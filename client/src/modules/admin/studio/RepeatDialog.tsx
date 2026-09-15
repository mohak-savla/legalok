/**
 * Phase 12 — Repeat dialog: choose the list field (collection) + loop variable.
 */
import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem } from '@mui/material';
import type { QuestionField } from '../../../types';

interface Props {
  open: boolean;
  fields: QuestionField[];
  onClose: () => void;
  onInsert: (collection: string, item: string) => void;
}

export default function RepeatDialog({ open, fields, onClose, onInsert }: Props): JSX.Element {
  const [collection, setCollection] = useState(fields[0]?.key ?? '');
  const [item, setItem] = useState('item');
  const finish = (): void => {
    if (!collection) return;
    onInsert(collection, item.trim() || 'item');
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>🔁 Repeat / Loop</DialogTitle>
      <DialogContent>
        <TextField select fullWidth label="Collection (list field)" value={collection}
          onChange={(e) => setCollection(e.target.value)} margin="normal">
          {fields.map((f) => <MenuItem key={f.key} value={f.key}>{f.label || f.key}{f.type === 'checkbox' ? ' · multi-select' : ''}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Loop variable — reference rows as {{item}} or {{item.field}}"
          value={item} onChange={(e) => setItem(e.target.value)} margin="normal"
          helperText="Example: vehicle → {{vehicle.model}}" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!collection} onClick={finish}>Insert ✓</Button>
      </DialogActions>
    </Dialog>
  );
}