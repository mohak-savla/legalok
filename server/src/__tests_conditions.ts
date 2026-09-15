/**
 * Phases 2–4 test suite — shared condition engine + structural document engine.
 * Run: npx tsx src/__tests_conditions.ts   (server must NOT be running for render tests? not required — pure functions)
 */
import {
  ConditionNode, ConditionGroup, ConditionRule, ConditionOperator,
  evaluateCondition, serializeCondition, parseCondition, escapeAttr, decodeAttr,
  categoryOf, operatorsFor, isEmptyValue,
} from './engine/condition-engine';
import { resolveConditionals, resolveDocument, parseCondBlock, conditionFieldKeysInHtml, stripEmptyMergeTokens, mergeAdjacentLists, repeatItemVars, stripRepeatScopedKeys } from './engine/document-engine';
import { renderDocument } from './services/handlebars.service';
import type { QuestionField } from './db/entities';

let pass = 0;
let fail = 0;
function t(name: string, cond: boolean, detail = ''): void {
  if (cond) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fail += 1; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/* ------------------------------ helpers ------------------------------ */

const rule = (field: string, operator: ConditionOperator, value?: unknown): ConditionRule =>
  ({ type: 'rule', field, operator, ...(value !== undefined ? { value } : {}) });
const and = (...items: ConditionNode[]): ConditionGroup => ({ type: 'group', logic: 'AND', items });
const or = (...items: ConditionNode[]): ConditionGroup => ({ type: 'group', logic: 'OR', items });

interface SpecBranch { when?: ConditionNode; legacy?: { op: string; value: string }; isElse?: boolean; body: string }

/** Build a cond-block div exactly like the editor serializes it (v2 or legacy branches). */
function block(branches: SpecBranch[], field?: string): string {
  const inner = branches.map((b) => {
    let attrs = '';
    if (b.isElse) attrs = ' data-else="true"';
    else if (b.when) attrs = ` data-when="${escapeAttr(serializeCondition(b.when))}"`;
    else if (b.legacy) attrs = ` data-value="${b.legacy.value.replace(/"/g, '&quot;')}" data-op="${b.legacy.op}"`;
    return `<div class="cond-body"${attrs}><div class="cond-branch-head">chrome</div><div class="cond-branch-inner">${b.body}</div></div>`;
  }).join('');
  return `<div class="cond-block"${field ? ` data-field="${field}"` : ''}><div class="cond-head">head</div><div class="cond-branches">${inner}</div></div>`;
}

const FIELD_TYPES: Record<string, string> = {
  vehicleType: 'dropdown', buyerType: 'dropdown', companyType: 'dropdown',
  saleAmount: 'number', saleDate: 'date', financing: 'radio', gstApplicable: 'radio',
  partyName: 'text', remarks: 'textarea', selectedItems: 'checkbox', isRural: 'boolean',
};

const FIELDS: QuestionField[] = Object.entries(FIELD_TYPES).map(([key, type]) => ({
  key, type, label: key, ...(type === 'dropdown' || type === 'radio' || type === 'checkbox'
    ? { options: ['Car', 'Motorcycle', 'Truck', 'Company', 'Individual', 'Yes', 'No', 'A', 'B', 'C'] }
    : {}),
})) as QuestionField[];

const CTX = { fieldTypes: FIELD_TYPES };

/* ===================== SECTION A — engine unit tests ===================== */

console.log('\n— A. Operators —');

// TEST 1 / 2 — equals
t('T1 equals → true (select)', evaluateCondition(rule('vehicleType', 'equals', 'Car'), { vehicleType: 'Car' }, CTX));
t('T2 equals → false', !evaluateCondition(rule('vehicleType', 'equals', 'Car'), { vehicleType: 'SUV' }, CTX));

// text operators
t('text not_equals', evaluateCondition(rule('partyName', 'not_equals', 'Bob'), { partyName: 'Alice' }, CTX));
// TEST 10 — contains
t('T10 contains (case-insensitive)', evaluateCondition(rule('remarks', 'contains', 'URGENT'), { remarks: 'please handle quickly, urgent matter' }, CTX));
t('not_contains', !evaluateCondition(rule('remarks', 'not_contains', 'urgent'), { remarks: 'urgent' }, CTX));
t('starts_with', evaluateCondition(rule('partyName', 'starts_with', 'acme'), { partyName: 'Acme Corp' }, CTX));
t('ends_with', evaluateCondition(rule('partyName', 'ends_with', 'corp'), { partyName: 'Acme Corp' }, CTX));
// TEST 15 / 16 — empty & missing
t('T15 is_empty (empty string)', evaluateCondition(rule('partyName', 'is_empty'), { partyName: '' }, CTX));
t('T15 is_not_empty', evaluateCondition(rule('partyName', 'is_not_empty'), { partyName: 'x' }, CTX));
t('T16 is_empty (missing field)', evaluateCondition(rule('ghost', 'is_empty'), {}, CTX));
t('T16 missing equals → false', !evaluateCondition(rule('ghost', 'equals', 'x'), {}, CTX));
t('isEmptyValue contract', isEmptyValue('') && isEmptyValue(undefined) && isEmptyValue(null) && isEmptyValue([]) && !isEmptyValue([1]));

// TEST 11 — number
t('T11 greater_than (number answer)', evaluateCondition(rule('saleAmount', 'greater_than', 1000000), { saleAmount: 1500000 }, CTX));
t('number greater_than (string answer normalized)', evaluateCondition(rule('saleAmount', 'greater_than', 500), { saleAmount: '1,000' }, CTX));
t('number less_than', evaluateCondition(rule('saleAmount', 'less_than', 500), { saleAmount: 100 }, CTX));
t('number greater_than_or_equal', evaluateCondition(rule('saleAmount', 'greater_than_or_equal', 1000), { saleAmount: 1000 }, CTX));
t('number less_than_or_equal', evaluateCondition(rule('saleAmount', 'less_than_or_equal', 1000), { saleAmount: 1000 }, CTX));
t('number not_equals', evaluateCondition(rule('saleAmount', 'not_equals', 7), { saleAmount: 9 }, CTX));
t('number non-numeric never matches ordering', !evaluateCondition(rule('saleAmount', 'greater_than', 5), { saleAmount: 'abc' }, CTX));
// TEST 12 — between
t('T12 number between (array bounds)', evaluateCondition(rule('saleAmount', 'between', [1000000, 2000000]), { saleAmount: 1500000 }, CTX));
t('T12 number between → false below', !evaluateCondition(rule('saleAmount', 'between', [1000000, 2000000]), { saleAmount: 500000 }, CTX));
t('number between {min,max}', evaluateCondition(rule('saleAmount', 'between', { min: 10, max: 20 }), { saleAmount: 15 }, CTX));

// TEST 13 — dates
t('T13 date before', evaluateCondition(rule('saleDate', 'before', '2026-04-01'), { saleDate: '2026-03-15' }, CTX));
t('date after', evaluateCondition(rule('saleDate', 'after', '2026-03-01'), { saleDate: '2026-03-15' }, CTX));
t('date on_or_before (same day)', evaluateCondition(rule('saleDate', 'on_or_before', '2026-03-15'), { saleDate: '2026-03-15' }, CTX));
t('date on_or_after', evaluateCondition(rule('saleDate', 'on_or_after', '2026-03-15'), { saleDate: '2026-03-15' }, CTX));
t('date between', evaluateCondition(rule('saleDate', 'between', ['2026-01-01', '2026-12-31']), { saleDate: '2026-03-15' }, CTX));
t('date equals (same calendar day)', evaluateCondition(rule('saleDate', 'equals', '2026-03-15'), { saleDate: '2026-03-15' }, CTX));
t('date invalid → false', !evaluateCondition(rule('saleDate', 'before', '2026-01-01'), { saleDate: 'not-a-date' }, CTX));

// TEST 14 — boolean
t('T14 is_true (boolean true)', evaluateCondition(rule('isRural', 'is_true'), { isRural: true }, CTX));
t('is_true (string Yes coerced)', evaluateCondition(rule('isRural', 'is_true'), { isRural: 'Yes' }, CTX));
t('is_false (missing → false → is_false true)', evaluateCondition(rule('isRural', 'is_false'), {}, CTX));
t('is_false (explicit false)', evaluateCondition(rule('isRural', 'is_false'), { isRural: false }, CTX));

// TEST 17 — multi-select
t('T17 multiselect contains', evaluateCondition(rule('selectedItems', 'contains', 'A'), { selectedItems: ['A', 'B'] }, CTX));
t('multiselect not_contains', evaluateCondition(rule('selectedItems', 'not_contains', 'C'), { selectedItems: ['A', 'B'] }, CTX));
t('multiselect contains scalar answer normalized', evaluateCondition(rule('selectedItems', 'contains', 'A'), { selectedItems: 'A' }, CTX));

// single select not_equals — missing answer ≠ value → true (documented)
t('select not_equals missing answer → true', evaluateCondition(rule('vehicleType', 'not_equals', 'Car'), {}, CTX));

/* ===================== SECTION B — groups & nesting ===================== */

console.log('\n— B. AND / OR / groups —');

// TEST 6 — AND
t('T6 AND (both true)', evaluateCondition(and(
  rule('vehicleType', 'equals', 'Car'),
  rule('gstApplicable', 'equals', 'Yes'),
), { vehicleType: 'Car', gstApplicable: 'Yes' }, CTX));
t('T6 AND (one false)', !evaluateCondition(and(
  rule('vehicleType', 'equals', 'Car'),
  rule('gstApplicable', 'equals', 'No'),
), { vehicleType: 'Car', gstApplicable: 'Yes' }, CTX));

// TEST 7 — OR
t('T7 OR (one true)', evaluateCondition(or(
  rule('vehicleType', 'equals', 'Car'),
  rule('vehicleType', 'equals', 'Truck'),
), { vehicleType: 'Truck' }, CTX));
t('T7 OR (none true)', !evaluateCondition(or(
  rule('vehicleType', 'equals', 'Car'),
  rule('vehicleType', 'equals', 'Truck'),
), { vehicleType: 'Bike' }, CTX));

// TEST 8 — (A OR B) AND C
t('T8 (A OR B) AND C → true', evaluateCondition(and(
  or(rule('vehicleType', 'equals', 'Car'), rule('vehicleType', 'equals', 'SUV')),
  rule('saleAmount', 'greater_than', 1000000),
), { vehicleType: 'SUV', saleAmount: 2000000 }, CTX));
t('T8 (A OR B) AND C → false', !evaluateCondition(and(
  or(rule('vehicleType', 'equals', 'Car'), rule('vehicleType', 'equals', 'SUV')),
  rule('saleAmount', 'greater_than', 1000000),
), { vehicleType: 'SUV', saleAmount: 500 }, CTX));

// TEST 9 — deep nesting: A AND (B OR (C AND D))
t('T9 deep nesting', evaluateCondition(and(
  rule('buyerType', 'equals', 'Company'),
  or(
    rule('gstApplicable', 'equals', 'Yes'),
    and(rule('financing', 'equals', 'Yes'), rule('saleAmount', 'greater_than', 1000000)),
  ),
), { buyerType: 'Company', financing: 'Yes', saleAmount: 2000000, gstApplicable: 'No' }, CTX));

/* ============== SECTION C — serialization & block parsing ============== */

console.log('\n— C. Serialization & parsing —');

const g1 = and(rule('buyerType', 'equals', 'Company'), or(rule('gstApplicable', 'equals', 'Yes'), rule('saleAmount', 'greater_than', 1000000)));
const json1 = serializeCondition(g1);
t('serialize → parse round-trip (deep equal)', JSON.stringify(parseCondition(json1)) === JSON.stringify(JSON.parse(json1)));
t('serialize is deterministic', serializeCondition(g1) === serializeCondition(JSON.parse(json1) as ConditionNode));
t('parse rejects garbage', parseCondition('{not json') === null && parseCondition('{"type":"nope"}') === null);

const attrRound = decodeAttr(escapeAttr(json1));
t('attr escape/decode round-trip', attrRound === json1);
t('escaped attr contains no raw quotes', !escapeAttr(json1).includes('"'));

const legacyHtml = block([{ legacy: { op: 'equals', value: 'Car' }, body: 'X' }], 'vehicleType');
const pb = parseCondBlock(legacyHtml);
t('parseCondBlock legacy → normalized rule', pb?.branches[0]?.when?.type === 'rule'
  && (pb.branches[0].when as ConditionRule).field === 'vehicleType'
  && (pb.branches[0].when as ConditionRule).operator === 'equals');
t('parseCondBlock marks legacy branch', pb?.branches[0]?.legacy === true);
t('conditionFieldKeysInHtml (legacy)', conditionFieldKeysInHtml(legacyHtml).has('vehicleType'));
t('conditionFieldKeysInHtml (v2 nested groups)',
  conditionFieldKeysInHtml(block([{ when: g1, body: '' }])).has('saleAmount')
  && conditionFieldKeysInHtml(block([{ when: g1, body: '' }])).has('buyerType'));

/* ============== SECTION D — structural resolver ============== */

console.log('\n— D. Structural resolver —');

const answers1 = { vehicleType: 'Car', buyerType: 'Company', companyType: 'Private Limited', gstApplicable: 'Yes', saleAmount: 850000 };

// TEST 3 — IF → ELSE
const r3 = resolveConditionals(
  'START' + block([{ when: rule('vehicleType', 'equals', 'Car'), body: 'CAR-CLAUSE' }, { isElse: true, body: 'GENERIC-CLAUSE' }]) + 'END',
  { vehicleType: 'Car' }, CTX);
t('T3 IF selected, ELSE skipped', r3 === 'STARTCAR-CLAUSEEND');

// TEST 4 — IF → ELSE IF → ELSE (first match wins)
const r4 = resolveConditionals(block([
  { when: rule('vehicleType', 'equals', 'Car'), body: 'CAR' },
  { when: rule('vehicleType', 'equals', 'Motorcycle'), body: 'MOTO' },
  { isElse: true, body: 'GENERIC' },
]), { vehicleType: 'Motorcycle' }, CTX);
t('T4 ELSE IF matched', r4 === 'MOTO');

// TEST 5 — multiple ELSE IF, later match
const r5 = resolveConditionals(block([
  { when: rule('vehicleType', 'equals', 'Car'), body: 'CAR' },
  { when: rule('vehicleType', 'equals', 'Motorcycle'), body: 'MOTO' },
  { when: rule('vehicleType', 'equals', 'Truck'), body: 'TRUCK' },
  { isElse: true, body: 'GENERIC' },
]), { vehicleType: 'Truck' }, CTX);
t('T5 third branch matched', r5 === 'TRUCK');

// TEST 23 — no match, no ELSE → nothing rendered
const r23 = resolveConditionals(block([
  { when: rule('vehicleType', 'equals', 'Car'), body: 'CAR' },
]), { vehicleType: 'Bike' }, CTX);
t('T23 no match + no ELSE → empty', r23 === '');

// no chrome / syntax in resolved output
const chrome = resolveConditionals(block([{ when: and(rule('a', 'equals', 'x'), rule('b', 'equals', 'y')), body: 'OK' }]), { a: 'x', b: 'y' }, CTX);
t('no cond-block/head/branch chrome in output', !chrome.includes('cond-') && !chrome.includes('data-when') && chrome === 'OK');

// TEST 6/8 through the resolver (AND group + nested OR group)
const rAnd = resolveConditionals(block([
  { when: and(rule('buyerType', 'equals', 'Company'), rule('gstApplicable', 'equals', 'Yes')), body: 'COMPANY-GST' },
  { isElse: true, body: 'OTHER' },
]), answers1, CTX);
t('AND group through resolver', rAnd === 'COMPANY-GST');
const rGroup = resolveConditionals(block([
  { when: and(or(rule('vehicleType', 'equals', 'Car'), rule('vehicleType', 'equals', 'Truck')), rule('saleAmount', 'greater_than', 500000)), body: 'BIG-VEHICLE' },
  { isElse: true, body: 'SMALL' },
]), answers1, CTX);
t('(A OR B) AND C through resolver', rGroup === 'BIG-VEHICLE');

// TEST 18 — nested ConditionalBlock inside the selected branch
const nestedInner = block([
  { when: rule('companyType', 'equals', 'Private Limited'), body: 'PRIVATE-LIMITED' },
  { isElse: true, body: 'OTHER-COMPANY' },
]);
const nestedOuter = block([
  { when: rule('buyerType', 'equals', 'Company'), body: `<p>COMPANY-CLAUSE</p>${nestedInner}` },
  { isElse: true, body: 'INDIVIDUAL-CLAUSE' },
]);
const r18 = resolveConditionals(nestedOuter, { buyerType: 'Company', companyType: 'Private Limited' }, CTX);
t('T18 nested block (Company → Private Limited)', r18.includes('COMPANY-CLAUSE') && r18.includes('PRIVATE-LIMITED') && !r18.includes('OTHER-COMPANY') && !r18.includes('INDIVIDUAL-CLAUSE'));
const r18b = resolveConditionals(nestedOuter, { buyerType: 'Company', companyType: 'LLP' }, CTX);
t('T18 nested ELSE selected', r18b.includes('COMPANY-CLAUSE') && r18b.includes('OTHER-COMPANY') && !r18b.includes('PRIVATE-LIMITED'));
const r18c = resolveConditionals(nestedOuter, { buyerType: 'Individual' }, CTX);
t('T18 outer ELSE selected, inner never evaluated content absent', r18c === 'INDIVIDUAL-CLAUSE');

// TEST 24 — multiple sibling nested conditions + blocks in one document
const doc24 = `<h1>DEED</h1>`
  + block([{ when: rule('buyerType', 'equals', 'Company'), body: 'BUYER-COMPANY' }, { isElse: true, body: 'BUYER-INDIVIDUAL' }])
  + `<p>middle</p>`
  + block([{ when: rule('gstApplicable', 'equals', 'Yes'), body: 'GST-YES' }, { isElse: true, body: 'GST-NO' }])
  + block([{ when: and(rule('financing', 'equals', 'Yes'), rule('saleAmount', 'greater_than', 100000)), body: 'FINANCED-BIG' }]);
const r24 = resolveConditionals(doc24, { buyerType: 'Individual', gstApplicable: 'Yes', financing: 'Yes', saleAmount: 850000 }, CTX);
t('T24 multiple sibling blocks resolved independently',
  r24.includes('<h1>DEED</h1>') && r24.includes('BUYER-INDIVIDUAL') && r24.includes('middle')
  && r24.includes('GST-YES') && r24.includes('FINANCED-BIG')
  && !r24.includes('BUYER-COMPANY') && !r24.includes('GST-NO'));

// TEST 19 — legacy conditional block (data-field/data-value/data-op) through resolver
const legacyBlock = block([
  { legacy: { op: 'equals', value: 'Car' }, body: 'LEGACY-CAR' },
  { isElse: true, body: 'LEGACY-ELSE' },
], 'vehicleType');
t('T19a legacy IF selected', resolveConditionals(legacyBlock, { vehicleType: 'Car' }, CTX) === 'LEGACY-CAR');
t('T19b legacy ELSE selected', resolveConditionals(legacyBlock, { vehicleType: 'Bike' }, CTX) === 'LEGACY-ELSE');
const legacyNeq = block([{ legacy: { op: 'not_equals', value: 'Car' }, body: 'NOT-CAR' }], 'vehicleType');
t('T19c legacy not_equals', resolveConditionals(legacyNeq, { vehicleType: 'Bike' }, CTX) === 'NOT-CAR');

// debug trace
{
  const trace: import('./engine/document-engine').BranchEvalTrace[] = [];
  resolveConditionals(block([
    { when: rule('vehicleType', 'equals', 'Car'), body: 'CAR' },
    { isElse: true, body: 'GEN' },
  ]), { vehicleType: 'SUV' }, { ...CTX, trace });
  t('debug trace: two branches evaluated, correct results',
    trace.length === 2 && trace[0].result === false && trace[1].result === true && trace[1].isElse === true);
}

/* ========= SECTION E — renderDocument integration (server pipeline) ========= */

console.log('\n— E. renderDocument integration —');

// TEST 20 — legacy Handlebars IF template (compat fallback)
const out20 = renderDocument('V: {{#if (eq buyerType "Company")}}C-TEMPLATE{{else}}I-TEMPLATE{{/if}}', { buyerType: 'Company' }, { fields: FIELDS });
t('T20 legacy Handlebars IF still works', out20.includes('C-TEMPLATE') && !out20.includes('I-TEMPLATE'));

// TEST 21 + 22 — merge fields inside selected / unselected branches
const mergeDoc = block([
  { when: rule('vehicleType', 'equals', 'Car'), body: '<p>Car: {{partyName}}</p>' },
  { isElse: true, body: '<p>Other: {{remarks}}</p>' },
]);
const out21 = renderDocument(mergeDoc, { vehicleType: 'Car', partyName: 'Acme Corp', remarks: 'zzz-unselected' }, { fields: FIELDS });
t('T21 merge field inside selected branch resolved', out21.includes('Car: Acme Corp'));
t('T22 unselected branch content fully discarded', !out21.includes('Other:') && !out21.includes('zzz-unselected'));

// murf + condition ordering: conditions evaluate on REAL answers, redaction only masks output
const murfFields: QuestionField[] = [
  { key: 'buyerType', type: 'dropdown', label: 'Buyer', options: ['Company', 'Individual'] },
  { key: 'gstin', type: 'text', label: 'GSTIN', sensitive: true },
];
const murfDoc = block([
  { when: rule('buyerType', 'equals', 'Company'), body: '<p>GSTIN: {{gstin}}</p>' },
  { isElse: true, body: '<p>No GST clause.</p>' },
]);
const outMurf = renderDocument(murfDoc, { buyerType: 'Company', gstin: '22AAAAA0000A1Z5' }, { fields: murfFields, murfed: true });
t('murfed: branch picked from REAL answer', outMurf.includes('GSTIN:') && !outMurf.includes('No GST clause'));
t('murfed: sensitive value redacted', outMurf.includes('__LEGALOK_REDACTED__') && !outMurf.includes('22AAAAA0000A1Z5'));
const outMurf2 = renderDocument(murfDoc, { buyerType: 'Individual', gstin: '22AAAAA0000A1Z5' }, { fields: murfFields, murfed: true });
t('murfed: ELSE branch when buyer is Individual', outMurf2.includes('No GST clause'));

// formatting preserved inside branch body (lists + strong)
const fmtDoc = block([{ when: rule('gstApplicable', 'equals', 'Yes'), body: '<ol><li><strong>GST clause one</strong></li><li>clause two</li></ol>' }]);
const outFmt = renderDocument(fmtDoc, { gstApplicable: 'Yes' }, { fields: FIELDS });
t('formatting preserved (<ol>/<strong>)', outFmt.includes('<ol>') && outFmt.includes('<strong>'));

// missing answers → ELSE renders
t('missing answers → ELSE renders', renderDocument(block([{ when: rule('buyerType', 'equals', 'Company'), body: 'C' }, { isElse: true, body: 'I' }]), {}, { fields: FIELDS }) === 'I');

// empty merge tokens — the parse-error fix (Handlebars "Expecting ID… got CLOSE")
t('empty {{}} merge token stripped before compile (no crash, no braces left)',
  !renderDocument('<p>Party: {{}} end</p>', {}, { fields: [] }).includes('{{'));
t('stripEmptyMergeTokens utility strips {{}} and {{ }}',
  stripEmptyMergeTokens('a {{}} b {{ }} c') === 'a  b  c');
t('stripEmptyMergeTokens leaves real merge fields intact',
  stripEmptyMergeTokens('{{partyName}} is {{}} here') === '{{partyName}} is  here');

/* -------------------- Phase 9: dynamic numbering -------------------- */
console.log('\n— Phase 9: numbering (mergeAdjacentLists) —');
t('numbering: adjacent same-type lists merged',
  mergeAdjacentLists('<ol><li>1a</li></ol><ol><li>1b</li></ol>') === '<ol><li>1a</li><li>1b</li></ol>');
t('numbering: lists separated by empty <p> merged',
  mergeAdjacentLists('<ol><li>a</li></ol><p><br></p><ol><li>b</li></ol>') === '<ol><li>a</li><li>b</li></ol>');
t('numbering: different list types NOT merged',
  mergeAdjacentLists('<ol><li>a</li></ol><ul><li>b</li></ul>').includes('</ol><ul>'));
t('numbering: real content between lists NOT merged',
  mergeAdjacentLists('<ol><li>a</li></ol><p>NOTE</p><ol><li>b</li></ol>').includes('</ol><p>NOTE</p><ol>'));
t('numbering: chain of three lists fully merged',
  mergeAdjacentLists('<ol><li>a</li></ol><ol><li>b</li></ol><ol><li>c</li></ol>') === '<ol><li>a</li><li>b</li><li>c</li></ol>');
const numDoc = `<ol><li>First</li></ol>${block([{ when: rule('gstApplicable', 'equals', 'Yes'), body: '<ol><li>GST</li></ol>' }])}<ol><li>Last</li></ol>`;
t('numbering: pruned conditional between lists → continuous numbering (1. 2. — never 1. 2. 1.)',
  resolveConditionals(numDoc, { gstApplicable: 'No' }, CTX) === '<ol><li>First</li><li>Last</li></ol>');
t('numbering: matching branch list joins the sequence',
  resolveConditionals(numDoc, { gstApplicable: 'Yes' }, CTX) === '<ol><li>First</li><li>GST</li><li>Last</li></ol>');

/* -------------------- Phase 11: conditional table rows -------------------- */
console.log('\n— Phase 11: conditional table rows —');
const esc = (n: ConditionNode): string => escapeAttr(serializeCondition(n));
const rowDoc = `<table><tbody><tr><th>Item</th></tr>`
  + `<tr data-when="${esc(rule('gstApplicable', 'equals', 'Yes'))}"><td>GST row</td></tr>`
  + `<tr><td>Normal row</td></tr></tbody></table>`;
t('row: matching condition keeps row', resolveDocument(rowDoc, { gstApplicable: 'Yes' }, CTX).includes('GST row'));
const rowNo = resolveDocument(rowDoc, { gstApplicable: 'No' }, CTX);
t('row: non-matching condition drops row — no empty <tr> left, others kept',
  !rowNo.includes('GST row') && !rowNo.includes('<tr></tr>') && rowNo.includes('Normal row') && rowNo.includes('<th>Item</th>'));
const legacyRow = '<table><tr data-field="buyerType" data-value="Company" data-op="equals"><td>Company</td></tr>'
  + '<tr data-field="buyerType" data-value="Company" data-op="not_equals"><td>Non-company</td></tr></table>';
const legacyOut = resolveDocument(legacyRow, { buyerType: 'Company' }, CTX);
t('row: legacy attrs (data-field/data-op/data-value) work', legacyOut.includes('<td>Company</td>') && !legacyOut.includes('Non-company'));
const nestedRow = block([{
  when: rule('gstApplicable', 'equals', 'Yes'),
  body: `<table><tr data-when="${esc(rule('financing', 'equals', 'Yes'))}"><td>Financed</td></tr></table>`,
}]);
t('row: rows surfaced by branch pruning resolve too (AND composition)',
  resolveDocument(nestedRow, { gstApplicable: 'Yes', financing: 'Yes' }, CTX).includes('Financed')
  && !resolveDocument(nestedRow, { gstApplicable: 'Yes', financing: 'No' }, CTX).includes('Financed'));
t('row: condition fields collected for publish validation', conditionFieldKeysInHtml(rowDoc).has('gstApplicable'));
t('row: AND-group row condition evaluated',
  (() => {
    const d = `<table><tr data-when="${esc(and(rule('buyerType', 'equals', 'Company'), rule('gstApplicable', 'equals', 'Yes')))}"><td>Both</td></tr></table>`;
    return resolveDocument(d, { buyerType: 'Company', gstApplicable: 'Yes' }, CTX).includes('Both')
      && !resolveDocument(d, { buyerType: 'Company', gstApplicable: 'No' }, CTX).includes('Both');
  })());

/* -------------------- Phase 12: repeat / loop -------------------- */
console.log('\n— Phase 12: repeat / loop —');
const rpt = (collection: string, item: string, body: string): string =>
  `<div class="repeat-block" data-collection="${collection}" data-item="${item}"><div class="repeat-head" contenteditable="false">FOR EACH ${item} IN ${collection}</div><div class="repeat-body">${body}</div></div>`;
t('repeat: iterates scalar array rows',
  resolveDocument(rpt('vehicles', 'v', '<p>{{v}}</p>'), { vehicles: ['A', 'B', 'C'] }, CTX) === '<p>A</p><p>B</p><p>C</p>');
t('repeat: object rows resolve item.sub',
  resolveDocument(rpt('vehicles', 'v', '<p>{{v.model}} ({{v.year}})</p>'), { vehicles: [{ model: 'X1', year: 2020 }, { model: 'X2', year: 2021 }] }, CTX)
    === '<p>X1 (2020)</p><p>X2 (2021)</p>');
t('repeat: scalar rows fill every sub-key ({{v.model}} prints value)',
  resolveDocument(rpt('types', 'v', '<p>{{v.model}}</p>'), { types: ['Car'] }, CTX) === '<p>Car</p>');
t('repeat: missing collection → block removed entirely',
  resolveDocument(rpt('missing', 'v', '<p>x</p>'), {}, CTX) === '');
t('repeat: empty collection → block removed entirely', 
  resolveDocument(rpt('vehicles', 'v', '<p>x</p>'), { vehicles: [] }, CTX) === '');
const condInRepeat = rpt('vehicles', 'v',
  block([{ when: rule('v.type', 'equals', 'Car'), body: '<p>CAR: {{v.name}}</p>' }, { isElse: true, body: '<p>OTHER</p>' }]));
t('repeat: conditional block INSIDE repeat body — per-row branch selection',
  resolveDocument(condInRepeat, { vehicles: [{ type: 'Car', name: 'Swift' }, { type: 'Bike', name: 'Pulsar' }] }, CTX) === '<p>CAR: Swift</p><p>OTHER</p>');
const repeatInCond = block([{ when: rule('showList', 'equals', 'Yes'), body: rpt('vehicles', 'v', '<p>{{v}}</p>') }]);
t('repeat: repeat block inside conditional branch (AND composition)',
  resolveDocument(repeatInCond, { showList: 'Yes', vehicles: ['A'] }, CTX) === '<p>A</p>'
  && resolveDocument(repeatInCond, { showList: 'No', vehicles: ['A'] }, CTX) === '');
const rptList = rpt('vehicles', 'v', '<ol><li>{{v}}</li></ol>');
t('repeat: repeated numbered lists merge into one sequence',
  resolveDocument(rptList, { vehicles: ['A', 'B'] }, CTX) === '<ol><li>A</li><li>B</li></ol>');
t('repeat: no item tokens leak into output',
  !resolveDocument(rpt('vehicles', 'v', '<p>{{v.model}}</p>'), { vehicles: [{ model: 'X' }] }, CTX).includes('{{'));
t('repeat: loop-local item.sub NOT flagged by validation',
  !stripRepeatScopedKeys(['vehicle.model', 'other'], repeatItemVars(rpt('vehicles', 'vehicle', '<p>{{vehicle.model}}</p>')))
    .includes('vehicle.model'));
t('repeat: bare loop variable NOT flagged by validation',
  !repeatItemVars(rpt('vehicles', 'veh', '<p>{{veh}}</p>')).has('vehicles'));
t('repeat: dotted condition (item.sub) evaluates per row',
  resolveDocument(rpt('vehicles', 'v', block([
    { when: rule('v.type', 'equals', 'Car'), body: '<p>CAR</p>' },
    { isElse: true, body: '<p>OTHER</p>' },
  ])), { vehicles: [{ type: 'Car' }, { type: 'Bike' }] }, CTX) === '<p>CAR</p><p>OTHER</p>');
t('repeat: sensitive collection redacted in murfed render',
  resolveDocument(rpt('pins', 'p', '<p>Pin: {{p}}</p>'), { pins: ['1234'] }, { sensitiveKeys: new Set(['pins']) })
    === '<p>Pin: __LEGALOK_REDACTED__</p>'
  && resolveDocument(rpt('pins', 'p', '<p>Pin: {{p}}</p>'), { pins: ['1234'] }, CTX) === '<p>Pin: 1234</p>');

console.log(fail === 0 ? `\n=== CONDITIONS: ALL ${pass} PASSED ===` : `\n=== CONDITIONS: ${fail} FAILED / ${pass} PASSED ===`);
process.exit(fail === 0 ? 0 : 1);
