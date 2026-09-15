import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Button, Stack, Chip, Paper } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import PaymentsIcon from '@mui/icons-material/Payments';
import SendIcon from '@mui/icons-material/Send';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import api, { getErrorMessage } from '../../services/api';
import type { DocumentFull, QuestionField } from '../../types';
import { Spinner, useToast } from '../../components/common';
import DocumentRenderer from '../../components/document/DocumentRenderer';
import { SelfSignDialog, SendSignDialog } from './SignModals';
import DocumentAudit from './DocumentAudit';
import SignaturesCard from './SignaturesCard';

export default function DocumentDetail(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState<DocumentFull | null>(null);
  const [html, setHtml] = useState('');
  const [signOpen, setSignOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      const d = data.document as DocumentFull;
      setDoc(d);
      if (d.paymentStatus === 'paid' || d.paymentStatus === 'free') {
        const f = await api.get(`/documents/${id}/file`);
        setHtml(f.data.html);
      }
    } catch (e) {
      toast(getErrorMessage(e), 'error');
      navigate('/documents');
    }
  }, [id, navigate, toast]);

  useEffect(() => { void load(); }, [load]);

  if (!doc) return <Spinner label="Loading document…" />;
  const d = doc;
  const unlocked = d.paymentStatus === 'paid' || d.paymentStatus === 'free';
  const signable = ['generated', 'pending_signatures', 'partially_signed'].includes(d.status);

  const downloadDocx = async (): Promise<void> => {
    try {
      const res = await api.get(`/documents/${d.id}/docx`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${d.title.replace(/[^\w\- ]+/g, '')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast('DOCX downloaded ✓');
    } catch (e) { toast(getErrorMessage(e), 'error'); }
  };

  const downloadPdf = async (): Promise<void> => {
    try {
      const res = await api.get(`/documents/${d.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${d.title.replace(/[^\w\- ]+/g, '')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast('PDF downloaded ✓');
    } catch (e) { toast(getErrorMessage(e), 'error'); }
  };

  const resend = async (sigId: string): Promise<void> => {
    try {
      const { data } = await api.post(`/documents/${d.id}/sign-requests/${sigId}/resend`);
      toast(data.message ?? 'Resent');
    } catch (e) { toast(getErrorMessage(e), 'error'); }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <Typography variant="h2">{d.title}</Typography>
        {d.documentNumber && <Chip size="small" label={d.documentNumber} />}
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Typography color="text.secondary">{d.template.name}</Typography>
        <Chip size="small" label={d.status.replace(/_/g, ' ')} sx={{ bgcolor: '#EDE9FE', color: '#6D28D9' }} />
        <Chip size="small" label={d.paymentStatus} sx={{ bgcolor: '#DBEAFE', color: '#1D4ED8' }} />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {d.status === 'draft' && (
          <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/template/${d.templateId}/create`)}>Resume Questionnaire</Button>
        )}
        {d.status === 'awaiting_payment' && (
          <Button variant="contained" color="warning" startIcon={<PaymentsIcon />} onClick={() => navigate(`/document/${d.id}/payment`)}>Pay ₹{d.template.price} Now</Button>
        )}
        {unlocked && (
          <>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadPdf}>Download PDF</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={downloadDocx}>Download DOCX</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => navigate(`/print/${d.id}`)}>Print / Save as PDF</Button>
          </>
        )}
        {signable && <Button variant="contained" color="success" startIcon={<HistoryEduIcon />} onClick={() => setSignOpen(true)}>✍️ Sign Document</Button>}
        {signable && <Button variant="outlined" startIcon={<SendIcon />} onClick={() => setSendOpen(true)}>Send for Signing</Button>}
      </Stack>

      <SignaturesCard doc={d} onResend={(sigId) => { void resend(sigId); }} />

      {unlocked ? (
        <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2, mb: 3, maxHeight: 640, overflow: 'auto' }}>
          <DocumentRenderer html={html} fields={(d.template as { questionnaireSchema?: QuestionField[] }).questionnaireSchema ?? []} answers={(d.userAnswers as Record<string, unknown>) ?? {}} />
        </Paper>
      ) : (
        <Paper sx={{ mb: 3, p: 3, bgcolor: '#FFFBEB', border: '1px dashed #F59E0B', borderRadius: 3 }}>
          <Typography fontWeight={700}>🔒 Locked — complete payment to view the final document.</Typography>
        </Paper>
      )}

      <DocumentAudit documentId={d.id} />

      <SelfSignDialog doc={d} open={signOpen} onClose={() => setSignOpen(false)} onSigned={() => { void load(); toast('Document signed successfully!'); }} />
      <SendSignDialog doc={d} open={sendOpen} onClose={() => setSendOpen(false)} onSent={() => { void load(); toast('Signing request sent 📧'); }} />
    </Box>
  );
}