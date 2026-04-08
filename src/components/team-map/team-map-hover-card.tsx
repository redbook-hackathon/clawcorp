import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamWorkStatusKey } from '@/lib/team-work-visibility';
import { cn } from '@/lib/utils';

type TeamMapHoverCardProps = {
  open: boolean;
  anchor: { top: number; left: number } | null;
  statusKey: TeamWorkStatusKey;
  statusLabel: string;
  currentTask?: string | null;
  blockingReason?: string | null;
  nextStep?: string | null;
};

const HOVER_CARD_DELAY_MS = 150;

function getStatusClasses(statusKey: TeamWorkStatusKey) {
  if (statusKey === 'blocked') {
    return 'bg-amber-100 text-amber-800';
  }

  if (statusKey === 'waiting_approval') {
    return 'bg-violet-100 text-violet-800';
  }

  if (statusKey === 'working' || statusKey === 'active') {
    return 'bg-blue-100 text-blue-800';
  }

  return 'bg-slate-100 text-slate-600';
}

export function TeamMapHoverCard({
  open,
  anchor,
  statusKey,
  statusLabel,
  currentTask,
  blockingReason,
  nextStep,
}: TeamMapHoverCardProps) {
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open || !anchor) {
      setVisible(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVisible(true);
    }, HOVER_CARD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      setVisible(false);
    };
  }, [anchor, open]);

  if (!visible || !anchor) {
    return null;
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-xl backdrop-blur"
      style={{ top: anchor.top, left: anchor.left }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t('teamMap.hover.summary', { defaultValue: 'Work Summary' })}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold',
            getStatusClasses(statusKey),
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 space-y-3 text-sm text-slate-700">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t('teamMap.hover.currentTask', { defaultValue: 'Current task' })}
          </p>
          <p className="mt-1 leading-5 text-slate-900">
            {currentTask || t('teamMap.activity.noActiveWork', { defaultValue: 'No active work' })}
          </p>
        </div>

        {blockingReason ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('teamMap.hover.blockingReason', { defaultValue: 'Blocking reason' })}
            </p>
            <p className="mt-1 leading-5 text-amber-900">{blockingReason}</p>
          </div>
        ) : null}

        {nextStep ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('teamMap.hover.nextStep', { defaultValue: 'Recommended next step' })}
            </p>
            <p className="mt-1 leading-5 text-slate-900">{nextStep}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
