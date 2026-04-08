import { Bot, MemoryStick, MessageSquare, Settings2, ShieldAlert, Trash2 } from 'lucide-react';
import type { EmployeeSquareCardModel } from '@/lib/agent-square-view-model';
import { cn } from '@/lib/utils';

interface EmployeeSquareCardProps {
  card: EmployeeSquareCardModel;
  actionLabels: {
    chat: string;
    memory: string;
    details: string;
    roleLeader: string;
    roleWorker: string;
    leaderOnly: string;
    settings: string;
    delete: string;
  };
  onChat: () => void;
  onMemory: () => void;
  onDetails: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
  showDelete?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((chunk) => chunk[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function EmployeeSquareCard({
  card,
  actionLabels,
  onChat,
  onMemory,
  onDetails,
  onOpenSettings,
  onDelete,
  showDelete = true,
}: EmployeeSquareCardProps) {
  const initials = getInitials(card.name);

  return (
    <article className="group flex h-full flex-col rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            {initials ? (
              <span className="text-sm font-semibold">{initials}</span>
            ) : (
              <Bot className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-950">{card.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {card.roleLabel === 'leader' ? actionLabels.roleLeader : actionLabels.roleWorker}
              </span>
              {card.isDirectChatBlocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {actionLabels.leaderOnly}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            title={actionLabels.settings}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          {showDelete ? (
            <button
              type="button"
              onClick={onDelete}
              title={actionLabels.delete}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-5 min-h-[44px] text-sm leading-6 text-slate-600">
        {card.persona || '暂未配置角色设定。'}
      </p>
      {card.currentWorkSummary ? (
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {card.currentWorkSummary}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {card.teamLabels.length > 0 ? (
          card.teamLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] text-slate-600"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-[12px] text-slate-400">
            独立成员
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            模型
          </div>
          <div className="mt-1 text-sm font-medium text-slate-800">{card.modelLabel}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            频道
          </div>
          <div className="mt-1 text-sm font-medium text-slate-800">{card.channelCount}</div>
        </div>
      </div>

      <div className="mt-4">
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium',
            card.activityTone === 'active'
              ? 'bg-emerald-50 text-emerald-700'
              : card.activityTone === 'blocked'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-500',
          )}
        >
          {card.lastActiveLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onChat}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <MessageSquare className="h-4 w-4" />
          {actionLabels.chat}
        </button>
        <button
          type="button"
          onClick={onMemory}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <MemoryStick className="h-4 w-4" />
          {actionLabels.memory}
        </button>
        <button
          type="button"
          onClick={onDetails}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          {actionLabels.details}
        </button>
      </div>
    </article>
  );
}
