/**
 * Email service — Zoho-style mail merge.
 *
 * 1. Admin-editable system templates live in the `email_templates` table
 *    (subject + HTML body with Handlebars merge fields). If a row is missing
 *    or untouched, a built-in default is used.
 * 2. `sendMail()` renders the template, wraps it in a branded shell, and
 *    delivers via SMTP (Brevo/SES/any) when SMTP_USER is configured —
 *    otherwise it logs to console (dev/mock mode). Every send is recorded
 *    in `email_logs` with status sent | logged | failed.
 */
import nodemailer, { Transporter } from 'nodemailer';
import Handlebars from 'handlebars';
import { repo } from '../db/connection';
import { EmailLog, EmailTemplate } from '../db/entities';
import { config } from '../config';

export interface MailVars {
  [key: string]: string | number | null | undefined;
}

export interface MailInput {
  toEmail: string;
  toName?: string | null;
  /** Template key — rendered with `vars` (merge fields) when subject/html not given. */
  template: string;
  /** Explicit override (skips DB template rendering). */
  subject?: string;
  body?: string;
  html?: string;
  vars?: MailVars;
  documentId?: string | null;
  signatureId?: string | null;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

const shell = (title: string, bodyHtml: string, cta?: { label: string; url: string }): string =>
  `<div style="font-family:Segoe UI,Arial,sans-serif;background:#F3F4F6;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB">
    <div style="background:#4F46E5;padding:18px 24px"><span style="color:#fff;font-size:20px;font-weight:800">&#9878;&#65039; Legalok</span></div>
    <div style="padding:28px 24px">
      <h2 style="margin:0 0 12px;color:#111827;font-size:18px">${title}</h2>
      <div style="color:#374151;font-size:14px;line-height:1.7">${bodyHtml}</div>
      ${cta ? `<div style="margin-top:22px"><a href="${cta.url}" style="background:#4F46E5;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:700;display:inline-block">${cta.label}</a></div>` : ''}
    </div>
    <div style="padding:14px 24px;background:#F9FAFB;color:#9CA3AF;font-size:11px">Sent by Legalok. If you weren't expecting this email, please ignore it.</div>
  </div>
</div>`;

const line = (s: string): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>');


/** Built-in defaults (exported for the admin Email Merge Studio). */
export const DEFAULTS: Record<string, { name: string; subject: string; bodyHtml: string; description: string }> = {
  'signing-request': {
    name: 'Signature Request',
    description: 'Sent automatically when a signing request is created (auto-sent).',
    subject: 'Signature request: {{document_title}}',
    bodyHtml: `<p>Hi {{signer_name}},</p>
<p><b>{{owner_name}}</b> has requested your signature on <b>{{document_title}}</b>{{#if document_number}} ({{document_number}}){{/if}}.</p>
{{#if message}}<p style="background:#F3F4F6;padding:10px 14px;border-radius:8px"><i>{{message}}</i></p>{{/if}}
<p>This link is valid for {{expiry_days}} days.</p>`,
  },
  'signing-request-resend': {
    name: 'Signature Request Reminder',
    description: 'Resent signing request (manual reminder from the document page).',
    subject: 'Reminder: signature request for {{document_title}}',
    bodyHtml: `<p>Hi {{signer_name}},</p>
<p>A gentle reminder — <b>{{owner_name}}</b> is still waiting for your signature on <b>{{document_title}}</b>.</p>
<p>This link is valid for {{expiry_days}} days.</p>`,
  },
  'document-delivered': {
    name: 'Document Delivered',
    description: 'Sent when a drafted document is delivered to a client (auto or manual, with optional PDF).',
    subject: 'Your document: {{document_title}}',
    bodyHtml: `<p>Hi {{user_name}},</p>
<p>Please find your document <b>{{document_title}}</b>{{#if document_number}} ({{document_number}}){{/if}} attached, or open it in your Legalok dashboard.</p>
<p>Generated on {{generated_date}}.</p>`,
  },
  'document-completed': {
    name: 'Document Fully Signed',
    description: 'Sent to the document owner when the last required signature is collected.',
    subject: '\u2705 {{document_title}} has been fully signed',
    bodyHtml: `<p>Good news!</p>
<p><b>{{signer_name}}</b> ({{signer_email}}) has signed <b>{{document_title}}</b>{{#if document_number}} ({{document_number}}){{/if}}. All signatures are complete and the final document is ready to download.</p>`,
  },
  welcome: {
    name: 'Welcome Email',
    description: 'Sent when a new account is registered.',
    subject: 'Welcome to Legalok \uD83C\uDF89',
    bodyHtml: `<p>Hi {{name}},</p><p>Your Legalok account is ready. Create professional legal documents in minutes — start from a template and answer a few questions.</p>`,
  },
  'reset-password': {
    name: 'Password Reset',
    description: 'Sent when a password reset is requested (valid 30 minutes).',
    subject: 'Reset your Legalok password',
    bodyHtml: `<p>Hi {{name}},</p><p>Click the button below to choose a new password. The link expires in 30 minutes.</p>`,
  },
};

/** Public helper for the admin editor: which merge fields each template supports. */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  'signing-request': ['signer_name', 'signer_email', 'owner_name', 'document_title', 'document_number', 'signing_link', 'expiry_days', 'message'],
  'signing-request-resend': ['signer_name', 'signer_email', 'owner_name', 'document_title', 'document_number', 'signing_link', 'expiry_days'],
  'document-delivered': ['user_name', 'owner_name', 'document_title', 'document_number', 'document_link', 'generated_date'],
  'document-completed': ['signer_name', 'signer_email', 'owner_name', 'document_title', 'document_number', 'document_link'],
  welcome: ['name'],
  'reset-password': ['name', 'reset_link'],
};

