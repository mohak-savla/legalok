import { useContext, useMemo, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { Button, IconButton, Select, MenuItem, Typography, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { FieldsContext, CondFieldContext } from './nodeContexts';
import ConditionBuilderDialog from './ConditionBuilderDialog';
import { parseCondition, needsValue } from '@engine/condition-engine';
import type { ConditionNode } from '@engine/condition-engine';
import type { QuestionField } from '../../../types';

/** Compact one-line summary of a condition tree: Buyer Type = Company AND GST = Yes */
export function summarizeCondition(node: ConditionNode, fields: QuestionField[]): string {
  const SYM: Record<string, string> = {
    equals: '=', not_equals: '≠', contains: 'contains', not_contains: 'not contains',
    starts_with: 'starts with', ends_with: 'ends with',
    is_empty: 'is empty', is_not_empty: 'is not empty',
    greater_than: '>', less_than: '<', greater_than_or_equal: '≥', less_than_or_equal: '≤',
    between: 'between', before: 'before', after: 'after',
    on_or_before: '≤', on_or_after: '≥', is_true: 'is true', is_false: 'is false',
  };
  if (node.type === 'rule') {
    const f = fields.find((x) => x.key === node.field);
    const label = f?.label || node.field || '(no field)';
    if (!needsValue(node.operator)) return `${label} ${SYM[node.operator] ?? node.operator}`;
    const v = Array.isArray(node.value) ? (node.value as unknown[]).join(' – ') : String(node.value ?? '');
    return `${label} ${SYM[node.operator] ?? node.operator} ${v}`;
  }
  const joiner = node.logic === 'AND' ? '  AND  ' : '  OR  ';
  return node.items
    .map((i) => (i.type === 'group' ? `( ${summarizeCondition(i, fields)} )` : summarizeCondition(i, fields)))
    .join(joiner);
}

/* -------------- Conditional wrapper: ELSE-IF/ELSE + legacy field -------------- */

function ConditionalBlockView(props: NodeViewProps): JSX.Element {
  const { node, editor, getPos, updateAttributes, deleteNode } = props;
  const fields = useContext(FieldsContext);
  const branches = node.content.content as readonly { attrs?: { when?: string; isElse?: boolean } }[];
  const hasElse = branches.some((c) => c.attrs?.isElse === true);
  // Legacy branches carry their condition on the block-level data-field attr.
  const hasLegacy = branches.some((c) => !c.attrs?.isElse && !c.attrs?.when);
  const addBranch = (isElse: boolean): void => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().insertContentAt(pos + node.nodeSize - 1, {
      type: 'condBranch',
      attrs: { value: '', op: 'equals', isElse, when: '' },
      content: [{ type: 'paragraph' }],
    }).run();
  };
  return (
    <NodeViewWrapper className="cond-block" data-field={node.attrs.field}>
      <div className="cond-head" contentEditable={false}>
        <Typography component="span" variant="caption" fontWeight={800} sx={{ mr: 0.5, cursor: 'grab' }} data-drag-handle>⚡ IF</Typography>
        {hasLegacy && (
          <Select
            size="small" variant="standard" value={node.attrs.field} displayEmpty
            onChange={(e) => updateAttributes({ field: e.target.value })}
            title="Condition field for legacy (= value) branches"
            sx={{ fontSize: 12, '& .MuiSelect-select': { py: 0.25, fontSize: 12 } }}
          >
            <MenuItem value="" disabled><em>select field…</em></MenuItem>
            {fields.map((f) => <MenuItem key={f.key} value={f.key}>{f.label || f.key}</MenuItem>)}
          </Select>
        )}
        <Button size="small" startIcon={<AddIcon />} disabled={hasElse} onClick={() => addBranch(false)} sx={{ ml: 1, fontSize: 11 }}>
          ELSE IF
        </Button>
        <Button size="small" disabled={hasElse} onClick={() => addBranch(true)} sx={{ ml: 0.5, fontSize: 11 }}>
          + ELSE
        </Button>
        <IconButton size="small" onClick={deleteNode} sx={{ ml: 0.5 }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
      </div>
      <div className="cond-branches">
        <CondFieldContext.Provider value={node.attrs.field}>
          <NodeViewContent className="cond-branches-content" />
        </CondFieldContext.Provider>
      </div>
    </NodeViewWrapper>
  );
}

export const ConditionalBlock = Node.create({
  name: 'conditionalBlock',
  group: 'block',
  content: 'condBranch+',
  defining: true,
  draggable: true,
  addAttributes: () => ({ field: { default: '' } }),
  parseHTML() {
    return [{
      tag: 'div.cond-block',
      getAttrs: (el) => ({ field: (el as HTMLElement).getAttribute('data-field') ?? '' }),
      // canonical structure uses .cond-branches; legacy blocks without it fall
      // back to a fragment of just the branch divs (editing chrome stripped)
      contentElement: (el) => {
        const branches = (el as HTMLElement).querySelector('.cond-branches') as HTMLElement | null;
        if (branches) return branches;
        const frag = document.createElement('div');
        (el as HTMLElement).querySelectorAll(':scope > .cond-body').forEach((n) => frag.appendChild(n));
        return frag;
      },
    }];
  },
  renderHTML({ node }) {
    const attrs: Record<string, string> = { class: 'cond-block' };
    if (node.attrs.field) attrs['data-field'] = node.attrs.field;
    return ['div', mergeAttributes(attrs),
      ['div', { class: 'cond-head', contenteditable: 'false' }, `⚡ IF ${node.attrs.field || ''} — branches`],
      ['div', { class: 'cond-branches' }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ConditionalBlockView);
  },
});

/* ---------------- Branch: condition summary + editable body ---------------- */

function CondBranchView(props: NodeViewProps): JSX.Element {
  const { node, updateAttributes, deleteNode } = props;
  const parentField = useContext(CondFieldContext);
  const fields = useContext(FieldsContext);
  const [editOpen, setEditOpen] = useState(false);
  const whenNode = useMemo(() => parseCondition(node.attrs.when || ''), [node.attrs.when]);

  const head = node.attrs.isElse ? (
    <Typography variant="caption" fontWeight={800}>ELSE (used when nothing above matches)</Typography>
  ) : whenNode ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
      <Typography variant="caption" fontWeight={700} sx={{ color: '#5B21B6' }}>
        {summarizeCondition(whenNode, fields)}
      </Typography>
    </Box>
  ) : (
    <Typography variant="caption" fontWeight={700} sx={{ color: '#9F67FA' }}>
      {node.attrs.value !== '' || node.attrs.op === 'not_equals'
        ? `${node.attrs.op === 'not_equals' ? '≠' : '='} "${node.attrs.value}"`
        : 'IF — click ⚙ to set condition'}
    </Typography>
  );

  return (
    <NodeViewWrapper
      className={node.attrs.isElse ? 'cond-body cond-else' : 'cond-body'}
      {...(node.attrs.when
        ? { 'data-when': node.attrs.when as string }
        : { 'data-value': node.attrs.value as string, 'data-op': node.attrs.op as string })}
      {...(node.attrs.isElse ? { 'data-else': 'true' } : {})}
    >
      <div className="cond-branch-head" contentEditable={false}>
        {head}
        {!node.attrs.isElse && (
          <IconButton size="small" title="Edit condition (AND / OR / operators)" onClick={() => setEditOpen(true)} sx={{ ml: 'auto' }}>
            <EditIcon sx={{ fontSize: 13 }} />
          </IconButton>
        )}
        <IconButton size="small" onClick={deleteNode} title="Delete branch"><DeleteIcon sx={{ fontSize: 13 }} /></IconButton>
      </div>
      <NodeViewContent className="cond-branch-body" />
      <ConditionBuilderDialog
        open={editOpen} mode="edit" fields={fields} initialWhen={node.attrs.when || ''}
        onClose={() => setEditOpen(false)}
        onSave={(when) => updateAttributes({ when })}
      />
    </NodeViewWrapper>
  );
}

export const CondBranch = Node.create({
  name: 'condBranch',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    value: { default: '' },   // legacy single-value condition
    op: { default: 'equals' }, // legacy operator
    isElse: { default: false },
    when: { default: '' },    // v2: serialized ConditionNode JSON (priority over legacy)
  }),
  parseHTML() {
    return [{
      tag: 'div.cond-body',
      getAttrs: (el) => ({
        when: (el as HTMLElement).getAttribute('data-when') ?? '',
        value: (el as HTMLElement).getAttribute('data-value') ?? '',
        op: (el as HTMLElement).getAttribute('data-op') ?? 'equals',
        isElse: (el as HTMLElement).getAttribute('data-else') === 'true',
      }),
      // Content lives in .cond-branch-inner; legacy bare bodies strip the head.
      contentElement: (el) => {
        const inner = (el as HTMLElement).querySelector('.cond-branch-inner') as HTMLElement | null;
        if (inner) return inner;
        const clone = (el as HTMLElement).cloneNode(true) as HTMLElement;
        clone.querySelector('.cond-branch-head')?.remove();
        return clone;
      },
    }];
  },
  renderHTML({ node }) {
    const condAttrs = node.attrs.when
      ? { 'data-when': node.attrs.when as string }
      : { 'data-value': node.attrs.value as string, 'data-op': node.attrs.op as string };
    return ['div', mergeAttributes({
      class: 'cond-body',
      ...condAttrs,
      ...(node.attrs.isElse ? { 'data-else': 'true' } : {}),
    }),
      ['div', { class: 'cond-branch-head', contenteditable: 'false' },
        node.attrs.isElse ? 'ELSE' : (node.attrs.when ? 'IF — condition' : `${node.attrs.op === 'not_equals' ? '≠' : '='} "${node.attrs.value}"`)],
      ['div', { class: 'cond-branch-inner' }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CondBranchView);
  },
});
