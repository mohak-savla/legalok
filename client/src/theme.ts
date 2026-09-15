import { createTheme } from '@mui/material/styles';

/** Legalok design system — UI/UX brief: blue/white, Inter, 8px grid, rounded */
export const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280',
  awaiting_payment: '#F59E0B',
  generated: '#3B82F6',
  pending_signatures: '#8B5CF6',
  partially_signed: '#6366F1',
  fully_executed: '#10B981',
  expired: '#EF4444',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting Payment',
  generated: 'Generated',
  pending_signatures: 'Pending Signatures',
  partially_signed: 'Partially Signed',
  fully_executed: 'Fully Executed',
  expired: 'Expired',
};

export const theme = createTheme({
  palette: {
    primary: { main: '#2563EB', light: '#DBEAFE', dark: '#1D4ED8' },
    secondary: { main: '#7C3AED' },
    success: { main: '#10B981' },
    warning: { main: '#F59E0B' },
    error: { main: '#EF4444' },
    info: { main: '#3B82F6' },
    background: { default: '#F9FAFB', paper: '#FFFFFF' },
    text: { primary: '#111827', secondary: '#6B7280' },
    divider: '#E5E7EB',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    h1: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.25 },
    h3: { fontSize: '1.375rem', fontWeight: 600 },
    h4: { fontSize: '1.125rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, paddingInline: 20, paddingBlock: 9, boxShadow: 'none',
          // Smooth motion: compositor-friendly properties only, instant press feedback
          transition: 'background-color 180ms cubic-bezier(.4,0,.2,1), box-shadow 180ms ease, transform 120ms ease',
          '&:active': { transform: 'scale(0.985)' },
        },
        containedPrimary: { '&:hover': { boxShadow: '0 4px 14px rgba(37,99,235,.35)' } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { transition: 'background-color 180ms ease, color 180ms ease' } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { transition: 'background-color 160ms ease, color 160ms ease, border-radius 160ms ease' } },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { transition: 'color 160ms ease' } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          transition: 'box-shadow 220ms ease, transform 220ms ease, border-color 220ms ease',
          '&:hover': { boxShadow: '0 10px 28px rgba(0,0,0,.10)', transform: 'translateY(-2px)', borderColor: '#D1D5DB' },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, transition: 'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease' } },
    },
    MuiTab: {
      styleOverrides: { root: { transition: 'color 160ms ease, background-color 160ms ease' } },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
