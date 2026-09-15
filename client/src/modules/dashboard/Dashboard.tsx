import { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, List, ListItemButton, ListItemText, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import type { DocumentRow } from '../../types';
import { StatusBadge, EmptyState, Spinner, useToast } from '../../components/common';

export default function Dashboard(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [recent, setRecent] = useState<DocumentRow[] | null>(null);
  const user = JSON.parse(localStorage.getItem('legalok.user') ?? '{}') as { fullName?: string };

  useEffect(() => {
    api.get('/documents/stats').then((r) => setStats(r.data.stats)).catch(() => toast('Unable to load statistics', 'error'));
    api.get('/documents?limit=5').then((r) => setRecent(r.data.documents)).catch(() => toast('Unable to load recent documents', 'error'));
  }, [toast]);

  if (!stats || !recent) return <Spinner />;
  const cards = [
    { label: t('total'), value: stats.total ?? 0, to: '/documents' },
    { label: 'Draft', value: stats.draft ?? 0, to: '/documents?status=draft' },
    { label: 'Paid', value: (stats.generated ?? 0) + (stats.pending_signatures ?? 0) + (stats.partially_signed ?? 0), to: '/documents?status=generated' },
    { label: 'Signed', value: stats.fully_executed ?? 0, to: '/documents?status=fully_executed' },
  ];

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 0.5 }}>{t('welcome')}, {user.fullName?.split(' ')[0]}! 👋</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Manage your legal documents in one place.</Typography>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {cards.map((c) => (
          <Grid item xs={6} md={3} key={c.label}>
            <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,.12)' } }} onClick={() => navigate(c.to)}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography sx={{ fontSize: 34, fontWeight: 800, color: 'primary.main' }}>{c.value}</Typography>
                <Typography color="text.secondary" fontWeight={600}>{c.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
        <Button variant="contained" size="large" onClick={() => navigate('/templates')} sx={{ px: 4 }}>{t('createNew')} →</Button>
        <Button variant="outlined" size="large" onClick={() => navigate('/templates')}>Browse Templates</Button>
      </Stack>

      <Typography variant="h3" sx={{ mb: 2 }}>{t('recent') ?? 'Recent Documents'}</Typography>
      {recent.length === 0 ? (
        <EmptyState title="Welcome to Legalok!" subtitle="You haven't created any documents yet." action={<Button variant="contained" onClick={() => navigate('/templates')}>Create Your First Document →</Button>} />
      ) : (
        <List sx={{ bgcolor: '#fff', border: '1px solid #E5E7EB', borderRadius: 3, py: 0 }}>
          {recent.map((d, i) => (
            <ListItemButton key={d.id} onClick={() => navigate(`/document/${d.id}`)} divider={i < recent.length - 1}>
              <ListItemText
                primary={<Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap"><Typography fontWeight={700}>{d.title}</Typography><StatusBadge status={d.status} /></Stack>}
                secondary={`${d.templateName} · updated ${new Date(d.updatedAt).toLocaleDateString()}`}
              />
              <Typography variant="caption" color="text.secondary">{d.documentNumber ?? ''}</Typography>
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
