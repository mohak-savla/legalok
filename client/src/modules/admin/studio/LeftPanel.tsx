/**
 * Document Builder left panel — element library (Zoho Writer-style).
 * Sections: TEXT · STRUCTURE · DYNAMIC · SIGNATURE · FORM FIELDS (searchable).
 * Every item is click-to-insert AND drag-and-drop into the document.
 * Drag payloads: `legalok:<element>` and `merge:<key>` (consumed by TiptapEditor).
 * FORM FIELDS auto-syncs with the Form Builder — it reads the same `fields` state.
 */
import { useRef, useState } from 'react';
import { Box, Typography, Stack, TextField, InputAdornment, Chip, Collapse, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NotesIcon from '@mui/icons-material/Notes';
import TitleIcon from '@mui/icons-material/Title';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ShortTextIcon from '@mui/icons-material/ShortText';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LastPageIcon from '@mui/icons-material/LastPage';
import TableChartIcon from '@mui/icons-material/TableChart';
import ImageIcon from '@mui/icons-material/Image';
import RemoveIcon from '@mui/icons-material/Remove';
import BoltIcon from '@mui/icons-material/Bolt';
import LoopIcon from '@mui/icons-material/Loop';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import type { QuestionField } from '../../../types';

export type PanelElement =
  | 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'quote' | 'hr' | 'pagebreak'
  | 'table'
  | `sig:${'signature' | 'initials' | 'date' | 'name'}`;

interface Props {
  fields: QuestionField[];
  active: boolean;
  onInsertElement: (el: PanelElement) => void;
  onInsertChip: (key: string) => void;
  onInsertImage: (dataUrl: string) => void;
  onOpenCondition: () => void;
  onOpenRepeat: () => void;
}

interface Item { icon: JSX.Element; label: string; el?: PanelElement; chip?: 'image'; disabled?: boolean; hint?: string }

function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}): JSX.Element {
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.5, cursor: 'pointer', userSelect: 'none' }} onClick={onToggle}>
        <Typography variant="caption" fontWeight={800} color="text.secondary">{title}</Typography>
        <IconButton size="small" sx={{ p: 0.25 }} aria-label={`Toggle ${title}`}>
          <ExpandMoreIcon sx={{ fontSize: 18, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
        </IconButton>
      </Stack>
      <Collapse in={open}><Stack spacing={0.5} sx={{ mt: 0.5 }}>{children}</Stack></Collapse>
    </Box>
  );
}

function LpItem({ item, active, payload, onPick }: {
  item: Item; active: boolean; payload?: string; onPick: () => void;
}): JSX.Element {
  const enabled = active && !item.disabled;
  return (
    <Box
      draggable={enabled && !!payload}
      onDragStart={(e) => { if (payload) e.dataTransfer.setData('text/plain', payload); }}
      onClick={() => enabled && onPick()}
      title={enabled ? (item.hint ?? 'Click to insert, or drag into the document') : item.hint ?? 'Switch to Editor mode'}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.9,
        borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#fff',
        cursor: enabled ? 'grab' : 'default', opacity: enabled ? 1 : 0.55,
        transition: 'background-color 160ms ease, border-color 160ms ease',
        '&:hover': enabled ? { bgcolor: 'primary.light', borderColor: 'primary.main' } : {},
      }}
    >
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}>{item.icon}</Box>
      <Typography variant="caption" fontWeight={700} sx={{ flex: 1 }}>{item.label}</Typography>
      {item.disabled && <Chip size="small" label="soon" sx={{ height: 18, fontSize: 10 }} />}
    </Box>
  );
}

