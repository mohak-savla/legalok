/**
 * Legalok Document Engine — structural conditional resolution
 * -----------------------------------------------------------
 * Finds ConditionalBlock markup inside stored document HTML, parses each
 * block's branches into real JS objects, evaluates them with the shared
 * condition engine, keeps ONLY the first matching branch (or ELSE), and
 * recursively resolves nested blocks.
 *
 * Output contains: no cond-block markup, no editor chrome, no unselected
 * branch content — ready for merge-field resolution (Handlebars).
 *
 * Backward compatible:
 *  - v2 branches:   data-when="<serialized ConditionNode JSON>"
 *  - legacy branches: data-field (on block) + data-value / data-op / data-else
 *    are normalized at runtime into ConditionRules (never mutate storage).
 */
import {
  ConditionNode, parseCondition, evaluateCondition, normalizeLegacyRule,
  decodeAttr, conditionFieldKeys, EvalTrace,
} from './condition-engine';

/* ------------------------- HTML scanning helpers ------------------------ */

/** Index just past the `</div>` closing the `<div…>` whose open tag starts at `start`.
 *  `depth` = stack depth already open at `start` (0 when `start` is ON an open
 *  tag, 1 when scanning the interior right after an open tag). */
export function matchDivEnd(html: string, start: number, depth = 0): number {
  const re = /<div\b|<\/div\s*>/g;
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<div')) depth += 1;
    else {
      depth -= 1;
      if (depth === 0) return re.lastIndex;
    }
  }
  return html.length;
}

/** Interior markup of the `<div…>` whose opening tag starts at openStart. */
function divInner(html: string, openStart: number): string {
  const gt = html.indexOf('>', openStart);
  if (gt < 0) return '';
  const contentStart = gt + 1;
  const end = matchDivEnd(html, contentStart, 1);
  return html.slice(contentStart, Math.max(contentStart, end - '</div>'.length));
}

/** Peel editor chrome (.cond-branch-head + .cond-branch-inner) off a branch body. */
function branchBodyRaw(bodyDivHtml: string): string {
  const m = /<div class="cond-branch-inner"[^>]*>/.exec(bodyDivHtml);
  if (m) return divInner(bodyDivHtml, m.index);
  // legacy blocks (bare body) — unwrap the outer div only
  return bodyDivHtml.replace(/^<div\b[^>]*>([\s\S]*)<\/div>\s*$/, '$1');
}

/* ------------------------------ Block model ----------------------------- */

export interface ParsedBranch {
  /** v2 serialized condition (null for legacy/else/draft branches). */
  when: ConditionNode | null;
  isElse: boolean;
  /** true when the condition came from legacy data-value/data-op attrs. */
  legacy: boolean;
  body: string;
}

export interface ParsedBlock {
  field: string | null;
  branches: ParsedBranch[];
}

function openTagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /data-[\w-]+="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    const name = /data-([\w-]+)=/.exec(m[0])?.[1] ?? '';
    attrs[name] = decodeAttr(m[1]);
  }
  return attrs;
}

/**
 * Parse one cond-block div (the full `<div class="cond-block"…></div>` slice).
 * Only DIRECT children of the `.cond-branches` container are treated as
 * branches — nested cond-blocks inside a branch body are skipped, so nested
 * blocks can never be mis-read as outer branches.
 */
