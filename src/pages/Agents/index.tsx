import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AgentSettingsModal } from '@/components/agents/AgentSettingsModal';
import { CreateAgentSheet } from '@/components/agents/CreateAgentSheet';
import {
  EmployeeSquareHero,
  type EmployeeSquareFilterKey,
} from '@/components/agents/EmployeeSquareHero';
import { EmployeeSquareCard } from '@/components/agents/EmployeeSquareCard';
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { useTeamsStore } from '@/stores/teams';
import { useGatewayStore } from '@/stores/gateway';
import { useChatStore } from '@/stores/chat';
import { useApprovalsStore } from '@/stores/approvals';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { buildEmployeeSquareCardModels } from '@/lib/agent-square-view-model';

export function Agents() {
  const { t } = useTranslation('agents');
  const navigate = useNavigate();
  const gatewayStatus = useGatewayStore((state) => state.status);
  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    fetchAgents,
    deleteAgent,
  } = useAgentsStore();
  const { channels, fetchChannels } = useChannelsStore();
  const {
    teams,
    loading: teamsLoading,
    error: teamsError,
    fetchTeams,
  } = useTeamsStore();
  const tasks = useApprovalsStore((state) => state.tasks ?? []);
  const fetchTasks = useApprovalsStore((state) => state.fetchTasks ?? (async () => undefined));
  const sessionLastActivity = useChatStore((state) => state.sessionLastActivity);
  const openDirectAgentSession = useChatStore((state) => state.openDirectAgentSession);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentSummary | null>(null);
  const [activeFilter, setActiveFilter] = useState<EmployeeSquareFilterKey>('all');

  const loading = agentsLoading || teamsLoading;
  const error = agentsError ?? teamsError;

  useEffect(() => {
    void Promise.all([fetchAgents(), fetchChannels(), fetchTeams(), fetchTasks()]);
  }, [fetchAgents, fetchChannels, fetchTeams, fetchTasks]);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? null,
    [activeAgentId, agents],
  );

  const cards = useMemo(
    () => buildEmployeeSquareCardModels({ agents, teams, sessionLastActivity, tasks }),
    [agents, sessionLastActivity, tasks, teams],
  );

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );

  const filteredCards = useMemo(() => {
    switch (activeFilter) {
      case 'leader':
        return cards.filter((card) => card.roleLabel === 'leader');
      case 'worker':
        return cards.filter((card) => card.roleLabel === 'worker');
      case 'direct':
        return cards.filter((card) => !card.isDirectChatBlocked);
      case 'leader_only':
        return cards.filter((card) => card.isDirectChatBlocked);
      case 'with_team':
        return cards.filter((card) => card.teamLabels.length > 0);
      case 'all':
      default:
        return cards;
    }
  }, [activeFilter, cards]);

  const statCounts = useMemo(() => ({
    total: cards.length,
    leaders: cards.filter((card) => card.roleLabel === 'leader').length,
    workers: cards.filter((card) => card.roleLabel === 'worker').length,
  }), [cards]);

  const filterLabels = useMemo(() => ({
    all: t('square.filters.all', { defaultValue: 'All' }),
    leader: t('square.filters.leader', { defaultValue: 'Leaders' }),
    worker: t('square.filters.worker', { defaultValue: 'Workers' }),
    direct: t('square.filters.direct', { defaultValue: 'Direct Chat' }),
    leader_only: t('square.filters.leader_only', { defaultValue: 'Leader Only' }),
    with_team: t('square.filters.with_team', { defaultValue: 'With Team' }),
  }), [t]);

  const actionLabels = useMemo(() => ({
    chat: t('square.actions.chat', { defaultValue: 'Chat' }),
    memory: t('square.actions.memory', { defaultValue: 'Memory' }),
    details: t('square.actions.details', { defaultValue: 'Details' }),
    roleLeader: t('detail.teamRoleLeader', { defaultValue: 'leader' }),
    roleWorker: t('detail.teamRoleWorker', { defaultValue: 'worker' }),
    leaderOnly: t('detail.chatAccessLeaderOnly', { defaultValue: 'leader_only' }),
    settings: t('settings', { defaultValue: 'Settings' }),
    delete: t('deleteAgent', { defaultValue: 'Delete Agent' }),
  }), [t]);

  const handleRefresh = () => {
    void Promise.all([fetchAgents(), fetchChannels(), fetchTeams()]);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center dark:bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
        <EmployeeSquareHero
          title={t('square.title', { defaultValue: t('title') })}
          subtitle={t('square.subtitle', { defaultValue: t('subtitle') })}
          totalCount={statCounts.total}
          leaderCount={statCounts.leaders}
          workerCount={statCounts.workers}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onRefresh={handleRefresh}
          onCreate={() => setShowCreateSheet(true)}
          refreshLabel={t('refresh')}
          createLabel={t('addAgent')}
          statLabels={{
            all: t('square.stats.all', { defaultValue: 'All Agents' }),
            leaders: t('square.stats.leaders', { defaultValue: 'Leaders' }),
            workers: t('square.stats.workers', { defaultValue: 'Workers' }),
          }}
          filterLabels={filterLabels}
        />

        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          {gatewayStatus.state !== 'running' && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {error}
              </span>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 text-center shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t('square.empty.title', { defaultValue: 'No matching agents' })}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {t('square.empty.description', { defaultValue: 'Adjust the current filters or create a new agent.' })}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredCards.map((card) => {
                const agent = agentsById.get(card.id);
                if (!agent) return null;

                return (
                  <EmployeeSquareCard
                    key={card.id}
                    card={card}
                    actionLabels={actionLabels}
                    onChat={() => {
                      try {
                        openDirectAgentSession(agent.id);
                        navigate('/');
                      } catch (error) {
                        toast.error(String(error));
                      }
                    }}
                    onMemory={() => navigate(card.memoryHref)}
                    onDetails={() => navigate(card.detailsHref)}
                    onOpenSettings={() => setActiveAgentId(agent.id)}
                    onDelete={() => setAgentToDelete(agent)}
                    showDelete={!agent.isDefault}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CreateAgentSheet open={showCreateSheet} onOpenChange={setShowCreateSheet} />

      {activeAgent && (
        <AgentSettingsModal
          agent={activeAgent}
          channels={channels}
          onClose={() => setActiveAgentId(null)}
        />
      )}

      <ConfirmDialog
        open={!!agentToDelete}
        title={t('deleteDialog.title')}
        message={agentToDelete ? t('deleteDialog.message', { name: agentToDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!agentToDelete) return;
          try {
            await deleteAgent(agentToDelete.id);
            const deletedId = agentToDelete.id;
            setAgentToDelete(null);
            if (activeAgentId === deletedId) {
              setActiveAgentId(null);
            }
            toast.success(t('toast.agentDeleted'));
          } catch (deleteError) {
            toast.error(t('toast.agentDeleteFailed', { error: String(deleteError) }));
          }
        }}
        onCancel={() => setAgentToDelete(null)}
      />
    </div>
  );
}

export default Agents;
