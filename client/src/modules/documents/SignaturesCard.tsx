import { Box, Card, CardContent, Stack, Chip, Typography, Button } from '@mui/material';
import type { DocumentFull } from '../../types';

/** Signing status list with resend actions */
export default function SignaturesCard({ doc, onResend }: {
  doc: DocumentFull;
  onResend: (sigId: string) => void;
}): JSX.Element {
  const d = doc;
  return (
    <Card sx={{ mb: 3, borderRadius: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>Signing Status</Typography>
        {d.signatures.length === 0 ? (
          <Typography color="text.secondary">
            No signatures yet. Sign yourself or send a request to the other party.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {d.signatures.map((s) => (
              <Stack key={s.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ border: '1px solid #E5E7EB', borderRadius: 2, px: 2, py: 1.25 }}>
                <Box>
                  <Typography fontWeight={700}>{s.signerName}{s.isOwner ? ' (You)' : ''}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.signerEmail} · {s.signatureType}</Typography>
                  {s.signatureStatus === 'signed' && s.signatureData && s.signatureData.startsWith('data:image/') && (
                    <img src={s.signatureData} alt={`Signature of ${s.signerName}`}
                      style={{ display: 'block', height: 44, marginTop: 6, objectFit: 'contain' }} />
                  )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {s.aadhaarReference && <Chip size="small" label={s.aadhaarReference} />}
                  <Chip size="small" label={s.signatureStatus}
                    sx={{ bgcolor: s.signatureStatus === 'signed' ? '#D1FAE5' : '#FEF3C7', color: s.signatureStatus === 'signed' ? '#065F46' : '#92400E' }} />
                  {!s.isOwner && s.signatureStatus !== 'signed' && <Button size="small" onClick={() => onResend(s.id)}>Resend</Button>}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
        {d.signedAt && (
          <Typography color="success.main" sx={{ mt: 2 }}>
            ✅ Fully executed on {new Date(d.signedAt).toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
