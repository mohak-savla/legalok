/**
 * Payments — Razorpay-shaped MVP. Order creation + HMAC signature verification
 * use the EXACT Razorpay algorithm; `mock-checkout` simulates the gateway JS
 * signing the payment. Swapping in the real Razorpay SDK later only replaces
 * `mock-checkout` (the browser SDK returns these same fields).
 */
import { Router } from 'express';
import crypto from 'crypto';
import { repo } from '../../db/connection';
import { PaymentTransaction, UserDocument, Template } from '../../db/entities';
import { config } from '../../config';
import { asyncHandler, HttpError, randomToken } from '../../utils/helpers';
import { authRequired } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { generateFinalDocument, assertTransition } from '../../services/document.service';

export const paymentsRouter = Router();
paymentsRouter.use(authRequired);

function razorpaySignature(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', config.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

async function loadOwnedDoc(userId: string, documentId: string): Promise<UserDocument> {
  const doc = await repo(UserDocument).findOne({ where: { id: documentId, userId } });
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

paymentsRouter.post(
  '/create-order',
  asyncHandler(async (req, res) => {
    const { documentId } = req.body || {};
    if (!documentId) throw new HttpError(400, 'documentId required');
    const doc = await loadOwnedDoc(req.user!.id, documentId);
    if (doc.status !== 'awaiting_payment') throw new HttpError(400, 'Document is not awaiting payment');
    const template = await repo(Template).findOne({ where: { id: doc.templateId } });
    if (!template || !template.isPaid) throw new HttpError(400, 'Template is not payable');

    const tx = repo(PaymentTransaction).create({
      userId: req.user!.id,
      documentId: doc.id,
      gatewayOrderId: `order_${randomToken(8)}`,
      amount: template.price,
      currency: 'INR',
      status: 'created',
    });
    await repo(PaymentTransaction).save(tx);
    await logAudit(req, {
      action: 'Payment Order Created', actionCategory: 'payment', resourceType: 'document', resourceId: doc.id,
      details: { orderId: tx.gatewayOrderId, amount: template.price },
    });
    res.status(201).json({
      orderId: tx.gatewayOrderId, amount: template.price, currency: 'INR',
      keyId: config.razorpayKeyId, documentId: doc.id,
    });
  }),
);

/** Simulated gateway checkout — stands in for the Razorpay browser SDK */
paymentsRouter.post(
  '/mock-checkout/:orderId',
  asyncHandler(async (req, res) => {
    const tx = await repo(PaymentTransaction).findOne({
      where: { gatewayOrderId: String(req.params.orderId), userId: req.user!.id },
    });
    if (!tx) throw new HttpError(404, 'Order not found');
    if (tx.status === 'captured') throw new HttpError(400, 'Payment already processed');
    const paymentId = `pay_${randomToken(8)}`;
    res.json({
      razorpay_order_id: tx.gatewayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: razorpaySignature(tx.gatewayOrderId, paymentId),
    });
  }),
);

paymentsRouter.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new HttpError(400, 'Missing payment verification fields');
    }
    const expected = razorpaySignature(String(razorpay_order_id), String(razorpay_payment_id));
    if (expected !== String(razorpay_signature)) {
      await logAudit(req, { action: 'Payment Verification Failed', actionCategory: 'payment', resourceType: 'payment', details: { orderId: razorpay_order_id } });
      throw new HttpError(400, 'Invalid payment signature');
    }
    const tx = await repo(PaymentTransaction).findOne({
      where: { gatewayOrderId: String(razorpay_order_id), userId: req.user!.id },
    });
    if (!tx) throw new HttpError(404, 'Order not found');
    if (tx.status === 'captured') {
      return res.json({ ok: true, documentId: tx.documentId, message: 'Payment already verified' });
    }

    tx.gatewayPaymentId = String(razorpay_payment_id);
    tx.status = 'captured';
    tx.method = 'mock_checkout';
    tx.completedAt = new Date();
    await repo(PaymentTransaction).save(tx);

    const doc = tx.documentId ? await repo(UserDocument).findOne({ where: { id: tx.documentId } }) : null;
    if (doc) {
      const template = await repo(Template).findOne({ where: { id: doc.templateId } });
      if (template) await generateFinalDocument(doc, template);
      assertTransition(doc, 'generated');
      doc.paymentStatus = 'paid';
      doc.paidAt = new Date();
      doc.paymentTransactionId = tx.id;
      doc.paymentAmount = tx.amount;
      await repo(UserDocument).save(doc);
    }

    await logAudit(req, {
      action: 'Payment Captured', actionCategory: 'payment', resourceType: 'document', resourceId: doc?.id ?? null,
      details: { orderId: tx.gatewayOrderId, paymentId: tx.gatewayPaymentId, amount: tx.amount },
    });
    res.json({ ok: true, documentId: doc?.id, message: 'Payment successful! Your document is being generated.' });
  }),
);

paymentsRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const txs = await repo(PaymentTransaction).find({
      where: { userId: req.user!.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    res.json({ transactions: txs });
  }),
);
