/**
 * Document email delivery — Zoho "merge and send" for a real document:
 * preview rendered email + optional PDF attachment, manual send trigger,
 * and the auto-send-on-generate hook.
 */
import { Router } from 'express';
import { repo } from '../../db/connection';
import { config } from '../../config';
import { UserDocument, User, Template } from '../../db/entities';
import { asyncHandler, HttpError, isUuid } from '../../utils/helpers';
import { authRequired, AuthUser } from '../../middleware/auth';
import { logAudit } from '../../middleware/audit';
import { renderEmailTemplate } from '../../services/mailer.service';
import { readObject } from '../../services/storage.service';
import { generatePdf } from '../../services/pdf.service';

export const documentEmailRouter = Router();
documentEmailRouter.use(authRequired);

async function loadOwnedDoc(userId: string, id: string, allowAdmin = false): Promise<UserDocument> {
  if (!isUuid(id)) throw new HttpError(404, 'Document not found');
  const doc = await repo(UserDocument).findOne({ where: { id } });
  if (!doc || doc.deletedAt) throw new HttpError(404, 'Document not found');
  const isOwner = doc.userId === userId;
  if (!isOwner && !allowAdmin) throw new HttpError(404, 'Document not found');
  return doc;
}

/** True for admin accounts (may preview/send any document, like GET /documents/:id). */
function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin';
}

/** Resolve the document owner row (merge vars must describe the owner, not the viewer). */
async function docOwner(doc: UserDocument, viewer: AuthUser): Promise<User> {
  const owner = await repo(User).findOne({ where: { id: doc.userId } });
  if (owner) return owner;
  return viewer as unknown as User;
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
    const doc = await loadOwnedDoc(user.id, String(req.params.id), isAdmin(user));
    const owner = await docOwner(doc, user);
    const toEmail = String(req.query.to ?? '').trim() || owner.email;
    const tpl = await repo(Template).findOne({ where: { id: doc.templateId } });
    const vars = await docVars(doc, owner);
    const rendered = await renderEmailTemplate('document-delivered', vars, {
      subject: tpl?.emailSubject ?? undefined,
      bodyHtml: tpl?.emailBody ?? undefined,
    });
    res.json({
      toEmail, toName: owner.fullName, subject: rendered.subject, html: rendered.html,
      attachPdf: tpl?.attachPdf ?? true, smtpConfigured: Boolean(config.smtpUser), vars,
    });
  }),
);

/** Send the document by email (manual trigger) — uses the template's custom subject/body + PDF. */
documentEmailRouter.post(
  '/:id/send-email',
  asyncHandler(async (req, res) => {
    const user = publicDocEmailRouterGuard(req);
    const doc = await loadOwnedDoc(user.id, String(req.params.id), isAdmin(user));
    const owner = await docOwner(doc, user);
    const toEmail = String(req.body?.toEmail ?? owner.email).toLowerCase().trim();
    const toName = String(req.body?.toName ?? owner.fullName);
    const tpl = await repo(Template).findOne({ where: { id: doc.templateId } });
    const attachPdf = req.body?.attachPdf !== false && (tpl?.attachPdf ?? true);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) throw new HttpError(400, 'A valid recipient email is required');

    const vars = { ...(await docVars(doc, owner)), ...(req.body?.vars ?? {}) };
    const rendered = await renderEmailTemplate('document-delivered', vars, {
      subject: (req.body?.subject as string | undefined) ?? tpl?.emailSubject ?? undefined,
      bodyHtml: (req.body?.bodyHtml as string | undefined) ?? tpl?.emailBody ?? undefined,
    });
    // Render the PDF attachment once (was rendered twice per send).
    const pdf = attachPdf ? await docPdf(doc) : null;
    const attachments = pdf ? [pdf] : [];

    const { sendMail } = await import('../../services/mailer.service');
    await sendMail({ toEmail, toName, template: 'document-delivered', subject: rendered.subject, html: rendered.html, attachments, documentId: doc.id });
    await logAudit(req, {
      action: 'Document Sent by Email', actionCategory: 'document', resourceType: 'document', resourceId: doc.id,
      details: { toEmail, attachPdf: attachments.length > 0 },
    });
    res.json({ message: `Document emailed to ${toEmail}${attachments.length ? ' with PDF attached' : ''}` });
  }),
);
