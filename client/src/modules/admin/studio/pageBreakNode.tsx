/**
 * Page break — block atom inserted from the Document Builder panel.
 * Editor: dashed visual marker. Final document: invisible on screen,
 * breaks the page when printing (see doc.css @media print).
 */
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

function PageBreakView(): JSX.Element {
  return (
    <NodeViewWrapper className="page-break-node" contentEditable={false} draggable data-drag-handle>
      <span className="page-break-label">⤓ Page break</span>
    </NodeViewWrapper>
  );
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div.page-break' }];
  },
  renderHTML() {
    return ['div', { class: 'page-break' }];
  },
  renderText() {
    return '';
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageBreakView);
  },
});
