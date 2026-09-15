import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import type { DocumentRow, QuestionField, TemplateFull } from '../../types';
import { Spinner, useToast } from '../../components/common';
import QuestionnaireView from './QuestionnaireView';

export function isFieldVisible(field: QuestionField, answers: Record<string, unknown>): boolean {
  if (!field.condition || !field.condition.field) return true;
  const raw = answers?.[field.condition.field];
  const target = field.condition.value;
  const equals = Array.isArray(raw) ? raw.includes(target) : String(raw ?? '') === target;
  return field.condition.op === 'not_equals' ? !equals : equals;
}

export default function QuestionnaireFlow(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tpl, setTpl] = useState<TemplateFull | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<number | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tplRes = await api.get(`/templates/${id}`);
        const template: TemplateFull = tplRes.data.template;
        const drafts = await api.get('/documents', { params: { status: 'draft', limit: 100 } });
        const match = (drafts.data.documents as DocumentRow[]).find((d) => d.templateName === template.name);
        let docIdFinal: string;
        if (match) {
          const full = await api.get(`/documents/${match.id}`);
          if (cancelled) return;
          setAnswers(full.data.document.userAnswers ?? {});
          setStep(full.data.document.currentStep ?? 0);
          docIdFinal = match.id;
        } else {
          const created = await api.post('/documents', { templateId: id });
          if (cancelled) return;
          docIdFinal = created.data.document.id;
        }
        if (cancelled) return;
        setDocId(docIdFinal);
        setTpl(template);
      } catch (e) {
        toast(getErrorMessage(e), 'error');
        navigate('/templates');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { if (docId) booted.current = true; }, [docId]);

  const fields = tpl?.questionnaireSchema ?? [];
  const visible = useMemo(
    () => fields.filter((f) => f.type !== 'heading' && isFieldVisible(f, answers)),
    [fields, answers],
  );

  const save = useCallback(async (newStep: number): Promise<void> => {
    if (!docId) return;
    setSaveState('saving');
    try {
      await api.put(`/documents/${docId}/answers`, { answers, currentStep: newStep });
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1500);
    } catch { setSaveState('idle'); }
  }, [docId, answers]);

  useEffect(() => {
    if (!docId || !booted.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void save(step); }, 900);
  }, [answers, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateCurrent = (): boolean => {
    const current = visible[Math.min(step, Math.max(visible.length - 1, 0))];
    if (!current?.required) return true;
    const v = answers[current.key];
    const ok = !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
    if (!ok) toast('This question is required', 'warning');
    return ok;
  };

  const complete = async (): Promise<void> => {
    if (!validateCurrent() || !docId) return;
    try {
      await api.put(`/documents/${docId}/answers`, { answers, currentStep: step });
      const { data } = await api.post(`/documents/${docId}/complete`);
      toast('Questionnaire completed! 🎉');
      navigate(data.document.status === 'awaiting_payment' ? `/document/${docId}/payment` : `/document/${docId}`);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    }
  };

  const onNext = (): void => {
    if (!validateCurrent()) return;
    void save(step + 1);
    if (step >= visible.length - 1) void complete();
    else setStep((s) => s + 1);
  };

  if (!tpl || !docId) return <Spinner label="Preparing your questionnaire…" />;

  return (
    <QuestionnaireView
      tpl={tpl} answers={answers} visible={visible} step={step} saveState={saveState}
      onAnswer={(key, value) => setAnswers((a) => ({ ...a, [key]: value }))}
      onNext={onNext}
      onPrev={() => { void save(Math.max(0, step - 1)); setStep((s) => Math.max(0, s - 1)); }}
      onComplete={() => { void complete(); }}
    />
  );
}