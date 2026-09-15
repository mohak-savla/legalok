import { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Stack, Divider, Chip } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api, { getErrorMessage } from '../../services/api';
import type { DocumentFull } from '../../types';
import { Spinner, useToast, StatusBadge } from '../../components/common';
import DocumentRenderer from '../../components/document/DocumentRenderer';
import MockCheckout from './MockCheckout';

export default function PaymentPage(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [order, setOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/documents/${id}`).then((r) => {
      const d: DocumentFull = r.data.document;
      if (d.status !== 'awaiting_payment') navigate(`/document/${d.id}`, { replace: true });
      else setDoc(d);
    }).catch((e) => { toast(getErrorMessage(e), 'error'); navigate('/documents'); });
  }, [id, navigate, toast]);

  if (!doc) return <Spinner label="Loading payment…" />;

  const pay = async (method: string): Promise<void> => {
    if (!order) return;
    setBusy(true);
    try {
      const mock = await api.post(`/payments/mock-checkout/${order.orderId}`);
      await api.post('/payments/verify', {
        razorpay_order_id: mock.data.razorpay_order_id,
        razorpay_payment_id: mock.data.razorpay_payment_id,
        razorpay_signature: mock.data.razorpay_signature,
        method,
      });
      toast('Payment successful! Your document is unlocked 🎉');
      navigate(`/document/${doc.id}`);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
      setOrder(null);
    }
  };

  const startPayment = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data } = await api.post('/payments/create-order', { documentId: doc.id });
      setOrder({ orderId: data.orderId, amount: data.amount });
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/documents')} sx={{ mb: 2, color: 'text.secondary' }}>My Documents</Button>
      <Typography variant="h2" sx={{ mb: 0.5 }}>📄 Document Ready!</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Pay to unlock the final, unredacted document.</Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1.4, border: '2px dashed #F59E0B55', borderRadius: 3, p: 2, bgcolor: '#FFFBEB' }}>
          <Chip label="SAMPLE — SENSITIVE DATA REDACTED" size="small" color="warning" sx={{ mb: 1.5 }} />
          <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
            <DocumentRenderer html={doc.template.documentHtml} fields={doc.template.questionnaireSchema} answers={doc.userAnswers} murfed />
          </Box>
        </Box>

        <Card sx={{ flex: 1, borderRadius: 3, height: 'fit-content' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Payment Summary</Typography>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Template</Typography><Typography fontWeight={600}>{doc.template.name}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Status</Typography><StatusBadge status={doc.status} /></Stack>
              <Divider />
              <Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Total</Typography><Typography fontWeight={800} sx={{ fontSize: 22 }}>₹{Number(doc.template.price).toLocaleString('en-IN')}</Typography></Stack>
            </Stack>
            <Button fullWidth variant="contained" size="large" sx={{ mt: 3, py: 1.3 }} onClick={startPayment} disabled={busy}>
              {busy ? 'Preparing…' : 'Pay with Razorpay →'}
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
              🔒 256-bit SSL · UPI, Cards, NetBanking
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {order && <MockCheckout orderId={order.orderId} amount={order.amount} busy={busy} onDone={pay} onClose={() => setOrder(null)} />}
    </Box>
  );
}