export default function LeftPanel({ fields, active, onInsertElement, onInsertChip, onInsertImage, onOpenCondition, onOpenRepeat }: Props): JSX.Element {
  const [open, setOpen] = useState<Record<string, boolean>>({ text: true, structure: true, dynamic: true, signature: true, fields: true });
  const toggle = (k: string): void => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? fields.filter((f) => `${f.label ?? ''} ${f.key}`.toLowerCase().includes(q)) : fields;
  const pickImage = (): void => fileRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { alert('Image too large — please use an image under 1.5 MB.'); return; }
    const r = new FileReader();
    r.onload = () => onInsertImage(String(r.result));
    r.readAsDataURL(f);
  };

  const textItems: Item[] = [
    { icon: <NotesIcon fontSize="small" />, label: 'Paragraph', el: 'paragraph' },
    { icon: <TitleIcon fontSize="small" />, label: 'Heading 1', el: 'h1' },
    { icon: <TextFieldsIcon fontSize="small" />, label: 'Heading 2', el: 'h2' },
    { icon: <ShortTextIcon fontSize="small" />, label: 'Heading 3', el: 'h3' },
    { icon: <FormatListBulletedIcon fontSize="small" />, label: 'Bullet List', el: 'bullet' },
    { icon: <FormatListNumberedIcon fontSize="small" />, label: 'Numbered List', el: 'numbered', hint: 'Numbering auto-renumbers when clauses are added/removed' },
    { icon: <FormatQuoteIcon fontSize="small" />, label: 'Quote', el: 'quote' },
    { icon: <LastPageIcon fontSize="small" />, label: 'Page Break', el: 'pagebreak' },
  ];
  const structureItems: Item[] = [
    { icon: <TableChartIcon fontSize="small" />, label: 'Table (3×3)', el: 'table' },
    { icon: <ImageIcon fontSize="small" />, label: 'Image', chip: 'image' },
    { icon: <RemoveIcon fontSize="small" />, label: 'Divider', el: 'hr' },
  ];
  const signatureItems: Item[] = [
    { icon: <HistoryEduIcon fontSize="small" />, label: 'Signature Block', el: 'sig:signature' },
    { icon: <FingerprintIcon fontSize="small" />, label: 'Initials', el: 'sig:initials' },
    { icon: <EventIcon fontSize="small" />, label: 'Signing Date', el: 'sig:date' },
    { icon: <PersonIcon fontSize="small" />, label: 'Signatory Name', el: 'sig:name' },
  ];

  return (
    <Box sx={{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto', pr: 0.5 }}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />

      <Section title="TEXT" open={open.text} onToggle={() => toggle('text')}>
        {textItems.map((it) => (
          <LpItem key={it.label} item={it} active={active} payload={it.el ? `legalok:${it.el}` : undefined}
            onPick={() => it.el && onInsertElement(it.el)} />
        ))}
      </Section>

      <Section title="STRUCTURE" open={open.structure} onToggle={() => toggle('structure')}>
        {structureItems.map((it) => (
          <LpItem key={it.label} item={it} active={active} payload={it.el ? `legalok:${it.el}` : undefined}
            onPick={() => {
              if (it.el) onInsertElement(it.el);
              else if (it.chip === 'image') pickImage();
            }} />
        ))}
      </Section>

      <Section title="DYNAMIC" open={open.dynamic} onToggle={() => toggle('dynamic')}>
        <LpItem item={{ icon: <BoltIcon fontSize="small" />, label: 'IF / ELSE / ELSE IF', hint: 'Opens the visual condition builder' }}
          active={active} onPick={onOpenCondition} />
        <LpItem item={{ icon: <LoopIcon fontSize="small" />, label: 'REPEAT / LOOP', hint: 'Iterate a list answer once per row (supports nested IF inside the body)' }}
          active={active} onPick={onOpenRepeat} />
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block' }}>
          Merge fields live under FORM FIELDS below.
        </Typography>
      </Section>

      <Section title="SIGNATURE" open={open.signature} onToggle={() => toggle('signature')}>
        {signatureItems.map((it) => (
          <LpItem key={it.label} item={it} active={active} payload={it.el ? `legalok:${it.el}` : undefined}
            onPick={() => it.el && onInsertElement(it.el)} />
        ))}
      </Section>

      <Section title={`FORM FIELDS (${fields.length})`} open={open.fields} onToggle={() => toggle('fields')}>
        <TextField size="small" placeholder="Search fields…" value={query} onChange={(e) => setQuery(e.target.value)}
          fullWidth sx={{ mb: 0.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        {fields.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block' }}>
            Add questions in the Form Builder tab — they appear here automatically.
          </Typography>
        )}
        {filtered.map((f) => (
          <Box key={f.key}
            draggable={active}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', `merge:${f.key}`)}
            onClick={() => active && onInsertChip(f.key)}
            title={active ? 'Drag into the document (works inside IF/ELSE blocks too) or click to insert at cursor' : 'Switch to Editor mode'}
            sx={{
              px: 1.25, py: 0.9, borderRadius: 2, border: '1px solid #E5E7EB', bgcolor: '#fff',
              cursor: active ? 'grab' : 'default',
              transition: 'background-color 160ms ease, border-color 160ms ease',
              '&:hover': active ? { bgcolor: 'primary.light', borderColor: 'primary.main' } : {},
            }}>
            <Typography variant="caption" fontWeight={700} display="block">{f.label || f.key}</Typography>
            <Typography variant="caption" color="primary.main" fontFamily="monospace">{`{{${f.key}}}`}</Typography>
          </Box>
        ))}
        {fields.length > 0 && filtered.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block' }}>No fields match “{query}”.</Typography>
        )}
      </Section>
    </Box>
  );
}

