/**
 * Legalok Condition Engine
 * ------------------------
 * Shared, UI-independent evaluation of conditional logic against form answers.
 * Single source of truth used by:
 *   - Document Builder editor preview (client, via @engine alias)
 *   - Live "Murfed" questionnaire preview (client)
 *   - Final document generation (server)
 *   - Future: Form Builder show/hide logic, Condition Debugger
 *
 * PURE LOGIC — no React, no DOM, no Handlebars, no Node APIs, no I/O.
 */

/* ================================ Model ================================ */

export type ConditionOperator =
  // text / single-select
  | 'equals' | 'not_equals'
  // text
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty'
  // number
  | 'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' | 'between'
  // date
  | 'before' | 'after' | 'on_or_before' | 'on_or_after'
  // boolean
  | 'is_true' | 'is_false';

export interface ConditionRule {
  type: 'rule';
  /** Form-field key this rule inspects. */
  field: string;
  operator: ConditionOperator;
  /**
   * Comparison literal. Semantics per operator:
   *  - equals / not_equals      exact text, trimmed, case-sensitive
   *  - contains / not_contains  substring, case-insensitive
   *  - starts_with / ends_with  case-insensitive
   *  - is_empty / is_not_empty  value ignored
   *  - number ops               number | numeric string ("1,000" ok)
   *  - between                  [min, max] array or { min, max }
   *  - date ops                 'YYYY-MM-DD' (recommended) or parseable date
   *  - is_true / is_false       value ignored
   */
  value?: unknown;
}

export interface ConditionGroup {
  type: 'group';
  logic: 'AND' | 'OR';
  items: ConditionNode[];
}

export type ConditionNode = ConditionRule | ConditionGroup;

/** Operators that carry a comparison literal. */
const VALUE_OPS: ReadonlySet<string> = new Set([
  'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
  'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between',
  'before', 'after', 'on_or_before', 'on_or_after',
]);

export function needsValue(op: ConditionOperator): boolean {
  return VALUE_OPS.has(op);
}

/* =========================== Field categories =========================== */

export type FieldCategory = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

/** Map a QuestionField.type to the engine's comparison category. */
export function categoryOf(fieldType?: string): FieldCategory {
  switch (fieldType) {
    case 'number': case 'currency': return 'number';
    case 'date': return 'date';
    case 'boolean': return 'boolean';
    case 'checkbox': return 'multiselect'; // checkbox = multi-select semantics
    case 'dropdown': case 'radio': return 'select';
    default: return 'text'; // text, textarea, email, phone, address, file, unknown
  }
}

export const OPERATORS_BY_CATEGORY: Record<FieldCategory, ConditionOperator[]> = {
  text: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal', 'between'],
  date: ['equals', 'before', 'after', 'on_or_before', 'on_or_after', 'between'],
  boolean: ['is_true', 'is_false'],
  select: ['equals', 'not_equals'],
  multiselect: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
};

export function operatorsFor(fieldType?: string): ConditionOperator[] {
  return OPERATORS_BY_CATEGORY[categoryOf(fieldType)];
}

export function operatorLabel(op: ConditionOperator): string {
  const labels: Record<ConditionOperator, string> = {
    equals: 'is equal to', not_equals: 'is not equal to',
    contains: 'contains', not_contains: 'does not contain',
    starts_with: 'starts with', ends_with: 'ends with',
    is_empty: 'is empty', is_not_empty: 'is not empty',
    greater_than: 'is greater than', less_than: 'is less than',
    greater_than_or_equal: 'is greater than or equal to', less_than_or_equal: 'is less than or equal to',
    between: 'is between',
    before: 'is before', after: 'is after',
    on_or_before: 'is on or before', on_or_after: 'is on or after',
    is_true: 'is true', is_false: 'is false',
  };
  return labels[op] ?? op;
}

export interface EvalContext {
  /** field key → QuestionField.type (drives type-aware comparison) */
  fieldTypes?: Record<string, string>;
}

/* =============================== Tracing =============================== */

export interface RuleTrace {
  kind: 'rule';
  field: string;
  operator: ConditionOperator;
  value: unknown;
  answer: unknown;
  result: boolean;
}
export interface GroupTrace {
  kind: 'group';
  logic: 'AND' | 'OR';
  result: boolean;
  children: EvalTrace[];
}
export type EvalTrace = RuleTrace | GroupTrace;

/* ============================ Normalization ============================ */

