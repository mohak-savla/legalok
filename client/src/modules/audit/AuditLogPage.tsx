import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import type { AuditRow } from '../../types';
import { EmptyState, Spinner, useToast } from '../../components/common';

const ACTIONS = ['all', 'Viewed', 'Created', 'Paid', 'Downloaded', 'Signed'];

export default function AuditLogPage(): JSX.Element {
  const toast = useToast();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/audit', {
        params: { action: action === 'all' ? undefined : action, from: from || undefined, to: to || undefined },
      });
      setRows(data.logs);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
      setRows([]);
    }
  }, [action, from, to, toast]);

  useEffect(() => { const id = window.setTimeout(load, 250); return () => window.clearTimeout(id); }, [load]);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>📋 Audit Log</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField size="small" select label="Filter" value={action} onChange={(e) => setAction(e.target.value)} sx={{ width: 180 }}>
          {ACTIONS.map((a) => <MenuItem key={a} value={a}>{a === 'all' ? 'All actions' : a}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 180 }} />
        <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 180 }} />
      </Stack>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon="📋" title="No Audit Log Entries" subtitle="Your document activities will appear here." />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
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
                  <TableCell sx={{ fontWeight: 600 }}>{a.action}</TableCell>
                  <TableCell>{a.actionCategory}</TableCell>
                  <TableCell>{a.resourceType}</TableCell>
                  <TableCell>{String(a.details?.ip ?? '')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
