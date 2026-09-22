/**
 * Admin → Email Merge Studio: manage every system email template
 * (Zoho Writer "Merge and Send Email" equivalent).
 */
import { useEffect, useState } from 'react';
import { Box, Typography, Stack, Chip, Alert } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { Spinner, useToast } from '../../components/common';
import EmailMergeEditor, { EmailTemplateDto } from './EmailMergeEditor';

export default function AdminEmails(): JSX.Element {
  const toast = useToast();
  const [templates, setTemplates] = useState<EmailTemplateDto[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const load = (): void => {
    api.get('/admin/emails').then((r) => {
      setTemplates(r.data.templates as EmailTemplateDto[]);
      setSmtpConfigured(Boolean(r.data.smtpConfigured));
      setActive((a) => a ?? (r.data.templates[0]?.key as string | undefined) ?? null);
    }).catch((e) => toast(getErrorMessage(e), 'error'));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!templates.length) return <Spinner label="Loading email templates…" />;
  const current = templates.find((t) => t.key === active) ?? templates[0];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h2" sx={{ mb: 0.5 }}>Email Merge Studio</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Zoho-style merge emails — edit what gets sent, preview it, test it. Signature requests auto-send with your copy.
      </Typography>
      {!smtpConfigured && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          SMTP not configured — emails are currently logged, not delivered. Add <code>SMTP_USER</code>/<code>SMTP_PASS</code> on the server to go live.
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {templates.map((t) => (
          <Chip
            key={t.key} clickable label={t.name}
            color={t.key === current.key ? 'primary' : 'default'}
            variant={t.key === current.key ? 'filled' : 'outlined'}
            onClick={() => setActive(t.key)}
          />
        ))}
      </Stack>
      <EmailMergeEditor
        template={current}
        onChanged={load}
      />
    </Box>
  );
}
