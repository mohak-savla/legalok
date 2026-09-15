import { useEffect, useState } from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, Paper, Chip, Stack } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import type { TemplateListItem } from '../../types';
import { PriceBadge } from '../../components/common';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export default function Landing(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector((s: RootState) => s.auth.user);
  const [popular, setPopular] = useState<TemplateListItem[]>([]);

  useEffect(() => {
    api.get('/templates').then((r) => setPopular(r.data.templates.slice(0, 6))).catch(() => {});
  }, []);

  const go = (tpl?: TemplateListItem): void => {
    if (!user) return navigate('/login');
    navigate(tpl ? `/template/${tpl.id}` : '/templates');
  };

  return (
    <Box>
      <Paper elevation={0} sx={{
        p: { xs: 4, md: 7 }, borderRadius: 4, textAlign: 'center', color: '#fff', mb: 5,
        background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
      }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 42 }, mb: 2 }}>{t('tagline')}</Typography>
        <Typography sx={{ opacity: 0.92, maxWidth: 640, mx: 'auto', mb: 3.5, fontSize: 17 }}>{t('heroSub')}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button component={RouterLink} to={user ? '/templates' : '/signup'} variant="contained" size="large" sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: '#EFF6FF' } }} endIcon={<ArrowForwardIcon />}>
            {t('start')}
          </Button>
          <Button component={RouterLink} to={user ? '/templates' : '/login'} variant="outlined" size="large" sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)' }}>
            {t('browse')}
          </Button>
        </Stack>
        <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 4, flexWrap: 'wrap' }}>
          <Chip label="✓ Templates by legal experts" sx={{ bgcolor: 'rgba(255,255,255,.15)', color: '#fff' }} />
          <Chip label="✓ Aadhaar eSign compliant" sx={{ bgcolor: 'rgba(255,255,255,.15)', color: '#fff' }} />
          <Chip label="🔒 256-bit SSL" sx={{ bgcolor: 'rgba(255,255,255,.15)', color: '#fff' }} />
        </Stack>
      </Paper>

      <Typography variant="h2" textAlign="center" sx={{ mb: 4 }}>{t('how')}</Typography>
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {[{ n: 1, h: t('how1'), s: t('how1s') }, { n: 2, h: t('how2'), s: t('how2s') }, { n: 3, h: t('how3'), s: t('how3s') }].map((st) => (
          <Grid item xs={12} md={4} key={st.n}>
            <Card sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>{st.n}</Box>
                <Typography variant="h4" sx={{ mb: 1 }}>{st.h}</Typography>
                <Typography color="text.secondary">{st.s}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h3">Popular documents</Typography>
        <Button component={RouterLink} to={user ? '/templates' : '/login'} endIcon={<ArrowForwardIcon />}>{t('browse')}</Button>
      </Stack>
      <Grid container spacing={2.5}>
        {popular.map((tpl) => (
          <Grid item xs={12} sm={6} md={4} key={tpl.id}>
            <Card sx={{ height: '100%', borderRadius: 3, cursor: 'pointer', transition: '.2s', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,.12)', transform: 'translateY(-2px)' } }} onClick={() => go(tpl)}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h4" sx={{ fontSize: 17 }}>{tpl.name}</Typography>
                  <PriceBadge isPaid={tpl.isPaid} price={tpl.price} />
                </Stack>
                <Typography color="text.secondary" sx={{ minHeight: 40 }}>{tpl.description}</Typography>
                <Typography variant="caption" color="text.secondary">📋 {tpl.questionCount} {t('questions')} · ⏱ ~{tpl.estimatedTimeMinutes} min</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
