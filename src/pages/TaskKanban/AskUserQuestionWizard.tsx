import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ApprovalItem } from '@/stores/approvals';

interface Props {
  approval: ApprovalItem;
  onRespond: (answers: Record<string, string>) => void;
  onDismiss: () => void;
}

interface WizardOption {
  label: string;
  description?: string;
}

interface WizardQuestion {
  question: string;
  header?: string;
  options: WizardOption[];
  multiSelect?: boolean;
}

interface StructuredToolInput {
  questions?: unknown;
  answers?: Record<string, unknown>;
  context?: unknown;
  requestedToolInput?: unknown;
}

const ACCENT = '#007aff';
const BG = '#ffffff';
const SECONDARY_BG = '#f2f2f7';
const BORDER = '#c6c6c8';

function normalizeQuestion(raw: unknown): WizardQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
  if (!question) return null;

  const optionsRaw = Array.isArray(candidate.options) ? candidate.options : [];
  const options = optionsRaw
    .map((opt) => {
      if (typeof opt === 'string') {
        const label = opt.trim();
        if (!label) return null;
        return { label };
      }
      if (!opt || typeof opt !== 'object') return null;
      const obj = opt as Record<string, unknown>;
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      if (!label) return null;
      return {
        label,
        description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
      };
    })
    .filter((opt): opt is WizardOption => Boolean(opt));

  return {
    question,
    header: typeof candidate.header === 'string' ? candidate.header.trim() : undefined,
    options,
    multiSelect: Boolean(candidate.multiSelect),
  };
}

function toQuestions(payload: unknown): WizardQuestion[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeQuestion).filter((q): q is WizardQuestion => Boolean(q));
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;
    if (Array.isArray(candidate.questions)) {
      return candidate.questions
        .map(normalizeQuestion)
        .filter((q): q is WizardQuestion => Boolean(q));
    }
    const single = normalizeQuestion(candidate);
    return single ? [single] : [];
  }

  return [];
}

function parsePromptQuestions(prompt?: string): WizardQuestion[] {
  const raw = (prompt ?? '').trim();
  if (!raw) return [];

  try {
    return toQuestions(JSON.parse(raw));
  } catch {
    // Ignore direct parse error and try fenced JSON extraction.
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fenced?.[1]) return [];

  try {
    return toQuestions(JSON.parse(fenced[1]));
  } catch {
    return [];
  }
}

function questionKey(question: WizardQuestion, index: number): string {
  const title = question.question.trim() || question.header?.trim();
  return title || `Question ${index + 1}`;
}

function getStructuredToolInput(approval: ApprovalItem): StructuredToolInput | null {
  if (!approval.toolInput || typeof approval.toolInput !== 'object') {
    return null;
  }
  return approval.toolInput as StructuredToolInput;
}

