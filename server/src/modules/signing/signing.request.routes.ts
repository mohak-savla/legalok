/** Owner sends/resends guest signing requests (mounted at /api/documents) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { UserDocument, DocumentSignature, User } from '../../db/entities';
import { config } from '../../config';
import { asyncHandler, HttpError, randomToken } from '../../utils/helpers';
import { authRequired } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { sendMail } from '../../services/mailer.service';
import { assertTransition } from '../../services/document.service';

export const signingRequestRouter = Router();

async function loadOwnedDoc(userId: string, documentId: string): Promise<UserDocument> {
  const doc = await repo(UserDocument).findOne({ where: { id: documentId, userId } });
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

signingRequestRouter.post(
  '/:id/sign-requests',
  authRequired,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.user!.id, String(req.params.id));
    if (!['generated', 'pending_signatures', 'partially_signed'].includes(doc.status)) {
      throw new HttpError(400, 'Document is not ready for signatures');
    }
    const { signerEmail, signerName, message } = req.body || {};
    if (!signerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(signerEmail))) {
      throw new HttpError(400, 'Please enter a valid signer email');
    }
    if (!signerName || String(signerName).trim().length < 2) throw new HttpError(400, 'Signer name is required');

    const sig = repo(DocumentSignature).create({
      documentId: doc.id,
      signerEmail: String(signerEmail).toLowerCase().trim(),
      signerName: String(signerName).trim(),
      message: message ? String(message) : null,
      signatureStatus: 'sent',
      signingToken: randomToken(24),
      tokenExpiresAt: new Date(Date.now() + config.signingExpiryDays * 24 * 60 * 60 * 1000),
    });
    await repo(DocumentSignature).save(sig);

    if (doc.status === 'generated') {
      assertTransition(doc, 'pending_signatures');
      if (!doc.expiresAt) doc.expiresAt = new Date(Date.now() + config.signingExpiryDays * 24 * 60 * 60 * 1000);
      await repo(UserDocument).save(doc);
    }
    const owner = await repo(User).findOne({ where: { id: doc.userId } });
    await sendMail({
      toEmail: sig.signerEmail, toName: sig.signerName, template: 'signing-request',
      subject: `Signature request: ${doc.title}`, documentId: doc.id, signatureId: sig.id,
      body: `${owner?.fullName ?? 'Someone'} has requested your signature on: ${doc.title}\n\n${sig.message ? `Message: ${sig.message}\n\n` : ''}Sign here (valid ${config.signingExpiryDays} days): ${config.appUrl}/sign/${sig.signingToken}`,
    });
    await logAudit(req, {
      action: 'Signing Request Sent', actionCategory: 'signature', resourceType: 'document', resourceId: doc.id,
      details: { signerEmail: sig.signerEmail, signatureId: sig.id },
    });
    res.status(201).json({ signature: sig, message: `Signing request sent to ${sig.signerEmail}` });
  }),
);

signingRequestRouter.post(
  '/:id/sign-requests/:sigId/resend',
  authRequired,
  asyncHandler(async (req, res) => {
    const doc = await loadOwnedDoc(req.user!.id, String(req.params.id));
    const sig = await repo(DocumentSignature).findOne({ where: { id: String(req.params.sigId), documentId: doc.id } });
    if (!sig) throw new HttpError(404, 'Signature request not found');
    if (sig.signatureStatus === 'signed') throw new HttpError(400, 'This party has already signed');
    sig.signingToken = randomToken(24);
    sig.tokenExpiresAt = new Date(Date.now() + config.signingExpiryDays * 24 * 60 * 60 * 1000);
    sig.signatureStatus = 'sent';
    await repo(DocumentSignature).save(sig);
    await sendMail({
      toEmail: sig.signerEmail, toName: sig.signerName, template: 'signing-request-resend',
      subject: `Reminder: signature request for ${doc.title}`, documentId: doc.id, signatureId: sig.id,
      body: `New signing link (valid ${config.signingExpiryDays} days): ${config.appUrl}/sign/${sig.signingToken}`,
    });
    await logAudit(req, {
      action: 'Signing Request Resent', actionCategory: 'signature', resourceType: 'document', resourceId: doc.id,
      details: { signerEmail: sig.signerEmail },
    });
    res.json({ signature: sig, message: `Signing request resent to ${sig.signerEmail}` });
  }),
);
