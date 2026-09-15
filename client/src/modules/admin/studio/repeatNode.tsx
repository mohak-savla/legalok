/**
 * Repeat / Loop block — iterates a list answer (collection) and renders the
 * editable body once per row. The loop variable is set on the block (`item`).
 * Editor chrome never appears in previews or the final document.
 */
import { Node } from '@tiptap/core';
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import { useContext } from 'react';
import { TextField, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { FieldsContext } from './nodeContexts';

function RepeatBlockView({ node, updateAttributes, deleteNode }: NodeViewProps): JSX.Element {
  const fields = useContext(FieldsContext);
  return (
    <NodeViewWrapper className="repeat-block" data-collection={node.attrs.collection} data-item={node.attrs.item} data-repeat-block="true">
      <div className="repeat-head" contentEditable={false}>
        <span className="repeat-badge" data-drag-handle>🔁 FOR EACH</span>
        <TextField
          size="small" variant="standard" value={node.attrs.collection}
          onChange={(e) => updateAttributes({ collection: e.target.value })}
          title="Collection — must match a form field key that holds a list"
          select sx={{ fontSize: 12, '& .MuiSelect-select': { py: 0.25, fontSize: 12 } }}
        >
          {fields.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
        </TextField>
        <span className="repeat-snippet"> IN </span>
        <TextField
          size="small" variant="standard" value={node.attrs.item}
          onChange={(e) => updateAttributes({ item: e.target.value })}
          title="Loop variable — reference rows as {{item}} or {{item.field}}"
          sx={{ fontSize: 12, mt: 0, '& input': { py: 0.25, fontSize: 12 } }}
        />
        <span className="repeat-snippet"> DO</span>
        <IconButton size="small" onClick={deleteNode} sx={{ ml: 0.5 }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
      </div>
      <div className="repeat-body">
        <NodeViewContent className="repeat-body-inner" />
      </div>
    </NodeViewWrapper>
  );
}

export const RepeatBlock = Node.create({
  name: 'repeatBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  addAttributes: () => ({
    collection: { default: '' },
    item: { default: 'item' },
  }),
  parseHTML() {
    return [{
      tag: 'div.repeat-block',
      getAttrs: (el) => ({
        collection: (el as HTMLElement).getAttribute('data-collection') ?? '',
        item: (el as HTMLElement).getAttribute('data-item') ?? 'item',
      }),
      contentElement: (el): HTMLElement => {
        const body = (el as HTMLElement).querySelector('.repeat-body') as HTMLElement | null;
        if (body) return body;
        const frag = document.createElement('div');
        (el as HTMLElement).querySelectorAll(':scope > *').forEach((n) => frag.appendChild(n));
        return frag;
      },
    }];
  },
  renderHTML({ node }) {
    const attrs: Record<string, string> = { class: 'repeat-block', 'data-collection': node.attrs.collection, 'data-item': node.attrs.item };
    return ['div', attrs,
      ['div', { class: 'repeat-head', contenteditable: 'false' }, `FOR EACH ${node.attrs.item} IN ${node.attrs.collection}`],
      ['div', { class: 'repeat-body' }, 0],
    ];
  },
  renderText() { return ''; },
  addNodeView() { return ReactNodeViewRenderer(RepeatBlockView); },
});