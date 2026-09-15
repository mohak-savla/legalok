import React, { createContext, useCallback, useContext, useState } from 'react';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Button from '@mui/material/Button';
import { STATUS_COLORS, STATUS_LABELS } from '../../theme';

/* ---------- Toasts ---------- */
interface ToastState { msg: string; sev: 'success' | 'error' | 'info' | 'warning'; key: number }
const ToastCtx = createContext<(msg: string, sev?: ToastState['sev']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toast, setToast] = useState<ToastState | null>(null);
  const show = useCallback((msg: string, sev: ToastState['sev'] = 'success') => {
    setToast({ msg, sev, key: Date.now() });
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Snackbar
        key={toast?.key}
        open={!!toast}
        autoHideDuration={toast?.sev === 'error' ? 6000 : 4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)} sx={{ borderRadius: 2 }}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastCtx.Provider>
  );
}

/* ---------- Status badge ---------- */
export function StatusBadge({ status }: { status: string }): JSX.Element {
  return (
    <Chip
      size="small"
      label={STATUS_LABELS[status] ?? status}
      sx={{ backgroundColor: `${STATUS_COLORS[status] ?? '#6B7280'}1A`, color: STATUS_COLORS[status] ?? '#6B7280', border: `1px solid ${STATUS_COLORS[status] ?? '#6B7280'}55` }}
    />
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, subtitle, action }: {
  icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}): JSX.Element {
  return (
    <Box sx={{ textAlign: 'center', py: 8, px: 2, border: '1px dashed #D1D5DB', borderRadius: 3, bgcolor: '#fff' }}>
      <Box sx={{ fontSize: 44, mb: 1 }}>{icon ?? '📂'}</Box>
      <Typography variant="h4" gutterBottom>{title}</Typography>
      {subtitle && <Typography color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>}
      {action}
    </Box>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ label }: { label?: string }): JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
      <CircularProgress size={32} />
      {label && <Typography color="text.secondary">{label}</Typography>}
    </Box>
  );
}

/* ---------- Price badge ---------- */
export function PriceBadge({ isPaid, price }: { isPaid: boolean; price: number }): JSX.Element {
  return isPaid ? (
    <Chip size="small" color="secondary" label={`₹${price}`} />
  ) : (
    <Chip size="small" label="Free" sx={{ bgcolor: '#DBEAFE', color: '#2563EB' }} />
  );
}

/* ---------- Small back/link button ---------- */
export function GhostLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }): JSX.Element {
  return (
    <Button variant="text" onClick={onClick} sx={{ color: 'text.secondary', px: 1 }}>
      ← {children}
    </Button>
  );
}