/**
 * Normalization rules (documented contract):
 *  - undefined / null / '' / []  → the canonical "no answer" (isEmptyValue).
 *  - text/select                 → String, trimmed. equals is EXACT + case-sensitive
 *                                  (legal option values must match verbatim).
 *  - contains/starts_with/ends_with are case-INSENSITIVE (friendlier for prose).
 *  - number                      → Number(); strings tolerate "1,000" / "₹ 500" /
 *                                  spaces; non-numeric never matches ordering ops.
 *  - date                        → 'YYYY-MM-DD' parsed as LOCAL calendar date
 *                                  (no timezone drift); comparisons are per-day.
 *  - boolean                     → true/'true'/'yes'/'y'/'1'/'on' → true;
 *                                  everything else (incl. missing) → false.
 *  - multiselect (checkbox)      → string[]; a scalar answer becomes [scalar].
 *  - unknown field type          → treated as text (lenient).
 */
export function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function asText(v: unknown): string {
  return v === undefined || v === null ? '' : String(v);
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const s = v.trim().replace(/[,\s₹]/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Local-midnight timestamp → all date comparisons are calendar-day based. */
function dayTime(v: unknown): number | null {
  const d = asDate(v);
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : null;
}

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'on']);
const FALSY = new Set(['false', 'no', 'n', '0', 'off', '']);

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (TRUTHY.has(s)) return true;
    if (FALSY.has(s)) return false;
  }
  return false;
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asText(x));
  if (isEmptyValue(v)) return [];
  return [asText(v)];
}

function betweenBounds(raw: unknown): [unknown, unknown] | null {
  if (Array.isArray(raw) && raw.length >= 2) return [raw[0], raw[1]];
  if (raw && typeof raw === 'object') {
    const o = raw as { min?: unknown; max?: unknown };
    if (o.min !== undefined && o.max !== undefined) return [o.min, o.max];
  }
  return null;
}

/* ============================ Rule evaluation =========================== */

