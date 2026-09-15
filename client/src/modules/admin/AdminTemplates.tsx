import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Stack, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Switch, FormControlLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import api, { getErrorMessage } from '../../services/api';
import type { TemplateFull } from '../../types';
import { Spinner, useToast } from '../../components/common';

export default function AdminTemplates(): JSX.Element {
  const toast = useToast();
  const [rows, setRows] = useState<TemplateFull[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', category: 'Business', audience: 'business', isPaid: false, price: 0 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/admin/templates');
      setRows(data.templates);
    } catch (e) { toast(getErrorMessage(e), 'error'); setRows([]); }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.post('/admin/templates', { ...draft, questionnaireSchema: [], documentHtml: '' });
      toast('Draft created — open the Studio to build it');
      setCreating(false);
      window.location.assign(`/admin/templates/${data.template.id}/edit`);
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  const publish = async (t: TemplateFull): Promise<void> => {
    try {
      const { data } = await api.post(`/admin/templates/${t.id}/publish`);
      toast(data.message ?? 'Published');
      void load();
    } catch (e) { toast(getErrorMessage(e), 'error'); }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Typography variant="h2">📄 Templates (Admin)</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>New Template</Button>
      </Stack>
      {!rows ? <Spinner /> : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Audience</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Questions</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Usage</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{t.name}<br /><Typography variant="caption" color="text.secondary">v{t.version}</Typography></TableCell>
                  <TableCell>{t.audience}</TableCell>
                  <TableCell>{t.questionCount}</TableCell>
                  <TableCell>{t.isPaid ? `₹${t.price}` : 'Free'}</TableCell>
                  <TableCell><Chip size="small" label={t.status} color={t.status === 'published' ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell>{t.usageCount}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditIcon />} variant="contained" onClick={() => window.location.assign(`/admin/templates/${t.id}/edit`)}>Studio</Button>
                      {t.status !== 'published' && <Button size="small" onClick={() => void publish(t)}>Publish</Button>}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Template name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <TextField select label="Audience" value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>
              <MenuItem value="business">Business</MenuItem>
              <MenuItem value="personal">Personal</MenuItem>
            </TextField>
            <TextField label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <FormControlLabel
              control={<Switch checked={draft.isPaid} onChange={(e) => setDraft({ ...draft, isPaid: e.target.checked })} />}
              label="Paid template"
            />
            {draft.isPaid && <TextField type="number" label="Price (₹)" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={busy || draft.name.trim().length < 3}>Create & Open Studio →</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
