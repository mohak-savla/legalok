import { Stack, TextField, MenuItem, Switch, FormControlLabel, IconButton, Divider, Paper, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { QuestionField } from '../../../types';
import { uniqueKey, slugifyKey, isChoice } from './palette';

interface Props {
  field: QuestionField;
  index: number;
  fields: QuestionField[];
  onPatch: (i: number, patch: Partial<QuestionField>) => void;
}

/** Zoho Forms-style right-hand properties panel */
export default function FieldProps({ field, index, fields, onPatch }: Props): JSX.Element {
  const sensitiveDefault = !isChoice(field.type) && field.type !== 'heading';
  return (
    <Paper elevation={0} sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0, border: '1px solid #E5E7EB', borderRadius: 3, p: 2, position: 'sticky', top: 16 }}>
      <Typography fontWeight={800} sx={{ mb: 1.5 }}>Field properties</Typography>
      <Stack spacing={1.5}>
        <TextField size="small" label="Question label" value={field.label} onChange={(e) => onPatch(index, { label: e.target.value })} />
        <Stack direction="row" spacing={0.5} alignItems="center">
          <TextField size="small" label="Field key (merge key)" value={field.key}
            onChange={(e) => onPatch(index, { key: e.target.value.replace(/[^a-z0-9_]/g, '_') })} />
          <IconButton size="small" title="Regenerate from label"
            onClick={() => onPatch(index, { key: uniqueKey(fields.filter((_, i) => i !== index), slugifyKey(field.label || 'field')) })}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
        <FormControlLabel control={<Switch size="small" checked={!!field.required} onChange={(e) => onPatch(index, { required: e.target.checked })} />} label={<Typography>Required</Typography>} />
        <FormControlLabel
          control={<Switch size="small" checked={field.sensitive ?? sensitiveDefault} onChange={(e) => onPatch(index, { sensitive: e.target.checked })} />}
          label={<Typography>Mask until payment (Murfed)</Typography>}
        />
        <TextField size="small" label="Placeholder" value={field.placeholder ?? ''} onChange={(e) => onPatch(index, { placeholder: e.target.value })} />
        {isChoice(field.type) && (
          <TextField size="small" label="Options (one per line)" multiline minRows={3}
            value={(field.options ?? []).join('\n')}
            onChange={(e) => onPatch(index, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
        )}
        <Divider />
        <TextField size="small" label="Guide text (user help)" value={field.helpText ?? ''} onChange={(e) => onPatch(index, { helpText: e.target.value })} />
        <TextField size="small" label="YouTube URL" value={field.youtubeUrl ?? ''} onChange={(e) => onPatch(index, { youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=…" />
        <TextField size="small" label="Sample value (preview)" value={String(field.sample ?? '')} onChange={(e) => onPatch(index, { sample: e.target.value })} />
        <Divider />
        <FormControlLabel
          control={<Switch size="small" checked={!!field.condition?.field}
            onChange={(e) => onPatch(index, { condition: e.target.checked ? { field: fields.find((f) => f.key !== field.key)?.key ?? '', op: 'equals', value: '' } : null })} />}
          label={<Typography>Conditional logic (show/hide)</Typography>}
        />
        {field.condition && (
          <Stack spacing={1.2}>
            <TextField size="small" select label="Show only if field" value={field.condition.field}
              onChange={(e) => onPatch(index, { condition: { ...field.condition!, field: e.target.value } })}>
              {fields.filter((f) => f.key !== field.key).map((f) => <MenuItem key={f.key} value={f.key}>{f.label || f.key}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="Operator" value={field.condition.op}
              onChange={(e) => onPatch(index, { condition: { ...field.condition!, op: e.target.value as 'equals' | 'not_equals' } })}>
              <MenuItem value="equals">equals</MenuItem>
              <MenuItem value="not_equals">not equals</MenuItem>
            </TextField>
            <TextField size="small" label="Value" value={field.condition.value}
              onChange={(e) => onPatch(index, { condition: { ...field.condition!, value: e.target.value } })} />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
