/**
 * Phase 10 — Test Data panel: editable sample answers for Preview.
 * Inputs adapt to each field's type; preview re-renders live as values change.
 */
import { Box, Typography, Stack, TextField, MenuItem, Button, Paper } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { QuestionField } from '../../../types';

interface Props {
  fields: QuestionField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
}

export default function TestDataPanel({ fields, values, onChange, onReset }: Props): JSX.Element {
  const editable = fields.filter((f) => f.type !== 'heading');
  return (
    <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, mb: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" fontWeight={800} color="text.secondary">
          TEST DATA — change values, the document updates live
        </Typography>
        <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset}>Reset</Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1 }}>
        {editable.map((f) => {
          const v = values[f.key];
          const common = { size: 'small' as const, fullWidth: true, label: f.label || f.key };
          let input: JSX.Element;
          if ((f.type === 'dropdown' || f.type === 'radio') && f.options?.length) {
            input = (
              <TextField select {...common} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)}>
                {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            );
          } else if (f.type === 'checkbox' && f.options?.length) {
            const arr = Array.isArray(v) ? (v as string[]) : [];
            input = (
              <TextField select {...common} SelectProps={{ multiple: true }} value={arr}
                onChange={(e) => onChange(f.key, e.target.value)}>
                {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            );
          } else if (f.type === 'checkbox') {
            input = (
              <TextField select {...common} value={v ? 'Yes' : 'No'} onChange={(e) => onChange(f.key, e.target.value === 'Yes')}>
                <MenuItem value="Yes">Yes</MenuItem>
                <MenuItem value="No">No</MenuItem>
              </TextField>
            );
          } else if (f.type === 'date') {
            input = <TextField type="date" {...common} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)} InputLabelProps={{ shrink: true }} />;
          } else if (f.type === 'number') {
            input = <TextField type="number" {...common} value={v === undefined || v === null ? '' : String(v)}
              onChange={(e) => onChange(f.key, e.target.value === '' ? '' : Number(e.target.value))} />;
          } else if (f.type === 'file' || f.type === 'signature') {
            input = <TextField {...common} value="— provided at signing —" disabled />;
          } else {
            input = <TextField {...common} value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)} />;
          }
          return <Box key={f.key}>{input}</Box>;
        })}
      </Box>
    </Paper>
  );
}
