import { AppBar, Toolbar, Container, Button, Box, Select, MenuItem, Typography, Chip } from '@mui/material';
import { Outlet, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { LANGS } from '../../i18n';

export function LanguagePicker(): JSX.Element {
  const { i18n } = useTranslation();
  return (
    <Select
      size="small"
      value={i18n.language}
      onChange={(e) => {
        i18n.changeLanguage(e.target.value);
        localStorage.setItem('legalok.lang', e.target.value);
      }}
      sx={{ minWidth: 110, bgcolor: 'background.paper', borderRadius: 1, '& .MuiSelect-select': { py: 0.75 } }}
    >
      {LANGS.map((l) => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
    </Select>
  );
}

export function Logo(): JSX.Element {
  return (
    <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
      <Box sx={{ fontSize: 22 }}>⚖️</Box>
      <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'primary.main', letterSpacing: -0.5 }}>Legalok</Typography>
    </Box>
  );
}

export default function PublicLayout(): JSX.Element {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} color="inherit"
        sx={{ top: 0, zIndex: 1100, borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 2, minHeight: 64 }}>
            <Logo />
            <Box sx={{ flex: 1 }} />
            {user && <Chip label={t('dashboard')} onClick={() => navigate('/dashboard')} sx={{ cursor: 'pointer' }} />}
            <LanguagePicker />
            {user ? (
              <Button variant="contained" onClick={() => navigate('/dashboard')}>{t('dashboard')}</Button>
            ) : (
              <>
                <Button component={RouterLink} to="/login">{t('login')}</Button>
                <Button component={RouterLink} to="/signup" variant="contained">{t('signup')}</Button>
              </>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Box key={location.key} className="route-fade">
          <Outlet />
        </Box>
      </Container>
      <Box component="footer" sx={{ py: 4, textAlign: 'center', color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption">
          🔒 256-bit SSL · ✓ Aadhaar eSign compliant · © {new Date().getFullYear()} Legalok — Documents in English, UI in your language
        </Typography>
      </Box>
    </Box>
  );
}
