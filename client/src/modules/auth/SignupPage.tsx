import { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Checkbox, FormControlLabel, Link, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import api, { setSession, getErrorMessage } from '../../services/api';
import { setUser } from '../../store';
import { useToast } from '../../components/common';

function strength(pw: string): { label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score <= 1 ? { label: 'Weak', color: '#EF4444' } : score <= 2 ? { label: 'Medium', color: '#F59E0B' } : { label: 'Strong', color: '#10B981' };
}

export default function SignupPage(): JSX.Element {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = strength(form.password);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setErr('');
    if (form.fullName.trim().length < 2) return setErr('Name must be at least 2 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErr('Please enter a valid email');
    if (form.password.length < 8) return setErr('Password must be at least 8 characters');
    if (form.password !== form.confirm) return setErr('Passwords do not match');
    if (!terms) return setErr('Please agree to the Terms of Service');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register', { fullName: form.fullName, email: form.email, password: form.password });
      setSession(data.accessToken, data.refreshToken);
      dispatch(setUser(data.user));
      toast(`Verification email sent to ${form.email} (auto-verified in MVP)`);
      navigate('/dashboard', { replace: true });
    } catch (e2) {
      setErr(getErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>): void => setForm({ ...form, [k]: e.target.value });

  return (
    <Box sx={{ maxWidth: 440, mx: 'auto', mt: { xs: 2, md: 5 } }}>
      <Card elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h2" sx={{ fontSize: 24, mb: 2 }}>Create Your Legalok Account</Typography>
          <form onSubmit={submit}>
            <TextField fullWidth label="Full Name" value={form.fullName} onChange={set('fullName')} margin="normal" />
            <TextField fullWidth label="Email" type="email" value={form.email} onChange={set('email')} margin="normal" />
            <TextField
              fullWidth label="Password" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} margin="normal"
              InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShow(!show)}>{show ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> }}
            />
            {form.password && (
              <Typography variant="caption" sx={{ color: s.color, fontWeight: 700 }}>Password strength: {s.label}</Typography>
            )}
            <TextField fullWidth label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} margin="normal" />
            <FormControlLabel
              control={<Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} />}
              label={<Typography>I agree to the Terms of Service and Privacy Policy</Typography>}
              sx={{ mt: 1 }}
            />
            {err && <Typography color="error" sx={{ mt: 1 }}>{err}</Typography>}
            <Button type="submit" fullWidth variant="contained" size="large" disabled={busy} sx={{ mt: 2, py: 1.2 }}>
              {busy ? 'Creating account…' : 'Create Account →'}
            </Button>
          </form>
          <Typography textAlign="center" sx={{ mt: 3 }}>
            Already have an account? <Link component={RouterLink} to="/login" fontWeight={700}>Login</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

