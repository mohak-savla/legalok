import { useEffect, useState } from 'react';
import { Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import type { AuditRow } from '../../types';

/** Per-document audit trail */
export default function DocumentAudit({ documentId }: { documentId: string }): JSX.Element {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  useEffect(() => {
    api.get('/audit', { params: { documentId } })
      .then((r) => setLogs(r.data.logs))
      .catch((e) => console.error(getErrorMessage(e)));
  }, [documentId]);
  return (
    <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2 }}>
      <Typography variant="h4" sx={{ mb: 1.5 }}>Audit Trail</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>By</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{new Date(a.createdAt).toLocaleString()}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{a.action}</TableCell>
              <TableCell>{a.userEmail ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
