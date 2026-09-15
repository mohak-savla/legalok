import { useState } from 'react';
import { Box, Typography, Button, LinearProgress, Stack, Paper, Dialog, DialogTitle, DialogContent, IconButton, Chip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import LockIcon from '@mui/icons-material/Lock';
import type { QuestionField, TemplateFull } from '../../types';
import DocumentRenderer from '../../components/document/DocumentRenderer';
import FieldRenderer from './FieldRenderer';

interface Props {
  tpl: TemplateFull;
  answers: Record<string, unknown>;
  visible: QuestionField[];
  step: number;
  saveState: 'idle' | 'saving' | 'saved';
  onAnswer: (key: string, value: unknown) => void;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
}

export default function QuestionnaireView({ tpl, answers, visible, step, saveState, onAnswer, onNext, onPrev, onComplete }: Props): JSX.Element {
  const [video, setVideo] = useState<string | null>(null);
  const current = visible[Math.min(step, Math.max(visible.length - 1, 0))];
  const isLast = step >= visible.length - 1;
  const progress = ((step + 1) / Math.max(visible.length, 1)) * 100;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography color="text.secondary" fontWeight={700}>
          Step {Math.min(step + 1, visible.length)} of {visible.length} · {tpl.name}
        </Typography>
        {saveState !== 'idle' && (
          <Typography variant="caption" color={saveState === 'saved' ? 'success.main' : 'text.secondary'}>
            {saveState === 'saving' ? 'Saving…' : '✓ Saved'}
          </Typography>
        )}
      </Stack>
      <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, mb: 3 }} />

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'flex-start' }}>
        <Paper elevation={0} sx={{ p: 3.5, flex: 1, width: '100%', border: '1px solid #E5E7EB', borderRadius: 3 }}>
          {current ? (
            <>
              <FieldRenderer key={current.key} field={current} value={answers[current.key]} onChange={(v) => onAnswer(current.key, v)} />
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                {current.helpText && (
                  <Chip size="small" icon={<HelpOutlineIcon />} label={current.helpText} sx={{ maxWidth: 420 }} />
                )}
                {current.youtubeUrl && (
                  <Button size="small" startIcon={<PlayCircleIcon />} onClick={() => setVideo(current.youtubeUrl ?? null)}>
                    Watch video explanation
                  </Button>
                )}
              </Stack>
            </>
          ) : (
            <Typography>All questions answered — press Complete.</Typography>
          )}

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 4 }}>
            <Button variant="outlined" disabled={step === 0} onClick={onPrev}>← Previous</Button>
            {isLast ? (
              <Button variant="contained" color="success" size="large" onClick={onComplete}>✓ Complete &amp; Proceed</Button>
            ) : (
              <Button variant="contained" size="large" onClick={onNext}>Next →</Button>
            )}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ display: { xs: 'none', lg: 'block' }, width: 480, flexShrink: 0, border: '1px solid #E5E7EB', borderRadius: 3, p: 2, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 140px)', overflow: 'auto' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography fontWeight={800}>LIVE PREVIEW</Typography>
            <Chip size="small" icon={<LockIcon />} label="Murfed · unlocks after payment" sx={{ bgcolor: '#FEF3C7', color: '#92400E' }} />
          </Stack>
          <DocumentRenderer html={tpl.documentHtml} fields={tpl.questionnaireSchema} answers={answers} murfed />
        </Paper>

        <Box sx={{ display: { xs: 'block', lg: 'none' }, width: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LockIcon fontSize="small" sx={{ color: '#F59E0B' }} />
            <Typography variant="caption" fontWeight={800} color="text.secondary">PREVIEW (REDACTED — UNLOCKS AFTER PAYMENT)</Typography>
          </Stack>
          <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 1.5, overflowX: 'auto' }}>
            <DocumentRenderer html={tpl.documentHtml} fields={tpl.questionnaireSchema} answers={answers} murfed />
          </Paper>
        </Box>
      </Box>

      <Dialog open={!!video} onClose={() => setVideo(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Video explanation
          <IconButton onClick={() => setVideo(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
            <iframe
              src={(video ?? '').replace('watch?v=', 'embed/')}
              title="Guide video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 8 }}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
