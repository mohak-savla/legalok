/** Owner (User A) signs own document (mounted at /api/documents) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { UserDocument, DocumentSignature } from '../../db/entities';
import { asyncHandler, HttpError, randomToken } from '../../utils/helpers';
import { authRequired } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { assertTransition } from '../../services/document.service';

export const selfSignRouter = Router();

selfSignRouter.post(
  '/:id/self-sign',
  authRequired,
  asyncHandler(async (req, res) => {
    const doc = await repo(UserDocument).findOne({ where: { id: String(req.params.id), userId: req.user!.id } });
    if (!doc) throw new HttpError(404, 'Document not found');
    if (!['generated', 'pending_signatures', 'partially_signed'].includes(doc.status)) {
      throw new HttpError(400, 'Document is not ready for signatures');
    }
    const { signatureType, signatureData } = req.body || {};
    if (!signatureData || String(signatureData).trim().length === 0) throw new HttpError(400, 'Please provide a signature');
    const type = signatureType === 'aadhaar' ? 'aadhaar' : 'click';

    let sig = await repo(DocumentSignature).findOne({ where: { documentId: doc.id, isOwner: true, userId: req.user!.id } });
    if (!sig) {
      sig = repo(DocumentSignature).create({
        documentId: doc.id, userId: req.user!.id, signerEmail: req.user!.email,
        signerName: req.user!.fullName, isOwner: true,
      });
    }
    sig.signatureType = type;
    sig.signatureData = String(signatureData);
    sig.signatureStatus = 'signed';
    sig.signedAt = new Date();
    sig.aadhaarReference = type === 'aadhaar' ? `CDAC-MOCK-${randomToken(6).toUpperCase()}` : null;
    await repo(DocumentSignature).save(sig);

    const all = await repo(DocumentSignature).find({ where: { documentId: doc.id } });
    const otherPending = all.filter((s) => !s.isOwner && s.signatureStatus !== 'signed').length;

    if (otherPending === 0 && doc.status !== 'fully_executed') {
      assertTransition(doc, 'fully_executed');
      doc.signedAt = new Date();
    } else if (doc.status === 'generated' || doc.status === 'pending_signatures') {
      assertTransition(doc, 'partially_signed');
    }
    await repo(UserDocument).save(doc);
    await logAudit(req, {
      action: 'Document Signed (Owner)', actionCategory: 'signature', resourceType: 'document',
      resourceId: doc.id, details: { type },
    });
    res.json({ signature: sig, status: doc.status, message: 'Document signed successfully!' });
  }),
);
