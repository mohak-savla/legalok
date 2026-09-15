/** End-user documents — core CRUD (mounted at /api/documents) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { UserDocument, Template, DocumentSignature, DocStatus } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';

export const documentsRouter = Router();
documentsRouter.use(authRequired);

export async function loadOwned(userId: string, id: string, allowAdmin = false): Promise<UserDocument> {
  let doc = await repo(UserDocument).findOne({ where: { id, userId } });
  if (!doc && allowAdmin) doc = (await repo(UserDocument).findOne({ where: { id } })) ?? null;
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

documentsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { templateId, title } = req.body || {};
    const template = await repo(Template).findOne({ where: { id: String(templateId || '') } });
    if (!template || template.status !== 'published' || template.deletedAt) throw new HttpError(404, 'Template not found');
    const doc = repo(UserDocument).create({
      userId: req.user!.id, templateId: template.id,
      title: title ? String(title) : template.name,
      status: 'draft' as DocStatus, userAnswers: {},
    });
    await repo(UserDocument).save(doc);
    await logAudit(req, {
      action: 'Document Started', actionCategory: 'document', resourceType: 'document',
      resourceId: doc.id, details: { template: template.name },
    });
    res.status(201).json({ document: doc });
  }),
);

documentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, q, sort, limit } = req.query as Record<string, string | undefined>;
    const docs = await repo(UserDocument).find({ where: { userId: req.user!.id }, order: { createdAt: 'DESC' } });
    const templates = await repo(Template).find();
    const tmap = new Map(templates.map((t) => [t.id, t]));
    let rows = docs.filter((d) => !d.deletedAt);
    if (status && status !== 'all') rows = rows.filter((d) => d.status === status);
    if (q) rows = rows.filter((d) => d.title.toLowerCase().includes(String(q).toLowerCase()));
    if (sort === 'oldest') rows = [...rows].reverse();
    if (sort === 'az') rows = [...rows].sort((a, b) => a.title.localeCompare(b.title));
    const lim = Math.min(parseInt(limit || '100', 10) || 100, 200);
    res.json({
      documents: rows.slice(0, lim).map((d) => ({
        id: d.id, title: d.title, status: d.status, documentNumber: d.documentNumber,
        paymentStatus: d.paymentStatus, templateName: tmap.get(d.templateId)?.name ?? '',
        createdAt: d.createdAt, updatedAt: d.updatedAt, expiresAt: d.expiresAt, signedAt: d.signedAt,
      })),
      total: rows.length,
    });
  }),
);

documentsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const docs = await repo(UserDocument).find({ where: { userId: req.user!.id } });
    const stats: Record<string, number> = { total: docs.length };
    for (const d of docs) stats[d.status] = (stats[d.status] || 0) + 1;
    res.json({ stats });
  }),
);

documentsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await loadOwned(req.user!.id, String(req.params.id), true);
    const template = await repo(Template).findOne({ where: { id: doc.templateId } });
    if (!template) throw new HttpError(404, 'Template not found');
    const signatures = await repo(DocumentSignature).find({ where: { documentId: doc.id }, order: { createdAt: 'ASC' } });
    res.json({
      document: {
        id: doc.id, title: doc.title, status: doc.status, documentNumber: doc.documentNumber,
        userAnswers: doc.userAnswers, currentStep: doc.currentStep, paymentStatus: doc.paymentStatus,
        paymentAmount: doc.paymentAmount, paidAt: doc.paidAt, expiresAt: doc.expiresAt,
        signedAt: doc.signedAt, createdAt: doc.createdAt, updatedAt: doc.updatedAt, templateId: doc.templateId,
        template: {
          id: template.id, name: template.name, category: template.category, audience: template.audience,
          isPaid: template.isPaid, price: template.price,
          questionnaireSchema: template.questionnaireSchema, documentHtml: template.documentHtml,
        },
        signatures,
      },
    });
  }),
);

/** Auto-save answers (fires on "Next" + debounced typing) */
documentsRouter.put(
  '/:id/answers',
  asyncHandler(async (req, res) => {
    const doc = await loadOwned(req.user!.id, String(req.params.id));
    if (doc.status !== 'draft') throw new HttpError(400, 'Answers can only be edited while in Draft');
    const { answers, currentStep } = req.body || {};
    if (answers !== undefined) doc.userAnswers = answers;
    if (typeof currentStep === 'number') doc.currentStep = currentStep;
    await repo(UserDocument).save(doc);
    res.json({ document: { id: doc.id, userAnswers: doc.userAnswers, currentStep: doc.currentStep }, savedAt: new Date().toISOString() });
  }),
);
