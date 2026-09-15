import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, Stack, Chip, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import api, { getErrorMessage } from '../../services/api';
import { setUser } from '../../store';
import { useToast, Spinner } from '../../components/common';
import { LANGS } from '../../i18n';

interface Me { id: string; email: string; fullName: string; phone: string | null; preferredLanguage: string; authProvider: string; createdAt: string }

export default function Profile(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const dispatch = useDispatch();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', preferredLanguage: 'en' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      const u: Me = r.data.user;
      setMe(u);
      setForm({ fullName: u.fullName, phone: u.phone ?? '', preferredLanguage: u.preferredLanguage });
    }).catch((e) => toast(getErrorMessage(e), 'error'));
  }, [toast]);

  if (!me) return <Spinner label="Loading profile…" />;

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.put('/auth/me', form);
      dispatch(setUser(data.user));
      toast('Profile updated successfully!');
      if (form.preferredLanguage !== me.preferredLanguage) {
        localStorage.setItem('legalok.lang', form.preferredLanguage);
        window.location.reload();
      }
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h2" sx={{ mb: 2.5 }}>👤 {t('profile')}</Typography>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800 }}>
              {me.fullName.slice(0, 1).toUpperCase()}
            </Box>
            <Box>
              <Typography fontWeight={800}>{me.fullName}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Chip size="small" label={me.email} />
                <Chip size="small" label={me.authProvider} variant="outlined" />
              </Stack>
            </Box>
          </Stack>
          <Stack spacing={2}>
            <TextField label="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography color="text.secondary">{t('language')}:</Typography>
              <Select size="small" value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} sx={{ width: 160 }}>
                {LANGS.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
              </Select>
            </Stack>
            <Button variant="contained" onClick={save} disabled={busy} sx={{ alignSelf: 'flex-start', px: 4 }}>Save Changes</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            Member since {new Date(me.createdAt).toLocaleDateString()} · Password changes & 2FA arrive with production auth hardening.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
