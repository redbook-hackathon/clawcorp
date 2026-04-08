import type { AgentSummary } from '@/types/agent';
import type { KanbanTask } from '@/types/task';
import { buildAgentTaskSummaryMap } from '@/lib/task-summary-read-model';

export type TeamWorkStatusKey = 'blocked' | 'waiting_approval' | 'working' | 'active' | 'idle';

export type TeamMemberWorkVisibility = {
  statusKey: TeamWorkStatusKey;
  activeTaskCount: number;
  currentWorkTitles: string[];
};

export function deriveTeamWorkVisibility(
  agents: AgentSummary[],
  sessionLastActivity: Record<string, number>,
  runtimeByAgent?: Record<string, Array<{ status: string; prompt: string }>>,
  tasks: KanbanTask[] = [],
): Record<string, TeamMemberWorkVisibility> {
  const taskSummaries = buildAgentTaskSummaryMap(tasks);
  const now = Date.now();
  const recentMs = 5 * 60 * 1000;

  return Object.fromEntries(agents.map((agent) => {
    const runtimeSessions = runtimeByAgent?.[agent.id] ?? [];
    const activeRuntime = runtimeSessions.filter(
      (session) => (
        session.status === 'running'
        || session.status === 'blocked'
        || session.status === 'waiting_approval'
        || session.status === 'error'
      ),
    );

    if (activeRuntime.length > 0) {
      const runtimeStatusKey: TeamWorkStatusKey =
        activeRuntime.some((session) => session.status === 'blocked' || session.status === 'error')
          ? 'blocked'
          : activeRuntime.some((session) => session.status === 'waiting_approval')
            ? 'waiting_approval'
            : 'working';

      const runtimeWorkTitles = activeRuntime
        .filter((session) => session.prompt?.trim())
        .map((session) => session.prompt.trim().slice(0, 80));
      const taskTitles = taskSummaries[agent.id]?.currentWorkTitles ?? [];

      return [agent.id, {
        statusKey: runtimeStatusKey,
        activeTaskCount: runtimeWorkTitles.length + taskTitles.length,
        currentWorkTitles: [...new Set([...runtimeWorkTitles, ...taskTitles])],
      }];
    }

    const taskSummary = taskSummaries[agent.id];
    const statusKey: TeamWorkStatusKey = taskSummary?.statusKey === 'blocked'
      ? 'blocked'
      : taskSummary?.statusKey === 'waiting_approval'
        ? 'waiting_approval'
        : taskSummary?.statusKey === 'working'
          ? 'working'
          : ((sessionLastActivity[agent.mainSessionKey] ?? 0) > now - recentMs ? 'active' : 'idle');

    return [agent.id, {
      statusKey,
      activeTaskCount: taskSummary?.activeTaskCount ?? 0,
      currentWorkTitles: taskSummary?.currentWorkTitles ?? [],
    }];
  }));
}