function getQuestionPrefill(question: WizardQuestion, index: number, answers: Record<string, unknown>): string | string[] | null {
  const candidates = [
    questionKey(question, index),
    question.question.trim(),
    question.header?.trim() ?? '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const value = answers[candidate];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function renderContextSummary(
  context: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const candidate = context as Record<string, unknown>;
  const requested = candidate.requestedToolInput && typeof candidate.requestedToolInput === 'object'
    ? candidate.requestedToolInput as Record<string, unknown>
    : candidate;

  if (typeof requested.command === 'string' && requested.command.trim()) {
    return t('askUserQuestion.context.command', { value: requested.command.trim() });
  }

  if (typeof requested.toolName === 'string' && requested.toolName.trim()) {
    return t('askUserQuestion.context.tool', { value: requested.toolName.trim() });
  }

  return null;
}

function AskUserQuestionWizardContent({ approval, onRespond, onDismiss }: Props) {
  const { t } = useTranslation('common');
  const structuredToolInput = useMemo(() => getStructuredToolInput(approval), [approval]);
  const questions = useMemo(() => {
    const structured = toQuestions(structuredToolInput?.questions);
    return structured.length > 0 ? structured : parsePromptQuestions(approval.prompt);
  }, [approval.prompt, structuredToolInput]);
  const prefilledAnswers = useMemo(() => structuredToolInput?.answers ?? {}, [structuredToolInput]);
  const contextSummary = useMemo(
    () => renderContextSummary(structuredToolInput?.context ?? structuredToolInput?.requestedToolInput, t),
    [structuredToolInput, t],
  );
  const [step, setStep] = useState(0);
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    questions.forEach((question, index) => {
      const value = getQuestionPrefill(question, index, prefilledAnswers);
      if (typeof value === 'string') {
        initial[questionKey(question, index)] = value;
      }
    });
    return initial;
  });
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    questions.forEach((question, index) => {
      const value = getQuestionPrefill(question, index, prefilledAnswers);
      if (Array.isArray(value)) {
        initial[questionKey(question, index)] = value;
      }
    });
    return initial;
  });
  const [otherAnswers, setOtherAnswers] = useState<Record<string, string>>({});
  const [fallbackAnswer, setFallbackAnswer] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const total = Math.max(questions.length, 1);
  const current = questions[step];
  const currentKey = current ? questionKey(current, step) : 'response';
  const progress = ((step + 1) / total) * 100;

  const goToStep = (value: number) => {
    setStep(Math.max(0, Math.min(value, total - 1)));
  };

  const goNext = () => goToStep(step + 1);
  const goPrev = () => goToStep(step - 1);

  const selectSingle = (value: string) => {
    setSingleAnswers((prev) => ({ ...prev, [currentKey]: value }));
    if (step < total - 1) {
      window.setTimeout(() => {
        goNext();
      }, 150);
    }
  };

  const toggleMulti = (value: string) => {
    setMultiAnswers((prev) => {
      const existing = prev[currentKey] ?? [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...prev, [currentKey]: next };
    });
  };

  const skipCurrent = () => {
    if (current?.multiSelect) {
      setMultiAnswers((prev) => ({ ...prev, [currentKey]: [] }));
    } else {
      setSingleAnswers((prev) => ({ ...prev, [currentKey]: '' }));
    }
    setOtherAnswers((prev) => ({ ...prev, [currentKey]: '' }));
    if (step < total - 1) goNext();
  };

  const submit = () => {
    if (questions.length === 0) {
      onRespond({ response: fallbackAnswer.trim() });
      return;
    }

    const answers: Record<string, string> = {};
    questions.forEach((question, index) => {
      const key = questionKey(question, index);
      const other = (otherAnswers[key] ?? '').trim();
      if (question.multiSelect) {
        const values = [...(multiAnswers[key] ?? [])];
        if (other) values.push(other);
        answers[key] = JSON.stringify(values);
      } else {
        answers[key] = other || singleAnswers[key] || '';
      }
    });
    onRespond(answers);
  };

  return (
    <div className="fixed inset-0 z-[120] flex h-screen w-screen flex-col" style={{ background: BG }}>
      <div className="h-1 w-full" style={{ background: SECONDARY_BG }}>
        <div className="h-full transition-all duration-200" style={{ width: `${progress}%`, background: ACCENT }} />
      </div>

      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: BORDER }}>
        <div className="text-[14px] font-semibold text-[#111827]">
          {t('askUserQuestion.title')}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-[#6b7280] transition-colors hover:bg-[#f3f4f6] hover:text-[#111827]"
          aria-label={t('askUserQuestion.closeWizard')}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex justify-center gap-2 border-b px-6 py-3" style={{ borderColor: BORDER }}>
        {Array.from({ length: total }).map((_, index) => {
          const active = index === step;
          return (
            <button
              key={index}
              type="button"
              onClick={() => goToStep(index)}
              className="h-2.5 w-2.5 rounded-full transition-all"
              style={{ background: active ? ACCENT : BORDER }}
              aria-label={t('askUserQuestion.goToStep', { step: index + 1 })}
            />
          );
        })}
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-auto px-6 py-8">
        {questions.length === 0 ? (
          <>
            <h2 className="text-[22px] font-semibold text-[#111827]">{t('askUserQuestion.emptyTitle')}</h2>
            <p className="mt-2 text-[14px] text-[#6b7280]">
              {t('askUserQuestion.emptyDescription')}
            </p>
            <textarea
              value={fallbackAnswer}
              onChange={(event) => setFallbackAnswer(event.target.value)}
              placeholder={t('askUserQuestion.responsePlaceholder')}
              rows={8}
              className="mt-6 w-full rounded-xl border px-4 py-3 text-[14px] outline-none focus:border-clawx-ac"
              style={{ borderColor: BORDER, background: SECONDARY_BG }}
            />
          </>
        ) : (
          <>
            <div className="mb-2 text-[12px] font-medium text-[#6b7280]">
              {t('askUserQuestion.stepCounter', { current: step + 1, total })}
            </div>
            <h2 className="text-[24px] font-semibold leading-tight text-[#111827]">
              {current?.header || t('askUserQuestion.questionLabel')}
            </h2>
            <p className="mt-2 text-[16px] leading-relaxed text-[#374151]">
              {current?.question}
            </p>
            {contextSummary && (
              <div className="mt-4 rounded-xl border border-[#c6c6c8] bg-[#f8f8fb] px-4 py-3 text-[13px] text-[#4b5563]">
                {contextSummary}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {(current?.options ?? []).map((option) => {
                const singleSelected = singleAnswers[currentKey] === option.label;
                const multiSelected = (multiAnswers[currentKey] ?? []).includes(option.label);
                const selected = current?.multiSelect ? multiSelected : singleSelected;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => (current?.multiSelect ? toggleMulti(option.label) : selectSingle(option.label))}
                    aria-pressed={selected}
                    className="w-full rounded-xl border px-4 py-3 text-left transition-colors"
                    style={{
                      background: selected ? '#eff6ff' : SECONDARY_BG,
                      borderColor: selected ? ACCENT : BORDER,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold text-[#111827]">{option.label}</div>
                        {option.description && (
                          <div className="mt-1 text-[12px] text-[#6b7280]">{option.description}</div>
                        )}
                      </div>
                      {selected && <Check size={16} color={ACCENT} className="mt-0.5 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <div className="mb-1.5 text-[12px] font-medium text-[#6b7280]">{t('askUserQuestion.otherOption')}</div>
              <input
                value={otherAnswers[currentKey] ?? ''}
                onChange={(event) =>
                  setOtherAnswers((prev) => ({ ...prev, [currentKey]: event.target.value }))
                }
                placeholder={t('askUserQuestion.customAnswerPlaceholder')}
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-[14px] outline-none focus:border-clawx-ac"
                style={{ borderColor: BORDER }}
              />
            </div>
          </>
        )}
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t px-6 py-4"
        style={{ borderColor: BORDER, background: '#fafafa' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 0}
            className="rounded-lg border px-3 py-1.5 text-[13px] text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: BORDER, background: BG }}
          >
            {t('actions.back')}
          </button>
          {questions.length > 0 && (
            <button
              type="button"
              onClick={skipCurrent}
              disabled={step >= total - 1}
              className="rounded-lg border px-3 py-1.5 text-[13px] text-[#6b7280] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: BORDER, background: BG }}
            >
              {t('actions.skip')}
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={step >= total - 1}
            className="rounded-lg border px-3 py-1.5 text-[13px] text-[#374151] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: BORDER, background: BG }}
          >
            {t('actions.next')}
          </button>
        </div>

        <button
          type="button"
          onClick={submit}
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-white"
          style={{ background: ACCENT }}
        >
          {t('askUserQuestion.submit')}
        </button>
      </div>
    </div>
  );
}

export function AskUserQuestionWizard(props: Props) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AskUserQuestionWizardContent key={props.approval.id} {...props} />,
    document.body,
  );
}

export default AskUserQuestionWizard;
