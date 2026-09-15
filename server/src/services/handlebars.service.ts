/**
 * Handlebars rendering engine — merge-field resolution + signature injection.
 * Conditional blocks are evaluated structurally by the shared document engine
 * (see src/engine) BEFORE Handlebars runs; Handlebars remains responsible for
 * {{merge_field}} resolution and legacy {{#if}} templates only.
 */
import Handlebars from 'handlebars';
import { QuestionField } from '../db/entities';
import { resolveDocument, stripEmptyMergeTokens } from '../engine/document-engine';

export const REDACTED_TOKEN = '__LEGALOK_REDACTED__';
export const REDACTED_CHIP = '<span class="murfed-chip" title="Unlocks after payment">🔒 ████████</span>';

/** Field types masked in the Murfed preview by default (names, addresses, money…) */
const SENSITIVE_BY_DEFAULT: Record<string, boolean> = {
  text: true, textarea: true, email: true, phone: true, number: true,
  date: true, file: true, signature: true,
  dropdown: false, radio: false, checkbox: false, heading: false,
};

export function isSensitive(field: QuestionField): boolean {
  return field.sensitive !== undefined ? !!field.sensitive : SENSITIVE_BY_DEFAULT[field.type] ?? true;
}

if (!('legalokHelpers' in (Handlebars as unknown as Record<string, unknown>))) {
  (Handlebars as unknown as Record<string, unknown>).legalokHelpers = true;

  Handlebars.registerHelper('money', (v: unknown) =>
    '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  Handlebars.registerHelper('date', (v: unknown) => {
    if (!v) return '';
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  });
  Handlebars.registerHelper('upper', (v: unknown) => String(v ?? '').toUpperCase());
  Handlebars.registerHelper('today', () =>
    new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper('neq', (a: unknown, b: unknown) => a !== b);
  Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
  Handlebars.registerHelper('default', (v: unknown, d: unknown) => (v === undefined || v === null || v === '' ? d : v));
}

/** Replace sensitive values with the redaction token (logic stays intact) */
export function murfyAnswers(fields: QuestionField[], answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  for (const f of fields || []) {
    if (!isSensitive(f)) continue;
    const v = out[f.key];
    if (v !== undefined && v !== null && v !== '') out[f.key] = REDACTED_TOKEN;
  }
  return out;
}


