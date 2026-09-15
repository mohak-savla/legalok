/** Admin: publish validation + sample-data preview (mounted at /api/admin/templates) */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { Template, TemplateVersion } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired, adminRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { renderBoth } from '../../services/handlebars.service';
import { extractReferencedKeys, buildSampleAnswers } from './admin.template.utils';

export const adminTemplateWorkflowRouter = Router();
adminTemplateWorkflowRouter.use(authRequired, adminRequired);

adminTemplateWorkflowRouter.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    const t = await repo(Template).findOne({ where: { id: String(req.params.id) } });
    if (!t || t.deletedAt) throw new HttpError(404, 'Template not found');
    if (!t.questionnaireSchema || t.questionnaireSchema.length === 0) throw new HttpError(400, 'Add at least one question before publishing');
    if (!t.documentHtml || !t.documentHtml.trim()) throw new HttpError(400, 'Document body is empty');
    if (t.isPaid && t.price <= 0) throw new HttpError(400, 'Paid templates need a price > 0');

    // Interlink check: every placeholder must map to a form field
    const fieldKeys = new Set((t.questionnaireSchema || []).map((f) => f.key));
    const missing = extractReferencedKeys(t.documentHtml).filter((k) => !fieldKeys.has(k));
    if (missing.length > 0) {
      throw new HttpError(400, `Document references unknown fields: ${missing.join(', ')}. Add them in the Form Builder or remove the placeholders.`);
    }

    const ver = repo(TemplateVersion).create({
      templateId: t.id, version: t.version,
      questionnaireSchema: t.questionnaireSchema, documentHtml: t.documentHtml,
      createdBy: (req.user as AuthUser).id,
    });
    await repo(TemplateVersion).save(ver);

    const firstPublish = t.status !== 'published';
    t.version += 1;
    t.status = 'published';
    t.isActive = true;
    if (!t.publishedAt || firstPublish) t.publishedAt = new Date();
    await repo(Template).save(t);
    await logAudit(req, {
      action: 'Template Published', actionCategory: 'template', resourceType: 'template', resourceId: t.id,
      details: { name: t.name, version: ver.version },
    });
    res.json({ template: t, message: `Template published (v${ver.version})` });
  }),
);

adminTemplateWorkflowRouter.post(
  '/:id/preview',
  asyncHandler(async (req, res) => {
    const t = await repo(Template).findOne({ where: { id: String(req.params.id) } });
    if (!t) throw new HttpError(404, 'Template not found');
    const given = (req.body && req.body.answers) || {};
    const answers = Object.keys(given).length > 0 ? given : buildSampleAnswers(t.questionnaireSchema);
    const out = renderBoth(t.documentHtml, t.questionnaireSchema, answers);
    res.json({ ...out, sampleAnswers: answers });
  }),
);

adminTemplateWorkflowRouter.get(
  '/:id/versions',
  asyncHandler(async (req, res) => {
    const t = await repo(Template).findOne({ where: { id: String(req.params.id) } });
    if (!t) throw new HttpError(404, 'Template not found');
    const versions = await repo(TemplateVersion).find({
      where: { templateId: t.id }, order: { version: 'DESC' },
    });
    res.json({ versions });
  }),
);
