import { useTranslation } from 'react-i18next';
import type { AgentSummary } from '@/types/agent';

interface MemberActivityTabProps {
  agent: AgentSummary;
  statusLabel?: string;
  currentWorkTitles?: string[];
  blockingReason?: string | null;
  nextStep?: string;
}

export function MemberActivityTab({
  agent,
  statusLabel = 'Idle',
  currentWorkTitles = [],
  blockingReason = null,
  nextStep,
}: MemberActivityTabProps) {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-700">
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-500">Status</span>
        <span className="font-medium text-slate-900">{statusLabel}</span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current Work</p>
        {currentWorkTitles.length > 0 ? (
          currentWorkTitles.map((title) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
              {title}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-slate-500">
            {t('teamMap.activity.noActiveWork', { defaultValue: 'No active work' })}
          </div>
        )}
      </div>

      {blockingReason ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Blocking Reason</p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {blockingReason}
          </div>
        </div>
      ) : null}

      {nextStep ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recommended Next Step</p>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            {nextStep}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-400">Agent: {agent.name}</p>
    </div>
  );
}
