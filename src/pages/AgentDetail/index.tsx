import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { hostApiFetch } from '@/lib/host-api';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { useChatStore } from '@/stores/chat';
import { useApprovalsStore } from '@/stores/approvals';
import type { AgentCronRelation, CronJob } from '@/types/cron';
import type { AgentChatAccess, AgentSummary, AgentTeamRole } from '@/types/agent';
import { AgentDetailHero } from '@/components/agents/detail/AgentDetailHero';
import { AgentDetailTabs, type AgentDetailTabId } from '@/components/agents/detail/AgentDetailTabs';
import { AgentMemoryTab } from '@/components/agents/detail/AgentMemoryTab';
import { AgentActivityTab } from '@/components/agents/detail/AgentActivityTab';
import { AgentSkillsTab } from '@/components/agents/detail/AgentSkillsTab';
import { buildAgentTaskSummaryMap } from '@/lib/task-summary-read-model';
import { toast } from 'sonner';

const RECENT_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const AGENT_DETAIL_TABS: AgentDetailTabId[] = ['overview', 'memory', 'skills', 'activity'];

function parseAgentDetailTab(tab: string | null): AgentDetailTabId {
  return AGENT_DETAIL_TABS.includes(tab as AgentDetailTabId)
    ? (tab as AgentDetailTabId)
    : 'overview';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-100 py-3 text-[13px]">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[360px] text-right text-slate-900">{value || '-'}</span>
    </div>
  );
}

function formatSchedule(schedule: CronJob['schedule']): string {
  if (typeof schedule === 'string') return schedule;
  if (schedule.kind === 'cron') return schedule.expr;
  if (schedule.kind === 'every') {
    const ms = schedule.everyMs;
    if (ms < 60_000) return `every ${ms / 1000}s`;
    if (ms < 3_600_000) return `every ${ms / 60_000}m`;
    if (ms < 86_400_000) return `every ${ms / 3_600_000}h`;
    return `every ${ms / 86_400_000}d`;
  }
  if (schedule.kind === 'at') return `at ${schedule.at}`;
  return '-';
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function TeamSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-medium text-slate-900">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TeamTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-medium text-slate-900">{label}</span>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
      />
    </label>
  );
}

interface AvatarSectionProps {
  agentId: string;
  agentName: string;
  avatar: string | null | undefined;
  onAvatarChange: (avatar: string | null) => void;
}

