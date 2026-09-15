import { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, IconButton, Stack } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import type { TemplateListItem } from '../../types';
import { PriceBadge, EmptyState, Spinner, useToast } from '../../components/common';

export default function Favorites(): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<TemplateListItem[] | null>(null);

  useEffect(() => {
    api.get('/favorites').then((r) => setRows(r.data.favorites)).catch((e) => { toast(getErrorMessage(e), 'error'); setRows([]); });
  }, [toast]);

  if (!rows) return <Spinner />;
  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>⭐ Favorites</Typography>
      {rows.length === 0 ? (
        <EmptyState
          icon="⭐" title="No Favorites Yet"
          subtitle="Star your favorite templates for quick access."
          action={<Button variant="contained" onClick={() => navigate('/templates')}>Browse Templates →</Button>}
        />
      ) : (
        <Grid container spacing={2.5}>
          {rows.map((tpl) => (
            <Grid item xs={12} sm={6} md={4} key={tpl.id}>
              <Card sx={{ height: '100%', borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between">
                    <Box sx={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/template/${tpl.id}`)}>
                      <Typography variant="h4" sx={{ fontSize: 16.5, mb: 0.5 }}>{tpl.name}</Typography>
                      <Typography color="text.secondary" sx={{ minHeight: 38 }}>{tpl.description}</Typography>
                    </Box>
                    <IconButton
                      sx={{ color: '#F59E0B' }}
                      onClick={async () => {
                        try { await api.delete(`/favorites/${tpl.id}`); setRows(rows.filter((r) => r.id !== tpl.id)); toast('Removed from favorites', 'info'); }
                        catch (e) { toast(getErrorMessage(e), 'error'); }
                      }}
                    ><StarIcon /></IconButton>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                    <PriceBadge isPaid={tpl.isPaid} price={tpl.price} />
                    <Button size="small" onClick={() => navigate(`/template/${tpl.id}/create`)}>Create →</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
