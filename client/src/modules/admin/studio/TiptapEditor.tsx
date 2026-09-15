/** Word-like editor built on TipTap — merge chips, IF/ELSE blocks, solid undo/paste/caret */
import { useEffect, useReducer, useState, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Box } from '@mui/material';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import type { QuestionField } from '../../../types';
import { FieldsContext } from './nodeContexts';
import { MergeField } from './mergeNode';
import { ConditionalBlock, CondBranch } from './condBranchNode';
import { SignatureSlot } from './signatureSlotNode';
import { PageBreak } from './pageBreakNode';
import { RepeatBlock } from './repeatNode';
import type { PanelElement } from './LeftPanel';
import EditorToolbar from './editorToolbar';
import { wrapMergeChips, editorHtmlToStorage, legacyIfToBlocks } from './docSerialize';

/** Build a fresh block node for a left-panel element (used by click-insert and drop). */
function buildBlock(schema: Schema, el: PanelElement): PMNode | null {
  const s = schema;
  const para = (): PMNode => s.nodes.paragraph.create();
  if (el.startsWith('sig:')) {
    return s.nodes.signatureSlot ? s.nodes.signatureSlot.create({ kind: el.slice(4) }) : null;
  }
  switch (el) {
    case 'paragraph': return para();
    case 'h1': return s.nodes.heading ? s.nodes.heading.create({ level: 1 }) : null;
    case 'h2': return s.nodes.heading ? s.nodes.heading.create({ level: 2 }) : null;
    case 'h3': return s.nodes.heading ? s.nodes.heading.create({ level: 3 }) : null;
    case 'bullet': return s.nodes.bulletList ? s.nodes.bulletList.create(null, [s.nodes.listItem.create(null, [para()])]) : null;
    case 'numbered': return s.nodes.orderedList ? s.nodes.orderedList.create(null, [s.nodes.listItem.create(null, [para()])]) : null;
    case 'quote': return s.nodes.blockquote ? s.nodes.blockquote.create(null, [para()]) : null;
    case 'hr': return s.nodes.horizontalRule ? s.nodes.horizontalRule.create() : null;
    case 'pagebreak': return s.nodes.pageBreak ? s.nodes.pageBreak.create() : null;
    case 'table': {
      if (!s.nodes.table) return null;
      const head = (): PMNode => s.nodes.tableHeader.create(null, [para()]);
      const cell = (): PMNode => s.nodes.tableCell.create(null, [para()]);
      const row = (cells: PMNode[]): PMNode => s.nodes.tableRow.create(null, cells);
      const rows = [row([head(), head(), head()])];
      for (let r = 0; r < 2; r += 1) rows.push(row([cell(), cell(), cell()]));
      return s.nodes.table.create(null, rows);
    }
    default: return null;
  }
}

/** TableRow + `when` attribute — Phase 11 row conditions (storage: `data-when`). */
const CondTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      when: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-when'),
        renderHTML: (attrs: { when?: string | null }) => (attrs.when ? { 'data-when': attrs.when } : {}),
      },
    };
  },
});

/** The table row containing the current selection, if any. */
function findCurrentRow(editor: Editor): PMNode | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d -= 1) {
    const n = $from.node(d);
    if (n.type.name === 'tableRow') return n;
  }
  return null;
}

export interface EditorApi {
  insertChip: (key: string) => void;
  /** v2: insert a conditional block from branch specs (serialized `when` conditions) */
  insertConditional: (branches: { when: string; isElse: boolean }[]) => void;
  insertSignatureSlot: () => void;
  /** Insert any left-panel element at the cursor */
  insertElement: (el: PanelElement) => void;
  insertImage: (dataUrl: string) => void;
  /** Phase 11: row conditions — read/update the current table row's condition */
  getRowCondition: () => string | null;
  setRowCondition: (when: string | null) => void;
  /** Phase 12: insert a Repeat/Loop block iterating a list answer */
  insertRepeat: (collection: string, item: string) => void;
  getStorageHTML: () => string;
  convertLegacy: (storageHtml: string) => number;
  focus: () => void;
}

interface Props {
  html: string;
  fields: QuestionField[];
  onChange: (storageHtml: string) => void;
  onReady: (api: EditorApi) => void;
  onRowCondition?: () => void;
}

