/** Admin: Template Studio CRUD (mounted at /api/admin/templates) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { Template, QuestionField } from '../../db/entities';
import { asyncHandler, HttpError, slugify } from '../../utils/helpers';
import { authRequired, adminRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { validateSchema } from './admin.template.utils';

export const adminTemplatesRouter = Router();
adminTemplatesRouter.use(authRequired, adminRequired);

adminTemplatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await repo(Template).find({ order: { createdAt: 'DESC' } });
    res.json({
      templates: rows.filter((t) => !t.deletedAt).map((t) => ({
        id: t.id, name: t.name, slug: t.slug, audience: t.audience, category: t.category,
        description: t.description, isPaid: t.isPaid, price: t.price, status: t.status,
        isActive: t.isActive, version: t.version, usageCount: t.usageCount,
        questionCount: (t.questionnaireSchema || []).length,
        createdAt: t.createdAt, publishedAt: t.publishedAt,
        questionnaireSchema: t.questionnaireSchema, documentHtml: t.documentHtml,
      })),
    });
  }),
);

adminTemplatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, category, audience, description, estimatedTimeMinutes, isPaid, price, questionnaireSchema, documentHtml } = req.body || {};
    if (!name || String(name).trim().length < 3) throw new HttpError(400, 'Template name must be at least 3 characters');
    validateSchema((questionnaireSchema || []) as QuestionField[]);
    if (isPaid && (!price || Number(price) <= 0)) throw new HttpError(400, 'Paid templates need a price > 0');

    let slug = slugify(String(name));
    while (await repo(Template).findOne({ where: { slug } })) slug = `${slugify(String(name))}-${Math.floor(Math.random() * 900 + 100)}`;

    const t = repo(Template).create({
      name: String(name).trim(), slug, category: String(category || 'Business'),
      audience: audience === 'personal' ? 'personal' : 'business',
      description: description ? String(description) : null,
      estimatedTimeMinutes: Number(estimatedTimeMinutes) || 10,
      isPaid: !!isPaid, price: isPaid ? Number(price) : 0,
      questionnaireSchema, documentHtml: String(documentHtml || ''),
      status: 'draft', createdBy: (req.user as AuthUser).id,
    });
    await repo(Template).save(t);
    await logAudit(req, { action: 'Template Created', actionCategory: 'template', resourceType: 'template', resourceId: t.id, details: { name: t.name } });
    res.status(201).json({ template: t });
  }),
);

adminTemplatesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const t = await repo(Template).findOne({ where: { id: String(req.params.id) } });
    if (!t || t.deletedAt) throw new HttpError(404, 'Template not found');
    const b = req.body || {};
    if (b.name !== undefined) t.name = String(b.name).trim();
    if (b.category !== undefined) t.category = String(b.category);
    if (b.audience !== undefined) t.audience = b.audience === 'personal' ? 'personal' : 'business';
    if (b.description !== undefined) t.description = b.description ? String(b.description) : null;
    if (b.estimatedTimeMinutes !== undefined) t.estimatedTimeMinutes = Number(b.estimatedTimeMinutes) || 10;
    if (b.isPaid !== undefined) t.isPaid = !!b.isPaid;
    if (b.price !== undefined) t.price = Number(b.price) || 0;
    if (b.questionnaireSchema !== undefined) {
      validateSchema(b.questionnaireSchema as QuestionField[]);
      t.questionnaireSchema = b.questionnaireSchema;
    }
    if (b.documentHtml !== undefined) t.documentHtml = String(b.documentHtml);
    if (b.isActive !== undefined) t.isActive = !!b.isActive;
    await repo(Template).save(t);
    await logAudit(req, { action: 'Template Updated', actionCategory: 'template', resourceType: 'template', resourceId: t.id, details: { name: t.name } });
    res.json({ template: t });
  }),
);

adminTemplatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const t = await repo(Template).findOne({ where: { id: String(req.params.id) } });
    if (!t) throw new HttpError(404, 'Template not found');
    t.deletedAt = new Date();
    t.isActive = false;
    await repo(Template).save(t);
    await logAudit(req, { action: 'Template Deleted', actionCategory: 'template', resourceType: 'template', resourceId: t.id, details: { name: t.name } });
    res.json({ message: 'Template deleted' });
  }),
);
