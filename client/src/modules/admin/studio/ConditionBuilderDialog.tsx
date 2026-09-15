/**
 * Visual condition builder — recursive AND/OR group editor.
 * Used by:
 *  - "Insert IF / ELSE" (insert mode → one or more branch specs)
 *  - Branch ⚙ Edit (edit mode → serialized ConditionNode JSON)
 * Operators are filtered by the selected field's type (shared engine).
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  FormControlLabel, Checkbox, Typography, Stack, Box, IconButton, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  ConditionGroup, ConditionRule, ConditionNode, ConditionOperator,
  operatorsFor, needsValue, operatorLabel, categoryOf, serializeCondition, parseCondition,
} from '@engine/condition-engine';
import type { QuestionField } from '../../../types';

export interface BranchSpec { when: string; isElse: boolean }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function newRule(field?: QuestionField): ConditionRule {
  return {
    type: 'rule',
    field: field?.key ?? '',
    operator: (operatorsFor(field?.type)[0] ?? 'equals') as ConditionOperator,
    value: '',
  };
}

export function newGroup(first?: ConditionNode): ConditionGroup {
  return { type: 'group', logic: 'AND', items: [first ?? newRule()] };
}

/** Any condition → normal root group (wraps bare rules). */
function asRootGroup(node: ConditionNode | null): ConditionGroup {
  if (!node) return newGroup();
  if (node.type === 'group') return node;
  return { type: 'group', logic: 'AND', items: [node] };
}

/* ------------------------------ Rule row ------------------------------- */

