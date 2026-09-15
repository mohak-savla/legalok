import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Stack, Chip, IconButton, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../services/api';
import type { TemplateFull } from '../../types';
import { PriceBadge, Spinner, useToast } from '../../components/common';

export default function TemplateDetail(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const [tpl, setTpl] = useState<TemplateFull | null>(null);

  useEffect(() => {
    api.get(`/templates/${id}`).then((r) => setTpl(r.data.template)).catch((e) => {
      toast(getErrorMessage(e), 'error');
      navigate('/templates');
    });
  }, [id, navigate, toast]);

  if (!tpl) return <Spinner label="Loading template…" />;

  const toggleFav = async (): Promise<void> => {
    try {
      if (tpl.isFavorite) { await api.delete(`/favorites/${tpl.id}`); toast('Removed from favorites', 'info'); }
      else { await api.post(`/favorites/${tpl.id}`); toast('Added to favorites'); }
      setTpl({ ...tpl, isFavorite: !tpl.isFavorite });
    } catch (e) { toast(getErrorMessage(e), 'error'); }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/templates')} sx={{ mb: 2, color: 'text.secondary' }}>Back to Templates</Button>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
            <Box>
              <Typography variant="h2">📄 {tpl.name}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <PriceBadge isPaid={tpl.isPaid} price={tpl.price} />
                <Chip size="small" label={tpl.category} />
                <Chip size="small" label={tpl.audience === 'business' ? t('business') : t('personal')} />
              </Stack>
            </Box>
            <IconButton onClick={toggleFav} sx={{ color: '#F59E0B' }}>
              {tpl.isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 2 }}>{tpl.description}</Typography>
          <Divider sx={{ my: 3 }} />
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography>⏱ Estimated time: ~{tpl.estimatedTimeMinutes} minutes</Typography>
            <Typography>💰 Price: {tpl.isPaid ? `₹${tpl.price}` : t('free')}</Typography>
            <Typography>📋 {tpl.questionCount} {t('questions')} to answer</Typography>
          </Stack>
          <Typography variant="h4" sx={{ mb: 1 }}>What&apos;s included:</Typography>
          <Typography color="text.secondary" component="ul" sx={{ pl: 3, mb: 3 }}>
            <li>Professional legal format</li>
            <li>Download as DOC or print to PDF</li>
            <li>Digital signing (Aadhaar eSign & click-to-sign)</li>
            <li>Guest co-signer via secure email link</li>
          </Typography>
          <Button variant="contained" size="large" sx={{ px: 4, py: 1.3 }} onClick={() => navigate(`/template/${tpl.id}/create`)}>
            {t('start')} →
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
