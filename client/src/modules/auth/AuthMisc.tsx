import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { useToast } from '../../components/common';

/** Forgot / Reset / Verify-email pages (MVP: emails logged to server console) */
export default function AuthMisc({ view }: { view: 'forgot' | 'reset' | 'verify' }): JSX.Element {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const forgot = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDone(data.message);
      toast('Password reset link sent (see server console in MVP)');
    } catch (e2) { toast(getErrorMessage(e2), 'error'); } finally { setBusy(false); }
  };

  const reset = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token: params.get('token'), password });
      toast(data.message ?? 'Password updated');
      navigate('/login');
    } catch (e2) { toast(getErrorMessage(e2), 'error'); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ maxWidth: 440, mx: 'auto', mt: { xs: 2, md: 6 } }}>
      <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {view === 'forgot' && (
            <>
              <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>🔑 Forgot Password?</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>Enter your account email and we&apos;ll send a reset link.</Typography>
              {done ? (
                <Typography color="success.main" sx={{ mb: 2 }}>{done}</Typography>
              ) : (
                <form onSubmit={forgot}>
                  <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} margin="normal" required />
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 2, py: 1.2 }}>
                    {busy ? 'Sending…' : 'Send Reset Link'}
                  </Button>
                </form>
              )}
            </>
          )}
          {view === 'reset' && (
            <>
              <Typography variant="h2" sx={{ fontSize: 24, mb: 2 }}>🔑 Set a New Password</Typography>
              <form onSubmit={reset}>
                <TextField fullWidth label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} margin="normal" required helperText="At least 8 characters" />
                <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 2, py: 1.2 }}>
                  {busy ? 'Updating…' : 'Update Password'}
                </Button>
              </form>
            </>
          )}
          {view === 'verify' && (
            <>
              <Typography variant="h2" sx={{ fontSize: 24, mb: 1 }}>📧 Verify Your Email</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                In this MVP build, accounts are auto-verified at signup. Verification emails will activate when Amazon SES is wired in.
              </Typography>
            </>
          )}
          <Button component={RouterLink} to="/login" sx={{ mt: 2 }}>← Back to Login</Button>
        </CardContent>
      </Card>
    </Box>
  );
}
