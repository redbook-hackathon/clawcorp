import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { useChannelsStore } from '@/stores/channels';
import {
  CHANNEL_ICONS,
  CHANNEL_WORKBENCH_TYPES,
  type Channel,
} from '@/types/channel';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

export interface BotRailProps {
  activeChannelId: string | null;
  onBotSelect: (botId: string) => void;
  onBotSettings: (botId: string) => void;
  connectChannel: (channelId: string) => Promise<void>;
  disconnectChannel: (channelId: string) => Promise<void>;
}

interface BotRailEntryProps {
  bot: Channel;
  isActive: boolean;
  agents: AgentSummary[];
  teams: TeamSummary[];
  onClick: () => void;
  onSettings: () => void;
  connectChannel: (channelId: string) => Promise<void>;
  disconnectChannel: (channelId: string) => Promise<void>;
}

function BotRailEntry({ bot, isActive, agents, teams, onClick, onSettings, connectChannel, disconnectChannel }: BotRailEntryProps) {
  // Resolve bound label from agents or teams store
  const boundLabel = useMemo(() => {
    if (bot.boundAgentId) {
      const agent = agents.find((a) => a.id === bot.boundAgentId);
      return agent ? `绑定: ${agent.name}` : null;
    }
    if (bot.boundTeamId) {
      const team = teams.find((t) => t.id === bot.boundTeamId);
      return team ? `绑定: ${team.name}` : null;
    }
    return null;
  }, [bot.boundAgentId, bot.boundTeamId, agents, teams]);

  const statusDotColor = useMemo(() => {
    switch (bot.status) {
      case 'connected': return 'bg-[#10b981]';
      case 'disconnected': return 'bg-[#94a3b8]';
      case 'connecting': return 'bg-[#f59e0b]';
      case 'error': return 'bg-[#ef4444]';
      default: return 'bg-[#94a3b8]';
    }
  }, [bot.status]);

  const icon = CHANNEL_ICONS[bot.type] ?? '🔌';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
        isActive
          ? 'border-l-[3px] border-[#6366f1] bg-[#EEF2FF]'
          : 'border-black/[0.06] bg-white hover:bg-[#f8fafc]',
      )}
    >
      {/* Row 1: icon + name + status dot + settings */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[18px]">{icon}</span>
          <span className={cn(
            'truncate text-[14px] font-medium text-[#111827]',
            isActive && 'text-[#4F46E5]',
          )}>
            {bot.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', statusDotColor)} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSettings(); }}
            className="text-[13px] leading-none text-[#8e8e93] hover:text-[#3c3c43]"
            aria-label="设置"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Row 2: bound label + responsible person */}
      <div className="flex flex-col gap-0.5 pl-[26px]">
        {boundLabel && (
          <span className="truncate text-[11px] text-[#64748b]">{boundLabel}</span>
        )}
        {bot.responsiblePerson && (
          <span className="truncate text-[11px] text-[#94a3b8]">负责人: {bot.responsiblePerson}</span>
        )}
        <button
          type="button"
          onClick={() => {
            if (bot.status === 'connected' || bot.status === 'connecting') {
              void disconnectChannel(bot.id);
            } else {
              void connectChannel(bot.id);
            }
          }}
          className="w-fit text-[11px] text-[#6366f1] hover:underline"
        >
          {bot.status === 'connected' || bot.status === 'connecting' ? '断开' : '连接'}
        </button>
      </div>
    </button>
  );
}

export function BotRail({ activeChannelId, onBotSelect, onBotSettings, connectChannel, disconnectChannel }: BotRailProps) {
  const agents = useAgentsStore((s) => s.agents);
  const teams = useTeamsStore((s) => s.teams);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const fetchTeams = useTeamsStore((s) => s.fetchTeams);
  // Subscribe to channels for reactive re-renders when channels change
  const channels = useChannelsStore((s) => s.channels);

  // Load agents and teams if empty
  useEffect(() => {
    if (agents.length === 0) void fetchAgents();
    if (teams.length === 0) void fetchTeams();
  }, [agents.length, teams.length, fetchAgents, fetchTeams]);

  // Derive bot list from channels store reactively
  const bots = useMemo<Channel[]>(() => {
    const workbenchChannels = channels.filter((c) =>
      CHANNEL_WORKBENCH_TYPES.includes(c.type),
    );
    // Sort: connected first, then by name alphabetically
    return [...workbenchChannels].sort((a, b) => {
      if (a.status === 'connected' && b.status !== 'connected') return -1;
      if (a.status !== 'connected' && b.status === 'connected') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [channels]);

  if (bots.length === 0) {
    return (
      <section className="flex w-[290px] shrink-0 flex-col border-r border-black/[0.06] bg-white">
        <div className="flex h-[56px] items-center border-b border-black/[0.06] px-5">
          <h1 className="text-[15px] font-semibold text-[#111827]">渠道机器人</h1>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-[13px] text-[#8e8e93]">暂无可用机器人</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-[290px] shrink-0 flex-col border-r border-black/[0.06] bg-white">
      <div className="flex h-[56px] items-center border-b border-black/[0.06] px-5">
        <h1 className="text-[15px] font-semibold text-[#111827]">渠道机器人</h1>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {bots.map((bot) => (
          <BotRailEntry
            key={bot.id}
            bot={bot}
            isActive={bot.id === activeChannelId}
            agents={agents}
            teams={teams}
            onClick={() => onBotSelect(bot.id)}
            onSettings={() => onBotSettings(bot.id)}
            connectChannel={connectChannel}
            disconnectChannel={disconnectChannel}
          />
        ))}
      </div>
    </section>
  );
}
