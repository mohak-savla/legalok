/**
 * EmailMergeEditor — Zoho Writer "Merge and Send Email" style editor.
 * Left: subject + HTML body with merge-field chips. Right: live preview.
 * Used inside Template Studio (tab ③) and the standalone /admin/emails page.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Stack, Chip, TextField, Switch, FormControlLabel, Paper, Divider, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import api, { getErrorMessage } from '../../services/api';
import { useToast } from '../../components/common';

export interface EmailTemplateDto {
  key: string;
  name: string;
  description: string;
  variables: string[];
  subject: string;
  bodyHtml: string;
  isEnabled: boolean;
  isCustomized: boolean;
}

const SAMPLE_VARS: Record<string, string> = {
  signer_name: 'Riya Sharma', signer_email: 'riya@example.com',
  owner_name: 'Mohak Savla', user_name: 'Riya Sharma', name: 'Riya Sharma',
  document_title: 'Freelance Service Agreement', document_number: 'LGL-2026-0042',
  signing_link: 'https://legalok.legalok.workers.dev/sign/sample-token',
  document_link: 'https://legalok.legalok.workers.dev/dashboard',
  reset_link: 'https://legalok.legalok.workers.dev/reset-password?token=sample',
  expiry_days: '7', message: 'Please review and sign at your convenience.',
  generated_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
};

export default function EmailMergeEditor({ template: initial, templateKey, onChanged }: { template?: EmailTemplateDto; templateKey?: string; onChanged?: () => void }): JSX.Element {
  const toast = useToast();
  const [template, setTemplate] = useState<EmailTemplateDto | null>(initial ?? null);
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.bodyHtml ?? '');
  const [enabled, setEnabled] = useState(initial?.isEnabled ?? true);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Self-fetch mode (used from Template Studio and /admin/emails)
  useEffect(() => {
    if (initial || !templateKey) return;
    let alive = true;
    api.get('/admin/emails').then((r) => {
      const found = (r.data.templates as EmailTemplateDto[]).find((t) => t.key === templateKey);
      if (!alive) return;
      if (found) {
        setTemplate(found); setSubject(found.subject); setBody(found.bodyHtml); setEnabled(found.isEnabled);
      }
    }).catch(() => { /* handled by parent */ });
    return () => { alive = false; };
  }, [initial, templateKey]);

  useEffect(() => {
    if (!template) return;
    setSubject(template.subject); setBody(template.bodyHtml); setEnabled(template.isEnabled); setPreview(null);
  }, [template?.key, template?.subject, template?.bodyHtml, template?.isEnabled]);

  if (!template) return <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Loading email template…</Typography>;
  const dirty = subject !== template.subject || body !== template.bodyHtml || enabled !== template.isEnabled;

  const insertVar = (v: string): void => {
    const ta = taRef.current;
    if (!ta) { setBody((b) => `${b}{{${v}}}`); return; }
    const start = ta.selectionStart ?? body.length;
    const next = `${body.slice(0, start)}{{${v}}}${body.slice(ta.selectionEnd ?? start)}`;
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + v.length + 4; });
  };

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.put(`/admin/emails/${template.key}`, { subject, bodyHtml: body, isEnabled: enabled });
      setTemplate({ ...template, subject, bodyHtml: body, isEnabled: enabled });
      toast('Email template saved ✓'); onChanged?.();
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  const reset = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/admin/emails/${template.key}`);
      if (data.template) { setSubject(data.template.subject); setBody(data.template.bodyHtml); setEnabled(true); }
      toast('Reset to default'); onChanged?.();
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  const doPreview = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/emails/${template.key}/preview`, { subject, bodyHtml: body, vars: SAMPLE_VARS });
      setPreview({ subject: data.subject, html: data.html });
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  const sendTest = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/emails/${template.key}/test`, { subject, bodyHtml: body, vars: SAMPLE_VARS });
      toast(data.message ?? 'Test sent');
    } catch (e) { toast(getErrorMessage(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 2 }}>
      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography fontWeight={800}>{template.name}</Typography>
          <Tooltip title={enabled ? 'Template active — emails will send' : 'Disabled — emails are suppressed and logged'}>
            <FormControlLabel control={<Switch size="small" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label={<Typography variant="caption">Enabled</Typography>} />
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>{template.description}</Typography>

        <Typography variant="caption" fontWeight={700}>MERGE FIELDS — click to insert</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 1 }}>
          {template.variables.map((v) => (
            <Chip key={v} size="small" label={`{{${v}}}`} onClick={() => insertVar(v)} sx={{ fontFamily: 'monospace', fontSize: 11 }} />
          ))}
        </Box>

        <TextField fullWidth size="small" label="Subject (supports merge fields)" value={subject} onChange={(e) => setSubject(e.target.value)} sx={{ mb: 1.5 }} />
        <TextField
          fullWidth label="Email body (HTML + merge fields)" multiline minRows={10} value={body}
          onChange={(e) => setBody(e.target.value)} inputRef={taRef}
          sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12.5 } }}
        />

        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={save} disabled={busy || !dirty}>Save</Button>
          <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={doPreview} disabled={busy}>Preview</Button>
          <Button variant="outlined" startIcon={<SendIcon />} onClick={sendTest} disabled={busy}>Send test to me</Button>
          <Box sx={{ flex: 1 }} />
          {template.isCustomized && (
            <Button color="warning" startIcon={<RestartAltIcon />} onClick={reset} disabled={busy}>Reset default</Button>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2, bgcolor: '#F9FAFB' }}>
        <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
          LIVE PREVIEW — rendered with sample data {preview ? '' : '(press Preview)'}
        </Typography>
        {preview ? (
          <>
            <Typography fontWeight={700} sx={{ mb: 1 }}>✉️ {preview.subject}</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Box sx={{ bgcolor: '#fff', borderRadius: 2, border: '1px solid #E5E7EB' }}>
              <iframe title="email-preview" srcDoc={preview.html} style={{ width: '100%', height: 500, border: 'none', borderRadius: 8 }} />
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            Click <b>Preview</b> to render this template exactly as the recipient will see it.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
