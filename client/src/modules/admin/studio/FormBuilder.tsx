import { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography, Stack, TextField } from '@mui/material';
import type { QuestionField, FieldType } from '../../../types';
import { useToast } from '../../../components/common';
import FormCanvas from './FormCanvas';
import FieldProps from './FieldProps';
import { slugifyKey, uniqueKey, PALETTE, isChoice } from './palette';

interface Props {
  fields: QuestionField[];
  onChange: (f: QuestionField[]) => void;
}

/** Zoho Forms replica: palette → canvas → properties, with two-way JSON binding */
export default function FormBuilder({ fields, onChange }: Props): JSX.Element {
  const toast = useToast();
  const [sel, setSel] = useState(-1);
  const [dropIdx, setDropIdx] = useState(-1);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [json, setJson] = useState('');
  const selected = sel >= 0 && sel < fields.length ? fields[sel] : null;

  useEffect(() => { if (jsonOpen) setJson(JSON.stringify(fields, null, 2)); }, [fields, jsonOpen]);

  const addField = (type: FieldType, atIdx?: number): void => {
    const label = `${PALETTE.find((p) => p.type === type)?.label ?? 'Field'} question`;
    const f: QuestionField = {
      key: uniqueKey(fields, slugifyKey(label)), label: '', type, required: false, condition: null,
      ...(isChoice(type) ? { options: ['Option 1', 'Option 2'] } : {}),
    };
    const next = [...fields];
    next.splice(atIdx ?? fields.length, 0, f);
    onChange(next);
    setSel(next.indexOf(f));
  };

  const patch = (i: number, p: Partial<QuestionField>): void =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));

  const handleDrop = (data: string, atIdx: number): void => {
    if (data.startsWith('new:')) addField(data.slice(4) as FieldType, atIdx);
    else if (data.startsWith('move:')) {
      const from = Number(data.slice(5));
      if (from === atIdx) return;
      const next = [...fields];
      const [f] = next.splice(from, 1);
      next.splice(from < atIdx ? atIdx - 1 : atIdx, 0, f);
      onChange(next);
      setSel(next.indexOf(f));
    }
    setDropIdx(-1);
  };

  const applyJson = (): void => {
    try {
      const parsed = JSON.parse(json) as QuestionField[];
      if (!Array.isArray(parsed)) throw new Error('Expected an array');
      const keys = new Set<string>();
      for (const f of parsed) {
        if (!f.key || keys.has(f.key)) throw new Error(`Duplicate/missing key: ${f.key ?? '(none)'}`);
        keys.add(f.key);
      }
      onChange(parsed);
      toast('JSON applied to builder ✓');
    } catch (e) {
      toast(`Invalid JSON: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Palette */}
      <Paper elevation={0} sx={{ width: { xs: '100%', md: 190 }, flexShrink: 0, border: '1px solid #E5E7EB', borderRadius: 3, p: 1.5 }}>
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ px: 1 }}>FIELD TYPES — click or drag</Typography>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {PALETTE.map((p) => (
            <Box key={p.type} draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', `new:${p.type}`)}
              onClick={() => addField(p.type)}
              sx={{ px: 1.5, py: 1, borderRadius: 2, border: '1px solid #E5E7EB', cursor: 'grab', fontSize: 13, fontWeight: 600, bgcolor: '#fff', '&:hover': { bgcolor: 'primary.light', borderColor: 'primary.main' } }}>
              {p.icon} {p.label}
            </Box>
          ))}
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box onDragOver={(e) => { e.preventDefault(); setDropIdx(fields.length); }} onDrop={(e) => { handleDrop(e.dataTransfer.getData('text/plain'), fields.length); }}>
          <FormCanvas
            fields={fields} sel={sel} dropIdx={dropIdx}
            onSel={setSel} onDropData={handleDrop}
            onDuplicate={(i) => {
              const src = fields[i];
              const copy = { ...src, key: uniqueKey(fields, `${src.key}_copy`), label: `${src.label} (copy)` };
              const next = [...fields];
              next.splice(i + 1, 0, copy);
              onChange(next);
            }}
            onRemove={(i) => { onChange(fields.filter((_, idx) => idx !== i)); setSel(-1); }}
          />
        </Box>

        {/* JSON two-way binding drawer — the WOW factor */}
        <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, mt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1 }}>
            <Typography fontWeight={800}>
              questionnaire_schema.json
              <Typography component="span" variant="caption" color="text.secondary"> — two-way binding with the builder</Typography>
            </Typography>
            <Button size="small" onClick={() => setJsonOpen(!jsonOpen)}>{jsonOpen ? 'Hide' : 'Show JSON'}</Button>
          </Stack>
          {jsonOpen && (
            <Box sx={{ px: 2, pb: 2 }}>
              <TextField fullWidth multiline minRows={10} value={json} onChange={(e) => setJson(e.target.value)}
                InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12.5, bgcolor: '#0F172A', color: '#E2E8F0', borderRadius: 2 } }} />
              <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
                <Button variant="contained" size="small" onClick={applyJson}>Apply JSON → Builder</Button>
                <Button size="small" onClick={() => setJson(JSON.stringify(fields, null, 2))}>Reset from builder</Button>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>

      {selected && sel >= 0 && (
        <FieldProps field={selected} index={sel} fields={fields} onPatch={patch} />
      )}
    </Box>
  );
}