export function parseCondBlock(blockHtml: string): ParsedBlock | null {
  const openTag = /^<div class="cond-block"[^>]*>/.exec(blockHtml)?.[0] ?? '';
  const field = openTag ? openTag.match(/data-field="([^"]*)"/)?.[1] ?? null : null;
  const branches: ParsedBranch[] = [];

  // Scan region = interior of the .cond-branches container when present,
  // otherwise the block interior minus the head (defensive fallback).
  const containerStart = blockHtml.indexOf('<div class="cond-branches">');
  let scanStart: number;
  let scanEnd: number;
  if (containerStart >= 0) {
    scanStart = blockHtml.indexOf('>', containerStart) + 1;
    scanEnd = Math.max(scanStart, matchDivEnd(blockHtml, containerStart, 1) - '</div>'.length);
  } else {
    // No container: direct children of .cond-block (skipping the .cond-head).
    const headStart = blockHtml.indexOf('<div class="cond-head"');
    scanStart = headStart >= 0
      ? blockHtml.indexOf('</div>', headStart) + '</div>'.length
      : (blockHtml.indexOf('>', openTag.length - 1) + 1);
    scanEnd = Math.max(scanStart, matchDivEnd(blockHtml, openTag.length ? openTag.length - 1 : 0, 1) - '</div>'.length);
  }

  let cursor = scanStart;
  const bodyRe = /<div class="cond-body"[^>]*>/g;
  for (;;) {
    bodyRe.lastIndex = cursor;
    const bm = bodyRe.exec(blockHtml);
    if (!bm || bm.index >= scanEnd) break;
    // Accept only when it's a direct child (only whitespace between the
    // previous branch end / container start and this branch open tag).
    if (blockHtml.slice(cursor, bm.index).trim() !== '') {
      // Not a direct child (inside some other node) — skip it and keep scanning.
      cursor = bm.index + bm[0].length;
      continue;
    }
    const bodyEnd = matchDivEnd(blockHtml, bm.index);
    if (bodyEnd > scanEnd) break;
    const bodyDivHtml = blockHtml.slice(bm.index, bodyEnd);
    const a = openTagAttrs(bm[0]);
    const isElse = 'else' in a && a.else === 'true';
    let when: ConditionNode | null = null;
    let legacy = false;
    if ('when' in a && a.when) {
      when = parseCondition(a.when);
      if (!when && !isElse) legacy = true; // malformed JSON — treat as legacy-ish (never matches)
    } else if (!isElse) {
      when = normalizeLegacyRule(field, a.op ?? 'equals', a.value ?? '');
      legacy = true;
    }
    branches.push({ when, isElse, legacy, body: branchBodyRaw(bodyDivHtml) });
    cursor = bodyEnd;
  }
  if (branches.length === 0 && field === null) return null;
  return { field, branches };
}

/* --------------------------- Resolution pass ---------------------------- */

export interface BranchEvalTrace {
  blockField: string | null;
  branchIndex: number;
  isElse: boolean;
  result: boolean;
  when: ConditionNode | null;
  engineTrace?: EvalTrace[];
}

export interface ResolveOptions {
  /** field key → QuestionField.type for type-aware comparisons. */
  fieldTypes?: Record<string, string>;
  /** Repeat substitution redacts item values when the collection field is sensitive (Murfed). */
  sensitiveKeys?: Set<string>;
  /** When provided, collects one entry per evaluated branch. */
  trace?: BranchEvalTrace[];
}

/**
 * Resolve every ConditionalBlock in `html` against `answers`:
 * parse → evaluate → splice the first matching branch → recurse into its body.
 * Blocks with no matching branch and no ELSE resolve to ''.
 */
export function resolveConditionals(html: string, answers: Record<string, unknown>, opts: ResolveOptions = {}): string {
  if (!html || !html.includes('cond-block')) return html || '';
  let out = '';
  let i = 0;
  for (;;) {
    const start = html.indexOf('<div class="cond-block"', i);
    if (start < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, start);
    const end = matchDivEnd(html, start);
    out += resolveBlock(html.slice(start, end), answers, opts);
    i = end;
  }
  // Conditional pruning often splits one logical clause list into several —
  // merge adjacent same-type lists so auto-numbering stays continuous.
  return mergeAdjacentLists(out);
}

/**
 * Merge adjacent same-type lists (`</ol><ol>`, `</ul><ul>`) separated only by
 * whitespace or empty paragraphs, and drop empty lists left behind by pruning.
 * Lists separated by real content are never touched (intentional structure).
 * Idempotent; the loop handles chains of 3+ lists.
 */
