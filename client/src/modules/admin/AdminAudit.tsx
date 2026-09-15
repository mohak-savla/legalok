import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack, Pagination } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import type { AuditRow } from '../../types';
import { Spinner, useToast } from '../../components/common';

export default function AdminAudit(): JSX.Element {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/admin/audit', { params: { category: category === 'all' ? undefined : category, page, limit: 25 } });
      setRows(data.logs);
      setPages(data.pages);
      setTotal(data.total);
    } catch (e) { toast(getErrorMessage(e), 'error'); setRows([]); }
  }, [category, page, toast]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 0.5 }}>📋 System Audit Log</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{total.toLocaleString('en-IN')} entries</Typography>
      <Stack direction="row" sx={{ mb: 2 }}>
        <TextField size="small" select label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} sx={{ width: 200 }}>
          {['all', 'auth', 'document', 'payment', 'signature', 'template', 'admin', 'system'].map((c) => (
            <MenuItem key={c} value={c}>{c === 'all' ? 'All categories' : c}</MenuItem>
          ))}
        </TextField>
      </Stack>
      {!rows ? <Spinner /> : (
        <>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                  <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Who</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Resource</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{new Date(a.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{a.userEmail ?? 'system'}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{a.action}</TableCell>
                    <TableCell>{a.actionCategory}</TableCell>
                    <TableCell>{a.resourceType}</TableCell>
                    <TableCell>{String(a.details?.ip ?? '')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination count={pages} page={page} onChange={(_, p) => setPage(p)} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
