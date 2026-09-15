import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';

function MergeFieldView({ node }: NodeViewProps): JSX.Element {
  return (
    <NodeViewWrapper as="span" className="merge-chip" data-merge-key={node.attrs.key} draggable data-drag-handle>
      {`{{${node.attrs.key}}}`}
    </NodeViewWrapper>
  );
}

/** Inline, draggable {{field}} chip */
export const MergeField = Node.create({
  name: 'mergeField',
  inline: true,
  group: 'inline',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({ key: { default: '' } }),
  parseHTML() {
    return [{ tag: 'span[data-merge-key]' }];
  },
  renderHTML({ node }) {
    return ['span', { 'data-merge-key': node.attrs.key, class: 'merge-chip' }, `{{${node.attrs.key}}}`];
  },
  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(MergeFieldView);
  },
});