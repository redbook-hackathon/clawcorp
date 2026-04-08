/**
 * Ecosystem Gateway Page
 * 生态网关 — 打通外部工作流，实现全渠道自动化响应
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Network, Plus, Route, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toOpenClawChannelType } from '@/lib/channel-alias';
import { hostApiFetch } from '@/lib/host-api';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { useChannelsStore } from '@/stores/channels';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { CHANNEL_NAMES, CHANNEL_WORKBENCH_TYPES, type Channel, type ChannelType } from '@/types/channel';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

type BoundOwner = {
  id: string;
  name: string;
  kind: 'agent' | 'team';
} | null;

type ChannelWithOwner = Channel & { owner: BoundOwner };

function getStatusDescriptor(status: Channel['status']) {
  if (status === 'connected') {
    return {
      label: '已连接',
      tone: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      dot: 'bg-emerald-500',
      cardAccent: 'border-emerald-200/70',
      cta: '查看配置',
    };
  }
  if (status === 'connecting') {
    return {
      label: '连接中',
      tone: 'text-amber-600 bg-amber-50 border-amber-100',
      dot: 'bg-amber-500',
      cardAccent: 'border-amber-200/70',
      cta: '继续配置',
    };
  }
  if (status === 'error') {
    return {
      label: '异常',
      tone: 'text-red-600 bg-red-50 border-red-100',
      dot: 'bg-red-500',
      cardAccent: 'border-red-200/70',
      cta: '修复配置',
    };
  }
  return {
    label: '未授权',
    tone: 'text-slate-500 bg-slate-50 border-slate-100',
    dot: 'bg-slate-400',
    cardAccent: 'border-slate-200/70',
    cta: '立即授权',
  };
}

function resolveBoundOwner(
  channel: Channel,
  agents: AgentSummary[],
  teams: TeamSummary[],
  accountOwnerMap: Record<string, string>,
  channelOwners: Record<string, string>,
): BoundOwner {
  if (channel.boundTeamId) {
    const team = teams.find((entry) => entry.id === channel.boundTeamId);
    if (team) {
      return { id: team.id, name: team.name, kind: 'team' };
    }
  }

  if (channel.boundAgentId) {
    const agent = agents.find((entry) => entry.id === channel.boundAgentId);
    if (agent) {
      return { id: agent.id, name: agent.name, kind: 'agent' };
    }
  }

  const rawChannelType = toOpenClawChannelType(channel.type);
  const accountId = channel.accountId || 'default';
  const accountScopedOwnerId =
    accountOwnerMap[`${channel.type}:${accountId}`]
    || accountOwnerMap[`${rawChannelType}:${accountId}`]
    || channelOwners[`${rawChannelType}:${accountId}`];
  const channelScopedOwnerId = channelOwners[rawChannelType] || channelOwners[channel.type];
  const ownerId = accountScopedOwnerId || channelScopedOwnerId;
  if (!ownerId) return null;

  const ownerAgent = agents.find((entry) => entry.id === ownerId);
  if (!ownerAgent) return null;
  return { id: ownerAgent.id, name: ownerAgent.name, kind: 'agent' };
}

interface ChannelCardProps {
  channel: ChannelWithOwner;
  onAuthorize: (channel: Channel) => void;
  onConfigure: (channel: Channel) => void;
}

function ChannelCard({ channel, onAuthorize, onConfigure }: ChannelCardProps) {
  const status = getStatusDescriptor(channel.status);
  const isConnected = channel.status === 'connected' || channel.status === 'connecting';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-3xl border bg-white p-5 transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]',
        status.cardAccent,
      )}
      onClick={() => (isConnected ? onConfigure(channel) : onAuthorize(channel))}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isConnected) {
            onConfigure(channel);
          } else {
            onAuthorize(channel);
          }
        }
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-slate-100/70 blur-2xl transition-opacity group-hover:opacity-90" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
            <ChannelIcon type={channel.type} size={26} className="grayscale group-hover:grayscale-0 transition-all" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900">{channel.name}</p>
            <p className="mt-0.5 text-[12px] text-slate-400">{channel.accountId || 'default'}</p>
          </div>
        </div>
        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold', status.tone)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex min-h-[28px] items-center">
        {channel.owner ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
            <ShieldCheck size={12} className="text-slate-500" />
            <span className="font-semibold text-slate-700">{channel.owner.name}</span>
            <span className="text-slate-400">{channel.owner.kind === 'agent' ? 'Agent' : 'Team'}</span>
          </div>
        ) : (
          <p className="text-[12px] text-slate-400">未绑定执行主体</p>
        )}
      </div>

      <button
        type="button"
        className={cn(
          'mt-4 w-full rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors',
          isConnected
            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            : 'bg-slate-900 text-white hover:bg-slate-700',
        )}
        onClick={(event) => {
          event.stopPropagation();
          if (isConnected) {
            onConfigure(channel);
          } else {
            onAuthorize(channel);
          }
        }}
      >
        {status.cta}
      </button>
    </div>
  );
}

interface UnconfiguredCardProps {
  type: ChannelType;
  onAdd: (channelType: string) => void;
}

function UnconfiguredCard({ type, onAdd }: UnconfiguredCardProps) {
  return (
    <button
      type="button"
      className="group flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-3 py-4 text-center transition-colors hover:border-slate-400 hover:bg-white"
      onClick={() => onAdd(type)}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
        <ChannelIcon type={type} size={22} className="opacity-45 group-hover:opacity-80 transition-opacity" />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-slate-600">{CHANNEL_NAMES[type]}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <Plus size={12} />
          添加渠道
        </p>
      </div>
    </button>
  );
}

interface RouteRowProps {
  channel: ChannelWithOwner;
  onConfigure: (channel: Channel) => void;
}

function RouteRow({ channel, onConfigure }: RouteRowProps) {
  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-slate-50/70"
      onClick={() => onConfigure(channel)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
          <ChannelIcon type={channel.type} size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{channel.name} 路由</p>
          <p className="mt-0.5 truncate text-[12px] text-slate-400">
            {channel.owner ? `转发到 ${channel.owner.name}` : '未绑定处理对象'}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500">
        <ExternalLink size={14} />
      </div>
    </button>
  );
}

export default function Gateway() {
  const navigate = useNavigate();
  const channels = useChannelsStore((state) => state.channels);
  const fetchChannels = useChannelsStore((state) => state.fetchChannels);
  const agents = useAgentsStore((state) => state.agents);
  const channelOwners = useAgentsStore((state) => state.channelOwners);
  const fetchAgents = useAgentsStore((state) => state.fetchAgents);
  const teams = useTeamsStore((state) => state.teams);
  const fetchTeams = useTeamsStore((state) => state.fetchTeams);
  const [accountOwnerMap, setAccountOwnerMap] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchChannels();
    if (agents.length === 0) void fetchAgents();
    if (teams.length === 0) void fetchTeams();

    void (async () => {
      try {
        const payload = await hostApiFetch<{
          success?: boolean;
          channels?: Array<{
            channelType: string;
            accounts: Array<{ accountId: string; agentId?: string }>;
          }>;
        }>('/api/channels/accounts');
        const nextMap: Record<string, string> = {};
        for (const channelEntry of payload.channels || []) {
          for (const account of channelEntry.accounts || []) {
            if (!account.agentId) continue;
            nextMap[`${channelEntry.channelType}:${account.accountId || 'default'}`] = account.agentId;
          }
        }
        setAccountOwnerMap(nextMap);
      } catch {
        // fallback to agent snapshot channelOwners map
      }
    })();
  }, [agents.length, fetchAgents, fetchChannels, fetchTeams, teams.length]);

  const channelsWithOwner = useMemo<ChannelWithOwner[]>(
    () =>
      channels.map((channel) => ({
        ...channel,
        owner: resolveBoundOwner(channel, agents, teams, accountOwnerMap, channelOwners),
      })),
    [accountOwnerMap, agents, channelOwners, channels, teams],
  );

  const workbenchChannels = useMemo(
    () => channelsWithOwner.filter((channel) => CHANNEL_WORKBENCH_TYPES.includes(channel.type)),
    [channelsWithOwner],
  );

  const connectedWorkbenchChannels = useMemo(
    () => workbenchChannels.filter((channel) => channel.status === 'connected' || channel.status === 'connecting'),
    [workbenchChannels],
  );

  const otherConnectedChannels = useMemo(
    () =>
      channelsWithOwner.filter(
        (channel) =>
          !CHANNEL_WORKBENCH_TYPES.includes(channel.type)
          && (channel.status === 'connected' || channel.status === 'connecting'),
      ),
    [channelsWithOwner],
  );

  const unconfiguredChannelTypes = useMemo(
    () => CHANNEL_WORKBENCH_TYPES.filter((channelType) => !workbenchChannels.some((channel) => channel.type === channelType)),
    [workbenchChannels],
  );

  const connectedCount = connectedWorkbenchChannels.length;
  const boundAgentCount = workbenchChannels.filter((channel) => channel.owner?.kind === 'agent').length;
  const boundTeamCount = workbenchChannels.filter((channel) => channel.owner?.kind === 'team').length;

  const handleAuthorize = (channel: Channel) => {
    navigate(`/channels?channel=${channel.type}`);
  };

  const handleConfigure = (channel: Channel) => {
    navigate(`/channels?channel=${channel.type}`);
  };

  const handleAddChannel = (channelType: string) => {
    navigate(`/channels?channel=${channelType}`);
  };

  const handleConfigureMore = () => {
    navigate('/channels');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fcfcfe] custom-scrollbar">
      <div className="px-8 pt-7 pb-5">
        <div className="rounded-[28px] border border-black/[0.06] bg-[radial-gradient(90%_120%_at_0%_0%,rgba(253,230,138,0.45),rgba(255,255,255,0.95))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-[24px] font-bold tracking-tight text-slate-900">生态网关</h1>
                <p className="mt-1 text-[13px] text-slate-500">打通外部渠道、绑定执行主体、统一路由处理</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700">
              <Sparkles size={13} />
              ClawFirm Style
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white bg-white/90 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">已连接</p>
              <p className="mt-1 text-[23px] font-bold text-slate-900">{connectedCount}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/90 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">绑定 Agent</p>
              <p className="mt-1 text-[23px] font-bold text-slate-900">{boundAgentCount}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white/90 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">绑定 Team</p>
              <p className="mt-1 text-[23px] font-bold text-slate-900">{boundTeamCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 px-8 pb-8 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-slate-900">授权接入</h2>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              {connectedCount}/{workbenchChannels.length} 在线
            </span>
          </div>

          {workbenchChannels.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {workbenchChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onAuthorize={handleAuthorize}
                  onConfigure={handleConfigure}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-9 text-center">
              <p className="text-[14px] font-semibold text-slate-500">暂无已配置渠道</p>
              <p className="mt-1 text-[12px] text-slate-400">从右侧先添加一个渠道入口</p>
            </div>
          )}

          {unconfiguredChannelTypes.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">添加更多渠道</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {unconfiguredChannelTypes.map((channelType) => (
                  <UnconfiguredCard
                    key={channelType}
                    type={channelType}
                    onAdd={handleAddChannel}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-[16px] font-semibold text-slate-900">
              <Route className="h-4 w-4 text-slate-500" />
              消息路由配置
            </h2>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              {connectedWorkbenchChannels.length + otherConnectedChannels.length} 条
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {connectedWorkbenchChannels.map((channel) => (
              <RouteRow key={channel.id} channel={channel} onConfigure={handleConfigure} />
            ))}
            {otherConnectedChannels.map((channel) => (
              <RouteRow key={channel.id} channel={channel} onConfigure={handleConfigure} />
            ))}

            {connectedWorkbenchChannels.length === 0 && otherConnectedChannels.length === 0 && (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                  <Network className="h-6 w-6 text-slate-300" />
                </div>
                <p className="mt-3 text-[14px] font-semibold text-slate-500">暂无可用路由</p>
                <p className="mt-1 text-[12px] text-slate-400">先完成渠道授权，再配置处理对象</p>
              </div>
            )}

            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700 transition-colors hover:text-slate-900"
                onClick={handleConfigureMore}
              >
                <ExternalLink size={14} />
                查看全部渠道配置
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