async function loadTemplate(key: string): Promise<{ subject: string; bodyHtml: string; isEnabled: boolean }> {
  const def = DEFAULTS[key] ?? { name: key, subject: 'Legalok notification', bodyHtml: '{{body}}', description: '' };
  try {
    const row = await repo(EmailTemplate).findOne({ where: { key } });
    if (row) return { subject: row.subject, bodyHtml: row.bodyHtml, isEnabled: row.isEnabled };
  } catch (e) {
    console.error('[mail] template load failed, using default', e);
  }
  return { subject: def.subject, bodyHtml: def.bodyHtml, isEnabled: true };
}

/** Render a system template with merge vars -> { subject, html } (no sending). */
export async function renderEmailTemplate(
  key: string,
  vars: MailVars,
  overrides?: { subject?: string; bodyHtml?: string },
): Promise<{ subject: string; html: string; isEnabled: boolean }> {
  const tpl = await loadTemplate(key);
  const subjectSrc = overrides?.subject ?? tpl.subject;
  const bodySrc = overrides?.bodyHtml ?? tpl.bodyHtml;
  const subject = Handlebars.compile(subjectSrc, { noEscape: true })(vars);
  const inner = Handlebars.compile(bodySrc)(vars);
  const ctaUrl = String(vars.signing_link ?? vars.document_link ?? '');
  const ctaLabel = vars.signing_link ? 'Review & Sign' : vars.document_link ? 'Open Document' : '';
  const html = shell(String(vars.document_title ?? vars.name ?? 'Notification'), inner, ctaUrl && ctaLabel ? { label: ctaLabel, url: ctaUrl } : undefined);
  return { subject, html, isEnabled: tpl.isEnabled };
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!config.smtpUser) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

function logDelivery(input: MailInput, status: 'sent' | 'logged' | 'failed', renderedSubject: string, renderedHtml: string): void {
  void repo(EmailLog)
    .save(
      repo(EmailLog).create({
        toEmail: input.toEmail,
        toName: input.toName ?? null,
        template: input.template,
        subject: renderedSubject,
        body: renderedHtml,
        documentId: input.documentId ?? null,
        signatureId: input.signatureId ?? null,
        status,
      }),
    )
    .catch((e) => console.error('[mail] log failed', e));
}

export async function sendMail(input: MailInput): Promise<void> {
  try {
    const rendered = await renderEmailTemplate(input.template, input.vars ?? {}, {
      subject: input.subject,
      bodyHtml: input.html ?? (input.body ? line(input.body) : undefined),
    });
    const t = getTransporter();
    if (t && rendered.isEnabled) {
      await t.sendMail({
        from: config.emailFrom,
        to: input.toName ? `${input.toName} <${input.toEmail}>` : input.toEmail,
        subject: rendered.subject,
        html: rendered.html,
        attachments: input.attachments,
      });
      console.log(`[mail] sent -> ${input.toEmail} (${input.template})`);
      logDelivery(input, 'sent', rendered.subject, rendered.html);
    } else {
      console.log(`\n=== [LEGALOK MAIL — ${rendered.isEnabled ? 'logged' : 'template disabled'}, not sent] ===`);
      console.log(`To     : ${input.toEmail}\nSubject: ${rendered.subject}`);
      logDelivery(input, rendered.isEnabled ? 'logged' : 'failed', rendered.subject, rendered.html);
    }
  } catch (e) {
    console.error('[mail] failed', e);
    try {
      logDelivery(input, 'failed', input.subject ?? input.template, input.html ?? input.body ?? '');
    } catch { /* ignore */ }
  }
}