function RuleRow({ rule, fields, onChange, onRemove, canRemove }: {
  rule: ConditionRule;
  fields: QuestionField[];
  onChange: (r: ConditionRule) => void;
  onRemove: () => void;
  canRemove: boolean;
}): JSX.Element {
  const field = fields.find((f) => f.key === rule.field);
  const category = categoryOf(field?.type);
  const ops = operatorsFor(field?.type);
  const options = (field?.options ?? []) as string[];
  const valueOps = needsValue(rule.operator);

  const setVal = (v: unknown): void => onChange({ ...rule, value: v });
  const bounds = Array.isArray(rule.value) && rule.value.length >= 2 ? (rule.value as unknown[]) : [undefined, undefined];

  const valueEditor = (): JSX.Element | null => {
    if (!valueOps || category === 'boolean') return null;
    if (category === 'number') {
      if (rule.operator === 'between') {
        return (
          <Stack direction="row" spacing={0.5}>
            <TextField size="small" type="number" placeholder="min" value={bounds[0] ?? ''}
              onChange={(e) => setVal([e.target.value === '' ? '' : Number(e.target.value), bounds[1] ?? ''])} sx={{ width: 92 }} />
            <TextField size="small" type="number" placeholder="max" value={bounds[1] ?? ''}
              onChange={(e) => setVal([bounds[0] ?? '', e.target.value === '' ? '' : Number(e.target.value)])} sx={{ width: 92 }} />
          </Stack>
        );
      }
      return <TextField size="small" type="number" placeholder="value" value={rule.value === undefined || rule.value === null ? '' : String(rule.value)}
        onChange={(e) => setVal(e.target.value === '' ? '' : Number(e.target.value))} sx={{ width: 120 }} />;
    }
    if (category === 'date') {
      if (rule.operator === 'between') {
        return (
          <Stack direction="row" spacing={0.5}>
            <TextField size="small" type="date" value={String(bounds[0] ?? '')} InputLabelProps={{ shrink: true }}
              onChange={(e) => setVal([e.target.value, bounds[1] ?? ''])} sx={{ width: 150 }} />
            <TextField size="small" type="date" value={String(bounds[1] ?? '')} InputLabelProps={{ shrink: true }}
              onChange={(e) => setVal([bounds[0] ?? '', e.target.value])} sx={{ width: 150 }} />
          </Stack>
        );
      }
      return <TextField size="small" type="date" value={String(rule.value ?? '')} InputLabelProps={{ shrink: true }}
        onChange={(e) => setVal(e.target.value)} sx={{ width: 160 }} />;
    }
    if ((category === 'select' || category === 'multiselect') && options.length > 0) {
      return (
        <TextField size="small" select value={String(rule.value ?? '')} sx={{ minWidth: 120 }} onChange={(e) => setVal(e.target.value)}>
          <MenuItem value=""><em>value…</em></MenuItem>
          {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      );
    }
    return <TextField size="small" placeholder="value" value={String(rule.value ?? '')}
      onChange={(e) => setVal(e.target.value)} sx={{ width: 140 }} />;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      <TextField size="small" select value={rule.field} sx={{ minWidth: 150 }}
        onChange={(e) => {
          const f = fields.find((x) => x.key === e.target.value);
          onChange({ type: 'rule', field: e.target.value, operator: (operatorsFor(f?.type)[0] ?? 'equals') as ConditionOperator, value: '' });
        }}>
        <MenuItem value="" disabled><em>field…</em></MenuItem>
        {fields.map((f) => <MenuItem key={f.key} value={f.key}>{f.label || f.key}</MenuItem>)}
      </TextField>
      <TextField size="small" select value={rule.operator} sx={{ minWidth: 170 }}
        onChange={(e) => onChange({ ...rule, operator: e.target.value as ConditionOperator, value: needsValue(e.target.value as ConditionOperator) ? rule.value : undefined })}>
        {ops.map((o) => <MenuItem key={o} value={o}>{operatorLabel(o)}</MenuItem>)}
      </TextField>
      {valueEditor()}
      {canRemove && <IconButton size="small" onClick={onRemove} title="Remove condition"><DeleteIcon sx={{ fontSize: 15 }} /></IconButton>}
    </Box>
  );
}

/* --------------------------- Recursive group ---------------------------- */

function GroupEditor({ group, fields, path, root, setRoot, depth }: {
  group: ConditionGroup;
  fields: QuestionField[];
  /** Path of THIS group inside root. */
  path: number[];
  root: ConditionGroup;
  setRoot: (g: ConditionGroup) => void;
  depth: number;
}): JSX.Element {
  const updateChild = (idx: number, node: ConditionNode): void => {
    const next = clone(root);
    const parent = nodeAt(next, path);
    parent.items[idx] = node;
    setRoot(next);
  };
  const removeChild = (idx: number): void => {
    const next = clone(root);
    const parent = nodeAt(next, path);
    parent.items.splice(idx, 1);
    if (parent.items.length === 0) parent.items.push(newRule()); // never leave an empty group
    setRoot(next);
  };
  const addChild = (node: ConditionNode): void => {
    const next = clone(root);
    const parent = nodeAt(next, path);
    parent.items.push(node);
    setRoot(next);
  };

  return (
    <Box sx={{
      border: '1px dashed #C4B5FD', borderRadius: 2, p: 1, mt: depth > 0 ? 1 : 0,
      bgcolor: depth > 0 ? '#FAF5FF' : 'transparent', minWidth: 0,
    }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <ToggleButtonGroup size="small" exclusive value={group.logic}
          onChange={(_, v) => { if (v) { const next = clone(root); nodeAt(next, path).logic = v; setRoot(next); } }}>
          <ToggleButton value="AND" sx={{ px: 1.2, py: 0.1, fontSize: 11, fontWeight: 800 }}>AND</ToggleButton>
          <ToggleButton value="OR" sx={{ px: 1.2, py: 0.1, fontSize: 11, fontWeight: 800 }}>OR</ToggleButton>
        </ToggleButtonGroup>
        {depth > 0 && (
          <IconButton size="small" title="Remove group" onClick={() => {
            const next = clone(root);
            const parentPath = path.slice(0, -1);
            const parent = nodeAt(next, parentPath);
            parent.items.splice(path[path.length - 1], 1);
            if (parent.items.length === 0) parent.items.push(newRule());
            setRoot(next);
          }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
        )}
      </Stack>
      <Stack spacing={0.75}>
        {group.items.map((item, idx) => (
          item.type === 'rule' ? (
            <RuleRow key={idx} rule={item} fields={fields} canRemove={group.items.length > 1}
              onChange={(r) => updateChild(idx, r)} onRemove={() => removeChild(idx)} />
          ) : (
            <GroupEditor key={idx} group={item} fields={fields} depth={depth + 1}
              path={[...path, idx]} root={root} setRoot={setRoot} />
          )
        ))}
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
        <Button size="small" startIcon={<AddIcon />} sx={{ fontSize: 11 }} onClick={() => addChild(newRule())}>rule</Button>
        <Button size="small" startIcon={<AddIcon />} sx={{ fontSize: 11 }} onClick={() => addChild(newGroup())}>(group)</Button>
      </Stack>
    </Box>
  );
}

/** Node at [i0, i1, …] from the root group. */
function nodeAt(root: ConditionGroup, path: number[]): ConditionGroup {
  let g = root;
  for (const i of path) g = g.items[i] as ConditionGroup;
  return g;
}

/* ------------------------------- Dialogs -------------------------------- */

/** Insert mode: build branches → TipTap ConditionalBlock. Edit mode: one condition. */
export default function ConditionBuilderDialog({ open, fields, mode = 'insert', initialFieldKey, initialWhen, onClose, onInsert, onSave, onRemove }: {
  open: boolean;
  fields: QuestionField[];
  mode?: 'insert' | 'edit';
  /** insert mode: pre-selected field key (from the merge panel) */
  initialFieldKey?: string;
  /** edit mode: currently serialized condition */
  initialWhen?: string;
  onClose: () => void;
  onInsert?: (branches: BranchSpec[]) => void;
  onSave?: (when: string) => void;
  /** edit mode: offer removing the condition entirely (e.g. table rows) */
  onRemove?: () => void;
}): JSX.Element {
  const [root, setRoot] = useState<ConditionGroup>(() => newGroup(newRule(fields.find((f) => f.key === initialFieldKey))));
  const [perOption, setPerOption] = useState(false);
  const [includeElse, setIncludeElse] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      setRoot(asRootGroup(parseCondition(initialWhen ?? '')));
    } else {
      setRoot(newGroup(newRule(fields.find((f) => f.key === initialFieldKey))));
      setPerOption(false);
      setIncludeElse(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialWhen, initialFieldKey]);

  const choiceField = fields.find((f) => f.key === (root.items[0] as ConditionRule | undefined)?.field);
  const isChoice = !!choiceField && ['dropdown', 'radio', 'checkbox'].includes(choiceField.type);
  const options = (choiceField?.options ?? []) as string[];

  const rootHasField = root.items.some((i) => i.type === 'rule' && !!(i as ConditionRule).field);

  const finish = (): void => {
    // flatten a single-rule root into the rule itself for clean storage
    const when = root.items.length === 1 && root.items[0].type === 'rule'
      ? serializeCondition(root.items[0])
      : serializeCondition(root);
    if (mode === 'edit') onSave?.(when);
    else onInsert?.([{ when, isElse: false }]);
    onClose();
  };

  const insertPerOption = (): void => {
    const branches: BranchSpec[] = options.map((o) => ({
      when: serializeCondition({ type: 'rule', field: choiceField!.key, operator: 'equals', value: o }),
      isElse: false,
    }));
    if (includeElse) branches.push({ when: '', isElse: true });
    onInsert?.(branches);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'edit' ? '⚡ Edit condition' : '⚡ Insert IF / ELSE logic'}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {mode === 'insert' && isChoice && (
            <FormControlLabel
              control={<Checkbox checked={perOption} onChange={(e) => setPerOption(e.target.checked)} />}
              label={<Typography variant="body2">One branch per option ({options.length} ELSE-IF branches — each option can drive different clause text)</Typography>}
            />
          )}
          {!(mode === 'insert' && perOption && isChoice) && (
            <>
              <GroupEditor group={root} fields={fields} path={[]} root={root} setRoot={setRoot} depth={0} />
              {!rootHasField && (
                <Typography variant="caption" color="warning.main">Pick a form field in the first rule.</Typography>
              )}
            </>
          )}
          {mode === 'insert' && (
            <FormControlLabel
              control={<Checkbox checked={includeElse} onChange={(e) => setIncludeElse(e.target.checked)} />}
              label={<Typography variant="body2">Add ELSE branch (fallback text when nothing matches)</Typography>}
            />
          )}
          <Typography variant="caption" color="text.secondary">
            Only the FIRST matching branch is rendered. Conditions are structural — they never appear in the final document.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {mode === 'edit' && onRemove && (
          <Button color="error" onClick={() => { onRemove(); onClose(); }}>Remove condition</Button>
        )}
        {mode === 'insert' && perOption && isChoice ? (
          <Button variant="contained" disabled={options.length === 0} onClick={insertPerOption}>Insert {options.length} branches →</Button>
        ) : (
          <Button variant="contained" disabled={!rootHasField} onClick={finish}>
            {mode === 'edit' ? 'Save condition' : 'Insert →'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
