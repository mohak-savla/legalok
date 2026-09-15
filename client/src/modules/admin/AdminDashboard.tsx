import { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, List, ListItemButton, ListItemText, Table, TableBody, TableCell, TableHead, TableRow, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { Spinner, useToast } from '../../components/common';

interface Stats {
  users: number; revenue: number;
  documents: { total: number; byStatus: Record<string, number> };
  templates: { total: number; published: number };
  payments: { captured: number };
}
interface RecentLog { id: string; action: string; userEmail: string | null; createdAt: string }

export default function AdminDashboard(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentLog[]>([]);

  useEffect(() => {
    api.get('/admin/stats').then((r) => { setStats(r.data.stats); setRecent(r.data.recentAudit); })
      .catch((e) => toast(getErrorMessage(e), 'error'));
  }, [toast]);

  if (!stats) return <Spinner label="Loading admin stats…" />;
  const cards = [
    { label: 'Users', value: stats.users, to: '/admin/users' },
    { label: 'Documents', value: stats.documents.total, to: '/admin/audit' },
    { label: 'Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, to: '/admin/audit' },
    { label: 'Templates', value: `${stats.templates.published}/${stats.templates.total}`, to: '/admin/templates' },
  ];

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>📊 Admin Dashboard</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {cards.map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,.12)' } }} onClick={() => navigate(c.to)}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'primary.main' }}>{c.value}</Typography>
                <Typography color="text.secondary" fontWeight={600}>{c.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>Document pipeline</Typography>
          <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
            <Table size="small">
              <TableBody>
                {Object.entries(stats.documents.byStatus).map(([k, v]) => (
                  <TableRow key={k}><TableCell sx={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</TableCell><TableCell align="right" sx={{ fontWeight: 800 }}>{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/admin/templates')}>Open Template Studio →</Button>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>Recent activity</Typography>
          <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
            <List dense sx={{ px: 1.5 }}>
              {recent.map((r) => (
                <ListItemButton key={r.id} divider>
                  <ListItemText primary={r.action} secondary={`${r.userEmail ?? 'system'} · ${new Date(r.createdAt).toLocaleString()}`} />
                </ListItemButton>
              ))}
            </List>
          </Card>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/admin/audit')}>View full audit log →</Button>
        </Grid>
      </Grid>
    </Box>
  );
}