export function mergeAdjacentLists(html: string): string {
  let out = html || '';
  const gap = /<\/(ol|ul)>\s*(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)*<(ol|ul)[^>]*>/gi;
  const emptyList = /<(ol|ul)[^>]*>\s*<\/\1>/gi;
  for (;;) {
    let next = out.replace(emptyList, '');
    next = next.replace(gap, (_m, close: string, open: string) =>
      close.toLowerCase() === open.toLowerCase() ? '' : _m);
    if (next === out) return out;
    out = next;
  }
}

/* ------------------- Phase 11: conditional table rows -------------------- */

/**
 * Resolve row-level conditions inside tables:
 *  - v2:    `<tr data-when="<serialized ConditionNode>">` — keep row when TRUE
 *  - legacy: `<tr data-field="f" data-op="equals|not_equals" data-value="v">`
 * Rows whose condition is FALSE are removed entirely — never left as empty
 * `<tr></tr>` shells. Rows without any condition attribute are untouched.
 */
export function resolveConditionalRows(html: string, answers: Record<string, unknown>, opts: ResolveOptions = {}): string {
  const src = html || '';
  if (!/<tr\b[^>]*\sdata-(?:when|value)=/i.test(src)) return src;
  const ctx = { fieldTypes: opts.fieldTypes };
  const openRe = /<tr\b[^>]*>/gi;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(src))) {
    const tag = m[0];
    const attrs = openTagAttrs(tag);
    const when = attrs.when
      ? parseCondition(attrs.when)
      : attrs.value !== undefined
        ? normalizeLegacyRule(attrs.field ?? '', attrs.op || 'equals', attrs.value)
        : null;
    if (!when) continue; // no usable condition — leave the row untouched (safety)
    const bodyStart = m.index + tag.length;
    const closeLower = src.toLowerCase().indexOf('</tr', bodyStart);
    const rowEnd = closeLower < 0 ? src.length : src.indexOf('>', closeLower) + 1;
    const keep = evaluateCondition(when, answers ?? {}, ctx);
    if (opts.trace) {
      opts.trace.push({ blockField: attrs.field ?? null, branchIndex: -1, isElse: false, result: keep, when, engineTrace: undefined });
    }
    out += src.slice(last, m.index);
    if (keep) out += src.slice(m.index, rowEnd);
    last = rowEnd;
  }
  out += src.slice(last);
  return out;
}

/**
 * Full structural resolution — the single entry point used by both the
 * server renderer and the client preview:
 *   1. evaluate Repeat/Loop blocks FIRST — each iteration binds the item,
 *      so conditions/tables/repeats *inside* a body resolve against the row's
 *      scoped answers via recursion.
 *   2. evaluate ConditionalBlocks that remain at the top level (outside
 *      repeat bodies).
 *   3. evaluate conditional table rows (possibly surfaced by steps 1–2).
 * Numbering merge runs inside block resolution and after repeat expansion.
 */
export function resolveDocument(html: string, answers: Record<string, unknown>, opts: ResolveOptions = {}): string {
  let out = html || '';
  if (hasRepeatBlocks(out)) out = resolveRepeats(out, answers ?? {}, opts);
  if (hasConditionalBlocks(out)) out = resolveConditionals(out, answers ?? {}, opts);
  if (/<tr\b[^>]*\sdata-(?:when|value)=/i.test(out)) out = resolveConditionalRows(out, answers ?? {}, opts);
  return out;
}

/* -------------------- Phase 12: repeat / loop -------------------- */

export interface RepeatSpec {
  /** Answer key holding the array to iterate (missing/not-an-array → block removed). */
  collection: string;
  /** Loop variable used inside the body, e.g. `vehicle` for `{{vehicle.model}}`. */
  item: string;
  /** Body markup rendered once per row (may contain merge fields/cond/rows/repeats). */
  body: string;
}

