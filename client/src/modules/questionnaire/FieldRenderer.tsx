import { useRef } from 'react';
import { Box, TextField, MenuItem, FormControlLabel, Radio, RadioGroup, Checkbox, FormGroup, FormLabel, Button, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { QuestionField } from '../../types';
import SignaturePad from '../../components/document/SignaturePad';
import api, { getErrorMessage } from '../../services/api';

interface Props {
  field: QuestionField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}

/** Renders one questionnaire question of any supported field type */
export default function FieldRenderer({ field, value, onChange, disabled }: Props): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File): Promise<void> => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = String(reader.result).split(',')[1] ?? '';
        const { data } = await api.post('/uploads', { name: file.name, dataB64: b64 });
        onChange({ key: data.key, name: data.name });
      } catch (e) {
        alert(getErrorMessage(e));
      }
    };
    reader.readAsDataURL(file);
  };

  switch (field.type) {
    case 'heading':
      return <Typography variant="h4" sx={{ mb: 1 }}>{field.label}</Typography>;
    case 'textarea':
      return (
        <TextField fullWidth multiline minRows={3} disabled={disabled} placeholder={field.placeholder}
          label={field.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      );
    case 'number':
      return (
        <TextField fullWidth type="number" disabled={disabled} placeholder={field.placeholder}
          label={field.label} value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
      );
    case 'date':
      return <TextField fullWidth type="date" disabled={disabled} label={field.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} InputLabelProps={{ shrink: true }} />;
    case 'email':
      return <TextField fullWidth type="email" disabled={disabled} label={field.label} placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'phone':
      return <TextField fullWidth type="tel" disabled={disabled} label={field.label} placeholder="+91 …" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'dropdown':
      return (
        <TextField fullWidth select disabled={disabled} label={field.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <MenuItem value=""><em>Select…</em></MenuItem>
          {(field.options ?? []).map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      );
    case 'radio':
      return (
        <Box>
          <FormLabel sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>{field.label}</FormLabel>
          <RadioGroup row value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} sx={{ mt: 0.5 }}>
            {(field.options ?? []).map((o) => <FormControlLabel key={o} value={o} control={<Radio disabled={disabled} />} label={o} />)}
          </RadioGroup>
        </Box>
      );
    case 'checkbox': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Box>
          <FormLabel sx={{ fontSize: 14, fontWeight: 600 }}>{field.label}</FormLabel>
          <FormGroup sx={{ mt: 0.5 }}>
            {(field.options ?? []).map((o) => (
              <FormControlLabel key={o} control={
                <Checkbox checked={arr.includes(o)} disabled={disabled}
                  onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
              } label={o} />
            ))}
          </FormGroup>
        </Box>
      );
    }
    case 'file': {
      const f = (value ?? null) as { key?: string; name?: string } | null;
      return (
        <Box>
          <input ref={fileRef} type="file" hidden accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
          <Button variant="outlined" startIcon={<UploadFileIcon />} disabled={disabled} onClick={() => fileRef.current?.click()}>
            {f?.name ? `📎 ${f.name}` : 'Upload file'}
          </Button>
          {f?.key && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>uploaded ✓</Typography>}
        </Box>
      );
    }
    case 'signature':
      return (
        <Box>
          <Typography fontWeight={600} sx={{ mb: 1 }}>{field.label}</Typography>
          <SignaturePad value={typeof value === 'string' ? value : null} onChange={(d) => onChange(d ?? '')} width={420} />
        </Box>
      );
    default:
      return <TextField fullWidth disabled={disabled} label={field.label} placeholder={field.placeholder} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}
