import type { ReactNode } from 'react';

interface AgentActivityTabProps {
  statusLabel: string;
  currentWorkTitles: string[];
  blockingReason?: string | null;
  nextStep?: string;
  children?: ReactNode;
}

export function AgentActivityTab({
  statusLabel,
  currentWorkTitles,
  blockingReason,
  nextStep,
  children,
}: AgentActivityTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Status</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{statusLabel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Next Step</div>
          <div className="mt-2 text-sm text-slate-700">{nextStep || 'Open a direct chat to collect the latest update.'}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Current Work</h3>
        {currentWorkTitles.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {currentWorkTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No active work</p>
        )}

        {blockingReason ? (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            blocking reason: {blockingReason}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
