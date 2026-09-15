import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Tabs, Tab, Box, FormControlLabel, Checkbox, Typography, Stack, Alert } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import type { DocumentFull } from '../../types';
import SignaturePad from '../../components/document/SignaturePad';

/** Owner signs own document — click-to-sign, mocked Aadhaar eSign, or draw */
export function SelfSignDialog({ doc, open, onClose, onSigned }: {
  doc: DocumentFull; open: boolean; onClose: () => void; onSigned: () => void;
}): JSX.Element {
  const user = JSON.parse(localStorage.getItem('legalok.user') ?? '{}') as { fullName?: string };
  const [tab, setTab] = useState(0);
  const [name, setName] = useState(user.fullName ?? '');
  const [aadhaar, setAadhaar] = useState('');
  const [drawn, setDrawn] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = (window as unknown as { __toast?: (m: string, s?: 'error' | 'success') => void });
  void toast;

  const sign = async (): Promise<void> => {
    let type = 'click';
    let signatureData = name;
    if (tab === 1) {
      if (aadhaar.replace(/\s/g, '').length !== 12) { alert('Enter a 12-digit Aadhaar number'); return; }
      type = 'aadhaar';
      signatureData = `Aadhaar verified: ****${aadhaar.slice(-4)}`;
    }
    if (tab === 2) {
      if (!drawn) { alert('Please draw your signature'); return; }
      type = 'click';
      signatureData = drawn;
    }
    if (!confirm) { alert('Please confirm this is your legal signature'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${doc.id}/self-sign`, { signatureType: type, signatureData });
      alert(data.message ?? 'Signed!');
      onSigned();
      onClose();
    } catch (e) {
      alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Signing failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>✍️ Sign Document</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 1 }}>
          {doc.title} {doc.documentNumber ? `· ${doc.documentNumber}` : ''}
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Type Name" />
          <Tab label="Aadhaar eSign" />
          <Tab label="Draw" />
        </Tabs>
        {tab === 0 && <TextField fullWidth label="Full legal name" value={name} onChange={(e) => setName(e.target.value)} />}
        {tab === 1 && (
          <Stack spacing={1}>
            <Alert severity="info" variant="outlined">Government eSign is mocked in MVP — a C-DAC reference number will be generated.</Alert>
            <TextField fullWidth label="Aadhaar number (12 digits)" value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/[^\d]/g, '').slice(0, 12))} />
          </Stack>
        )}
        {tab === 2 && <SignaturePad value={drawn} onChange={setDrawn} width={440} />}
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={<Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
            label={<Typography>I confirm this is my legal signature</Typography>}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={sign} disabled={busy || !confirm}>Sign →</Button>
      </DialogActions>
    </Dialog>
  );
}

/** Send to guest signer (User B) via email token link */
export function SendSignDialog({ doc, open, onClose, onSent }: {
  doc: DocumentFull; open: boolean; onClose: () => void; onSent: () => void;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async (): Promise<void> => {
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('Please enter a valid email');
    if (name.trim().length < 2) return setErr('Signer name is required');
    setBusy(true);
    try {
      const { data } = await api.post(`/documents/${doc.id}/sign-requests`, { signerEmail: email, signerName: name, message });
      alert(data.message ?? 'Sent!');
      onSent();
      onClose();
    } catch (e) {
      setErr((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to send');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>✉️ Send for Signing</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField fullWidth label="Signer email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField fullWidth label="Signer full name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField fullWidth multiline minRows={2} label="Optional message" value={message} onChange={(e) => setMessage(e.target.value)} />
          <Typography variant="caption" color="text.secondary">The signer receives a secure link valid for 7 days — no account needed.</Typography>
          {err && <Typography color="error">{err}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={send} disabled={busy}>Send Request →</Button>
      </DialogActions>
    </Dialog>
  );
}