/** Look up a rule field in answers. Dotted paths resolve repeat items (`vehicle.model`). */
function answerPath(answers: Record<string, unknown> | undefined, field: string): unknown {
  if (!answers) return undefined;
  if (!field.includes('.')) return answers[field];
  let cur: unknown = answers;
  for (const part of field.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function evaluateRule(
  rule: ConditionRule,
  answers: Record<string, unknown>,
  ctx: EvalContext | undefined,
  trace: EvalTrace[] | undefined,
): boolean {
  const raw = answerPath(answers, rule.field);
  const category = categoryOf(ctx?.fieldTypes?.[rule.field]);
  const op = rule.operator;
  let result = false;

  if (op === 'is_empty') {
    result = isEmptyValue(raw);
  } else if (op === 'is_not_empty') {
    result = !isEmptyValue(raw);
  } else if (op === 'is_true') {
    result = asBool(raw) === true;
  } else if (op === 'is_false') {
    result = asBool(raw) === false;
  } else if (category === 'number') {
    const a = asNumber(raw);
    const b = asNumber(rule.value);
    if (op === 'equals') result = a !== null && b !== null && a === b;
    else if (op === 'not_equals') result = a !== null && b !== null && a !== b;
    else if (op === 'greater_than') result = a !== null && b !== null && a > b;
    else if (op === 'less_than') result = a !== null && b !== null && a < b;
    else if (op === 'greater_than_or_equal') result = a !== null && b !== null && a >= b;
    else if (op === 'less_than_or_equal') result = a !== null && b !== null && a <= b;
    else if (op === 'between') {
      const bounds = betweenBounds(rule.value);
      const lo = bounds ? asNumber(bounds[0]) : null;
      const hi = bounds ? asNumber(bounds[1]) : null;
      result = a !== null && lo !== null && hi !== null && a >= lo && a <= hi;
    }
  } else if (category === 'date') {
    const a = dayTime(raw);
    const b = dayTime(rule.value);
    if (op === 'equals') result = a !== null && b !== null && a === b;
    else if (op === 'before') result = a !== null && b !== null && a < b;
    else if (op === 'after') result = a !== null && b !== null && a > b;
    else if (op === 'on_or_before') result = a !== null && b !== null && a <= b;
    else if (op === 'on_or_after') result = a !== null && b !== null && a >= b;
    else if (op === 'between') {
      const bounds = betweenBounds(rule.value);
      const lo = bounds ? dayTime(bounds[0]) : null;
      const hi = bounds ? dayTime(bounds[1]) : null;
      result = a !== null && lo !== null && hi !== null && a >= lo && a <= hi;
    }
  } else if (category === 'multiselect') {
    const arr = asArray(raw);
    const wanted = Array.isArray(rule.value) ? asArray(rule.value) : [asText(rule.value).trim()];
    if (op === 'contains') result = wanted.some((w) => w !== '' && arr.includes(w));
    else if (op === 'not_contains') result = wanted.every((w) => !arr.includes(w));
  } else if (category === 'select') {
    const a = asText(raw).trim();
    const b = asText(rule.value).trim();
    if (op === 'equals') result = a !== '' && b !== '' && a === b;
    else if (op === 'not_equals') result = a !== b; // missing answer ≠ value → true (documented)
  } else {
    // text (default)
    const a = asText(raw).trim();
    const b = asText(rule.value).trim();
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (op === 'equals') result = b !== '' && a === b;
    else if (op === 'not_equals') result = a !== b;
    else if (op === 'contains') result = b !== '' && la.includes(lb);
    else if (op === 'not_contains') result = b === '' || !la.includes(lb);
    else if (op === 'starts_with') result = b !== '' && la.startsWith(lb);
    else if (op === 'ends_with') result = b !== '' && la.endsWith(lb);
  }

  if (trace) trace.push({ kind: 'rule', field: rule.field, operator: op, value: rule.value, answer: raw, result });
  return result;
}

/* ============================ Group evaluation ========================== */

/** All items are evaluated (no short-circuit) so traces are complete. */
export function evaluateCondition(
  node: ConditionNode | null | undefined,
  answers: Record<string, unknown>,
  ctx?: EvalContext,
  trace?: EvalTrace[],
): boolean {
  if (!node) return false;
  if (node.type === 'rule') return evaluateRule(node, answers ?? {}, ctx, trace);
  const g = node as ConditionGroup;
  const childTrace = trace ? [] : undefined;
  const results = (g.items ?? []).map((item) => evaluateCondition(item, answers ?? {}, ctx, childTrace));
  const result = g.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  if (trace) trace.push({ kind: 'group', logic: g.logic, result, children: childTrace ?? [] });
  return result;
}

/* ====================== Serialization & migration ======================= */

type CanonicalNode =
  | { type: 'rule'; field: string; operator: ConditionOperator; value?: unknown }
  | { type: 'group'; logic: 'AND' | 'OR'; items: CanonicalNode[] };

function canonical(n: ConditionNode): CanonicalNode {
  if (n.type === 'rule') {
    const base: CanonicalNode = { type: 'rule', field: n.field, operator: n.operator };
    if (needsValue(n.operator)) base.value = n.value ?? '';
    return base;
  }
  return { type: 'group', logic: n.logic, items: (n.items ?? []).map(canonical) };
}

/** Deterministic JSON (stable key order) — safe to store in HTML attributes. */
export function serializeCondition(node: ConditionNode): string {
  return JSON.stringify(canonical(node));
}

/** Parse + validate a serialized ConditionNode; returns null when invalid. */
export function parseCondition(json: string | null | undefined): ConditionNode | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as ConditionNode;
    if (!v || typeof v !== 'object') return null;
    if (v.type === 'rule') {
      const r = v as ConditionRule;
      if (typeof r.field === 'string' && r.field && typeof r.operator === 'string') return r;
      return null;
    }
    if (v.type === 'group') {
      const g = v as ConditionGroup;
      if ((g.logic === 'AND' || g.logic === 'OR') && Array.isArray(g.items)) return g;
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Legacy branch attrs (data-field/data-op/data-value) → ConditionRule. */
export function normalizeLegacyRule(
  field: string | null | undefined,
  op: string | null | undefined,
  value: unknown,
): ConditionRule {
  return {
    type: 'rule',
    field: field ?? '',
    operator: op === 'not_equals' ? 'not_equals' : 'equals',
    value: value ?? '',
  };
}

/** Escape a serialized condition for a double-quoted HTML attribute. */
export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Reverse of escapeAttr for values read back out of raw HTML. */
export function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Every field key referenced anywhere inside a condition tree. */
export function conditionFieldKeys(node: ConditionNode | null | undefined, into = new Set<string>()): Set<string> {
  if (!node) return into;
  if (node.type === 'rule') {
    if (node.field) into.add(node.field);
  } else {
    for (const item of node.items ?? []) conditionFieldKeys(item, into);
  }
  return into;
}

