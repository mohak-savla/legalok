/**
 * Phase 10 — Condition Debugger: renders the engine's evaluation tree.
 * ✓/✗ per rule with the actual test-data answer, per branch of every
 * conditional block. Nested blocks appear after their parent (evaluation order).
 */
import { Box, Typography, Paper, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import type { BranchEvalTrace } from '@engine/document-engine';
import type { EvalTrace, ConditionNode } from '@engine/condition-engine';

const OP_LABEL: Record<string, string> = {
  equals: '=', not_equals: '≠', contains: 'contains', not_contains: 'does not contain',
  starts_with: 'starts with', ends_with: 'ends with', is_empty: 'is empty', is_not_empty: 'is not empty',
  greater_than: '>', less_than: '<', greater_than_or_equal: '≥', less_than_or_equal: '≤',
  between: 'between', before: 'is before', after: 'is after',
  on_or_before: 'is on or before', on_or_after: 'is on or after',
  is_true: 'is true', is_false: 'is false',
};
const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty', 'is_true', 'is_false']);

function summarize(node: ConditionNode): string {
  if (node.type === 'group') return `(${node.items.map(summarize).join(` ${node.logic} `)})`;
  const v = node.value === undefined ? ''
    : typeof node.value === 'object' ? JSON.stringify(node.value) : String(node.value);
  return `${node.field} ${OP_LABEL[node.operator] ?? node.operator}${v ? ` ${v}` : ''}`;
}

function fmtAnswer(a: unknown): string {
  if (a === undefined) return '(no answer)';
  if (Array.isArray(a)) return a.length ? a.join(', ') : '(empty selection)';
  if (a === '') return '(empty)';
  return String(a);
}

function TraceNode({ t }: { t: EvalTrace }): JSX.Element {
  if (t.kind === 'group') {
    return (
      <Box sx={{ pl: 1.5, ml: 0.5, borderLeft: '2px solid #E5E7EB' }}>
        <Typography variant="caption" fontWeight={800} sx={{ color: t.result ? '#059669' : '#DC2626' }}>
          {t.logic} → {t.result ? 'TRUE' : 'FALSE'}
        </Typography>
        {t.children.map((c, i) => <TraceNode key={i} t={c} />)}
      </Box>
    );
  }
  const showVal = !NO_VALUE_OPS.has(t.operator);
  const v = showVal ? (typeof t.value === 'object' ? JSON.stringify(t.value) : String(t.value)) : '';
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.15 }}>
      {t.result
        ? <CheckCircleIcon sx={{ fontSize: 14, color: '#10B981' }} />
        : <CancelIcon sx={{ fontSize: 14, color: '#EF4444' }} />}
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
        {t.field} {OP_LABEL[t.operator] ?? t.operator}{v ? ` ${v}` : ''}
        {' '}· answer: <strong>{fmtAnswer(t.answer)}</strong> → {t.result ? 'TRUE' : 'FALSE'}
      </Typography>
    </Stack>
  );
}

export default function ConditionDebugger({ traces }: { traces: BranchEvalTrace[] }): JSX.Element {
  if (traces.length === 0) {
    return (
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          No conditional blocks in this document — nothing to debug.
        </Typography>
      </Paper>
    );
  }
  return (
    <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, mb: 1.5, maxHeight: 280, overflow: 'auto' }}>
      <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        CONDITION DEBUGGER — first matching branch wins · nested blocks listed after their parent
      </Typography>
      {traces.map((b, i) => (
        <Box key={i} sx={{ mb: 0.75 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {b.result
              ? <CheckCircleIcon sx={{ fontSize: 15, color: '#10B981' }} />
              : <CancelIcon sx={{ fontSize: 15, color: '#EF4444' }} />}
            <Typography variant="caption" fontWeight={800}>
              {b.isElse ? 'ELSE' : b.when ? summarize(b.when) : 'IF'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (branch {b.branchIndex + 1}{b.blockField ? ` · block field: ${b.blockField}` : ''}) → {b.result ? 'SELECTED' : 'skipped'}
            </Typography>
          </Stack>
          {(b.engineTrace ?? []).map((e, j) => <TraceNode key={j} t={e} />)}
        </Box>
      ))}
    </Paper>
  );
}
