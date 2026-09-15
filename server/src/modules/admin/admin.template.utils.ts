/** Shared helpers for the Admin Template Studio backend */
import { QuestionField } from '../../db/entities';
import { HttpError } from '../../utils/helpers';
import { conditionFieldKeysInHtml, repeatItemVars } from '../../engine/document-engine';

const HELPER_KEYS = new Set(['if', 'else', 'this', 'each', 'unless', 'with', 'money', 'date', 'upper', 'today', 'eq', 'neq', 'or', 'default']);

/** All form fields referenced by a document body: {{placeholders}} AND condition rules */
export function extractReferencedKeys(html: string): string[] {
  const keys = new Set<string>();
  const patterns: RegExp[] = [
    /\{\{#if\s+([a-zA-Z0-9_]+)/g,
    /\{\{#unless\s+([a-zA-Z0-9_]+)/g,
    /\{\{(?:money|date|upper|default)\s+([a-zA-Z0-9_]+)/g,
    /\(\s*(?:eq|neq|or)\s+([a-zA-Z0-9_]+)/g,
    /\{\{\s*([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s*\}\}/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) keys.add(m[1]);
  }
  // v2 + legacy ConditionalBlock rule fields (inside data-when JSON / legacy attrs)
  for (const k of conditionFieldKeysInHtml(html || '')) keys.add(k);
  // `{{item}}` / `{{item.sub}}` inside repeat blocks are loop-local, not form fields
  const vars = repeatItemVars(html || '');
  return [...keys].filter((k) => !HELPER_KEYS.has(k) && !vars.has(k) && !(k.includes('.') && vars.has(k.split('.')[0])));
}

/** Throws 400 when the questionnaire schema is invalid */
export function validateSchema(schema: QuestionField[]): void {
  if (!Array.isArray(schema) || schema.length === 0) throw new HttpError(400, 'Add at least one question');
  const seen = new Set<string>();
  for (const f of schema) {
    if (!f.key || !/^[a-z][a-z0-9_]*$/.test(f.key)) throw new HttpError(400, `Invalid field key "${f.key}" (use lower_snake_case)`);
    if (seen.has(f.key)) throw new HttpError(400, `Duplicate field key "${f.key}"`);
    seen.add(f.key);
    if (!f.label || !String(f.label).trim()) throw new HttpError(400, `Field "${f.key}" needs a label`);
    if (['dropdown', 'radio', 'checkbox'].includes(f.type) && (!f.options || f.options.length < 2)) {
      throw new HttpError(400, `Field "${f.key}" needs at least 2 options`);
    }
  }
}

function sampleAnswer(f: QuestionField): unknown {
  if (f.sample !== undefined && f.sample !== null && f.sample !== '') return f.sample;
  switch (f.type) {
    case 'number': return 1000;
    case 'date': return new Date().toISOString().slice(0, 10);
    case 'dropdown':
    case 'radio': return f.options?.[0] ?? 'Option 1';
    case 'checkbox': return f.options?.slice(0, 1) ?? ['Option 1'];
    case 'email': return 'sample@legalok.in';
    case 'phone': return '+91 98765 43210';
    case 'signature': return 'Sample Signature';
    default: return `Sample ${f.label}`;
  }
}

export function buildSampleAnswers(schema: QuestionField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of schema || []) out[f.key] = sampleAnswer(f);
  return out;
}
