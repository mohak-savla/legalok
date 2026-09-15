import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { Spinner, useToast } from '../../components/common';

interface UserRow {
  id: string; fullName: string; email: string; role: string; authProvider: string;
  isActive: boolean; createdAt: string; lastLoginAt: string | null; documentCount: number;
}

export default function AdminUsers(): JSX.Element {
  const toast = useToast();
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/admin/users', { params: { q: q || undefined } });
      setRows(data.users);
    } catch (e) { toast(getErrorMessage(e), 'error'); setRows([]); }
  }, [q, toast]);

  useEffect(() => { const id = window.setTimeout(load, 250); return () => window.clearTimeout(id); }, [load]);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>👥 Users Management</Typography>
      <TextField size="small" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 2, width: 300 }} />
      {!rows ? <Spinner /> : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F9FAFB' }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Auth</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Docs</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{u.fullName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role === 'admin' ? <Chip size="small" color="secondary" label="admin" /> : 'user'}</TableCell>
                  <TableCell>{u.authProvider}</TableCell>
                  <TableCell>{u.documentCount}</TableCell>
                  <TableCell><Chip size="small" label={u.isActive ? 'Active' : 'Disabled'} color={u.isActive ? 'success' : 'default'} variant="outlined" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
