import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../services/api';
import type { DocumentRow } from '../../types';
import { StatusBadge, EmptyState, Spinner, useToast } from '../../components/common';

export default function MyDocuments(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [status, setStatus] = useState(params.get('status') ?? 'all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/documents', { params: { status, q: q || undefined, sort } });
      setRows(data.documents);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
      setRows([]);
    }
  }, [status, q, sort, toast]);

  useEffect(() => { const id = window.setTimeout(load, 250); return () => window.clearTimeout(id); }, [load]);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>📄 {t('myDocuments')}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField size="small" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 260 }} />
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 190 }}>
          {['all', 'draft', 'awaiting_payment', 'generated', 'pending_signatures', 'partially_signed', 'fully_executed', 'expired'].map((s) => (
            <MenuItem key={s} value={s}>{s === 'all' ? 'All' : s.replace(/_/g, ' ')}</MenuItem>
          ))}
        </TextField>
        <TextField size="small" select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ width: 150 }}>
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="oldest">Oldest</MenuItem>
          <MenuItem value="az">A–Z</MenuItem>
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/templates')}>{t('createNew')}</Button>
      </Stack>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <EmptyState
          title="No Documents Yet"
          subtitle="You haven't created any documents. Start by selecting a template."
          action={<Button variant="contained" onClick={() => navigate('/templates')}>Browse Templates →</Button>}
        />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Template</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Number</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/document/${d.id}`)}>
                  <TableCell sx={{ fontWeight: 600 }}>{d.title}</TableCell>
                  <TableCell color="text.secondary">{d.templateName}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell>{d.documentNumber ?? '—'}</TableCell>
                  <TableCell>{new Date(d.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