function AvatarSection({ agentId, agentName, avatar, onAvatarChange }: AvatarSectionProps) {
  const { t } = useTranslation('agents');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showFeedback = useCallback((type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!fileInputRef.current) fileInputRef.current = event.target;
      event.target.value = '';
      if (!file) return;

      setUploading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        await hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
          method: 'PUT',
          body: JSON.stringify({ avatar: base64 }),
        });
        onAvatarChange(base64);
        showFeedback('success', t('detail.avatarUploaded', { defaultValue: 'Avatar updated' }));
      } catch {
        showFeedback('error', t('detail.avatarUploadFailed', { defaultValue: 'Failed to upload avatar' }));
      } finally {
        setUploading(false);
      }
    },
    [agentId, onAvatarChange, showFeedback, t],
  );

  const handleRemove = useCallback(async () => {
    setUploading(true);
    try {
      await hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PUT',
        body: JSON.stringify({ avatar: null }),
      });
      onAvatarChange(null);
      showFeedback('success', t('detail.avatarRemoved', { defaultValue: 'Avatar removed' }));
    } catch {
      showFeedback('error', t('detail.avatarRemoveFailed', { defaultValue: 'Failed to remove avatar' }));
    } finally {
      setUploading(false);
    }
  }, [agentId, onAvatarChange, showFeedback, t]);

  const initials = agentName
    .split(/\s+/)
    .map((chunk) => chunk[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-slate-900">
        {t('detail.avatar', { defaultValue: 'Avatar' })}
      </h2>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          {avatar ? (
            <img src={avatar} alt={agentName} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[20px] font-semibold text-[#94a3b8]">
              {initials || '?'}
            </span>
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {t('detail.uploadAvatar', { defaultValue: 'Upload Avatar' })}
          </button>
          {avatar ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => void handleRemove()}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              {t('detail.removeAvatar', { defaultValue: 'Remove Avatar' })}
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      {feedback ? (
        <p className={`mt-3 text-[12px] ${feedback.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {feedback.msg}
        </p>
      ) : null}
    </div>
  );
}

interface CronSectionProps {
  agentId: string;
}

function CronSection({ agentId }: CronSectionProps) {
  const { t } = useTranslation('agents');
  const navigate = useNavigate();
  const [relations, setRelations] = useState<AgentCronRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadRelations = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await hostApiFetch<{ relations?: AgentCronRelation[] }>(
          `/api/agents/${encodeURIComponent(agentId)}/cron-relations`,
        );
        if (!cancelled) {
          setRelations(Array.isArray(result?.relations) ? result.relations : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setRelations([]);
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRelations();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-slate-900">
        {t('detail.cronJobs', { defaultValue: 'Cron Jobs' })}
      </h2>

      {loading ? (
        <p className="mt-4 text-[13px] text-slate-400">
          {t('detail.cronLoading', { defaultValue: 'Loading cron jobs...' })}
        </p>
      ) : null}

      {!loading && error ? <p className="mt-4 text-[13px] text-red-500">{error}</p> : null}

      {!loading && !error && relations.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-400">
          {t('detail.noCronJobs', { defaultValue: 'No cron jobs associated with this agent.' })}
        </p>
      ) : null}

      {!loading && !error && relations.length > 0 ? (
        <div className="mt-4 space-y-2">
          {relations.map((relation) => (
            <button
              key={relation.job.id}
              type="button"
              onClick={() => navigate(relation.deepLink)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-slate-900">{relation.job.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      relation.job.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {relation.job.enabled
                      ? t('detail.cronEnabled', { defaultValue: 'enabled' })
                      : t('detail.cronDisabled', { defaultValue: 'disabled' })}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[12px] text-slate-400">
                  <span>{formatSchedule(relation.job.schedule)}</span>
                  <span>{relation.relationReason}</span>
                  {relation.job.lastRun ? (
                    <span>
                      {t('detail.cronLastRun', { defaultValue: 'Last run' })}: {formatTime(relation.job.lastRun.time)}
                    </span>
                  ) : null}
                </div>
              </div>
              <svg className="ml-3 h-4 w-4 shrink-0 text-[#c7c7cc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AgentDetail() {
  const { t } = useTranslation('agents');
  const navigate = useNavigate();
  const { agentId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { agents, fetchAgents, loading: agentsLoading, updateAgent } = useAgentsStore();
  const {
    teams = [],
    fetchTeams = async () => undefined,
    loading: teamsLoading = false,
  } = useTeamsStore() as {
    teams?: Array<{ leaderId: string; memberIds: string[]; name: string }>;
    fetchTeams?: () => Promise<void>;
    loading?: boolean;
  };
  const tasks = useApprovalsStore((state) => state.tasks ?? []);
  const fetchTasks = useApprovalsStore((state) => state.fetchTasks ?? (async () => undefined));
  const sessionLastActivity = useChatStore((state) => state.sessionLastActivity);
  const openDirectAgentSession = useChatStore((state) => state.openDirectAgentSession);
  const [localAvatar, setLocalAvatar] = useState<{ agentId: string; avatar: string | null } | null>(null);
  const [teamRole, setTeamRole] = useState<AgentTeamRole>('worker');
  const [chatAccess, setChatAccess] = useState<AgentChatAccess>('direct');
  const [responsibility, setResponsibility] = useState('');
  const [reportsToDraft, setReportsToDraft] = useState('');
  const [savingTeamSettings, setSavingTeamSettings] = useState(false);
  const activeTab = parseAgentDetailTab(searchParams.get('tab'));
  const loading = agentsLoading || teamsLoading;

  useEffect(() => {
    void Promise.all([fetchAgents(), fetchTeams(), fetchTasks()]);
  }, [fetchAgents, fetchTeams, fetchTasks]);

  const agent = useMemo(
    () => agents.find((entry) => entry.id === agentId) ?? null,
    [agentId, agents],
  );

  const directReports = useMemo(
    () => agents.filter((entry) => (agent as AgentSummaryWithHierarchy)?.directReports?.includes(entry.id)),
    [agent, agents],
  );
  const reportsToId = (agent as AgentSummaryWithHierarchy)?.reportsTo ?? null;
  const reportsTo = reportsToId ? agents.find((entry) => entry.id === reportsToId) ?? null : null;
  const teamLabels = useMemo(
    () => teams
      .filter((team) => team.leaderId === agentId || team.memberIds.includes(agentId))
      .map((team) => team.name),
    [agentId, teams],
  );
  const taskSummaryByAgent = useMemo(() => buildAgentTaskSummaryMap(tasks), [tasks]);
  const hierarchySummary = agent?.isDefault
    ? t('detail.rootSummary', { defaultValue: 'This is the root ClawCorp agent.' })
    : t('detail.reportsToSummary', {
        name: agent?.name ?? '',
        parent: reportsTo?.name ?? 'main',
        defaultValue: `${agent?.name ?? ''} reports to ${reportsTo?.name ?? 'main'}`,
      });

  useEffect(() => {
    if (!agent) return;
    setTeamRole((agent as AgentSummaryWithTeamSettings).teamRole ?? (agent.isDefault ? 'leader' : 'worker'));
    setChatAccess((agent as AgentSummaryWithTeamSettings).chatAccess ?? 'direct');
    setResponsibility((agent as AgentSummaryWithTeamSettings).responsibility ?? '');
    setReportsToDraft(reportsToId ?? '');
  }, [agent, reportsToId]);

  const setActiveTab = (tab: AgentDetailTabId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  if (!loading && !agent) {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 px-8 py-10">
        <Link to="/agents" className="text-[13px] text-slate-400 hover:text-slate-900">
          {t('detail.backToAgents', { defaultValue: 'Back to agents' })}
        </Link>
        <div className="rounded-[24px] border border-slate-200/80 bg-white p-8 shadow-sm">
          <h1 className="text-[28px] font-semibold text-slate-900">
            {t('detail.notFoundTitle', { defaultValue: 'Agent not found' })}
          </h1>
          <p className="mt-3 text-[14px] text-slate-500">
            {t('detail.notFoundDescription', {
              defaultValue: 'The requested agent does not exist in the current ClawCorp snapshot.',
            })}
          </p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-slate-400">
        {t('detail.loading', { defaultValue: 'Loading agent details...' })}
      </div>
    );
  }

  const avatarValue = localAvatar?.agentId === agent.id
    ? localAvatar.avatar
    : (agent as AgentSummaryWithAvatar | null)?.avatar ?? null;
  const teamConfigDirty = teamRole !== ((agent as AgentSummaryWithTeamSettings).teamRole ?? (agent.isDefault ? 'leader' : 'worker'))
    || chatAccess !== ((agent as AgentSummaryWithTeamSettings).chatAccess ?? 'direct')
    || responsibility !== ((agent as AgentSummaryWithTeamSettings).responsibility ?? '')
    || reportsToDraft !== (reportsToId ?? '');

  const saveTeamSettings = async () => {
    setSavingTeamSettings(true);
    try {
      await updateAgent(agent.id, {
        teamRole,
        chatAccess,
        responsibility,
        reportsTo: reportsToDraft || null,
      });
    } finally {
      setSavingTeamSettings(false);
    }
  };

  const agentTaskSummary = taskSummaryByAgent[agent.id];
  const lastActiveAt = agentTaskSummary?.lastActiveTime ?? sessionLastActivity[agent.mainSessionKey];
  const statusLabel = agentTaskSummary?.statusKey === 'blocked'
    ? 'Blocked'
    : agentTaskSummary?.statusKey === 'waiting_approval'
      ? 'Waiting Approval'
      : agentTaskSummary?.activeTaskCount
        ? 'Working'
        : (lastActiveAt && Date.now() - lastActiveAt < RECENT_ACTIVITY_WINDOW_MS ? 'Active' : 'Idle');
  const activityTitles = agentTaskSummary?.currentWorkTitles?.length
    ? agentTaskSummary.currentWorkTitles
    : (responsibility ? [responsibility] : []);
  const blockingReason = agentTaskSummary?.blockingReason ?? (
    chatAccess === 'leader_only'
      ? 'Direct chat is routed through the reporting leader.'
      : null
  );
  const nextStep = agentTaskSummary?.statusKey === 'blocked' || agentTaskSummary?.statusKey === 'waiting_approval'
    ? 'Open Task Kanban to resolve the current execution gate.'
    : activityTitles.length > 0
      ? 'Open Task Kanban to inspect the current execution lineage.'
      : 'Open a direct chat from Employee Square to capture the latest status.';

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-6 px-8 py-10">
      <AgentDetailHero
        name={agent.name}
        persona={agent.persona || t('detail.noPersona', { defaultValue: 'No persona configured.' })}
        avatar={avatarValue}
        roleLabel={teamRole}
        modelLabel={agent.modelDisplay}
        teamLabels={teamLabels}
        onOpenChat={() => {
          try {
            openDirectAgentSession(agent.id);
            navigate('/');
          } catch (error) {
            toast.error(String(error));
          }
        }}
        onOpenMemory={() => setActiveTab('memory')}
        onOpenSkills={() => setActiveTab('skills')}
      />

      <AgentDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <section className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-[18px] font-semibold text-slate-900">
              {t('detail.metadata', { defaultValue: 'Metadata' })}
            </h2>
            <div className="mt-4">
              <DetailRow label={t('detail.agentId', { defaultValue: 'Agent ID' })} value={agent.id} />
              <DetailRow label={t('detail.model', { defaultValue: 'Model' })} value={agent.modelDisplay} />
              <DetailRow label={t('detail.workspace', { defaultValue: 'Workspace' })} value={agent.workspace} />
              <DetailRow label={t('detail.agentDir', { defaultValue: 'Agent directory' })} value={agent.agentDir} />
              <DetailRow label={t('detail.mainSessionKey', { defaultValue: 'Main session key' })} value={agent.mainSessionKey} />
            </div>
          </section>

          <section className="space-y-6">
            <AvatarSection
              agentId={agent.id}
              agentName={agent.name}
              avatar={avatarValue}
              onAvatarChange={(avatar) => setLocalAvatar({ agentId: agent.id, avatar })}
            />

            <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-slate-900">
                {t('detail.teamSettings', { defaultValue: 'Team settings' })}
              </h2>
              <p className="mt-3 text-[14px] text-slate-600">
                {t('detail.teamSettingsDescription', { defaultValue: 'Define whether this agent leads the team, can be directly contacted, and what work it is responsible for.' })}
              </p>
              <div className="mt-4 grid gap-4">
                <TeamSelect
                  id="team-role"
                  label={t('detail.teamRole', { defaultValue: 'Team role' })}
                  value={teamRole}
                  onChange={(value) => setTeamRole(value as AgentTeamRole)}
                  options={[
                    { value: 'leader', label: t('detail.teamRoleLeader', { defaultValue: 'leader' }) },
                    { value: 'worker', label: t('detail.teamRoleWorker', { defaultValue: 'worker' }) },
                  ]}
                />
                <p className="text-[12px] text-slate-500">
                  {teamRole === 'leader'
                    ? t('detail.teamRoleLeaderHint', { defaultValue: 'Leaders act as the main user-facing coordinator for a team.' })
                    : t('detail.teamRoleWorkerHint', { defaultValue: 'Workers focus on execution and can be routed through a leader.' })}
                </p>
                <TeamSelect
                  id="chat-access"
                  label={t('detail.chatAccess', { defaultValue: 'Chat access' })}
                  value={chatAccess}
                  onChange={(value) => setChatAccess(value as AgentChatAccess)}
                  options={[
                    { value: 'direct', label: t('detail.chatAccessDirect', { defaultValue: 'direct' }) },
                    { value: 'leader_only', label: t('detail.chatAccessLeaderOnly', { defaultValue: 'leader_only' }) },
                  ]}
                />
                <p className="text-[12px] text-slate-500">
                  {chatAccess === 'direct'
                    ? t('detail.chatAccessDirectHint', { defaultValue: 'Users can open a conversation with this agent directly.' })
                    : t('detail.chatAccessLeaderOnlyHint', { defaultValue: 'This agent is blocked from normal direct chat and should be contacted through its leader.' })}
                </p>
                <TeamTextarea
                  id="responsibility"
                  label={t('detail.responsibility', { defaultValue: 'Responsibility' })}
                  value={responsibility}
                  onChange={setResponsibility}
                  placeholder={t('detail.responsibilityPlaceholder', { defaultValue: 'Describe this member鈥檚 primary responsibility' })}
                />
                <TeamSelect
                  id="reports-to"
                  label={t('detail.reportsTo', { defaultValue: 'Reports to' })}
                  value={reportsToDraft}
                  onChange={setReportsToDraft}
                  options={[
                    { value: '', label: t('detail.none', { defaultValue: 'none' }) },
                    ...agents
                      .filter((entry) => entry.id !== agent.id)
                      .map((entry) => ({ value: entry.id, label: entry.id })),
                  ]}
                />
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveTeamSettings()}
                  disabled={!teamConfigDirty || savingTeamSettings}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingTeamSettings
                    ? t('detail.savingTeamSettings', { defaultValue: 'Saving...' })
                    : t('detail.saveTeamSettings', { defaultValue: 'Save team settings' })}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-slate-900">
                {t('detail.hierarchy', { defaultValue: 'Hierarchy' })}
              </h2>
              <p className="mt-3 text-[14px] text-slate-600">{hierarchySummary}</p>
              <div className="mt-4 space-y-3 text-[13px]">
                <DetailRow
                  label={t('detail.reportsTo', { defaultValue: 'Reports to' })}
                  value={reportsTo?.id ?? t('detail.none', { defaultValue: 'none' })}
                />
                <DetailRow
                  label={t('detail.directReports', { defaultValue: 'Direct reports' })}
                  value={directReports.length > 0 ? directReports.map((entry) => entry.id).join(', ') : t('detail.none', { defaultValue: 'none' })}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-[18px] font-semibold text-slate-900">
                {t('detail.channels', { defaultValue: 'Channels' })}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.channelTypes.length > 0 ? (
                  agent.channelTypes.map((channelType) => (
                    <span
                      key={channelType}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-700"
                    >
                      {channelType}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-slate-400">
                    {t('detail.noChannels', { defaultValue: 'No channels assigned.' })}
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'memory' ? <AgentMemoryTab agent={agent as AgentSummary} /> : null}
      {activeTab === 'skills' ? <AgentSkillsTab agentId={agent.id} /> : null}
      {activeTab === 'activity' ? (
        <AgentActivityTab
          statusLabel={statusLabel}
          currentWorkTitles={activityTitles}
          blockingReason={blockingReason}
          nextStep={nextStep}
        >
          <CronSection agentId={agent.id} />
        </AgentActivityTab>
      ) : null}
    </div>
  );
}

interface AgentSummaryWithAvatar {
  avatar?: string | null;
}

interface AgentSummaryWithHierarchy {
  reportsTo?: string | null;
  directReports?: string[];
}

interface AgentSummaryWithTeamSettings {
  teamRole?: AgentTeamRole;
  chatAccess?: AgentChatAccess;
  responsibility?: string;
}

export default AgentDetail;
