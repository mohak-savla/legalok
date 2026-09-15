/** Storage ⇄ editor HTML transforms for the TipTap Document Builder */
import { serializeCondition, escapeAttr } from '@engine/condition-engine';
import type { ConditionOperator } from '@engine/condition-engine';

/** {{key}} → merge chip spans so TipTap parses them as nodes */
export function wrapMergeChips(html: string): string {
  return (html || '')
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => `<span data-merge-key="${key}"></span>`)
    // Empty / whitespace-only {{ }} are invalid merge fields — never ship them
    // to TipTap (they'd survive round-trips and crash Handlebars at render).
    .replace(/\{\{\s*\}\}/g, '');
}

/** Editor HTML → storage HTML: merge chip spans → {{key}} (cond-blocks pass through) */
export function editorHtmlToStorage(html: string): string {
  return (html || '')
    .replace(/<span data-merge-key="([^"]*)"[^>]*>[\s\S]*?<\/span>/g, (_m, key: string) => (key ? `{{${key}}}` : ''))
    .replace(/\{\{\s*\}\}/g, '');
}

/**
 * Convert legacy `{{#if (eq x "A")}}…{{else if (eq x "B")}}…{{else}}…{{/if}}`
 * chains (non-nested) into editor cond-block divs. Returns converted count.
 */
export function legacyIfToBlocks(html: string): { html: string; count: number } {
  let count = 0;
  const openRe = /\{\{#if\s*\(\s*(eq|neq)\s+([a-zA-Z0-9_]+)\s+"([^"]*)"\s*\)\s*\}\}/g;

  function convertFrom(src: string, fromIdx: number): { html: string; next: number } | null {
    openRe.lastIndex = fromIdx;
    const open = openRe.exec(src);
    if (!open) return null;
    const branches: { value: string; op: string; isElse: boolean; body: string }[] = [];
    let cursor = openRe.lastIndex;
    let depth = 1;
    let currentOp = open[1];
    let currentValue = open[3];
    let currentIsElse = false;
    let bodyStart = cursor;
    const tokenRe = /\{\{#if\b|\{\{else\s+if\s*\(\s*(eq|neq)\s+([a-zA-Z0-9_]+)\s+"([^"]*)"\s*\)\s*\}\}|\{\{else\s*\}\}|\{\{\/if\s*\}\}/g;
    tokenRe.lastIndex = cursor;
    let tm: RegExpExecArray | null;
    for (;;) {
      tm = tokenRe.exec(src);
      if (!tm) return null; // unbalanced → leave untouched
      if (tm[0] === '{{#if') {
        depth += 1;
        continue; // nested if stays inside body text
      }
      if (tm[0] === '{{/if}}' || tm[0].startsWith('{{/if')) {
        depth -= 1;
        if (depth === 0) {
          branches.push({ value: currentValue, op: currentOp, isElse: currentIsElse, body: src.slice(bodyStart, tm.index) });
          cursor = tm.index + tm[0].length;
          break;
        }
        continue;
      }
      if (tm[0] === '{{else}}') {
        branches.push({ value: currentValue, op: currentOp, isElse: currentIsElse, body: src.slice(bodyStart, tm.index) });
        currentIsElse = true; currentValue = ''; bodyStart = tm.index + tm[0].length;
        continue;
      }
      // else if
      if (depth === 1) {
        branches.push({ value: currentValue, op: currentOp, isElse: currentIsElse, body: src.slice(bodyStart, tm.index) });
        currentOp = tm[1]; currentValue = tm[3]; currentIsElse = false; bodyStart = tm.index + tm[0].length;
      }
    }
    const field = open[2];
    const bodies = branches.map((b) => {
      // v2 storage: serialized condition group in data-when (legacy-attr free)
      const attrs = b.isElse
        ? 'data-else="true"'
        : `data-when="${escapeAttr(serializeCondition({
            type: 'rule',
            field,
            operator: (b.op === 'not_equals' ? 'not_equals' : 'equals') as ConditionOperator,
            value: b.value.replace(/\{\{|\}\}/g, ''),
          }))}"`;
      return `<div class="cond-body" ${attrs}><div class="cond-branch-inner">${b.body}</div></div>`;
    }).join('');
    const head = branches.map((b) => (b.isElse ? 'ELSE' : `IF ${b.op === 'not_equals' ? '≠' : '='} "${b.value}"`)).join(' / ');
    const block = `<div class="cond-block" data-field="${field}"><div class="cond-head" contenteditable="false">⚡ ${field}: ${head}</div><div class="cond-branches">${bodies}</div></div>`;
    return { html: src.slice(0, open.index) + block + src.slice(cursor), next: open.index + block.length };
  }

  let out = html;
  let idx = 0;
  for (;;) {
    const res = convertFrom(out, idx);
    if (!res) break;
    out = res.html;
    idx = res.next;
    count += 1;
  }
  return { html: out, count };
}