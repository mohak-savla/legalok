import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Typography, Stack, Alert, Switch, FormControlLabel, TextField } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import BoltIcon from '@mui/icons-material/Bolt';
import BugReportIcon from '@mui/icons-material/BugReport';
import type { QuestionField } from '../../../types';
import DocumentRenderer, { extractReferencedKeys } from '../../../components/document/DocumentRenderer';
import TiptapEditor, { EditorApi } from './TiptapEditor';
import ConditionBuilderDialog from './ConditionBuilderDialog';
import LeftPanel from './LeftPanel';
import type { PanelElement } from './LeftPanel';
import TestDataPanel from './TestDataPanel';
import ConditionDebugger from './ConditionDebugger';
import RepeatDialog from './RepeatDialog';
import { resolveConditionals, hasConditionalBlocks, repeatItemVars } from '@engine/document-engine';
import type { BranchEvalTrace } from '@engine/document-engine';

interface Props {
  html: string;
  fields: QuestionField[];
  onHtmlChange: (html: string) => void;
}

function sampleOf(f: QuestionField): unknown {
  if (f.sample !== undefined && f.sample !== '') return f.sample;
  if (f.type === 'number') return 1000;
  if (f.type === 'date') return new Date().toISOString().slice(0, 10);
  if (f.type === 'dropdown' || f.type === 'radio') return f.options?.[0] ?? 'Option 1';
  if (f.type === 'checkbox') return f.options?.slice(0, 1) ?? ['Option 1'];
  if (f.type === 'email') return 'sample@legalok.in';
  return `Sample ${f.label || f.key}`;
}