export interface RepeatItemToken {
  raw: string;
  sub: string | null;
}

export function hasRepeatBlocks(html: string): boolean {
  return !!html && html.includes('repeat-block');
}

const ITEM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse one `<div class="repeat-block" data-collection="…" data-item="…">…</div>`. */
export function parseRepeatBlock(block: string): RepeatSpec | null {
  const open = /^<div\b[^>]*class="repeat-block"[^>]*>/.exec(block);
  if (!open) return null;
  const attrs = openTagAttrs(open[0]);
  if (!attrs.collection || !attrs.item || !ITEM_NAME_RE.test(attrs.item)) return null;
  const inner = divInner(block, open.index);
  const bodyOpen = /<div class="repeat-body"[^>]*>/.exec(inner);
  if (!bodyOpen) return null;
  return {
    collection: attrs.collection,
    item: attrs.item,
    body: divInner(inner, bodyOpen.index),
  };
}

/** All `{{item}}` / `{{item.sub}}` tokens inside a repeat body. */
export function collectItemTokens(body: string, item: string): RepeatItemToken[] {
  const out: RepeatItemToken[] = [];
  const re = new RegExp(`\\{\\{\\s*${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.([A-Za-z0-9_]+))?\\s*\\}\\}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.push({ raw: m[0], sub: m[1] ?? null });
  return out;
}

function itemValue(row: unknown, sub: string | null): unknown {
  if (sub === null) return row;
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    return (row as Record<string, unknown>)[sub];
  }
  // scalar row with a sub-key → the scalar itself is used for every sub
  // (so `{{item.description}}` prints a plain text-row value), the same way
  // a scalar answer satisfies any selector. Object rows read their property.
  return row;
}

export function resolveRepeats(html: string, answers: Record<string, unknown>, opts: ResolveOptions = {}): string {
  const src = html || '';
  if (!hasRepeatBlocks(src)) return src;
  let out = '';
  let i = 0;
  for (;;) {
    const start = src.indexOf('<div class="repeat-block"', i);
    if (start < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, start);
    const end = matchDivEnd(src, start);
    out += resolveRepeatBlock(src.slice(start, end), answers ?? {}, opts);
    i = end;
  }
  return out;
}

function resolveRepeatBlock(block: string, answers: Record<string, unknown>, opts: ResolveOptions): string {
  const spec = parseRepeatBlock(block);
  if (!spec) return block; // not a usable block — leave untouched (safety)
  const collection = answers[spec.collection];
  if (!Array.isArray(collection) || collection.length === 0) return '';
  const redact = !!opts.sensitiveKeys?.has(spec.collection);
  const chunks: string[] = [];
  for (const row of collection) {
    // Each iteration runs with `item` bound to the current row. Conditions that
    // reference `item.sub` resolve via dotted lookup against the scoped answers;
    // merge-field tokens `{{item}}` / `{{item.sub}}` are substituted with their
    // (HTML-escaped, optionally redacted) VALUE right here — the engine owns the
    // item namespace so the outer Handlebars pass has nothing repeat-only to
    // resolve. Everything else ({{plainFields}}, nested cond/rows/repeats) is
    // resolved recursively on the iteration body.
    const scoped: Record<string, unknown> = { ...answers, [spec.item]: row };
    let body = spec.body;
    for (const t of collectItemTokens(spec.body, spec.item)) {
      const value = itemValue(row, t.sub);
      const str = value === undefined || value === null ? '' : String(value);
      body = body.split(t.raw).join(redact ? REDACTED_PLACEHOLDER : escapeHtmlValue(str));
    }
    chunks.push(resolveDocument(body, scoped, opts));
  }
  // Repeated list fragments are part of ONE logical list → merge numbering.
  return mergeAdjacentLists(chunks.join(''));
}

export const REDACTED_PLACEHOLDER = '__LEGALOK_REDACTED__';

function escapeHtmlValue(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Distinct `data-item` loop variables across every repeat block. */
export function repeatItemVars(html: string): Set<string> {
  const vars = new Set<string>();
  if (!hasRepeatBlocks(html)) return vars;
  const re = /<div\b[^>]*class="repeat-block"[^>]*data-item="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) vars.add(m[1]);
  return vars;
}

/** Drop `{{item.sub}}` tokens whose `item` is a repeat loop variable (valid list access). */
export function stripRepeatScopedKeys(keys: Iterable<string>, itemVars: Iterable<string>): string[] {
  const out: string[] = [];
  for (const k of keys) {
    if (k.includes('.') && itemVars instanceof Set && itemVars.has(k.split('.')[0])) continue;
    out.push(k);
  }
  return out;
}

function resolveBlock(block: string, answers: Record<string, unknown>, opts: ResolveOptions): string {
  const parsed = parseCondBlock(block);
  if (!parsed) return block; // not a recognizable block — leave untouched (safety)

  const ctx = { fieldTypes: opts.fieldTypes };
  let selectedBody: string | null = null;

  for (let idx = 0; idx < parsed.branches.length; idx++) {
    const b = parsed.branches[idx];
    // ELSE is selected only when nothing before it matched; the loop breaks on
    // the first match, so reaching an ELSE means every earlier branch failed.
    const engineTrace: EvalTrace[] | undefined = opts.trace ? [] : undefined;
    const result = b.isElse
      ? selectedBody === null
      : evaluateCondition(b.when, answers ?? {}, ctx, engineTrace);
    if (opts.trace) {
      opts.trace.push({
        blockField: parsed.field,
        branchIndex: idx,
        isElse: b.isElse,
        result,
        when: b.when,
        engineTrace,
      });
    }
    if (result) {
      selectedBody = b.body;
      break;
    }
  }

  const chosen = selectedBody ?? '';
  return chosen ? resolveConditionals(chosen, answers, opts) : '';
}

/* ------------------------------ Introspection ---------------------------- */

/** All form-field keys referenced by conditions inside `html` (v2 + legacy). */
export function conditionFieldKeysInHtml(html: string, into = new Set<string>()): Set<string> {
  if (!html) return into;
  let i = 0;
  for (;;) {
    const start = html.indexOf('<div class="cond-block"', i);
    if (start < 0) break;
    const end = matchDivEnd(html, start);
    const block = html.slice(start, end);
    const parsed = parseCondBlock(block);
    if (parsed) {
      if (parsed.field) into.add(parsed.field);
      for (const b of parsed.branches) conditionFieldKeys(b.when, into);
    }
    // recurse into branch bodies for nested blocks
    for (const b of parsed?.branches ?? []) conditionFieldKeysInHtml(b.body, into);
    i = end;
  }
  // conditional table rows (Phase 11) — used by publish validation
  const rowRe = /<tr\b[^>]*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(html))) {
    const attrs = openTagAttrs(rm[0]);
    if (attrs.when) {
      const node = parseCondition(attrs.when);
      if (node) conditionFieldKeys(node, into);
    } else if (attrs.value !== undefined && attrs.field) {
      into.add(attrs.field);
    }
  }
  return into;
}

/** True when the html contains at least one ConditionalBlock. */
export function hasConditionalBlocks(html: string): boolean {
  return !!html && html.includes('cond-block');
}

/**
 * Remove empty / whitespace-only {{ }} merge tokens — Handlebars cannot parse
 * them ("Expecting ID… got CLOSE") and they carry no information. The editor
 * serializers no longer produce them; this is the render-time safety net so a
 * stray token can never crash preview or final generation.
 */
export function stripEmptyMergeTokens(html: string): string {
  return (html || '').replace(/\{\{\s*\}\}/g, '');
}