/** Signature dataURLs → visible images (skips already-wrapped ones) */
export function postProcessSignatures(html: string): string {
  return html.replace(/(?<!src=")data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+/=]{20,}/g, (m) =>
    `<img class="sig-img" src="${m}" alt="signature" />`);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface SignatureInjection {
  signerName: string;
  signerEmail: string;
  signatureType: string;
  signatureData: string | null;
  signedAt: Date | null;
}

/** One visible, dated signature block placed in the executed document. */
function signatureBlockHtml(s: SignatureInjection): string {
  const label = (s.signerName ?? '').trim() || s.signerEmail;
  const data = s.signatureData ?? '';
  let visual: string;
  if (/^data:image\/(?:png|jpe?g);base64,/i.test(data)) {
    visual = `<img class="sig-img" src="${data}" alt="signature" />`;
  } else if (/^https?:\/\/[^\s"]+/i.test(data)) {
    visual = `<img class="sig-img" src="${data}" alt="signature" />`;
  } else if (data.trim()) {
    // click / typed signature — rendered as a cursive name
    visual = `<div class="sig-typed">${escapeHtml(data)}</div>`;
  } else {
    visual = '';
  }
  const role = s.signatureType === 'aadhaar' ? 'Aadhaar e-Signed' : 'Digitally signed';
  const d = s.signedAt ? new Date(s.signedAt) : null;
  const dateStr = d && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return `<div class="sig-block">
  <div class="sig-label">${escapeHtml(label)} · ${role}${dateStr ? ` · ${dateStr}` : ''}</div>
  ${visual}
</div>`;
}

function initialsOf(name: string): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => (p[0] ?? '').toUpperCase()).join('');
}

function signedDateStr(s: SignatureInjection): string {
  const d = s.signedAt ? new Date(s.signedAt) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
}

/**
 * Inject every collected signature into the final document.
 * - `<div class="sig-slot">` (or data-kind="signature") → full dated signature blocks.
 * - data-kind="name" → signatory names · "date" → signing dates · "initials" → signer initials.
 * - No signatures collected yet → slots removed entirely.
 * - No slot present at all → appends an "Execution" section at the end.
 */
export function injectSignatures(html: string, signatures: SignatureInjection[]): string {
  const src = html || '';
  const signed = (signatures || []).filter((s) => s && !!s.signatureData);
  const slotRe = /<div class="sig-slot"[^>]*><\/div>/gi;
  if (signed.length === 0) return src.replace(slotRe, '');
  const blocks = signed.map(signatureBlockHtml).join('\n');
  const names = signed.map((s) => escapeHtml((s.signerName || '').trim() || s.signerEmail)).join(', ');
  const dates = signed.map((s) => `<span class="sig-date">${escapeHtml(signedDateStr(s))}</span>`).join(' ');
  const initials = signed
    .map((s) => `<span class="sig-initials">${escapeHtml(initialsOf((s.signerName || '').trim() || s.signerEmail))}</span>`)
    .join(' ');
  if (!/<div class="sig-slot"/i.test(src)) {
    return `${src}\n<div class="sig-execution">\n  <h2>Execution — Signatures</h2>\n  ${blocks}\n</div>`;
  }
  return src.replace(slotRe, (slot) => {
    const m = /data-kind="([a-z]+)"/i.exec(slot);
    const kind = m ? m[1] : 'signature';
    if (kind === 'name') return `<span class="sig-inline">${names}</span>`;
    if (kind === 'date') return `<span class="sig-inline">${dates}</span>`;
    if (kind === 'initials') return `<span class="sig-inline">${initials}</span>`;
    return blocks;
  });
}

export interface RenderOpts { fields?: QuestionField[]; murfed?: boolean }

function fieldTypesOf(fields?: QuestionField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields ?? []) map[f.key] = f.type;
  return map;
}

/**
 * Full pipeline (order matters):
 *  1. Structurally evaluate ConditionalBlocks against REAL answers — the
 *     selected branch body survives, everything else is discarded before any
 *     merge-field processing (unselected {{fields}} can never leak out).
 *  2. Optionally redact sensitive answers (Murfed) — conditions were already
 *     evaluated, so redaction can never change which branch is rendered.
 *  3. Handlebars resolves {{merge_fields}} and legacy raw {{#if}} templates.
 *  4. Signature dataURLs → visible images.
 */
export function renderDocument(
  templateHtml: string,
  answers: Record<string, unknown>,
  opts: RenderOpts = {},
): string {
  const fieldTypes = fieldTypesOf(opts.fields);
  const sensitiveKeys = opts.murfed && opts.fields
    ? new Set((opts.fields).filter((f) => f.sensitive).map((f) => f.key))
    : undefined;
  const resolved = stripEmptyMergeTokens(resolveDocument(templateHtml || '', answers ?? {}, { fieldTypes, sensitiveKeys }));
  const a = opts.murfed && opts.fields ? murfyAnswers(opts.fields, answers ?? {}) : (answers ?? {});
  const compiled = Handlebars.compile(resolved)(a);
  return postProcessSignatures(compiled);
}

export interface RenderedDocument {
  html: string;
  murfedHtml: string;
}

export function renderBoth(templateHtml: string, fields: QuestionField[], answers: Record<string, unknown>): RenderedDocument {
  return {
    html: renderDocument(templateHtml, answers, { fields }),
    murfedHtml: renderDocument(templateHtml, answers, { fields, murfed: true }),
  };
}