export default function TiptapEditor({ html, fields, onChange, onReady, onRowCondition }: Props): JSX.Element {
  const [, force] = useReducer((x: number) => x + 1, 0);
  // Initial storage value = sanitize html once (empty merge tokens stripped).
  // NEVER call editor.* during render — useEditor is null on first render.
  const [lastEmitted, setLastEmitted] = useState<string>(() => editorHtmlToStorage(html));

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color.configure({ types: ['textStyle'] }), TextAlign.configure({ types: ['heading', 'paragraph'] }), Table.configure({ resizable: false }), CondTableRow, TableHeader, TableCell, Image, MergeField, ConditionalBlock, CondBranch, SignatureSlot, PageBreak, RepeatBlock],
    content: wrapMergeChips(html),
    editorProps: {
      attributes: { class: 'tiptap-doc' },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const data = (event as DragEvent).dataTransfer?.getData('text/plain') ?? '';
        if (!data) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
        if (!pos) return false;
        if (data.startsWith('merge:')) {
          const key = data.slice(6);
          if (!key) return false; // empty merge keys are invalid — never insert
          const node = view.state.schema.nodes.mergeField.create({ key });
          view.dispatch(view.state.tr.insert(pos.pos, node));
          return true;
        }
        if (data.startsWith('legalok:')) {
          const node = buildBlock(view.state.schema, data.slice(8) as PanelElement);
          if (!node) return false;
          view.dispatch(view.state.tr.insert(pos.pos, node));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const storage = editorHtmlToStorage(ed.getHTML());
      setLastEmitted(storage);
      onChange(storage);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const cb = () => force();
    editor.on('transaction', cb);
    return () => { editor.off('transaction', cb); };
  }, [editor]);

  // sync when html changes externally (source apply / legacy convert)
  useEffect(() => {
    if (!editor) return;
    if (html !== lastEmitted) {
      setLastEmitted(html);
      editor.commands.setContent(wrapMergeChips(html));
    }
  }, [html, editor, lastEmitted]);

  useEffect(() => {
    if (!editor) return;
    onReady({
      focus: () => editor.commands.focus(),
      insertChip: (key: string) => {
        if (!key) return;
        editor.chain().focus().insertContent({ type: 'mergeField', attrs: { key } }).run();
      },
      insertConditional: (branches: { when: string; isElse: boolean }[]) =>
        editor.chain().focus().insertContent({
          type: 'conditionalBlock',
          attrs: { field: '' },
          content: branches.map((b) => ({
            type: 'condBranch',
            attrs: { when: b.when, isElse: b.isElse, value: '', op: 'equals' },
            content: [{ type: 'paragraph' }],
          })),
        }).run(),
      insertSignatureSlot: () => editor.chain().focus().insertContent({ type: 'signatureSlot' }).run(),
      insertElement: (el: PanelElement) => {
        const node = buildBlock(editor.schema, el);
        if (node) editor.chain().focus().insertContent(node).run();
      },
      insertImage: (dataUrl: string) => {
        if (dataUrl) editor.chain().focus().setImage({ src: dataUrl }).run();
      },
      getRowCondition: () => (findCurrentRow(editor)?.attrs.when as string | null) ?? null,
      setRowCondition: (when: string | null) => {
        if (findCurrentRow(editor)) editor.chain().focus().updateAttributes('tableRow', { when }).run();
      },
      insertRepeat: (collection: string, item: string) => {
        if (!collection) return;
        editor.chain().focus().insertContent({
          type: 'repeatBlock',
          attrs: { collection, item: item.trim() || 'item' },
          content: [{ type: 'paragraph' }],
        }).run();
      },
      getStorageHTML: () => editorHtmlToStorage(editor.getHTML()),
      convertLegacy: (storageHtml: string) => {
        const { html: converted, count } = legacyIfToBlocks(storageHtml);
        if (count > 0) {
          setLastEmitted(converted);
          editor.commands.setContent(wrapMergeChips(converted));
          onChange(converted);
        }
        return count;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return <Box sx={{ minHeight: 460 }} />;
  return (
    <FieldsContext.Provider value={fields}>
      <EditorToolbar editor={editor} onRowCondition={onRowCondition} />
      <EditorContent editor={editor} />
    </FieldsContext.Provider>
  );
}