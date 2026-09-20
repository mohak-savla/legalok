/**
 * Document domain service — lifecycle state machine, generation, signature rollup.
 */
import { repo } from '../db/connection';
import { UserDocument, DocumentSignature, Template, DocStatus, VALID_TRANSITIONS } from '../db/entities';
import { renderDocument } from './handlebars.service';
import { saveObject } from './storage.service';
import { HttpError } from '../utils/helpers';

export async function nextDocumentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await repo(UserDocument).count();
  let n = count + 1;
  let num = `LEG-${year}-${String(n).padStart(4, '0')}`;
  // guard against unique collisions (deletes, races)
  while (await repo(UserDocument).findOne({ where: { documentNumber: num } })) {
    n += 1;
    num = `LEG-${year}-${String(n).padStart(4, '0')}`;
  }
  return num;
}

export function assertTransition(doc: UserDocument, next: DocStatus): void {
  const allowed = VALID_TRANSITIONS[doc.status] ?? [];
  if (!allowed.includes(next)) {
    throw new HttpError(400, `Invalid status transition: ${doc.status} → ${next}`);
  }
  doc.status = next;
}

/** Render final HTML with real answers and persist to object storage */
export async function generateFinalDocument(doc: UserDocument, template: Template): Promise<string> {
  const html = renderDocument(template.documentHtml, doc.userAnswers ?? {}, { fields: template.questionnaireSchema });
  const key = `documents/${doc.id}/v${Date.now()}.html`;
  saveObject(key, html);
  doc.generatedHtmlKey = key;
  if (!doc.documentNumber) doc.documentNumber = await nextDocumentNumber();
  return key;
}

/**
 * Recompute document status after a signature change.
 * Rules: all signatures collected → fully_executed; owner signed → partially_signed;
 * first pending signer sent → pending_signatures.
 */
export async function recomputeAfterSignature(documentId: string): Promise<UserDocument | null> {
  const doc = await repo(UserDocument).findOne({ where: { id: documentId } });
  if (!doc) return null;
  const sigs = await repo(DocumentSignature).find({ where: { documentId } });
  if (sigs.length === 0) return doc;

  const allSigned = sigs.every((s) => s.signatureStatus === 'signed');
  const ownerSigned = sigs.some((s) => s.isOwner && s.signatureStatus === 'signed');
  const hasPendingRequest = sigs.some((s) => !s.isOwner && s.signatureStatus !== 'signed');

  if (allSigned) {
    assertTransition(doc, 'fully_executed');
    doc.signedAt = new Date();
  } else if (ownerSigned) {
    assertTransition(doc, 'partially_signed');
  } else if (hasPendingRequest && doc.status === 'generated') {
    assertTransition(doc, 'pending_signatures');
  }
  await repo(UserDocument).save(doc);
  return doc;
}

/** Expire overdue documents + signing tokens (called on an interval) */
export async function runExpiryJob(): Promise<void> {
  const now = new Date();
  const docRepo = repo(UserDocument);
  const overdue = await docRepo
    .createQueryBuilder()
    .where('status IN (:...st) AND "expiresAt" IS NOT NULL AND "expiresAt" < :now', {
      st: ['awaiting_payment', 'pending_signatures', 'partially_signed'],
      now,
    })
    .getMany();
  for (const d of overdue) {
    d.status = 'expired';
    await docRepo.save(d);
  }
  if (overdue.length) console.log(`[expiry] expired ${overdue.length} document(s)`);

  const sigRepo = repo(DocumentSignature);
  const stale = await sigRepo
    .createQueryBuilder()
    .where("\"signatureStatus\" IN ('pending','sent','viewed') AND \"tokenExpiresAt\" IS NOT NULL AND \"tokenExpiresAt\" < :now", { now })
    .getMany();
  for (const s of stale) {
    s.signatureStatus = 'expired';
    await sigRepo.save(s);
  }
}
