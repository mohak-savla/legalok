import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Paper, Button, TextField, FormControlLabel, Checkbox, Stack, Chip } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { Spinner, useToast } from '../../components/common';
import DocumentRenderer from '../../components/document/DocumentRenderer';
import SignaturePad from '../../components/document/SignaturePad';

interface GuestData {
  documentTitle: string; documentNumber: string | null;
  senderName: string; senderEmail: string; message: string | null;
  signerName: string; signerEmail: string; expiresAt: string | null;
}

/** Public guest signing page (User B — no account required) */
export default function GuestSigning(): JSX.Element {
  const { token } = useParams();
  const toast = useToast();
  const [data, setData] = useState<GuestData | null>(null);
  const [html, setHtml] = useState('');
  const [name, setName] = useState('');
  const [drawn, setDrawn] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/sign/${token}`)
      .then((r) => { setData(r.data.signing); setHtml(r.data.documentHtml); setName(r.data.signing.signerName); })
      .catch((e) => setErr(getErrorMessage(e)));
  }, [token]);

  const sign = async (): Promise<void> => {
    if (!drawn) { toast('Please draw your signature', 'warning'); return; }
    if (!confirm) { toast('Please confirm this is your legal signature', 'warning'); return; }
    setBusy(true);
    try {
      await api.post(`/sign/${token}`, { signerName: name, signatureType: 'click', signatureData: drawn, confirm: true });
      setDone(true);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally { setBusy(false); }
  };

  if (err) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
        <Paper sx={{ p: 5, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
          <Typography sx={{ fontSize: 40, mb: 1 }}>⚠️</Typography>
          <Typography variant="h3" gutterBottom>Can&apos;t open this link</Typography>
          <Typography color="text.secondary">{err}</Typography>
        </Paper>
      </Box>
    );
  }
  if (done) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
        <Paper sx={{ p: 5, maxWidth: 480, textAlign: 'center', borderRadius: 3 }}>
          <Typography sx={{ fontSize: 48, mb: 1 }}>🎉</Typography>
          <Typography variant="h2" gutterBottom>Document signed!</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Thank you — both parties have been notified. You can close this window.</Typography>
          <Button component={RouterLink} to="/" variant="contained">Visit Legalok</Button>
        </Paper>
      </Box>
    );
  }
  if (!data) return <Spinner label="Loading document…" />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'primary.main', mb: 3 }}>⚖️ Legalok · Signature Request</Typography>
        <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3, mb: 3, border: '1px solid #E5E7EB' }}>
          <Typography color="text.secondary">
            <strong>{data.senderName}</strong> ({data.senderEmail}) has requested your signature on:
          </Typography>
          <Typography variant="h3" sx={{ mt: 0.5 }}>{data.documentTitle}</Typography>
          {data.documentNumber && <Chip size="small" label={data.documentNumber} sx={{ mt: 1 }} />}
          {data.message && <Typography sx={{ mt: 1.5, fontStyle: 'italic' }}>&ldquo;{data.message}&rdquo;</Typography>}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, mb: 3, border: '1px solid #E5E7EB', maxHeight: 520, overflow: 'auto' }}>
          <DocumentRenderer html={html} />
        </Paper>

        <Paper elevation={0} sx={{ p: 3.5, borderRadius: 3, border: '1px solid #E5E7EB' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>✍️ Sign as</Typography>
          <Stack spacing={2}>
            <TextField label="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
            <SignaturePad value={drawn} onChange={setDrawn} width={560} />
            <FormControlLabel
              control={<Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
              label={<Typography>I confirm this is my legal signature</Typography>}
            />
            {data.expiresAt && (
              <Typography variant="caption" color="text.secondary">This signing link expires {new Date(data.expiresAt).toLocaleString()}.</Typography>
            )}
            <Typography color="warning.dark">⚠️ This document will be legally binding. Please review it carefully before signing.</Typography>
            <Button variant="contained" size="large" onClick={sign} disabled={busy || !confirm} sx={{ py: 1.3 }}>
              {busy ? 'Signing…' : 'Sign Document →'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
