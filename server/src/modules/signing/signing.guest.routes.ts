/** Public guest signing endpoints (mounted at /api/sign) — User B needs no account */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { UserDocument, DocumentSignature, Template, User } from '../../db/entities';
import { asyncHandler, HttpError, randomToken } from '../../utils/helpers';
import { logAudit } from '../../middleware/audit';
import { generateFinalDocument, recomputeAfterSignature } from '../../services/document.service';
import { readObject } from '../../services/storage.service';
import { injectSignatures } from '../../services/handlebars.service';

export const signGuestRouter = Router();

async function loadByToken(token: string): Promise<DocumentSignature> {
  const sig = await repo(DocumentSignature).findOne({ where: { signingToken: String(token) } });
  if (!sig) throw new HttpError(404, 'Invalid or expired signing link. Please contact the sender.');
  if (sig.tokenExpiresAt && sig.tokenExpiresAt < new Date()) {
    throw new HttpError(410, 'This signing link has expired. Please ask the sender to resend.');
  }
  return sig;
}

/** Guest fetches signing page data */
signGuestRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const sig = await loadByToken(req.params.token);
    if (sig.signatureStatus === 'signed') throw new HttpError(409, 'This document has already been signed.');
    const doc = await repo(UserDocument).findOne({ where: { id: sig.documentId } });
    if (!doc) throw new HttpError(404, 'Document not found');
    const template = await repo(Template).findOne({ where: { id: doc.templateId } });
    if (!template) throw new HttpError(404, 'Template not found');
    const owner = await repo(User).findOne({ where: { id: doc.userId } });

    let html = '';
    if (doc.generatedHtmlKey) {
      try { html = readObject(doc.generatedHtmlKey).toString('utf8'); } catch { html = ''; }
    }
    if (!html) {
      await generateFinalDocument(doc, template);
      await repo(UserDocument).save(doc);
      html = doc.generatedHtmlKey ? readObject(doc.generatedHtmlKey).toString('utf8') : '';
    }
    // Show any signatures already collected (e.g. the owner's) on the guest page.
    const allSigs = await repo(DocumentSignature).find({ where: { documentId: doc.id } });
    html = injectSignatures(html, allSigs.map((s) => ({
      signerName: s.signerName,
      signerEmail: s.signerEmail,
      signatureType: s.signatureType,
      signatureData: s.signatureData,
      signedAt: s.signedAt,
    })));
    if (!sig.viewedAt) {
      sig.viewedAt = new Date();
      if (sig.signatureStatus === 'sent') sig.signatureStatus = 'viewed';
      await repo(DocumentSignature).save(sig);
    }
    res.json({
      signing: {
        documentTitle: doc.title, documentNumber: doc.documentNumber,
        senderName: owner?.fullName ?? '', senderEmail: owner?.email ?? '',
        message: sig.message, signerName: sig.signerName, signerEmail: sig.signerEmail,
        expiresAt: sig.tokenExpiresAt,
      },
      documentHtml: html,
    });
  }),
);

/** Guest signs */
signGuestRouter.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const sig = await loadByToken(req.params.token);
    if (sig.signatureStatus === 'signed') throw new HttpError(409, 'Already signed');
    const { signerName, signatureType, signatureData, confirm } = req.body || {};
    if (confirm !== true) throw new HttpError(400, 'Please confirm this is your legal signature');
    if (!signatureData || String(signatureData).trim().length === 0) throw new HttpError(400, 'Please provide a signature');
    if (signerName && String(signerName).trim().length >= 2) sig.signerName = String(signerName).trim();

    const type = signatureType === 'aadhaar' ? 'aadhaar' : 'click';
    sig.signatureType = type;
    sig.signatureData = String(signatureData);
    sig.signatureStatus = 'signed';
    sig.signedAt = new Date();
    sig.aadhaarReference = type === 'aadhaar' ? `CDAC-MOCK-${randomToken(6).toUpperCase()}` : null;
    await repo(DocumentSignature).save(sig);

    const doc = await recomputeAfterSignature(sig.documentId);
    await logAudit(req, {
      action: 'Document Signed (Guest)', actionCategory: 'signature', resourceType: 'document', resourceId: sig.documentId,
      details: { signerEmail: sig.signerEmail, type },
    });
    res.json({ message: 'Document signed successfully! Thank you.', status: doc?.status ?? 'pending_signatures' });
  }),
);
