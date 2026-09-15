/**
 * Email service — MVP implementation logs emails to console + `email_logs` table.
 * Swap-in point for Amazon SES: replace the `deliver()` body with an SES call;
 * everything else (logging, templates, links) stays identical.
 */
import { repo } from '../db/connection';
import { EmailLog } from '../db/entities';

export interface MailInput {
  toEmail: string;
  toName?: string | null;
  template: string;
  subject: string;
  body?: string;
  documentId?: string | null;
  signatureId?: string | null;
}

function deliver(input: MailInput): void {
  console.log('\n=================== [LEGALOK MAIL — logged, not sent] ===================');
  console.log(`To     : ${input.toEmail}`);
  console.log(`Subject: ${input.subject}`);
  if (input.body) console.log(input.body);
  console.log('=========================================================================\n');
}

export async function sendMail(input: MailInput): Promise<void> {
  try {
    deliver(input);
    const row = repo(EmailLog).create({
      toEmail: input.toEmail,
      toName: input.toName ?? null,
      template: input.template,
      subject: input.subject,
      body: input.body ?? null,
      documentId: input.documentId ?? null,
      signatureId: input.signatureId ?? null,
      status: 'sent',
    });
    await repo(EmailLog).save(row);
  } catch (e) {
    console.error('[mail] failed', e);
  }
}
