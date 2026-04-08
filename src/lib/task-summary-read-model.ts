import type { KanbanTask } from '@/types/task';

export type TaskSummaryStatusKey = 'blocked' | 'waiting_approval' | 'working' | 'active' | 'idle';

export interface AgentTaskSummary {
  statusKey: TaskSummaryStatusKey;
  activeTaskCount: number;
  currentWorkTitles: string[];
  currentWorkSummary?: string;
  blockingReason?: string | null;
  latestInternalExcerpt?: string | null;
  owningTeamLabel?: string;
  borrowedTeamLabels: string[];
  lastActiveTime?: number;
}

export interface TeamTaskRollup {
  activeTaskCount: number;
  lastActiveTime?: number;
  status: 'active' | 'idle' | 'blocked';
  currentWorkTitles: string[];
  borrowedExecutionCount: number;
}

const STATUS_PRIORITY: Record<TaskSummaryStatusKey, number> = {
  blocked: 4,
  waiting_approval: 3,
  working: 2,
  active: 1,
  idle: 0,
};

function toTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isActiveTask(task: KanbanTask): boolean {
  return task.status !== 'done' && task.workState !== 'done';
}

function getTaskStatusKey(task: KanbanTask): TaskSummaryStatusKey {
  if (task.blocker?.state === 'blocked' || task.workState === 'blocked') {
    return 'blocked';
  }
  if (
    task.blocker?.state === 'waiting_approval'
    || task.approvalState?.state === 'waiting_leader'
    || task.approvalState?.state === 'waiting_user'
    || task.workState === 'waiting_approval'
  ) {
    return 'waiting_approval';
  }
  if (isActiveTask(task)) {
    return 'working';
  }
  return 'idle';
}

function pickHigherPriorityStatus(
  current: TaskSummaryStatusKey,
  incoming: TaskSummaryStatusKey,
): TaskSummaryStatusKey {
  return STATUS_PRIORITY[incoming] > STATUS_PRIORITY[current] ? incoming : current;
}

function updateLastActiveTime(current: number | undefined, task: KanbanTask): number | undefined {
  const candidate = toTimestamp(
    task.canonicalExecution?.updatedAt
    ?? task.updatedAt
    ?? task.canonicalExecution?.startedAt
    ?? task.createdAt,
  );
  if (!candidate) return current;
  if (!current) return candidate;
  return Math.max(current, candidate);
}

export function buildAgentTaskSummaryMap(tasks: KanbanTask[]): Record<string, AgentTaskSummary> {
  const summaries: Record<string, AgentTaskSummary> = {};

  const ensureSummary = (agentId: string): AgentTaskSummary => {
    if (!summaries[agentId]) {
      summaries[agentId] = {
        statusKey: 'idle',
        activeTaskCount: 0,
        currentWorkTitles: [],
        borrowedTeamLabels: [],
      };
    }
    return summaries[agentId];
  };

  for (const task of tasks) {
    if (!isActiveTask(task)) {
      continue;
    }

    const taskStatus = getTaskStatusKey(task);
    const blockingReason = task.blocker?.summary ?? null;
    const latestInternalExcerpt = task.latestInternalExcerpt?.content ?? null;
    const lastActiveTime = updateLastActiveTime(undefined, task);

    if (task.assigneeId) {
      const summary = ensureSummary(task.assigneeId);
      summary.statusKey = pickHigherPriorityStatus(summary.statusKey, taskStatus);
      summary.activeTaskCount += 1;
      if (!summary.currentWorkTitles.includes(task.title)) {
        summary.currentWorkTitles.push(task.title);
      }
      summary.currentWorkSummary ??= task.title;
      summary.blockingReason ??= blockingReason;
      summary.latestInternalExcerpt ??= latestInternalExcerpt;
      summary.owningTeamLabel ??= task.teamName;
      summary.lastActiveTime = lastActiveTime && summary.lastActiveTime
        ? Math.max(summary.lastActiveTime, lastActiveTime)
        : (lastActiveTime ?? summary.lastActiveTime);
    }

    for (const borrowedExecution of task.borrowedExecutions ?? []) {
      for (const agentId of borrowedExecution.agentIds) {
        const summary = ensureSummary(agentId);
        summary.statusKey = pickHigherPriorityStatus(summary.statusKey, taskStatus);
        summary.activeTaskCount += 1;
        const supportTitle = `${task.title} (support)`;
        if (!summary.currentWorkTitles.includes(supportTitle)) {
          summary.currentWorkTitles.push(supportTitle);
        }
        summary.currentWorkSummary ??= supportTitle;
        if (!summary.borrowedTeamLabels.includes(task.teamName ?? borrowedExecution.teamId)) {
          summary.borrowedTeamLabels.push(task.teamName ?? borrowedExecution.teamId);
        }
        summary.blockingReason ??= blockingReason;
        summary.latestInternalExcerpt ??= latestInternalExcerpt;
        summary.lastActiveTime = lastActiveTime && summary.lastActiveTime
          ? Math.max(summary.lastActiveTime, lastActiveTime)
          : (lastActiveTime ?? summary.lastActiveTime);
      }
    }
  }

  return summaries;
}

export function buildTeamTaskRollupMap(tasks: KanbanTask[]): Record<string, TeamTaskRollup> {
  const rollups: Record<string, TeamTaskRollup> = {};

  for (const task of tasks) {
    if (!task.teamId || !isActiveTask(task)) {
      continue;
    }

    const existing = rollups[task.teamId] ?? {
      activeTaskCount: 0,
      status: 'idle' as const,
      currentWorkTitles: [],
      borrowedExecutionCount: 0,
    };

    existing.activeTaskCount += 1;
    if (!existing.currentWorkTitles.includes(task.title)) {
      existing.currentWorkTitles.push(task.title);
    }
    existing.borrowedExecutionCount += task.borrowedExecutions?.length ?? 0;

    const taskStatus = getTaskStatusKey(task);
    if (taskStatus === 'blocked' || taskStatus === 'waiting_approval') {
      existing.status = 'blocked';
    } else if (existing.status !== 'blocked') {
      existing.status = 'active';
    }

    const candidate = updateLastActiveTime(existing.lastActiveTime, task);
    existing.lastActiveTime = candidate ?? existing.lastActiveTime;

    rollups[task.teamId] = existing;
  }

  return rollups;
}
