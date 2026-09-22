/**
 * Admin: Email Merge Studio (Zoho Writer "Merge and Send Email" style)
 * Mounted at /api/admin/emails — manage system email templates with merge fields,
 * preview rendered output, and send test emails.
 */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { EmailTemplate } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired, adminRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { renderEmailTemplate, TEMPLATE_VARIABLES, DEFAULTS, SAMPLE_VARS, MailVars } from '../../services/mailer.service';

export const adminEmailsRouter = Router();
adminEmailsRouter.use(authRequired, adminRequired);

const KEYS = Object.keys(DEFAULTS);

/** All system templates with their DB override (or the built-in default). */
adminEmailsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await repo(EmailTemplate).find();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    res.json({
      smtpConfigured: Boolean((await import('../../config')).config.smtpUser),
      templates: KEYS.map((key) => {
        const row = byKey.get(key);
        const def = DEFAULTS[key];
        return {
          key,
          name: def.name,
          description: def.description,
          variables: TEMPLATE_VARIABLES[key] ?? [],
          subject: row?.subject ?? def.subject,
          bodyHtml: row?.bodyHtml ?? def.bodyHtml,
          isEnabled: row?.isEnabled ?? true,
          isCustomized: Boolean(row),
        };
      }),
    });
  }),
);

/** Update a template (creates the DB override row on first save). */
adminEmailsRouter.put(
  '/:key',
  asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    if (!KEYS.includes(key)) throw new HttpError(404, 'Unknown email template');
    const { subject, bodyHtml, isEnabled } = req.body as { subject?: string; bodyHtml?: string; isEnabled?: boolean };
    if (subject !== undefined && String(subject).trim().length === 0) throw new HttpError(400, 'Subject is required');
    if (bodyHtml !== undefined && String(bodyHtml).trim().length === 0) throw new HttpError(400, 'Body is required');
    let row = await repo(EmailTemplate).findOne({ where: { key } });
    if (!row) {
      const def = DEFAULTS[key];
      row = repo(EmailTemplate).create({
        key, name: def.name, subject: def.subject, bodyHtml: def.bodyHtml, isEnabled: true,
      });
    }
    if (subject !== undefined) row.subject = String(subject);
    if (bodyHtml !== undefined) row.bodyHtml = String(bodyHtml);
    if (isEnabled !== undefined) row.isEnabled = Boolean(isEnabled);
    row.updatedBy = (req as unknown as { user: AuthUser }).user.id;
    await repo(EmailTemplate).save(row);
    await logAudit(req, { action: 'Email Template Updated', actionCategory: 'admin', resourceType: 'email_template', resourceId: key });
    res.json({ message: 'Email template saved', template: { key: row.key, subject: row.subject, bodyHtml: row.bodyHtml, isEnabled: row.isEnabled } });
  }),
);

/** Reset a template to the built-in default. */
adminEmailsRouter.delete(
  '/:key',
  asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    await repo(EmailTemplate).delete({ key });
    await logAudit(req, { action: 'Email Template Reset', actionCategory: 'admin', resourceType: 'email_template', resourceId: key });
    const def = DEFAULTS[key];
    res.json({ message: 'Reset to default', template: def ? { key, subject: def.subject, bodyHtml: def.bodyHtml, isEnabled: true } : null });
  }),
);

/** Preview: render a template with sample merge data (live preview / "ensure what's sent"). */
adminEmailsRouter.post(
  '/:key/preview',
  asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    if (!KEYS.includes(key)) throw new HttpError(404, 'Unknown email template');
    const vars = { ...SAMPLE_VARS, ...((req.body?.vars ?? {}) as Record<string, string>) };
    const overrides = {
      subject: (req.body?.subject as string | undefined) ?? undefined,
      bodyHtml: (req.body?.bodyHtml as string | undefined) ?? undefined,
    };
    const rendered = await renderEmailTemplate(key, vars, overrides);
    res.json(rendered);
  }),
);

/** Send a test email to the admin's own address. */
adminEmailsRouter.post(
  '/:key/test',
  asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    if (!KEYS.includes(key)) throw new HttpError(404, 'Unknown email template');
    const user = (req as unknown as { user: AuthUser & { email: string; fullName: string } }).user;
    const { sendMail } = await import('../../services/mailer.service');
    // Sample data first (so nothing renders blank), then real values override.
    const vars: MailVars = { ...SAMPLE_VARS, name: user.fullName, ...((req.body?.vars ?? {}) as Record<string, string>) };
    await sendMail({
      toEmail: user.email, toName: user.fullName, template: key,
      vars,
      subject: req.body?.subject, html: req.body?.bodyHtml,
      attachments: req.body?.attachPdf && req.body?.pdfBase64
        ? [{ filename: `${String(vars.document_title ?? 'document')}.pdf`, content: Buffer.from(String(req.body.pdfBase64), 'base64'), contentType: 'application/pdf' }]
        : undefined,
    });
    await logAudit(req, { action: 'Email Test Sent', actionCategory: 'admin', resourceType: 'email_template', resourceId: key });
    res.json({ message: `Test email sent to ${user.email}` });
  }),
);
