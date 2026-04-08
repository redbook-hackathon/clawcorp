import { memo, useEffect, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent';

interface AgentPanelProps {
  onClose: () => void;
}

export function AgentPanel({ onClose }: AgentPanelProps) {
  const { agents, fetchAgents } = useAgentsStore();
  const { teams } = useTeamsStore();

  // 计算每个 Agent 所属团队数
  const agentTeamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    teams.forEach((team) => {
      [team.leaderId, ...team.memberIds].forEach((agentId) => {
        counts[agentId] = (counts[agentId] || 0) + 1;
      });
    });
    return counts;
  }, [teams]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  return (
    <div className="h-full w-full bg-white border-l border-slate-200 shadow-xl flex flex-col">
      {/* 头部 */}
      <div className="h-16 shrink-0 border-b border-slate-200/60 flex items-center justify-between px-5">
        <h3 className="text-base font-semibold text-slate-900">可用 Agent</h3>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 提示文字 */}
      <div className="shrink-0 px-5 py-3 bg-blue-50/50 border-b border-blue-100">
        <p className="text-sm text-blue-700">
          拖拽 Agent 到左侧创建区来组建团队
        </p>
      </div>

      {/* Agent 列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2.5">
          {agents.map((agent) => (
            <DraggableAgentCard
              key={agent.id}
              agent={agent}
              teamCount={agentTeamCounts[agent.id] || 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const DraggableAgentCard = memo(function DraggableAgentCard({
  agent,
  teamCount,
}: {
  agent: AgentSummary;
  teamCount: number;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: agent.id,
    data: { agent },
  });

  const initials = agent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'p-3.5 rounded-xl border bg-white cursor-grab active:cursor-grabbing transition-all',
        'hover:border-blue-300 hover:shadow-md',
        isDragging && 'opacity-40 border-blue-300'
      )}
      style={{
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 ring-2 ring-slate-100">
          {agent.avatar ? (
            <img src={agent.avatar} alt={agent.name} className="object-cover" />
          ) : (
            <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 text-sm font-semibold">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{agent.name}</p>
          <p className="text-xs text-slate-500 truncate">{agent.persona || '暂无描述'}</p>
        </div>
      </div>

      {/* 团队徽章 */}
      {teamCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <Badge variant="secondary" className="text-xs font-medium">
            已加入 {teamCount} 个团队
          </Badge>
        </div>
      )}
    </div>
  );
});

DraggableAgentCard.displayName = 'DraggableAgentCard';
