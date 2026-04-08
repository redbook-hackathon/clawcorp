import { startTransition } from 'react';
import { cn } from '@/lib/utils';

export type AgentDetailTabId = 'overview' | 'memory' | 'skills' | 'activity';

const TABS: AgentDetailTabId[] = ['overview', 'memory', 'skills', 'activity'];

interface AgentDetailTabsProps {
  activeTab: AgentDetailTabId;
  onTabChange: (tab: AgentDetailTabId) => void;
}

export function AgentDetailTabs({ activeTab, onTabChange }: AgentDetailTabsProps) {
  return (
    <div role="tablist" aria-label="Agent detail tabs" className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
      {TABS.map((tab) => {
        const selected = tab === activeTab;
        const label = tab[0].toUpperCase() + tab.slice(1);

        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              startTransition(() => onTabChange(tab));
            }}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              selected
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
