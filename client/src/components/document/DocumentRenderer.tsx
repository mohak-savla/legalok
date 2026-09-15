import { useMemo } from 'react';
import Handlebars from 'handlebars';
import { resolveDocument, conditionFieldKeysInHtml, repeatItemVars, stripEmptyMergeTokens } from '@engine/document-engine';
import type { QuestionField } from '../../types';

export const REDACTED = '__LEGALOK_REDACTED__';
const CHIP = '<span class="murfed-chip" title="Unlocks after payment">🔒 ████████</span>';

const SENSITIVE_BY_DEFAULT: Record<string, boolean> = {
  text: true, textarea: true, email: true, phone: true, number: true,
  date: true, file: true, signature: true,
  dropdown: false, radio: false, checkbox: false, heading: false,
};

export function isSensitiveField(f: QuestionField): boolean {
  return f.sensitive !== undefined ? !!f.sensitive : SENSITIVE_BY_DEFAULT[f.type] ?? true;
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

/** Mask sensitive values for the Murfed preview — conditional logic stays intact */
export function murfyAnswers(fields: QuestionField[], answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };
  for (const f of fields || []) {
    if (!isSensitiveField(f)) continue;
    const v = out[f.key];
    if (v !== undefined && v !== null && v !== '') out[f.key] = REDACTED;
  }
  return out;
}


const HELPER_KEYS = new Set(['if', 'else', 'this', 'each', 'unless', 'with', 'money', 'date', 'upper', 'today', 'eq', 'neq', 'or', 'default']);

/** All field keys referenced by a document body (placeholders, helpers, condition rules) */
export function extractReferencedKeys(html: string): string[] {
  const keys = new Set<string>();
  const patterns: RegExp[] = [
    /\{\{#if\s+([a-zA-Z0-9_]+)/g, /\{\{#unless\s+([a-zA-Z0-9_]+)/g,
    /\{\{(?:money|date|upper|default)\s+([a-zA-Z0-9_]+)/g,
    /\(\s*(?:eq|neq|or)\s+([a-zA-Z0-9_]+)/g,
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    /data-field="([a-zA-Z0-9_]*)"/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) keys.add(m[1]);
  }
  // v2 + legacy ConditionalBlock rule fields (inside data-when JSON / legacy attrs)
  for (const k of conditionFieldKeysInHtml(html || '')) keys.add(k);
  return [...keys].filter((k) => !HELPER_KEYS.has(k));
}

function postProcessSignatures(html: string): string {
  return html
    .replace(/<div class="sig-slot"[^>]*><\/div>/gi, '')
    .replace(/(?<!src=")data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+/=]{20,}/g, (m) =>
      `<img class="sig-img" src="${m}" alt="signature" />`);
}

interface Props {
  html: string;
  fields?: QuestionField[];
  answers?: Record<string, unknown>;
  murfed?: boolean;
}

/** Renders final, clean document: conditionals resolved, answers injected, signatures visible */
export default function DocumentRenderer({ html, fields = [], answers = {}, murfed = false }: Props): JSX.Element {
  const out = useMemo(() => {
    try {
      // 1) Structural conditional evaluation against REAL answers (unselected
      //    branches are discarded before any merge-field processing).
      const fieldTypes: Record<string, string> = {};
      for (const f of fields) fieldTypes[f.key] = f.type;
      const sensitiveKeys = murfed ? new Set(fields.filter((f) => f.sensitive).map((f) => f.key)) : undefined;
      const resolved = stripEmptyMergeTokens(resolveDocument(html || '', answers ?? {}, { fieldTypes, sensitiveKeys }));
      // 2) Redaction (Murfed) then 3) Handlebars merge-field resolution.
      const a = murfed ? murfyAnswers(fields, answers) : answers;
      const compiled = Handlebars.compile(resolved)(a ?? {});
      return postProcessSignatures(murfed ? compiled.split(REDACTED).join(CHIP) : compiled);
    } catch (e) {
      return `<p style="color:#EF4444;font-family:Inter,sans-serif">Preview error: ${(e as Error).message}</p>`;
    }
  }, [html, fields, answers, murfed]);
  return <div className="doc-page" dangerouslySetInnerHTML={{ __html: out }} />;
}
