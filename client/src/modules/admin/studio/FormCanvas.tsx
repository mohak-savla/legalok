import { Box, Paper, Typography, Stack, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { QuestionField, FieldType } from '../../../types';
import { PALETTE } from './palette';

interface Props {
  fields: QuestionField[];
  sel: number;
  dropIdx: number;
  onSel: (i: number) => void;
  onDropData: (data: string, atIdx: number) => void;
  onDuplicate: (i: number) => void;
  onRemove: (i: number) => void;
}

/** Zoho Forms-style canvas with drag-reorder + palette drop targets */
export default function FormCanvas({ fields, sel, dropIdx, onSel, onDropData, onDuplicate, onRemove }: Props): JSX.Element {
  return (
    <Paper
      elevation={0}
      sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2, minHeight: 320, width: '100%' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { onDropData(e.dataTransfer.getData('text/plain'), fields.length); }}
    >
      {fields.length === 0 && (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          Drag a field type here, or click one on the left to add your first question.
        </Typography>
      )}
      <Stack spacing={1}>
        {fields.map((f, i) => (
          <Box
            key={f.key}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', `move:${i}`)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onSel(-2); if (typeof dropIdx === 'number') { /* noop */ } }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropData(e.dataTransfer.getData('text/plain'), i); }}
            onClick={() => onSel(i)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
              bgcolor: sel === i ? 'primary.light' : '#fff',
              border: '1px solid #E5E7EB',
              boxShadow: dropIdx === i ? 'inset 0 3px 0 #2563EB' : 'none',
            }}
          >
            <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'grab' }} />
            <Typography sx={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {f.type === 'heading' ? '🅷 ' : ''}{f.label || <em style={{ color: '#9CA3AF' }}>Untitled {f.type}</em>}
            </Typography>
            <Typography variant="caption" sx={{ bgcolor: '#F1F5F9', px: 1, borderRadius: 1, color: '#475569', fontWeight: 700 }}>{f.type}</Typography>
            {f.required && <Typography variant="caption" color="error">*</Typography>}
            {f.condition?.field && <Typography variant="caption" title="Conditional">⚡</Typography>}
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}><ContentCopyIcon sx={{ fontSize: 16 }} /></IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemove(i); }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
          </Box>
        ))}
      </Stack>
      {fields.length === 0 && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {PALETTE.slice(0, 3).map((p) => (
            <Button key={p.type} size="small" variant="outlined" onClick={() => onDropData(`new:${p.type}`, fields.length)}>
              + Add {p.label}
            </Button>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
