import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type CompatItem = {
  id: string;
  label: string;
  desc: string;
  pass: boolean;
};

type SettingsMigrationWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsMigrationWizard({ open, onOpenChange }: SettingsMigrationWizardProps) {
  const { t } = useTranslation('settings');
  const compatItems: CompatItem[] = [
    { id: 'channels', label: t('migrationWizard.compatibility.items.channels.label'), desc: t('migrationWizard.compatibility.items.channels.description'), pass: true },
    { id: 'agentDefaults', label: t('migrationWizard.compatibility.items.agentDefaults.label'), desc: t('migrationWizard.compatibility.items.agentDefaults.description'), pass: true },
    { id: 'workspace', label: t('migrationWizard.compatibility.items.workspace.label'), desc: t('migrationWizard.compatibility.items.workspace.description'), pass: true },
    { id: 'agents', label: t('migrationWizard.compatibility.items.agents.label'), desc: t('migrationWizard.compatibility.items.agents.description'), pass: true },
    { id: 'skills', label: t('migrationWizard.compatibility.items.skills.label'), desc: t('migrationWizard.compatibility.items.skills.description'), pass: true },
    { id: 'cron', label: t('migrationWizard.compatibility.items.cron.label'), desc: t('migrationWizard.compatibility.items.cron.description'), pass: true },
    { id: 'identity', label: t('migrationWizard.compatibility.items.identity.label'), desc: t('migrationWizard.compatibility.items.identity.description'), pass: true },
    { id: 'memory', label: t('migrationWizard.compatibility.items.memory.label'), desc: t('migrationWizard.compatibility.items.memory.description'), pass: false },
    { id: 'history', label: t('migrationWizard.compatibility.items.history.label'), desc: t('migrationWizard.compatibility.items.history.description'), pass: false },
    { id: 'providers', label: t('migrationWizard.compatibility.items.providers.label'), desc: t('migrationWizard.compatibility.items.providers.description'), pass: false },
    { id: 'browser', label: t('migrationWizard.compatibility.items.browser.label'), desc: t('migrationWizard.compatibility.items.browser.description'), pass: false },
    { id: 'media', label: t('migrationWizard.compatibility.items.media.label'), desc: t('migrationWizard.compatibility.items.media.description'), pass: false },
    { id: 'plugins', label: t('migrationWizard.compatibility.items.plugins.label'), desc: t('migrationWizard.compatibility.items.plugins.description'), pass: false },
    { id: 'gateway', label: t('migrationWizard.compatibility.items.gateway.label'), desc: t('migrationWizard.compatibility.items.gateway.description'), pass: false },
  ];
  const scopeItems = compatItems.filter((item) => item.pass);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>(scopeItems.map((i) => i.id));
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  const totalSteps = 3;

  const toggleItem = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = selected.length === scopeItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={() => onOpenChange(false)} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('migrationWizard.dialogAriaLabel')}
        className="relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f2f7] text-[22px]">
              🗂
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-[#000000]">{t('migrationWizard.header.title')}</h1>
              <p className="text-[12px] text-[#8e8e93]">{t('migrationWizard.header.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('migrationWizard.actions.close')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e5e5ea] text-[#3c3c43] hover:bg-[#d1d1d6]"
          >
            ✕
          </button>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 py-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                i + 1 === step ? 'bg-[#3c3c43]' : 'bg-[#d1d1d6]',
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {step === 1 && <CompatibilityStep items={compatItems} t={t} />}
          {step === 2 && (
            <ScopeStep
              items={scopeItems}
              selected={selected}
              allSelected={allSelected}
              onToggle={toggleItem}
              onToggleAll={() =>
                setSelected(allSelected ? [] : scopeItems.map((i) => i.id))
              }
              t={t}
            />
          )}
          {step === 3 && (
            <ConfirmStep acknowledged={acknowledged} onAcknowledgeChange={setAcknowledged} t={t} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onOpenChange(false))}
            className="flex items-center gap-1 rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium text-[#000000] hover:bg-[#f2f2f7]"
          >
            {t('migrationWizard.actions.previous')}
          </button>

          <div className="flex items-center gap-3">
            {step < totalSteps && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full px-4 py-2 text-[13px] font-medium text-[#8e8e93] hover:text-[#000000]"
              >
                {t('migrationWizard.actions.skip')}
              </button>
            )}
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1 rounded-full bg-[#ff6a00] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#e05d00]"
              >
                {t('migrationWizard.actions.next')}
              </button>
            ) : (
              <button
                type="button"
                disabled={!acknowledged}
                onClick={() => {
                  if (acknowledged) onOpenChange(false);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white transition',
                  acknowledged
                    ? 'bg-[#ff6a00] hover:bg-[#e05d00]'
                    : 'cursor-not-allowed bg-[#c7c7cc]',
                )}
              >
                {t('migrationWizard.actions.start')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompatibilityStep({ items, t }: { items: CompatItem[]; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <div className="space-y-4 py-2">
      {/* Icon + title */}
      <div className="flex flex-col items-center py-4 text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M8 14 L16 22 L8 14" stroke="none" />
          <line x1="6" y1="16" x2="13" y2="23" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="23" x2="20" y2="12" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="16" x2="42" y2="16" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="6" y1="32" x2="13" y2="39" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="39" x2="20" y2="28" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="32" x2="42" y2="32" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2 className="mt-1 text-[22px] font-bold text-[#000000]">{t('migrationWizard.compatibility.title')}</h2>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {/* Status icon */}
            {item.pass ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#34c759] text-white text-[13px] font-bold">
                ✓
              </span>
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ffd6d6] text-[#ff3b30] text-[13px] font-bold">
                ✕
              </span>
            )}
            {/* Label */}
            <span
              className={cn(
                'shrink-0 text-[14px]',
                item.pass ? 'font-semibold text-[#000000]' : 'text-[#8e8e93]',
              )}
            >
              {item.label}
            </span>
            {/* Dotted separator */}
            <span className="flex-1 border-b border-dashed border-[#c7c7cc]" />
            {/* Description */}
            <span className="shrink-0 text-right text-[13px] text-[#8e8e93]">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ScopeStepProps = {
  items: CompatItem[];
  selected: string[];
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function ScopeStep({ items, selected, allSelected, onToggle, onToggleAll, t }: ScopeStepProps) {
  return (
    <div className="space-y-4 py-2">
      {/* Icon + title */}
      <div className="flex flex-col items-center py-4 text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <line x1="6" y1="16" x2="13" y2="23" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="23" x2="20" y2="12" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="16" x2="42" y2="16" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="6" y1="32" x2="13" y2="39" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="13" y1="39" x2="20" y2="28" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="26" y1="32" x2="42" y2="32" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h2 className="mt-1 text-[22px] font-bold text-[#000000]">{t('migrationWizard.scope.title')}</h2>
        <p className="mt-1 text-[13px] text-[#8e8e93]">{t('migrationWizard.scope.subtitle')}</p>
      </div>

      {/* Select-all row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[13px] text-[#3c3c43] hover:text-[#000000]"
        >
          {allSelected ? t('migrationWizard.scope.clearAll') : t('migrationWizard.scope.selectAll')}
        </button>
        <span className="text-[13px] text-[#8e8e93]">
          {t('migrationWizard.scope.counter', { selected: selected.length, total: items.length })}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className="flex w-full items-center gap-3 rounded-xl bg-[#f2f2f7] px-4 py-3 text-left"
            >
              {/* Orange checkbox */}
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[13px]',
                  isSelected ? 'bg-[#ff6a00]' : 'bg-[#c7c7cc]',
                )}
              >
                ✓
              </span>
              {/* Label */}
              <span className="shrink-0 text-[14px] font-semibold text-[#000000]">{item.label}</span>
              {/* Dotted separator */}
              <span className="flex-1 border-b border-dashed border-[#c7c7cc]" />
              {/* Desc */}
              <span className="shrink-0 text-right text-[13px] text-[#8e8e93]">{item.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ConfirmStepProps = {
  acknowledged: boolean;
  onAcknowledgeChange: (v: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function ConfirmStep({ acknowledged, onAcknowledgeChange, t }: ConfirmStepProps) {
  return (
    <div className="space-y-5 py-4">
      {/* Warning icon + title */}
      <div className="flex flex-col items-center py-4 text-center">
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <path
            d="M26 6 L48 44 H4 Z"
            stroke="#1c1c1e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="26" y1="22" x2="26" y2="34" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="26" cy="40" r="1.5" fill="#1c1c1e" />
        </svg>
        <h2 className="mt-3 text-[22px] font-bold text-[#000000]">{t('migrationWizard.confirm.title')}</h2>
      </div>

      {/* Checklist */}
      <div className="space-y-4">
        {[
          t('migrationWizard.confirm.checklist.copyOnly'),
          t('migrationWizard.confirm.checklist.keepDefaults'),
          t('migrationWizard.confirm.checklist.backupPath'),
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <span className="text-[15px] text-[#3c3c43]">✓</span>
            <span className="text-[14px] text-[#3c3c43]">{item}</span>
          </div>
        ))}
      </div>

      {/* Security warning */}
      <div className="flex items-center gap-2 rounded-full border border-[#f5c842] bg-[#fffbea] px-4 py-3">
        <span className="text-[15px]">🛡️</span>
        <span className="text-[15px]">💧</span>
        <span className="text-[13px] text-[#3c3c43]">
          {t('migrationWizard.confirm.securityNotice')}
        </span>
      </div>

      {/* Acknowledge checkbox */}
      <button
        type="button"
        onClick={() => onAcknowledgeChange(!acknowledged)}
        className="flex items-center gap-3"
      >
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] text-white',
            acknowledged
              ? 'border-[#ff6a00] bg-[#ff6a00]'
              : 'border-[#c7c7cc] bg-white',
          )}
        >
          {acknowledged ? '✓' : ''}
        </span>
        <span className="text-[14px] text-[#3c3c43]">{t('migrationWizard.confirm.acknowledge')}</span>
      </button>
    </div>
  );
}
