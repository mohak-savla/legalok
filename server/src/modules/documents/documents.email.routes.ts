/**
 * Document email delivery — Zoho "merge and send" for a real document:
 * preview rendered email + optional PDF attachment, manual send trigger,
 * and the auto-send-on-generate hook.
 */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { config } from '../../config';
import { UserDocument, User, Template } from '../../db/entities';
import { asyncHandler, HttpError } from '../../utils/helpers';
import { authRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { renderEmailTemplate } from '../../services/mailer.service';
import { readObject } from '../../services/storage.service';
import { generatePdf } from '../../services/pdf.service';

export const documentEmailRouter = Router();
documentEmailRouter.use(authRequired);

async function loadOwnedDoc(userId: string, id: string): Promise<UserDocument> {
  const doc = await repo(UserDocument).findOne({ where: { id } });
  if (!doc || doc.userId !== userId || doc.deletedAt) throw new HttpError(404, 'Document not found');
  return doc;
}

/** Merge vars for a document delivery email. */
async function docVars(doc: UserDocument, owner: User): Promise<Record<string, string>> {
  return {
    user_name: owner.fullName,
    owner_name: owner.fullName,
    document_title: doc.title,
    document_number: doc.documentNumber ?? '',
    document_link: `${config.appUrl}/document/${doc.id}`,
    generated_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

async function docPdf(doc: UserDocument): Promise<{ filename: string; content: Buffer; contentType: string } | null> {
  try {
    if (!doc.generatedHtmlKey) return null;
    const html = readObject(doc.generatedHtmlKey).toString('utf8');
    const pdf = await generatePdf(html, doc.title);
    const safe = doc.title.replace(/[^\w\- ]+/g, '').trim() || 'document';
    return { filename: `${safe}.pdf`, content: pdf, contentType: 'application/pdf' };
  } catch (e) {
    console.error('[doc-email] pdf attach failed', e);
    return null;
  }
}

function publicDocEmailRouterGuard(req: { user?: AuthUser }): AuthUser {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user;
}

/** Preview the delivery email for this document (live "ensure what's being sent" view). */
documentEmailRouter.get(
  '/:id/email-preview',
  asyncHandler(async (req, res) => {
    const user = publicDocEmailRouterGuard(req);
    const doc = await loadOwnedDoc(user.id, String(req.params.id));
    const owner = user as unknown as User;
    const tpl = await repo(Template).findOne({ where: { id: doc.templateId } });
    const vars = await docVars(doc, owner);
    const rendered = await renderEmailTemplate('document-delivered', vars, {
      subject: tpl?.emailSubject ?? undefined,
      bodyHtml: tpl?.emailBody ?? undefined,
    });
    res.json({
      toEmail: owner.email, toName: owner.fullName, subject: rendered.subject, html: rendered.html,
      attachPdf: tpl?.attachPdf ?? true, smtpConfigured: Boolean(config.smtpUser), vars,
    });
  }),
);

/** Send the document by email (manual trigger) — uses the template's custom subject/body + PDF. */
documentEmailRouter.post(
  '/:id/send-email',
  asyncHandler(async (req, res) => {
    const user = publicDocEmailRouterGuard(req);
    const doc = await loadOwnedDoc(user.id, String(req.params.id));
    const toEmail = String(req.body?.toEmail ?? user.email).toLowerCase().trim();
    const toName = String(req.body?.toName ?? user.fullName);
    const attachPdf = req.body?.attachPdf !== false && ((await repo(Template).findOne({ where: { id: doc.templateId } }))?.attachPdf ?? true);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) throw new HttpError(400, 'A valid recipient email is required');

    const tpl = await repo(Template).findOne({ where: { id: doc.templateId } });
    const vars = { ...(await docVars(doc, user as unknown as User)), ...(req.body?.vars ?? {}) };
    const rendered = await renderEmailTemplate('document-delivered', vars, {
      subject: (req.body?.subject as string | undefined) ?? tpl?.emailSubject ?? undefined,
      bodyHtml: (req.body?.bodyHtml as string | undefined) ?? tpl?.emailBody ?? undefined,
    });
    const attachments = attachPdf ? ((await docPdf(doc)) ? [await docPdf(doc) as { filename: string; content: Buffer; contentType: string }] : []) : [];

    const { sendMail } = await import('../../services/mailer.service');
    await sendMail({ toEmail, toName, template: 'document-delivered', subject: rendered.subject, html: rendered.html, attachments, documentId: doc.id });
    await logAudit(req, {
      action: 'Document Sent by Email', actionCategory: 'document', resourceType: 'document', resourceId: doc.id,
      details: { toEmail, attachPdf: attachments.length > 0 },
    });
    res.json({ message: `Document emailed to ${toEmail}${attachments.length ? ' with PDF attached' : ''}` });
  }),
);
