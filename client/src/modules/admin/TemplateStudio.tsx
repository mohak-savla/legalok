import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Stack, Chip, TextField, MenuItem, Switch, FormControlLabel, Tabs, Tab } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import api, { getErrorMessage } from '../../services/api';
import type { QuestionField, TemplateFull } from '../../types';
import { Spinner, useToast } from '../../components/common';
import FormBuilder from './studio/FormBuilder';
import DocBuilder from './studio/DocBuilder';
import './studio/studio.css';

export default function TemplateStudio(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tpl, setTpl] = useState<TemplateFull | null>(null);
  const [meta, setMeta] = useState({ name: '', category: '', audience: 'business', description: '', isPaid: false, price: 0, estimatedTimeMinutes: 10 });
  const [fields, setFields] = useState<QuestionField[]>([]);
  const [html, setHtml] = useState('');

  useEffect(() => {
    api.get(`/templates/${id}`).then((r) => {
      const t: TemplateFull = r.data.template;
      setTpl(t);
      setMeta({
        name: t.name, category: t.category, audience: t.audience,
        description: t.description ?? '', isPaid: t.isPaid, price: t.price, estimatedTimeMinutes: t.estimatedTimeMinutes,
      });
      setFields(t.questionnaireSchema ?? []);
      setHtml(t.documentHtml ?? '');
    }).catch((e) => { toast(getErrorMessage(e), 'error'); navigate('/admin/templates'); });
  }, [id, navigate, toast]);

  const save = useCallback(async (): Promise<void> => {
    if (!id) return;
    setBusy(true);
    try {
      await api.put(`/admin/templates/${id}`, { ...meta, questionnaireSchema: fields, documentHtml: html });
      toast('Template saved ✓');
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally { setBusy(false); }
  }, [id, meta, fields, html, toast]);

  const publish = useCallback(async (): Promise<void> => {
    if (!id) return;
    setBusy(true);
    try {
      await api.put(`/admin/templates/${id}`, { ...meta, questionnaireSchema: fields, documentHtml: html });
      const { data } = await api.post(`/admin/templates/${id}/publish`);
      toast(data.message ?? 'Published!');
      setTpl((t) => (t ? { ...t, status: 'published' } : t));
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally { setBusy(false); }
  }, [id, meta, fields, html, toast]);

  if (!tpl) return <Spinner label="Loading Studio…" />;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/templates')} sx={{ mb: 1.5, color: 'text.secondary' }}>
        All templates
      </Button>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 1 }}>
        <TextField size="small" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} sx={{ maxWidth: 380, '& input': { fontWeight: 800, fontSize: 18 } }} />
        <TextField size="small" select value={meta.audience} onChange={(e) => setMeta({ ...meta, audience: e.target.value })} sx={{ width: 130 }} label="Audience">
          <MenuItem value="business">Business</MenuItem>
          <MenuItem value="personal">Personal</MenuItem>
        </TextField>
        <TextField size="small" label="Category" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} sx={{ width: 150 }} />
        <FormControlLabel control={<Switch size="small" checked={meta.isPaid} onChange={(e) => setMeta({ ...meta, isPaid: e.target.checked })} />} label={<Typography>Paid</Typography>} />
        {meta.isPaid && <TextField size="small" type="number" value={meta.price} onChange={(e) => setMeta({ ...meta, price: Number(e.target.value) })} sx={{ width: 110 }} label="₹" />}
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={tpl.status} color={tpl.status === 'published' ? 'success' : 'default'} variant="outlined" />
        <Button variant="outlined" startIcon={<SaveIcon />} onClick={save} disabled={busy}>Save Draft</Button>
        <Button variant="contained" startIcon={<RocketLaunchIcon />} onClick={publish} disabled={busy}>Publish</Button>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="① Form Builder (Zoho Forms style)" />
        <Tab label="② Document Builder (Zoho Writer style)" />
      </Tabs>

      {tab === 0 && <FormBuilder fields={fields} onChange={setFields} />}
      {tab === 1 && <DocBuilder html={html} fields={fields} onHtmlChange={setHtml} />}

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        🔗 Interlinked: fields added here appear instantly as merge fields in the Document Builder. Publishing validates that every
        {' '}
        <code>{'{{placeholder}}'}</code> matches a form field.
      </Typography>
    </Box>
  );
}
