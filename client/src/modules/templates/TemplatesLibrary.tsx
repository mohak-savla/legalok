import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, TextField, InputAdornment, Tabs, Tab, IconButton, Stack, Pagination } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../services/api';
import type { TemplateListItem } from '../../types';
import { PriceBadge, EmptyState, Spinner, useToast } from '../../components/common';

export default function TemplatesLibrary(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'all' | 'business' | 'personal'>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<TemplateListItem[] | null>(null);
  const [meta, setMeta] = useState<{ categories: string[]; counts: { all: number; business: number; personal: number } } | null>(null);
  const page = parseInt(params.get('page') ?? '1', 10);
  const perPage = 9;

  const load = useCallback(async (): Promise<void> => {
    setRows(null);
    try {
      const { data } = await api.get('/templates', { params: { q: q || undefined, audience: tab === 'all' ? undefined : tab } });
      setRows(data.templates);
      setMeta(data.meta);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
      setRows([]);
    }
  }, [q, tab, toast]);

  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const toggleFav = async (tpl: TemplateListItem): Promise<void> => {
    try {
      if (tpl.isFavorite) {
        await api.delete(`/favorites/${tpl.id}`);
        toast('Removed from favorites', 'info');
      } else {
        await api.post(`/favorites/${tpl.id}`);
        toast(`${tpl.name} added to favorites`);
      }
      setRows((prev) => (prev ?? []).map((r) => (r.id === tpl.id ? { ...r, isFavorite: !r.isFavorite } : r)));
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    }
  };

  const pages = Math.max(1, Math.ceil((rows?.length ?? 0) / 9));
  const shown = (rows ?? []).slice((page - 1) * 9, page * 9);

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2 }}>📝 Document Templates</Typography>
      <TextField
        fullWidth placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 2, maxWidth: 480 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 700 } }}>
        <Tab value="all" label={`${t('all')} (${meta?.counts.all ?? '…'})`} />
        <Tab value="business" label={`${t('business')} (${meta?.counts.business ?? '…'})`} />
        <Tab value="personal" label={`${t('personal')} (${meta?.counts.personal ?? '…'})`} />
      </Tabs>

      {!rows ? <Spinner /> : shown.length === 0 ? (
        <EmptyState title="No templates found" subtitle="Try a different search or category." />
      ) : (
        <>
          <Grid container spacing={2.5}>
            {shown.map((tpl) => (
              <Grid item xs={12} sm={6} md={4} key={tpl.id}>
                <Card sx={{ height: '100%', borderRadius: 3, transition: '.2s', '&:hover': { boxShadow: '0 8px 24px rgba(0,0,0,.12)', transform: 'translateY(-2px)' } }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box onClick={() => window.location.assign(`/template/${tpl.id}`)} sx={{ cursor: 'pointer', flex: 1 }}>
                        <Typography variant="h4" sx={{ fontSize: 16.5, mb: 0.5 }}>{tpl.name}</Typography>
                        <Typography color="text.secondary" sx={{ minHeight: 38, mb: 1 }}>{tpl.description}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          📋 {tpl.questionCount} {t('questions')} · ⏱ ~{tpl.estimatedTimeMinutes} min · {tpl.category}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => toggleFav(tpl)} sx={{ color: tpl.isFavorite ? '#F59E0B' : '#9CA3AF' }}>
                        {tpl.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                      <PriceBadge isPaid={tpl.isPaid} price={tpl.price} />
                      <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => window.location.assign(`/template/${tpl.id}`)}>
                        Create →
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          {pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination count={pages} page={page} onChange={(_, p) => { window.location.assign(`/templates?page=${p}`); }} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