/** Zoho Writer replica v2: TipTap editor + IF/ELSE + source + clean preview */
export default function DocBuilder({ html, fields, onHtmlChange }: Props): JSX.Element {
  const apiRef = useRef<EditorApi | null>(null);
  const [mode, setMode] = useState<'wysiwyg' | 'source' | 'preview'>('wysiwyg');
  const [source, setSource] = useState('');
  const [murfed, setMurfed] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const [condKey, setCondKey] = useState(fields[0]?.key ?? '');
  // Phase 11: table-row conditions
  const [rowCondOpen, setRowCondOpen] = useState(false);
  const [rowInitial, setRowInitial] = useState<string | undefined>(undefined);
  // Phase 12: repeat dialog
  const [repeatOpen, setRepeatOpen] = useState(false);

  const fieldKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const broken = useMemo(() => {
    const vars = repeatItemVars(html);
    return extractReferencedKeys(html).filter((k) => !fieldKeys.has(k) && !k.includes('.') && !vars.has(k));
  }, [html, fieldKeys]);
  const sampleAnswers = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields) out[f.key] = sampleOf(f);
    return out;
  }, [fields]);

  // ---- Phase 10: Test Data + Condition Debugger ----
  const [testData, setTestData] = useState<Record<string, unknown>>(sampleAnswers);
  const [debugOn, setDebugOn] = useState(false);
  // New form fields get sample values automatically; user edits are preserved
  useEffect(() => { setTestData((prev) => ({ ...sampleAnswers, ...prev })); }, [sampleAnswers]);
  const setTestValue = (key: string, value: unknown): void => setTestData((prev) => ({ ...prev, [key]: value }));
  const fieldTypes = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.key, f.type])) as Record<string, string>,
    [fields],
  );
  const debugTrace = useMemo<BranchEvalTrace[]>(() => {
    if (mode !== 'preview' || !debugOn) return [];
    const tr: BranchEvalTrace[] = [];
    if (hasConditionalBlocks(html)) resolveConditionals(html, testData, { fieldTypes, trace: tr });
    return tr;
  }, [mode, debugOn, html, testData, fieldTypes]);

  const insertChip = (key: string): void => { apiRef.current?.focus(); apiRef.current?.insertChip(key); };
  const insertElement = (el: PanelElement): void => { apiRef.current?.focus(); apiRef.current?.insertElement(el); };
  const insertImage = (dataUrl: string): void => { apiRef.current?.focus(); apiRef.current?.insertImage(dataUrl); };
  const convertLegacy = (): void => {
    const n = apiRef.current?.convertLegacy(html) ?? 0;
    if (n > 0) onHtmlChange(apiRef.current?.getStorageHTML() ?? html);
  };
  const openRowCondition = (): void => {
    setRowInitial(apiRef.current?.getRowCondition() ?? undefined);
    setRowCondOpen(true);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
      <Paper elevation={0} sx={{ width: { xs: '100%', md: 230 }, flexShrink: 0, border: '1px solid #E5E7EB', borderRadius: 3, p: 1.5 }}>
        <LeftPanel
          fields={fields} active={mode === 'wysiwyg'}
          onInsertElement={insertElement} onInsertChip={insertChip}
          onInsertImage={insertImage} onOpenCondition={() => setCondOpen(true)} onOpenRepeat={() => setRepeatOpen(true)}
        />
        <Button fullWidth size="small" startIcon={<BoltIcon />} sx={{ mt: 1 }}
          onClick={convertLegacy} title="Convert legacy {{#if}} text into visual IF/ELSE blocks">
          Convert legacy IFs
        </Button>
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <Button size="small" startIcon={<EditIcon />} variant={mode === 'wysiwyg' ? 'contained' : 'outlined'} onClick={() => setMode('wysiwyg')}>Editor</Button>
          <Button size="small" startIcon={<CodeIcon />} variant={mode === 'source' ? 'contained' : 'outlined'}
            onClick={() => { if (mode !== 'source') setSource(html); setMode('source'); }}>Source (HTML)</Button>
          <Button size="small" startIcon={<VisibilityIcon />} variant={mode === 'preview' ? 'contained' : 'outlined'} onClick={() => setMode('preview')}>Preview</Button>
          {mode === 'preview' && (
            <>
              <FormControlLabel control={<Switch size="small" checked={murfed} onChange={(e) => setMurfed(e.target.checked)} />}
                label={<Typography variant="caption">Murfed (redacted)</Typography>} />
              <Button size="small" startIcon={<BugReportIcon />} variant={debugOn ? 'contained' : 'outlined'}
                onClick={() => setDebugOn(!debugOn)} title="Shows how every condition evaluates against the test data">
                Debugger
              </Button>
            </>
          )}
        </Stack>

        {broken.length > 0 && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            Unknown placeholders: <strong>{broken.join(', ')}</strong> — add these fields in the Form Builder or remove them. Publishing is blocked until fixed.
          </Alert>
        )}

        {mode === 'wysiwyg' && (
          <TiptapEditor html={html} fields={fields} onChange={onHtmlChange} onReady={(api) => { apiRef.current = api; }} onRowCondition={openRowCondition} />
        )}

        {mode === 'source' && (
          <Box>
            <TextField fullWidth multiline minRows={22} value={source} onChange={(e) => setSource(e.target.value)}
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12.5, bgcolor: '#0F172A', color: '#E2E8F0', borderRadius: 2 } }} />
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={() => { onHtmlChange(source); setMode('wysiwyg'); }}>Apply → Editor</Button>
              <Button onClick={() => setSource(html)}>Reset</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Raw storage HTML — <code>&lt;div class="cond-block"&gt;</code> structures carry the logic (data-when JSON / legacy attrs);
              {' '}<code>{'{{merge_fields}}'}</code> resolve at render time. Applying this HTML re-parses into visual blocks.
            </Typography>
          </Box>
        )}

        {mode === 'preview' && (
          <>
            <TestDataPanel
              fields={fields} values={testData} onChange={setTestValue}
              onReset={() => setTestData(sampleAnswers)}
            />
            {debugOn && <ConditionDebugger traces={debugTrace} />}
            <Paper elevation={0} sx={{ border: '1px solid #E5E7EB', borderRadius: 3, p: 2, maxHeight: 640, overflow: 'auto' }}>
              <DocumentRenderer html={html} fields={fields} answers={testData} murfed={murfed} />
            </Paper>
          </>
        )}
      </Box>

      <ConditionBuilderDialog
        open={condOpen} mode="insert" fields={fields} initialFieldKey={condKey}
        onClose={() => setCondOpen(false)}
        onInsert={(branches) => {
          apiRef.current?.focus();
          apiRef.current?.insertConditional(branches);
        }}
      />
      <ConditionBuilderDialog
        open={rowCondOpen} mode="edit" fields={fields} initialWhen={rowInitial}
        onClose={() => setRowCondOpen(false)}
        onSave={(when) => apiRef.current?.setRowCondition(when)}
        onRemove={() => apiRef.current?.setRowCondition(null)}
      />
      <RepeatDialog
        open={repeatOpen} fields={fields} onClose={() => setRepeatOpen(false)}
        onInsert={(collection, item) => {
          apiRef.current?.focus();
          apiRef.current?.insertRepeat(collection, item);
        }}
      />
    </Box>
  );
}