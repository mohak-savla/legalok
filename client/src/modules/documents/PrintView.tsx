import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import api, { getErrorMessage } from '../../services/api';
import { Spinner } from '../../components/common';
import DocumentRenderer from '../../components/document/DocumentRenderer';

/** Print view — browser print dialog → "Save as PDF" (lightweight PDF path) */
export default function PrintView(): JSX.Element {
  const { id } = useParams();
  const [html, setHtml] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/documents/${id}/file`)
      .then((r) => { setHtml(r.data.html); setTimeout(() => window.print(), 600); })
      .catch((e) => setErr(getErrorMessage(e)));
  }, [id]);

  if (err) return <Box sx={{ p: 4 }}><Typography color="error">{err}</Typography></Box>;
  if (!html) return <Spinner label="Preparing document for print…" />;
  return (
    <Box sx={{ p: 4 }}>
      <Typography className="no-print" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        If the print dialog didn&apos;t open, press Ctrl+P and choose “Save as PDF”.
      </Typography>
      <Box sx={{ mt: 2 }}><DocumentRenderer html={html} /></Box>
    </Box>
  );
}