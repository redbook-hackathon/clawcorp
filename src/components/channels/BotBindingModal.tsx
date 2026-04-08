/**
 * BotBindingModal — one-to-one binding of a bot to an Agent or Team
 * Phase 6: BotBindingModal + DingTalk/WeCom/QQ config pages
 */
import { useEffect, useState } from 'react';
import { useChannelsStore } from '@/stores/channels';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { hostApiFetch } from '@/lib/host-api';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '@/types/channel';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

export interface BotBindingModalProps {
  botId: string;
  onClose: () => void;
  onBound: () => void;
}

export function BotBindingModal({ botId, onClose, onBound }: BotBindingModalProps) {
  const { channels, updateChannel } = useChannelsStore();
  const { agents, fetchAgents } = useAgentsStore();
  const { teams, fetchTeams } = useTeamsStore();
  const agentList = agents ?? [];
  const teamList = teams ?? [];

  const bot = channels.find((c) => c.id === botId);

  const [bindType, setBindType] = useState<'agent' | 'team' | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(
    bot?.boundAgentId
  );
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    bot?.boundTeamId
  );
  const [responsiblePerson, setResponsiblePerson] = useState<string>(
    bot?.responsiblePerson ?? ''
  );
  const [saving, setSaving] = useState(false);

  // Load agents and teams if not yet loaded
  useEffect(() => {
    void fetchAgents();
    void fetchTeams();
  }, [fetchAgents, fetchTeams]);

  // Pre-select bind type based on existing binding
  useEffect(() => {
    if (bot) {
      if (bot.boundAgentId) {
        setBindType('agent');
        setSelectedAgentId(bot.boundAgentId);
      } else if (bot.boundTeamId) {
        setBindType('team');
        setSelectedTeamId(bot.boundTeamId);
      }
      if (bot.responsiblePerson) {
        setResponsiblePerson(bot.responsiblePerson);
      }
    }
  }, [bot]);

  const selectedAgent = agentList.find((a) => a.id === selectedAgentId);
  const selectedTeam = teamList.find((t) => t.id === selectedTeamId);

  const handleSave = async () => {
    if (!bot || !bindType) return;
    setSaving(true);
    try {
      // Update local store
      updateChannel(botId, {
        boundAgentId: bindType === 'agent' ? selectedAgentId : undefined,
        boundTeamId: bindType === 'team' ? selectedTeamId : undefined,
        responsiblePerson: responsiblePerson.trim() || undefined,
      });
      // Persist to backend
      await hostApiFetch('/api/channels/binding', {
        method: 'PUT',
        body: JSON.stringify({
          channelType: bot.type,
          accountId: bot.accountId,
          agentId: bindType === 'agent' ? selectedAgentId : undefined,
          teamId: bindType === 'team' ? selectedTeamId : undefined,
          responsiblePerson: responsiblePerson.trim() || undefined,
        }),
      });
      onBound();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleUnbind = async () => {
    if (!bot) return;
    setSaving(true);
    try {
      // Clear local store
      updateChannel(botId, {
        boundAgentId: undefined,
        boundTeamId: undefined,
        responsiblePerson: undefined,
      });
      // Persist to backend
      await hostApiFetch('/api/channels/binding', {
        method: 'DELETE',
        body: JSON.stringify({
          channelType: bot.type,
          accountId: bot.accountId,
        }),
      });
      setBindType(null);
      setSelectedAgentId(undefined);
      setSelectedTeamId(undefined);
      setResponsiblePerson('');
      onBound();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isBound = Boolean(bot?.boundAgentId || bot?.boundTeamId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[440px] rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[#111827]">机器人绑定配置</h2>
            <p className="text-[12px] text-[#8e8e93]">{bot?.name}</p>
          </div>
          <button
            type="button"
            className="text-[18px] text-[#8e8e93] hover:text-[#111827]"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Section 1 — Bot info (read-only) */}
          <div className="border-b border-black/[0.06] pb-5">
            <p className="mb-3 text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide">机器人信息</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f1e9] text-xl">
                {bot ? CHANNEL_ICONS[bot.type] ?? '🔌' : '🔌'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#111827]">{bot?.name}</p>
                <p className="text-[12px] text-[#8e8e93]">
                  {bot ? CHANNEL_NAMES[bot.type] : '未知'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#8e8e93]">
              当前绑定:{' '}
              {bot?.boundAgentId ? (
                <span className="text-[#111827]">
                  {selectedAgent?.name ?? bot.boundAgentId}
                </span>
              ) : bot?.boundTeamId ? (
                <span className="text-[#111827]">
                  {selectedTeam?.name ?? bot.boundTeamId}
                </span>
              ) : (
                <span className="text-[#f59e0b]">未绑定</span>
              )}
            </p>
          </div>

          {/* Section 2 — Bind to Agent or Team */}
          <div className="border-b border-black/[0.06] pb-5">
            <p className="mb-3 text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide">
              绑定到 Agent 或团队
            </p>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => { setBindType('agent'); setSelectedTeamId(undefined); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                  bindType === 'agent'
                    ? 'border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1]'
                    : 'border-black/10 text-[#8e8e93] hover:border-black/20'
                }`}
              >
                绑定到 Agent
              </button>
              <button
                type="button"
                onClick={() => { setBindType('team'); setSelectedAgentId(undefined); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                  bindType === 'team'
                    ? 'border-[#6366f1] bg-[#6366f1]/5 text-[#6366f1]'
                    : 'border-black/10 text-[#8e8e93] hover:border-black/20'
                }`}
              >
                绑定到团队
              </button>
            </div>

            {bindType === 'agent' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#111827]">选择 Agent</label>
                <select
                  value={selectedAgentId ?? ''}
                  onChange={(e) => setSelectedAgentId(e.target.value || undefined)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]"
                >
                  <option value="">— 选择 Agent —</option>
                    {agentList.map((agent: AgentSummary) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                {selectedAgent && (
                  <p className="text-[12px] text-[#10b981]">
                    已选择: {selectedAgent.name}
                  </p>
                )}
              </div>
            )}

            {bindType === 'team' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#111827]">选择团队</label>
                <select
                  value={selectedTeamId ?? ''}
                  onChange={(e) => setSelectedTeamId(e.target.value || undefined)}
                  className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]"
                >
                  <option value="">— 选择团队 —</option>
                    {teamList.map((team: TeamSummary) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {selectedTeam && (
                  <p className="text-[12px] text-[#10b981]">
                    已选择: {selectedTeam.name}
                  </p>
                )}
              </div>
            )}

            {bindType === null && (
              <p className="text-[13px] text-[#8e8e93] italic">请选择绑定类型</p>
            )}
          </div>

          {/* Section 3 — Responsible Person */}
          <div>
            <p className="mb-3 text-[12px] font-medium text-[#8e8e93] uppercase tracking-wide">
              负责人
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#111827]" htmlFor="responsiblePerson">
                负责人
              </label>
              <input
                id="responsiblePerson"
                type="text"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="输入负责人姓名"
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-[14px] text-[#111827] outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] placeholder:text-[#8e8e93]"
              />
              <p className="text-[12px] text-[#8e8e93]">指定该机器人的负责人姓名</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/[0.06] px-6 py-4">
          <div>
            {isBound && (
              <button
                type="button"
                onClick={() => void handleUnbind()}
                disabled={saving}
                className="rounded-xl border border-[#ef4444]/30 px-4 py-2 text-[13px] font-medium text-[#ef4444] hover:bg-[#ef4444]/5 disabled:opacity-50"
              >
                解除绑定
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 px-4 py-2 text-[13px] font-medium text-[#3c3c43] hover:bg-black/[0.04]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !bindType}
              className="rounded-xl bg-[#6366f1] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#4f46e5] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存绑定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
