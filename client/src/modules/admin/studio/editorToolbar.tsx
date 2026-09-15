import { Button, Stack, Divider, Tooltip } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease';
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease';
import ImageIcon from '@mui/icons-material/Image';
import type { Editor } from '@tiptap/react';

/** Word-style toolbar driven by TipTap commands */
export default function EditorToolbar({ editor, onRowCondition }: { editor: Editor; onRowCondition?: () => void }): JSX.Element {
  const TBtn = ({ onClick, active, title, children, disabled }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean;
  }): JSX.Element => (
    <Tooltip title={title} arrow>
      <Button size="small" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
        sx={{ minWidth: 34, px: 0.75, border: '1px solid #E5E7EB', borderRadius: 1.5, color: active ? 'primary.main' : 'text.primary', bgcolor: active ? 'primary.light' : '#fff' }}>
        {children}
      </Button>
    </Tooltip>
  );
  const c = (): ReturnType<typeof editor.chain> => editor.chain().focus();
  const inList = editor.isActive('bulletList') || editor.isActive('orderedList');
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mb: 1, p: 1, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E5E7EB' }}>
      <TBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><FormatBoldIcon fontSize="small" /></TBtn>
      <TBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><FormatItalicIcon fontSize="small" /></TBtn>
      <TBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><FormatUnderlinedIcon fontSize="small" /></TBtn>
      <TBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><FormatStrikethroughIcon fontSize="small" /></TBtn>
      <Divider orientation="vertical" flexItem />
      <TBtn title="Heading 1 (title)" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</TBtn>
      <TBtn title="Heading 2 (section)" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</TBtn>
      <TBtn title="Paragraph" active={editor.isActive('paragraph')} onClick={() => c().setParagraph().run()}>¶</TBtn>
      <Divider orientation="vertical" flexItem />
      <TBtn title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>•≡</TBtn>
      <TBtn title="Numbered clauses — numbering stays in sync automatically" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1≡</TBtn>
      <TBtn title="Decrease indent" disabled={!inList} onClick={() => c().liftListItem('listItem').run()}><FormatIndentDecreaseIcon fontSize="small" /></TBtn>
      <TBtn title="Increase indent" disabled={!inList} onClick={() => c().sinkListItem('listItem').run()}><FormatIndentIncreaseIcon fontSize="small" /></TBtn>
      <TBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>❝</TBtn>
      <TBtn title="Horizontal rule" onClick={() => c().setHorizontalRule().run()}>―</TBtn>
      <Button size="small" title="Insert image (from your device)" sx={{ minWidth: 34, border: '1px solid #E5E7EB', borderRadius: 1.5, px: 0.5 }}
        component="label"><ImageIcon fontSize="small" />
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > 1.5 * 1024 * 1024) { alert('Image too large — please use an image under 1.5 MB.'); return; }
          const r = new FileReader();
          r.onload = () => c().setImage({ src: String(r.result) }).run();
          r.readAsDataURL(f);
        }} />
      </Button>
      <Divider orientation="vertical" flexItem />
      <TBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}><FormatAlignLeftIcon fontSize="small" /></TBtn>
      <TBtn title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}><FormatAlignCenterIcon fontSize="small" /></TBtn>
      <TBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}><FormatAlignRightIcon fontSize="small" /></TBtn>
      <TBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => c().setTextAlign('justify').run()}><FormatAlignJustifyIcon fontSize="small" /></TBtn>
      <Divider orientation="vertical" flexItem />
      {editor.isActive('table') && (
        <>
          <TBtn title="Add row below" onClick={() => c().addRowAfter().run()}>R+</TBtn>
          <TBtn title="Add column after" onClick={() => c().addColumnAfter().run()}>C+</TBtn>
          <TBtn title="Delete row" onClick={() => c().deleteRow().run()}>R−</TBtn>
          <TBtn title="Delete column" onClick={() => c().deleteColumn().run()}>C−</TBtn>
          <TBtn title="Toggle header row" active={editor.isActive('tableHeader')} onClick={() => c().toggleHeaderRow().run()}>Hdr</TBtn>
          {onRowCondition && (
            <TBtn title="IF condition for this row — the row appears only when it matches (cursor must be inside the row)" onClick={onRowCondition}>⚡Row</TBtn>
          )}
          <TBtn title="Delete table" onClick={() => c().deleteTable().run()}>✕</TBtn>
          <Divider orientation="vertical" flexItem />
        </>
      )}
      <Button size="small" title="Text color" sx={{ minWidth: 34, border: '1px solid #E5E7EB', borderRadius: 1.5, px: 0.5 }}
        component="label">🎨<input type="color" hidden onChange={(e) => c().setColor(e.target.value).run()} /></Button>
      <TBtn title="Undo (Ctrl+Z)" onClick={() => c().undo().run()}><UndoIcon fontSize="small" /></TBtn>
      <TBtn title="Redo (Ctrl+Y)" onClick={() => c().redo().run()}><RedoIcon fontSize="small" /></TBtn>
    </Stack>
  );
}