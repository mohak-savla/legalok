/**
 * Signature slots — empty blocks the admin drops where signing data is
 * injected at execution time (server-side injectSignatures).
 * kind=signature → full signature block · initials → signer initials ·
 * date → signing date · name → signatory name.
 * Previews render nothing; serializes to `<div class="sig-slot" data-kind="…">`.
 */
import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';

export type SignatureKind = 'signature' | 'initials' | 'date' | 'name';

const LABELS: Record<SignatureKind, string> = {
  signature: '✍️ Signature block — parties who sign appear here',
  initials: '🔖 Initials — signer initials appear here',
  date: '📅 Signing date — date of signing appears here',
  name: '👤 Signatory name — signer name appears here',
};
const SHORT: Record<SignatureKind, string> = {
  signature: 'Signature block', initials: 'Initials', date: 'Signing date', name: 'Signatory name',
};

function SignatureSlotView({ node, selected }: NodeViewProps): JSX.Element {
  const kind = (node.attrs.kind as SignatureKind) || 'signature';
  return (
    <NodeViewWrapper className={`sig-slot sig-kind-${kind}`} data-signature-slot="true" contentEditable={false} draggable data-drag-handle>
      <span className="sig-slot-label">{selected ? SHORT[kind] : LABELS[kind]}</span>
    </NodeViewWrapper>
  );
}

export const SignatureSlot = Node.create({
  name: 'signatureSlot',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      kind: {
        default: 'signature',
        parseHTML: (el) => (el.getAttribute('data-kind') as SignatureKind) || 'signature',
        renderHTML: (attrs) => (attrs.kind && attrs.kind !== 'signature' ? { 'data-kind': attrs.kind } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div.sig-slot' }];
  },
  renderHTML({ node }) {
    const k = node.attrs.kind as SignatureKind | undefined;
    return ['div', { class: 'sig-slot', ...(k && k !== 'signature' ? { 'data-kind': k } : {}) }];
  },
  renderText() {
    return '';
  },
  addNodeView() {
    return ReactNodeViewRenderer(SignatureSlotView);
  },
});
