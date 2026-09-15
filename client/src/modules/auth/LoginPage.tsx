import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Card, CardContent, TextField, Button, Typography, IconButton, InputAdornment, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Stack, Link } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import api, { setSession, getErrorMessage, oauthLogin } from '../../services/api';
import { oauthEnabled, getSupabase } from '../../services/supabase';
import { setUser } from '../../store';
import { useToast } from '../../components/common';

export default function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [social, setSocial] = useState<null | { provider: string; name: string; email: string }>(null);
  /** Guard so the OAuth-return handshake runs once per page load. */
  const [exchanged, setExchanged] = useState(false);

  // ---- Real OAuth return (Google/Facebook via Supabase): after the provider
  // redirects back, exchange the Supabase token for a Legalok session. ----
  useEffect(() => {
    if (!oauthEnabled || exchanged) return;
    const sb = getSupabase();
    if (!sb) return;
    void sb.auth.getSession().then(async ({ data }) => {
      const access = data.session?.access_token;
      if (!access) return;
      setExchanged(true);
      setBusy(true);
      try {
        const provider = (data.session?.user.app_metadata?.provider as 'google' | 'facebook') ?? 'google';
        const result = await oauthLogin(provider, access);
        setSession(result.accessToken, result.refreshToken);
        dispatch(setUser(result.user));
        toast(`Welcome, ${result.user.fullName}!`);
        navigate((location.state as { from?: string })?.from ?? '/dashboard', { replace: true });
      } catch (e2) {
        toast(getErrorMessage(e2), 'error');
      } finally {
        setBusy(false);
        // The Supabase session is only a handshake — the Legalok JWT is the source of truth.
        void sb.auth.signOut();
      }
    });
  }, [exchanged, dispatch, navigate, toast, location.state]);

  /** Start the real OAuth flow, or fall back to the dev mock when Supabase isn't configured. */
  const startOAuth = async (provider: 'google' | 'facebook'): Promise<void> => {
    const sb = getSupabase();
    if (!sb) {
      setSocial({
        provider,
        name: provider === 'google' ? 'Google User' : 'FB User',
        email: provider === 'google' ? 'google.user@legalok.in' : 'fb.user@legalok.in',
      });
      return;
    }
    setBusy(true);
    const { error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast(error.message, 'error');
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Please enter a valid email');
    if (!password) return setErr('Password is required');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setSession(data.accessToken, data.refreshToken);
      dispatch(setUser(data.user));
      toast(`Welcome back, ${data.user.fullName}!`);
      navigate((location.state as { from?: string })?.from ?? '/dashboard', { replace: true });
    } catch (e2) {
      setErr(getErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const doSocial = async (): Promise<void> => {
    if (!social) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/social', { provider: social.provider, email: social.email, fullName: social.name });
      setSession(data.accessToken, data.refreshToken);
      dispatch(setUser(data.user));
      toast(`Welcome, ${data.user.fullName}! (mock ${social.provider} OAuth)`);
      navigate('/dashboard', { replace: true });
    } catch (e2) {
      toast(getErrorMessage(e2), 'error');
    } finally {
      setBusy(false);
      setSocial(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', mt: { xs: 2, md: 6 } }}>
      <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h2" sx={{ fontSize: 24, mb: 0.5 }}>Welcome back to Legalok</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>Login to continue your documents</Typography>
          <form onSubmit={submit}>
            <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} margin="normal" />
            <TextField
              fullWidth label="Password" type={show ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShow(!show)} edge="end" size="small">{show ? <VisibilityOff /> : <Visibility />}</IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {err && <Typography color="error" sx={{ mt: 1 }}>{err}</Typography>}
            <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 2, py: 1.2 }}>
              {busy ? 'Logging in…' : 'Login →'}
            </Button>
          </form>
          <Box sx={{ textAlign: 'right', mt: 1 }}>
            <Link component={RouterLink} to="/forgot-password">Forgot password?</Link>
          </Box>
          <Divider sx={{ my: 3 }}>or continue with</Divider>
          <Stack direction="row" spacing={1.5}>
            <Button fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled={busy} onClick={() => void startOAuth('google')}>Google</Button>
            <Button fullWidth variant="outlined" startIcon={<FacebookIcon />} disabled={busy} onClick={() => void startOAuth('facebook')}>Facebook</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {oauthEnabled
              ? 'Secured sign-in with Google / Facebook (Supabase Auth).'
              : 'Mock OAuth — add Supabase keys to .env for real Google/Facebook login.'}
          </Typography>
          <Divider sx={{ my: 3 }} />
          <Typography textAlign="center">
            Don&apos;t have an account? <Link component={RouterLink} to="/signup" fontWeight={700}>Sign Up</Link>
          </Typography>
        </CardContent>
      </Card>

      <Dialog open={!!social} onClose={() => setSocial(null)}>
        <DialogTitle>Continue with {social?.provider === 'google' ? 'Google' : 'Facebook'} (mock)</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full name" value={social?.name ?? ''} onChange={(e) => setSocial((s) => (s ? { ...s, name: e.target.value } : s))} margin="normal" />
          <TextField fullWidth label="Email" value={social?.email ?? ''} onChange={(e) => setSocial((s) => (s ? { ...s, email: e.target.value } : s))} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSocial(null)}>Cancel</Button>
          <Button variant="contained" onClick={doSocial} disabled={busy}>Continue →</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

