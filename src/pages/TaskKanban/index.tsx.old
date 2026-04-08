/**
 * Task Kanban Page / Frame 05
 * 任务看板 / 自动化工作流：拖拽式任务管理
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { useAgentsStore } from '@/stores/agents';
import { useApprovalsStore, type ApprovalItem } from '@/stores/approvals';
import type { AgentSummary } from '@/types/agent';
import type { CronSchedule } from '@/types/cron';
import type { RawMessage } from '@/stores/chat';
import { ChatMessage } from '@/pages/Chat/ChatMessage';
import { useTranslation } from 'react-i18next';
import { useNotificationsStore } from '@/stores/notifications';
import { AskUserQuestionWizard } from './AskUserQuestionWizard';

/* ─── Types ─── */

type TicketStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
type TicketPriority = 'low' | 'medium' | 'high';
type WorkState = 'idle' | 'starting' | 'working' | 'blocked' | 'waiting_approval' | 'scheduled' | 'done' | 'failed';

interface KanbanTicket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: string;
  assigneeRole?: string;
  workState: WorkState;
  workStartedAt?: string;
  workError?: string;
  workResult?: string;
  runtimeSessionId?: string;
  runtimeParentSessionId?: string;
  runtimeRootSessionId?: string;
  runtimeDepth?: number;
  runtimeSessionKey?: string;
  runtimeParentSessionKey?: string;
  runtimeLineageSessionKeys?: string[];
  runtimeHistory?: RawMessage[];
  runtimeTranscript?: string[];
  runtimeChildSessionIds?: string[];
  cronJobId?: string;
  cronScheduleKind?: string;
  cronBaselineJobIds?: string[];
  cronNextRunAt?: string;
  cronLastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RuntimeSessionResponse {
  id: string;
  sessionKey?: string;
  parentSessionKey?: string;
  parentRuntimeId?: string;
  rootRuntimeId?: string;
  depth?: number;
  childRuntimeIds?: string[];
  executionRecords?: Array<{
    id: string;
    toolCallId?: string;
    toolName: string;
    status: 'running' | 'completed' | 'error';
    summary?: string;
    durationMs?: number;
    input?: unknown;
    output?: unknown;
    details?: unknown;
    linkedRuntimeId?: string;
    linkedRuntimeSessionKey?: string;
  }>;
  toolSnapshot?: Array<{ server: string; name: string }>;
  skillSnapshot?: string[];
  status?: string;
  history?: RawMessage[];
  transcript?: string[];
  lastError?: string;
  error?: string;
  result?: string;
  output?: string;
  agentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CronJobSnapshot {
  id: string;
  name?: string;
  message?: string;
  schedule?: string | CronSchedule;
  sessionTarget?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  nextRun?: string;
  lastRun?: {
    time?: string;
    success?: boolean;
    error?: string;
    duration?: number;
  };
}

interface CronRunEntry {
  status?: string;
  summary?: string;
  error?: string;
  ts?: number;
}

/* ─── Persistence ─── */

const STORAGE_KEY = 'clawport-kanban';

function loadTickets(): KanbanTicket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KanbanTicket[]) : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets: KanbanTicket[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function createTicket(input: { title: string; description: string; priority: TicketPriority; assigneeId?: string; assigneeRole?: string }): KanbanTicket {
  const now = new Date().toISOString();
  return {
    id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    description: input.description,
    status: 'backlog',
    priority: input.priority,
    assigneeId: input.assigneeId,
    assigneeRole: input.assigneeRole,
    workState: 'idle',
    createdAt: now,
    updatedAt: now,
  };
}

/* ─── Constants ─── */

const COLUMN_KEYS: TicketStatus[] = ['backlog', 'todo', 'in-progress', 'review', 'done'];

function getColumns(t: (key: string, options?: Record<string, unknown>) => string): { key: TicketStatus; label: string }[] {
  return COLUMN_KEYS.map((key) => ({ key, label: t(`kanban.columns.${key}`) }));
}

function getPriorityStyles(t: (key: string, options?: Record<string, unknown>) => string): Record<TicketPriority, { dot: string; text: string; bg: string; label: string }> {
  return {
    high: { dot: '#ef4444', text: '#ef4444', bg: '#fef2f2', label: t('kanban.priorities.high') },
    medium: { dot: '#f59e0b', text: '#d97706', bg: '#fffbeb', label: t('kanban.priorities.medium') },
    low: { dot: '#10b981', text: '#059669', bg: '#f0fdf4', label: t('kanban.priorities.low') },
  };
}

function getWorkStateStyles(t: (key: string, options?: Record<string, unknown>) => string): Record<WorkState, { label: string; color: string }> {
  return {
    idle: { label: '', color: '' },
    starting: { label: t('kanban.workState.starting'), color: '#f59e0b' },
    working: { label: t('kanban.workState.working'), color: '#3b82f6' },
    blocked: { label: t('kanban.workState.blocked'), color: '#f97316' },
    waiting_approval: { label: t('kanban.workState.waitingApproval'), color: '#7c3aed' },
    scheduled: { label: t('kanban.workState.scheduled', { defaultValue: 'Scheduled' }), color: '#0ea5e9' },
    done: { label: t('kanban.workState.done'), color: '#10b981' },
    failed: { label: t('kanban.workState.failed'), color: '#ef4444' },
  };
}

const ACTIVE_RUNTIME_WORK_STATES = new Set<WorkState>(['starting', 'working', 'blocked', 'waiting_approval']);
const RUNTIME_WAIT_POLL_MS = 3000;

function normalizeIsoTimestampMs(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCronRunTimestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readCronScheduleKind(schedule: string | CronSchedule | undefined): string | undefined {
  if (!schedule) return undefined;
  if (typeof schedule === 'string') return 'cron';
  return typeof schedule.kind === 'string' ? schedule.kind : undefined;
}

function isOneShotCronSchedule(kind: string | undefined): boolean {
  return kind === 'at';
}

function normalizeCronRunStatus(status: string | undefined): 'ok' | 'error' | 'running' | 'unknown' {
  const normalized = (status ?? '').trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized === 'ok' || normalized === 'completed' || normalized === 'success' || normalized === 'done') return 'ok';
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') return 'error';
  if (normalized === 'running' || normalized === 'pending') return 'running';
  return 'unknown';
}

function readCronSetupCandidate(ticket: KanbanTicket, jobs: CronJobSnapshot[]): CronJobSnapshot | undefined {
  const baselineIds = new Set(ticket.cronBaselineJobIds ?? []);
  const startedAtMs = normalizeIsoTimestampMs(ticket.workStartedAt);
  const normalizedTitle = ticket.title.trim().toLowerCase();
  const normalizedDescription = ticket.description.trim().toLowerCase();

  const candidates = jobs
    .filter((job) => !baselineIds.has(job.id))
    .map((job) => {
      let score = 0;
      const createdAtMs = normalizeIsoTimestampMs(job.createdAt);
      const haystack = `${job.name ?? ''}\n${job.message ?? ''}`.toLowerCase();
      if (startedAtMs > 0 && createdAtMs >= startedAtMs - 60_000) score += 3;
      if (normalizedTitle && haystack.includes(normalizedTitle)) score += 2;
      if (normalizedDescription && haystack.includes(normalizedDescription)) score += 1;
      return { job, score, createdAtMs };
    })
    .filter((entry) => entry.score > 0 || jobs.length === 1)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.createdAtMs - left.createdAtMs;
    });

  return candidates[0]?.job;
}

function readRuntimeError(session: RuntimeSessionResponse): string | undefined {
  if (typeof session.lastError === 'string' && session.lastError.trim()) return session.lastError.trim();
  if (typeof session.error === 'string' && session.error.trim()) return session.error.trim();
  return undefined;
}

function readRuntimeResult(session: RuntimeSessionResponse): string | undefined {
  if (typeof session.result === 'string' && session.result.trim()) return session.result.trim();
  if (typeof session.output === 'string' && session.output.trim()) return session.output.trim();
  if (Array.isArray(session.transcript) && session.transcript.length > 0) {
    const last = session.transcript.at(-1);
    if (typeof last === 'string' && last.trim()) return last.trim();
  }
  return undefined;
}

function mergeRuntimeSessionKeys(...values: Array<string | string[] | undefined>): string[] | undefined {
  const keys = values.flatMap((value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }).filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (keys.length === 0) return undefined;
  return [...new Set(keys)];
}

function mapRuntimeSessionToTicketUpdates(ticket: KanbanTicket, session: RuntimeSessionResponse): Partial<KanbanTicket> {
  const status = (session.status ?? '').toLowerCase();
  const runtimeError = readRuntimeError(session);
  const runtimeResult = readRuntimeResult(session);
  const runtimeLineageSessionKeys = mergeRuntimeSessionKeys(
    ticket.runtimeLineageSessionKeys,
    ticket.runtimeParentSessionKey,
    ticket.runtimeSessionKey,
    session.parentSessionKey,
    session.sessionKey,
  );
  const base: Partial<KanbanTicket> = {
    runtimeSessionId: session.id || ticket.runtimeSessionId,
    runtimeParentSessionId: session.parentRuntimeId || ticket.runtimeParentSessionId,
    runtimeRootSessionId: session.rootRuntimeId || ticket.runtimeRootSessionId,
    runtimeDepth: typeof session.depth === 'number' ? session.depth : ticket.runtimeDepth,
    runtimeSessionKey: session.sessionKey || ticket.runtimeSessionKey,
    runtimeParentSessionKey: session.parentSessionKey || ticket.runtimeParentSessionKey,
    runtimeLineageSessionKeys,
    runtimeHistory: Array.isArray(session.history) ? session.history : ticket.runtimeHistory,
    runtimeTranscript: Array.isArray(session.transcript) ? session.transcript : ticket.runtimeTranscript,
    runtimeChildSessionIds: Array.isArray(session.childRuntimeIds) ? session.childRuntimeIds : ticket.runtimeChildSessionIds,
  };

  if (status === 'running') {
    return {
      ...base,
      status: 'in-progress',
      workState: 'working',
      workError: undefined,
    };
  }
  if (status === 'blocked') {
    return {
      ...base,
      status: 'in-progress',
      workState: 'blocked',
      workError: runtimeError ?? ticket.workError ?? 'Runtime blocked',
      workResult: undefined,
    };
  }
  if (status === 'waiting_approval') {
    return {
      ...base,
      status: 'review',
      workState: 'waiting_approval',
      workError: runtimeError ?? ticket.workError ?? 'Waiting for approval',
      workResult: undefined,
    };
  }
  if (status === 'completed') {
    return {
      ...base,
      status: 'review',
      workState: 'done',
      workError: undefined,
      workResult: runtimeResult ?? ticket.workResult,
    };
  }
  if (status === 'error') {
    return {
      ...base,
      workState: 'failed',
      workError: runtimeError ?? ticket.workError ?? 'Runtime error',
    };
  }
  if (status === 'killed') {
    return {
      ...base,
      workState: 'failed',
      workError: runtimeError ?? ticket.workError ?? 'Runtime killed',
    };
  }
  if (status === 'stopped') {
    return {
      ...base,
      workState: 'failed',
      workError: runtimeError ?? ticket.workError ?? 'Runtime stopped',
    };
  }

  return base;
}

function isSameTranscript(a?: string[], b?: string[]): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isSameHistory(a?: RawMessage[], b?: RawMessage[]): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasRuntimeTicketChanges(ticket: KanbanTicket, updates: Partial<KanbanTicket>): boolean {
  if ('status' in updates && updates.status !== ticket.status) return true;
  if ('workState' in updates && updates.workState !== ticket.workState) return true;
  if ('workError' in updates && updates.workError !== ticket.workError) return true;
  if ('workResult' in updates && updates.workResult !== ticket.workResult) return true;
  if ('runtimeSessionId' in updates && updates.runtimeSessionId !== ticket.runtimeSessionId) return true;
  if ('runtimeParentSessionId' in updates && updates.runtimeParentSessionId !== ticket.runtimeParentSessionId) return true;
  if ('runtimeRootSessionId' in updates && updates.runtimeRootSessionId !== ticket.runtimeRootSessionId) return true;
  if ('runtimeDepth' in updates && updates.runtimeDepth !== ticket.runtimeDepth) return true;
  if ('runtimeSessionKey' in updates && updates.runtimeSessionKey !== ticket.runtimeSessionKey) return true;
  if ('runtimeParentSessionKey' in updates && updates.runtimeParentSessionKey !== ticket.runtimeParentSessionKey) return true;
  if ('runtimeLineageSessionKeys' in updates && !isSameTranscript(ticket.runtimeLineageSessionKeys, updates.runtimeLineageSessionKeys)) return true;
  if ('runtimeHistory' in updates && !isSameHistory(ticket.runtimeHistory, updates.runtimeHistory)) return true;
  if ('runtimeTranscript' in updates && !isSameTranscript(ticket.runtimeTranscript, updates.runtimeTranscript)) return true;
  if ('runtimeChildSessionIds' in updates && !isSameTranscript(ticket.runtimeChildSessionIds, updates.runtimeChildSessionIds)) return true;
  if ('cronJobId' in updates && updates.cronJobId !== ticket.cronJobId) return true;
  if ('cronScheduleKind' in updates && updates.cronScheduleKind !== ticket.cronScheduleKind) return true;
  if ('cronBaselineJobIds' in updates && !isSameTranscript(ticket.cronBaselineJobIds, updates.cronBaselineJobIds)) return true;
  if ('cronNextRunAt' in updates && updates.cronNextRunAt !== ticket.cronNextRunAt) return true;
  if ('cronLastRunAt' in updates && updates.cronLastRunAt !== ticket.cronLastRunAt) return true;
  return false;
}

function buildScheduledTicketUpdates(
  ticket: KanbanTicket,
  session: RuntimeSessionResponse,
  jobs: CronJobSnapshot[],
): Partial<KanbanTicket> | null {
  const cronJob = readCronSetupCandidate(ticket, jobs);
  if (!cronJob) return null;

  const base = mapRuntimeSessionToTicketUpdates(ticket, session);
  return {
    ...base,
    status: 'in-progress',
    workState: 'scheduled',
    workError: undefined,
    workResult: readRuntimeResult(session) ?? ticket.workResult,
    cronJobId: cronJob.id,
    cronScheduleKind: readCronScheduleKind(cronJob.schedule),
    cronNextRunAt: cronJob.nextRun,
    cronLastRunAt: cronJob.lastRun?.time,
  };
}

function buildCronExecutionUpdates(
  ticket: KanbanTicket,
  cronJob: CronJobSnapshot | undefined,
  runs: CronRunEntry[],
): Partial<KanbanTicket> | null {
  if (!ticket.cronJobId || !cronJob) return null;

  const latestRun = runs
    .filter((run) => normalizeCronRunTimestampMs(run.ts) > 0)
    .sort((left, right) => normalizeCronRunTimestampMs(right.ts) - normalizeCronRunTimestampMs(left.ts))[0];

  const base: Partial<KanbanTicket> = {
    cronNextRunAt: cronJob.nextRun,
    cronLastRunAt: cronJob.lastRun?.time,
  };

  if (!latestRun) {
    return Object.keys(base).length > 0 ? base : null;
  }

  const normalizedStatus = normalizeCronRunStatus(latestRun.status);
  if (normalizedStatus === 'error') {
    return {
      ...base,
      status: 'review',
      workState: 'failed',
      workError: latestRun.error ?? cronJob.lastRun?.error ?? ticket.workError ?? 'Scheduled task failed.',
      workResult: undefined,
    };
  }

  if (normalizedStatus !== 'ok') {
    return Object.keys(base).length > 0 ? base : null;
  }

  const resultText = latestRun.summary?.trim() || ticket.workResult;
  const scheduleKind = ticket.cronScheduleKind ?? readCronScheduleKind(cronJob.schedule);
  if (isOneShotCronSchedule(scheduleKind)) {
    return {
      ...base,
      status: 'done',
      workState: 'done',
      workError: undefined,
      workResult: resultText,
    };
  }

  return {
    ...base,
    status: 'in-progress',
    workState: 'scheduled',
    workError: undefined,
    workResult: resultText,
  };
}

function formatExecutionDuration(durationMs?: number): string | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${Math.floor(durationMs / 60_000)}m ${Math.floor((durationMs % 60_000) / 1000)}s`;
}

function buildRuntimeHistoryFromTranscript(transcript?: string[]): RawMessage[] {
  return (transcript ?? [])
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => ({
      role: 'assistant',
      content: entry,
    }));
}

function normalizeRuntimeStatusToWorkState(status: string | undefined): WorkState {
  const normalized = (status ?? '').trim().toLowerCase();
  if (normalized === 'waiting_approval') return 'waiting_approval';
  if (normalized === 'blocked') return 'blocked';
  if (normalized === 'running' || normalized === 'working' || normalized === 'starting') return 'working';
  if (normalized === 'scheduled') return 'scheduled';
  if (normalized === 'completed' || normalized === 'done') return 'done';
  if (normalized === 'error' || normalized === 'failed' || normalized === 'killed' || normalized === 'stopped') return 'failed';
  return 'idle';
}

function getTicketRuntimeSessionKeys(ticket: KanbanTicket): Set<string> {
  return new Set(
    mergeRuntimeSessionKeys(
      ticket.runtimeLineageSessionKeys,
      ticket.runtimeParentSessionKey,
      ticket.runtimeSessionKey,
    ) ?? [],
  );
}

function getApprovalsForTicket(ticket: KanbanTicket, approvals: ApprovalItem[]): ApprovalItem[] {
  const runtimeSessionKeys = getTicketRuntimeSessionKeys(ticket);
  return approvals.filter((approval) => {
    if (approval.sessionKey) {
      return runtimeSessionKeys.size > 0 && runtimeSessionKeys.has(approval.sessionKey);
    }
    if (ticket.assigneeId && approval.agentId) {
      return approval.agentId === ticket.assigneeId;
    }
    return false;
  });
}

/* ─── Agent color helper ─── */

const AGENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444', '#06b6d4'];
function agentColor(idx: number) { return AGENT_COLORS[idx % AGENT_COLORS.length]; }

/* ─── Main component ─── */

export function TaskKanban() {
  const { t } = useTranslation('common');
  const columns = getColumns(t);
  const [tickets, setTickets] = useState<KanbanTicket[]>(() => loadTickets());
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<KanbanTicket | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TicketStatus | null>(null);

  const { agents, fetchAgents } = useAgentsStore();
  const { approvals, fetchApprovals, approveItem, rejectItem } = useApprovalsStore();

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);
  useEffect(() => { void fetchApprovals(); }, [fetchApprovals]);

  // Persist on every change
  useEffect(() => { saveTickets(tickets); }, [tickets]);

  const updateTicket = useCallback((id: string, updates: Partial<KanbanTicket>) => {
    const updatedAt = new Date().toISOString();
    setTickets((prev) =>
      prev.map((ticket) => (ticket.id === id ? { ...ticket, ...updates, updatedAt } : ticket))
    );
    setDetailTicket((prev) => (
      prev?.id === id ? { ...prev, ...updates, updatedAt } : prev
    ));
  }, [setDetailTicket]);

  const deleteTicket = (id: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
    if (detailTicket?.id === id) setDetailTicket(null);
  };

  const moveTicket = (id: string, status: TicketStatus) => {
    updateTicket(id, { status });
  };

  const handleCreate = (input: { title: string; description: string; priority: TicketPriority; assigneeId?: string; assigneeRole?: string }) => {
    const ticket = createTicket(input);
    setTickets((prev) => [ticket, ...prev]);
    setCreateOpen(false);
  };

  useEffect(() => {
    const activeTickets = tickets.filter((ticket) => {
      if (!ticket.runtimeSessionId) return false;
      return ACTIVE_RUNTIME_WORK_STATES.has(ticket.workState);
    });
    if (activeTickets.length === 0) return undefined;

    let disposed = false;
    const pollRuntime = async () => {
      for (const ticket of activeTickets) {
        if (!ticket.runtimeSessionId) continue;
        try {
          const response = await hostApiFetch<{
            success: boolean;
            session: RuntimeSessionResponse;
          }>(`/api/sessions/subagents/${encodeURIComponent(ticket.runtimeSessionId)}/wait`, {
            method: 'POST',
          });
          if (disposed || !response?.session?.id) continue;
          let runtimeUpdates = mapRuntimeSessionToTicketUpdates(ticket, response.session);
          if ((response.session.status ?? '').trim().toLowerCase() === 'completed') {
            try {
              const jobsResponse = await hostApiFetch<CronJobSnapshot[] | { jobs?: CronJobSnapshot[] }>('/api/cron/jobs');
              const jobs = Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.jobs ?? []);
              const scheduledUpdates = buildScheduledTicketUpdates(ticket, response.session, jobs);
              if (scheduledUpdates) {
                runtimeUpdates = scheduledUpdates;
              }
            } catch {
              // Fall back to runtime-only state updates when cron inspection fails.
            }
          }
          if (hasRuntimeTicketChanges(ticket, runtimeUpdates)) {
            updateTicket(ticket.id, runtimeUpdates);
            if (runtimeUpdates.workState === 'scheduled' && ticket.workState !== 'scheduled') {
              useNotificationsStore.getState().addNotification({
                level: 'info',
                title: t('kanban.notifications.taskScheduled', { title: ticket.title }),
                source: 'kanban',
              });
            }
            if (runtimeUpdates.workState === 'done' && ticket.workState !== 'done') {
              useNotificationsStore.getState().addNotification({
                level: 'info',
                title: t('kanban.notifications.taskCompleted', { title: ticket.title }),
                source: 'kanban',
              });
            }
          }
        } catch (error) {
          if (disposed) continue;
          const runtimeUpdates: Partial<KanbanTicket> = {
            workState: 'failed',
            workError: String(error),
          };
          if (hasRuntimeTicketChanges(ticket, runtimeUpdates)) {
            updateTicket(ticket.id, runtimeUpdates);
          }
        }
      }
    };

    const timer = window.setInterval(() => {
      void pollRuntime();
    }, RUNTIME_WAIT_POLL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [tickets, updateTicket, t]);

  useEffect(() => {
    const scheduledTickets = tickets.filter((ticket) => ticket.workState === 'scheduled' && ticket.cronJobId);
    if (scheduledTickets.length === 0) return undefined;

    let disposed = false;
    const pollCronRuns = async () => {
      const jobs = await hostApiFetch<CronJobSnapshot[] | { jobs?: CronJobSnapshot[] }>('/api/cron/jobs')
        .then((jobsResponse) => (Array.isArray(jobsResponse) ? jobsResponse : (jobsResponse?.jobs ?? [])))
        .catch(() => [] as CronJobSnapshot[]);

      for (const ticket of scheduledTickets) {
        if (disposed || !ticket.cronJobId) continue;
        try {
          const response = await hostApiFetch<{ runs?: CronRunEntry[] }>(
            `/api/cron/runs/${encodeURIComponent(ticket.cronJobId)}`,
          );
          if (disposed) continue;
          const updates = buildCronExecutionUpdates(
            ticket,
            jobs.find((job) => job.id === ticket.cronJobId),
            Array.isArray(response?.runs) ? response.runs : [],
          );
          if (updates && hasRuntimeTicketChanges(ticket, updates)) {
            updateTicket(ticket.id, updates);
            if (updates.workState === 'done' && ticket.workState !== 'done') {
              useNotificationsStore.getState().addNotification({
                level: 'info',
                title: t('kanban.notifications.taskCompleted', { title: ticket.title }),
                source: 'kanban',
              });
            }
          }
        } catch {
          // Retry on the next poll cycle.
        }
      }
    };

    const timer = window.setInterval(() => {
      void pollCronRuns();
    }, RUNTIME_WAIT_POLL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [tickets, updateTicket, t]);

  useEffect(() => {
    const shouldPollApprovals = tickets.some((ticket) =>
      ticket.runtimeSessionId && ACTIVE_RUNTIME_WORK_STATES.has(ticket.workState),
    );
    if (!shouldPollApprovals) return undefined;

    const timer = window.setInterval(() => {
      void fetchApprovals();
    }, RUNTIME_WAIT_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [tickets, fetchApprovals]);

  const startRuntimeWork = async (
    ticket: KanbanTicket,
    retryOrigin?: { runtimeSessionId?: string; runtimeSessionKey?: string },
  ) => {
    updateTicket(ticket.id, {
      status: 'in-progress',
      workState: 'starting',
      workError: undefined,
      workResult: undefined,
      workStartedAt: new Date().toISOString(),
      cronJobId: undefined,
      cronScheduleKind: undefined,
      cronNextRunAt: undefined,
      cronLastRunAt: undefined,
      cronBaselineJobIds: undefined,
    });

    try {
      // Send the task prompt directly to the agent's main session
      // (no sub-session spawn — execution and reminders stay in the main chat)
      const assigneeSessionKey = agents.find((entry) => entry.id === ticket.assigneeId)?.mainSessionKey
        ?? `agent:${ticket.assigneeId ?? 'main'}:main`;
      const response = await hostApiFetch<{
        success: boolean;
        session: RuntimeSessionResponse;
      }>('/api/sessions/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentSessionKey: retryOrigin?.runtimeSessionKey ?? ticket.runtimeSessionKey ?? assigneeSessionKey,
          ...((retryOrigin?.runtimeSessionId ?? ticket.runtimeSessionId) ? { parentRuntimeId: retryOrigin?.runtimeSessionId ?? ticket.runtimeSessionId } : {}),
          agentName: ticket.assigneeRole ?? ticket.assigneeId,
          prompt: [ticket.title, ticket.description].filter(Boolean).join('\n\n'),
          mode: 'session',
        }),
      });

      updateTicket(ticket.id, mapRuntimeSessionToTicketUpdates(ticket, response.session));
      return;
      /*
      const prompt = [ticket.title, ticket.description].filter(Boolean).join('\n\n');
      const result = await invokeIpc<{ success: boolean; result?: { runId?: string }; error?: string }>(
        'gateway:rpc',
        'chat.send',
        {
          sessionKey: assigneeSessionKey,
          message: prompt,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        },
        120_000,
      );

      if (!result.success) {
        throw new Error(result.error ?? 'Failed to send task to agent');
      }

      updateTicket(ticket.id, {
        status: 'done',
        workState: 'done',
        workError: undefined,
        runtimeSessionKey: assigneeSessionKey,
      });
      useNotificationsStore.getState().addNotification({
        level: 'info',
        title: t('kanban.notifications.taskDispatched', { title: ticket.title }),
        source: 'kanban',
      });
      */
    } catch (error) {
      updateTicket(ticket.id, {
        workState: 'failed',
        workError: String(error),
      });
    }
  };

  const steerRuntimeWork = async (ticket: KanbanTicket, input: string) => {
    if (!ticket.runtimeSessionId || !input.trim()) return;
    try {
      const response = await hostApiFetch<{
        success: boolean;
        session: RuntimeSessionResponse;
      }>(`/api/sessions/subagents/${encodeURIComponent(ticket.runtimeSessionId)}/steer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });

      const runtimeUpdates = mapRuntimeSessionToTicketUpdates(ticket, response.session);
      updateTicket(ticket.id, runtimeUpdates);
    } catch (error) {
      updateTicket(ticket.id, {
        workError: String(error),
      });
    }
  };

  const stopRuntimeWork = async (ticket: KanbanTicket) => {
    if (!ticket.runtimeSessionId) return;
    try {
      const response = await hostApiFetch<{
        success: boolean;
        session: RuntimeSessionResponse;
      }>(`/api/sessions/subagents/${encodeURIComponent(ticket.runtimeSessionId)}/kill`, {
        method: 'POST',
      });

      const runtimeUpdates = mapRuntimeSessionToTicketUpdates(ticket, response.session);
      updateTicket(ticket.id, {
        ...runtimeUpdates,
        workState: runtimeUpdates.workState ?? 'failed',
        workError: runtimeUpdates.workError ?? 'Manually stopped',
      });
    } catch (error) {
      updateTicket(ticket.id, {
        workError: String(error),
      });
    }
  };

  /* Drag handlers */
  const handleDragStart = (id: string) => setDragId(id);
  const handleDragEnd = () => { setDragId(null); setDragOverCol(null); };
  const handleDrop = (col: TicketStatus) => {
    if (dragId) moveTicket(dragId, col);
    setDragId(null);
    setDragOverCol(null);
  };

  const filtered = filterAgentId
    ? tickets.filter((t) => t.assigneeId === filterAgentId)
    : tickets;

  const activeCount = tickets.filter((t) => t.status !== 'done').length;

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7] p-6">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between px-8 pb-5 pt-8">
          <div>
            <h1 className="text-[26px] font-semibold text-[#000000]">{t('kanban.title')}</h1>
            <p className="mt-1 text-[13px] text-[#8e8e93]">{t('kanban.subtitle', { count: activeCount })}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#ef4444] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#dc2626]"
          >
            + {t('kanban.newTask')}
          </button>
        </div>

        {/* Pending Approvals */}
        {approvals.length > 0 && (
          <ApprovalsSection
            approvals={approvals}
            onApprove={(id, reason) => void approveItem(id, reason)}
            onReject={(id, reason) => void rejectItem(id, reason)}
          />
        )}

        {/* Agent filter pills */}
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-8 pb-5">
          <button
            type="button"
            onClick={() => setFilterAgentId(null)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              filterAgentId === null
                ? 'bg-[#10b981] text-white'
                : 'border border-black/10 bg-white text-[#3c3c43] hover:bg-[#f2f2f7]',
            )}
          >
            {t('kanban.allTasks')}
          </button>
          {agents.map((agent, idx) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setFilterAgentId(agent.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                filterAgentId === agent.id
                  ? 'bg-[#10b981] text-white'
                  : 'border border-black/10 bg-white text-[#3c3c43] hover:bg-[#f2f2f7]',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: agentColor(idx) }} />
              {agent.name}
            </button>
          ))}
        </div>

        {/* Kanban columns */}
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-8 pb-6">
          {columns.map((col) => {
            const colTickets = filtered.filter((t) => t.status === col.key);
            const isOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                className="flex w-[280px] shrink-0 flex-col"
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.key)}
              >
                <div className="mb-3 flex items-center justify-between" aria-label={`${col.label} column`}>
                  <span className="text-[14px] font-semibold text-[#000000]">{col.label}</span>
                  <span className="text-[13px] text-[#8e8e93]" aria-label={`${colTickets.length} tickets`}>{colTickets.length}</span>
                </div>
                <div
                  role="list"
                  aria-label={`${col.label} tickets`}
                  className={cn(
                    'flex min-h-[120px] flex-1 flex-col gap-3 rounded-xl p-3 transition-colors',
                    isOver ? 'bg-[#f0f7ff] ring-2 ring-clawx-ac/30' : 'bg-[#f9f9f9]',
                  )}
                >
                  {colTickets.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-[13px] text-[#c6c6c8]">
                      {t('kanban.emptyColumn')}
                    </div>
                  ) : (
                    colTickets.map((ticket) => (
                      <div key={ticket.id} role="listitem">
                        <TicketCard
                          ticket={ticket}
                          agents={agents}
                          isDragging={dragId === ticket.id}
                          onClick={() => setDetailTicket(ticket)}
                          onDragStart={() => handleDragStart(ticket.id)}
                          onDragEnd={handleDragEnd}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create modal */}
      {createOpen && (
        <CreateModal
          agents={agents}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Detail panel */}
      {detailTicket && (
        <DetailPanel
          ticket={detailTicket}
          agents={agents}
          approvals={getApprovalsForTicket(detailTicket, approvals)}
          onClose={() => setDetailTicket(null)}
          onUpdate={(updates) => updateTicket(detailTicket.id, updates)}
          onDelete={() => deleteTicket(detailTicket.id)}
          onStartRuntime={(retryOrigin) => void startRuntimeWork(detailTicket, retryOrigin)}
          onSteerRuntime={(input) => void steerRuntimeWork(detailTicket, input)}
          onStopRuntime={() => void stopRuntimeWork(detailTicket)}
          onApproveApproval={(id, reason) => void approveItem(id, reason)}
          onRejectApproval={(id, reason) => void rejectItem(id, reason)}
        />
      )}
    </div>
  );
}

/* ─── Ticket Card ─── */

function TicketCard({
  ticket, agents, isDragging, onClick, onDragStart, onDragEnd,
}: {
  ticket: KanbanTicket;
  agents: AgentSummary[];
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { t } = useTranslation('common');
  const p = getPriorityStyles(t)[ticket.priority];
  const agentIdx = agents.findIndex((a) => a.id === ticket.assigneeId);
  const agent = agentIdx >= 0 ? agents[agentIdx] : null;
  const color = agent ? agentColor(agentIdx) : '#8e8e93';
  const ws = getWorkStateStyles(t)[ticket.workState] ?? getWorkStateStyles(t).failed;
  const isDragLocked = ACTIVE_RUNTIME_WORK_STATES.has(ticket.workState);

  return (
    <div
      data-testid={`ticket-card-${ticket.id}`}
      draggable={!isDragLocked}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl bg-white p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
        isDragging && 'opacity-40 scale-95',
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      {agent && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-[12px] font-medium" style={{ color }}>{agent.name}</span>
        </div>
      )}
      {ticket.assigneeRole && (
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">
          {ticket.assigneeRole}
        </div>
      )}
      <p className="mb-1 text-[14px] font-semibold leading-snug text-[#000000]">{ticket.title}</p>
      {ticket.description && (
        <p className="mb-3 line-clamp-2 text-[12px] leading-snug text-[#8e8e93]">{ticket.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: p.bg, color: p.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.dot }} />
          {p.label}
        </span>
        {ws.label && (
          <span className="text-[11px] font-medium" style={{ color: ws.color }}>{ws.label}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Create Modal ─── */

function CreateModal({
  agents, onClose, onCreate,
}: {
  agents: AgentSummary[];
  onClose: () => void;
  onCreate: (input: { title: string; description: string; priority: TicketPriority; assigneeId?: string; assigneeRole?: string }) => void;
}) {
  const { t } = useTranslation('common');
  const priorityStyles = getPriorityStyles(t);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeRole, setAssigneeRole] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      assigneeId: assigneeId || undefined,
      assigneeRole: assigneeRole.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
      <div className="w-[420px] rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="create-modal-title" className="mb-4 text-[16px] font-semibold text-[#000000]">{t('kanban.createModal.title')}</h2>
        <div className="mb-3">
          <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('kanban.createModal.taskTitle')}</p>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const nativeEvent = e.nativeEvent as KeyboardEvent;
              const syntheticIsComposing = (e as unknown as { isComposing?: boolean }).isComposing === true;
              if (
                isComposingRef.current
                || syntheticIsComposing
                || nativeEvent.isComposing
                || nativeEvent.keyCode === 229
              ) {
                return;
              }
              e.preventDefault();
              handleSubmit();
            }}
            placeholder={t('kanban.createModal.taskTitlePlaceholder')}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
          />
        </div>
        <div className="mb-3">
          <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('kanban.createModal.taskDescription')}</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('kanban.createModal.taskDescriptionPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
          />
        </div>
        <div className="mb-3">
          <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('kanban.createModal.priority')}</p>
          <div className="flex gap-2">
            {(['high', 'medium', 'low'] as TicketPriority[]).map((p) => {
              const s = priorityStyles[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-[13px] font-medium transition-colors',
                    priority === p ? 'border-transparent' : 'border-black/10 bg-white',
                  )}
                  style={priority === p ? { background: s.bg, color: s.text, borderColor: s.dot } : { color: s.text }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        {agents.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('kanban.createModal.assignee')}</p>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            >
              <option value="">{t('kanban.createModal.unassigned')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="mb-5">
          <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('kanban.createModal.assigneeRole')}</p>
          <input
            value={assigneeRole}
            onChange={(e) => setAssigneeRole(e.target.value)}
            placeholder={t('kanban.createModal.assigneeRolePlaceholder')}
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-black/10 py-2 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]">{t('actions.cancel')}</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 rounded-xl bg-[#ef4444] py-2 text-[13px] font-medium text-white hover:bg-[#dc2626] disabled:opacity-50"
          >
            {t('kanban.createModal.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Panel ─── */

function DetailPanel({
  ticket, agents, approvals, onClose, onUpdate, onDelete,
  onStartRuntime,
  onSteerRuntime,
  onStopRuntime,
  onApproveApproval,
  onRejectApproval,
}: {
  ticket: KanbanTicket;
  agents: AgentSummary[];
  approvals: ApprovalItem[];
  onClose: () => void;
  onUpdate: (updates: Partial<KanbanTicket>) => void;
  onDelete: () => void;
  onStartRuntime: (retryOrigin?: { runtimeSessionId?: string; runtimeSessionKey?: string }) => void;
  onSteerRuntime: (input: string) => void;
  onStopRuntime: () => void;
  onApproveApproval: (id: string, reason?: string) => void;
  onRejectApproval: (id: string, reason: string) => void;
}) {
  const { t } = useTranslation('common');
  const columns = getColumns(t);
  const priorityStyles = getPriorityStyles(t);
  const workStateStyles = getWorkStateStyles(t);
  const agentIdx = agents.findIndex((a) => a.id === ticket.assigneeId);
  const agent = agentIdx >= 0 ? agents[agentIdx] : null;
  const color = agent ? agentColor(agentIdx) : '#8e8e93';
  const p = priorityStyles[ticket.priority];
  const [followup, setFollowup] = useState('');
  const [wizard, setWizard] = useState<ApprovalItem | null>(null);
  const [reviewing, setReviewing] = useState<ApprovalItem | null>(null);
  const [, setRuntimeChildren] = useState<RuntimeSessionResponse[]>([]);
  const [runtimeChildrenLoading, setRuntimeChildrenLoading] = useState(false);
  const [runtimeChildrenError, setRuntimeChildrenError] = useState<string | null>(null);
  const [runtimeTreeDescendants, setRuntimeTreeDescendants] = useState<RuntimeSessionResponse[]>([]);
  const [selectedRuntimeSessionId, setSelectedRuntimeSessionId] = useState<string | null>(ticket.runtimeSessionId ?? null);
  const [selectedRuntimeSession, setSelectedRuntimeSession] = useState<RuntimeSessionResponse | null>(null);
  const [selectedRuntimeLoading, setSelectedRuntimeLoading] = useState(false);
  const [selectedRuntimeError, setSelectedRuntimeError] = useState<string | null>(null);
  const reviewText = reviewing?.toolInput
    ? JSON.stringify(reviewing.toolInput, null, 2)
    : (reviewing?.prompt ?? '');
  const riskPreview = reviewText.toLowerCase();
  const isDangerous = ['rm -rf', 'sudo', 'del ', 'format ', 'powershell -command remove-item'].some((token) => riskPreview.includes(token));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (reviewing) { setReviewing(null); return; }
        if (wizard) { setWizard(null); return; }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, reviewing, wizard]);

  useEffect(() => {
    setSelectedRuntimeSessionId(ticket.runtimeSessionId ?? null);
    setSelectedRuntimeSession(null);
    setSelectedRuntimeError(null);
  }, [ticket.runtimeSessionId, ticket.runtimeHistory, ticket.runtimeTranscript]);

  useEffect(() => {
    const runtimeSessionId = ticket.runtimeSessionId;
    if (!runtimeSessionId || !ticket.runtimeChildSessionIds || ticket.runtimeChildSessionIds.length === 0) {
      setRuntimeChildren([]);
      setRuntimeTreeDescendants([]);
      setRuntimeChildrenError(null);
      return;
    }

    let cancelled = false;
    const loadRuntimeChildren = async () => {
      setRuntimeChildrenLoading(true);
      setRuntimeChildrenError(null);
      try {
        const treeResponse = await hostApiFetch<{
          success?: boolean;
          tree?: { root?: RuntimeSessionResponse; descendants?: RuntimeSessionResponse[] };
        }>(`/api/sessions/subagents/${encodeURIComponent(runtimeSessionId)}/tree`);
        if (cancelled) return;
        const descendants = Array.isArray(treeResponse?.tree?.descendants) ? treeResponse.tree.descendants : [];
        setRuntimeTreeDescendants(descendants);
        const childIds = new Set(ticket.runtimeChildSessionIds);
        const matchingChildren = descendants
          .filter((session) => childIds.has(session.id))
          .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
        setRuntimeChildren(matchingChildren);
      } catch {
        try {
          const response = await hostApiFetch<{ success?: boolean; sessions?: RuntimeSessionResponse[] }>('/api/sessions/subagents');
          if (cancelled) return;
          const childIds = new Set(ticket.runtimeChildSessionIds);
          const sessions = Array.isArray(response?.sessions) ? response.sessions : [];
          const matchingChildren = sessions
            .filter((session) => childIds.has(session.id))
            .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
          setRuntimeTreeDescendants(sessions);
          setRuntimeChildren(matchingChildren);
        } catch (fallbackError) {
          if (!cancelled) {
            setRuntimeTreeDescendants([]);
            setRuntimeChildren([]);
            setRuntimeChildrenError(String(fallbackError));
          }
        }
      } finally {
        if (!cancelled) setRuntimeChildrenLoading(false);
      }
    };

    void loadRuntimeChildren();

    return () => {
      cancelled = true;
    };
  }, [ticket.runtimeSessionId, ticket.runtimeChildSessionIds]);

  const currentRuntimeView: RuntimeSessionResponse | null = selectedRuntimeSessionId
    ? (
      selectedRuntimeSessionId === ticket.runtimeSessionId
        ? {
          id: ticket.runtimeSessionId,
          sessionKey: ticket.runtimeSessionKey,
          parentRuntimeId: ticket.runtimeParentSessionId,
          rootRuntimeId: ticket.runtimeRootSessionId,
          depth: ticket.runtimeDepth,
          parentSessionKey: ticket.runtimeParentSessionKey,
          history: ticket.runtimeHistory,
          transcript: ticket.runtimeTranscript,
          childRuntimeIds: ticket.runtimeChildSessionIds,
          status: ticket.workState,
          lastError: ticket.workError,
          result: ticket.workResult,
        }
        : selectedRuntimeSession
    )
    : null;

  const currentRuntimeHistory = currentRuntimeView?.history && currentRuntimeView.history.length > 0
    ? currentRuntimeView.history
    : buildRuntimeHistoryFromTranscript(currentRuntimeView?.transcript);
  const currentExecutionRecords = currentRuntimeView?.executionRecords ?? [];
  const currentRuntimeTools = currentRuntimeView?.toolSnapshot ?? [];
  const currentRuntimeSkills = currentRuntimeView?.skillSnapshot ?? [];
  const runtimeDescendantMap = useMemo(
    () => new Map(runtimeTreeDescendants.map((session) => [session.id, session])),
    [runtimeTreeDescendants],
  );
  const visibleChildIds = currentRuntimeView?.childRuntimeIds ?? ticket.runtimeChildSessionIds ?? [];
  const visibleRuntimeChildren = visibleChildIds
    .map((childId) => runtimeDescendantMap.get(childId))
    .filter((child): child is RuntimeSessionResponse => Boolean(child));
  const currentLineageIds = [
    currentRuntimeView?.rootRuntimeId,
    currentRuntimeView?.parentRuntimeId,
    currentRuntimeView?.id,
  ].filter((value, index, array): value is string => typeof value === 'string' && value.length > 0 && array.indexOf(value) === index);
  const latestRuntimeId = ticket.runtimeSessionId ?? null;
  const runtimeTreeStates = [
    ticket.workState,
    ...runtimeTreeDescendants.map((session) => normalizeRuntimeStatusToWorkState(session.status)),
  ];
  const subtreeState: WorkState =
    runtimeTreeStates.includes('waiting_approval') ? 'waiting_approval'
      : runtimeTreeStates.includes('blocked') ? 'blocked'
        : runtimeTreeStates.includes('working') ? 'working'
          : runtimeTreeStates.includes('scheduled') ? 'scheduled'
            : runtimeTreeStates.includes('failed') ? 'failed'
              : runtimeTreeStates.includes('done') ? 'done'
                : 'idle';

  const selectRuntimeSession = async (runtimeSessionId: string) => {
    if (runtimeSessionId === ticket.runtimeSessionId) {
      setSelectedRuntimeSessionId(runtimeSessionId);
      setSelectedRuntimeSession(null);
      setSelectedRuntimeError(null);
      return;
    }

    setSelectedRuntimeLoading(true);
    setSelectedRuntimeError(null);
    setSelectedRuntimeSessionId(runtimeSessionId);
    try {
      const response = await hostApiFetch<{ success?: boolean; session?: RuntimeSessionResponse }>(
        `/api/sessions/subagents/${encodeURIComponent(runtimeSessionId)}`,
      );
      setSelectedRuntimeSession(response.session ?? null);
    } catch (error) {
      setSelectedRuntimeSession(null);
      setSelectedRuntimeError(String(error));
    } finally {
      setSelectedRuntimeLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/20" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
        className="flex h-full w-[380px] flex-col bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <span id="detail-panel-title" className="text-[14px] font-semibold text-[#000000]">{t('kanban.detail.title')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-[#ef4444]/20 px-2.5 py-1 text-[12px] text-[#ef4444] hover:bg-[#fef2f2]"
            >
              {t('kanban.detail.delete')}
            </button>
            <button type="button" onClick={onClose} aria-label={t('kanban.detail.close')} className="text-[18px] text-[#8e8e93] hover:text-[#3c3c43]">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.titleLabel')}</p>
            <p className="text-[15px] font-semibold text-[#000000]">{ticket.title}</p>
          </div>

          {ticket.description && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.descriptionLabel')}</p>
              <p className="text-[13px] leading-relaxed text-[#3c3c43]">{ticket.description}</p>
            </div>
          )}

          <div className="flex gap-4">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.priorityLabel')}</p>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium"
                style={{ background: p.bg, color: p.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.dot }} />
                {p.label}
              </span>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.statusLabel')}</p>
              <span className="text-[13px] text-[#3c3c43]">
                {columns.find((c) => c.key === ticket.status)?.label ?? ticket.status}
              </span>
            </div>
          </div>

          {agent && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.assigneeLabel')}</p>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[13px] font-medium" style={{ color }}>{agent.name}</span>
              </div>
            </div>
          )}

          {ticket.assigneeRole && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.assigneeRoleLabel')}</p>
              <p className="text-[13px] font-medium text-[#3c3c43]">{ticket.assigneeRole}</p>
            </div>
          )}

          {ticket.workState !== 'idle' && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.executionLabel')}</p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: (workStateStyles[ticket.workState] ?? workStateStyles.failed).color }}>
                  {(workStateStyles[ticket.workState] ?? workStateStyles.failed).label}
                </span>
                {ticket.workState === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ workState: 'idle', workError: undefined, workResult: undefined })}
                    className="rounded-md border border-black/10 px-2 py-0.5 text-[11px] text-[#8e8e93] hover:bg-[#f2f2f7]"
                  >
                    {t('actions.clear')}
                  </button>
                )}
              </div>
              {ticket.workError && (
                <p className="mt-1 text-[12px] text-[#ef4444]">{ticket.workError}</p>
              )}
              {ticket.workResult && (
                <p className="mt-1 text-[12px] text-[#3c3c43]">{ticket.workResult}</p>
              )}
              {ACTIVE_RUNTIME_WORK_STATES.has(ticket.workState) && (
                <p className="mt-2 text-[12px] text-[#8e8e93]">{t('kanban.detail.runtimeLock')}</p>
              )}
            </div>
          )}


          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.runtime.title')}</p>
            {ticket.runtimeSessionId ? (
              <>
                <div className="mb-3 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {latestRuntimeId && (
                      <button
                        type="button"
                        onClick={() => void selectRuntimeSession(latestRuntimeId)}
                        className={cn(
                          'rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] text-[#475467]',
                          selectedRuntimeSessionId === latestRuntimeId && 'border-[#007aff] text-[#007aff]',
                        )}
                      >
                        {`${t('kanban.runtime.latestRun')} · ${latestRuntimeId}`}
                      </button>
                    )}
                    {ticket.runtimeSessionId && (
                      <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] text-[#475467]">
                        {`${t('kanban.runtime.currentRun')} · ${ticket.runtimeSessionId}`}
                      </span>
                    )}
                    {currentRuntimeView?.id && currentRuntimeView.id !== ticket.runtimeSessionId && (
                      <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] text-[#475467]">
                        {`${t('kanban.runtime.selectedRun')} · ${currentRuntimeView.id}`}
                      </span>
                    )}
                    {subtreeState !== 'idle' && (
                      <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[11px] text-[#475467]">
                        {`${t('kanban.runtime.activeSubtree')} · ${(workStateStyles[subtreeState] ?? workStateStyles.failed).label}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mb-2 rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475467]">
                  {t('kanban.runtime.session', { id: ticket.runtimeSessionId })}
                </div>
                {ticket.runtimeSessionKey && (
                  <div className="mb-2 rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475467]">
                    {t('kanban.runtime.sessionKey', { key: ticket.runtimeSessionKey })}
                  </div>
                )}
                {ticket.runtimeParentSessionId && (
                  <div className="mb-2 rounded-lg bg-[#f8fafc] px-3 py-2 text-[12px] text-[#475467]">
                    {t('kanban.runtime.parentRun', { id: ticket.runtimeParentSessionId })}
                    {typeof ticket.runtimeDepth === 'number' ? t('kanban.runtime.depthSuffix', { depth: ticket.runtimeDepth }) : ''}
                  </div>
                )}
                {visibleChildIds.length > 0 && (
                  <div className="mb-3 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-3" data-testid="ticket-runtime-children">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">Child runs</p>
                      <span className="text-[11px] text-[#8e8e93]">{visibleChildIds.length}</span>
                    </div>
                    {runtimeChildrenLoading ? (
                      <p className="text-[12px] text-[#8e8e93]">Loading child runs...</p>
                    ) : runtimeChildrenError ? (
                      <p className="text-[12px] text-[#ef4444]">{runtimeChildrenError}</p>
                    ) : visibleRuntimeChildren.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {visibleRuntimeChildren.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => void selectRuntimeSession(child.id)}
                            className={cn(
                              'rounded-lg bg-white px-3 py-2 text-left text-[12px] text-[#475467] shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                              selectedRuntimeSessionId === child.id && 'ring-1 ring-[#007aff]',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-[#111827]">{child.id}</span>
                              <span className="text-[11px] text-[#8e8e93]">{child.status ?? 'unknown'}</span>
                            </div>
                            {child.transcript && child.transcript.length > 0 && (
                              <p className="mt-1 truncate text-[11px] text-[#8e8e93]">{child.transcript.at(-1)}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {visibleChildIds.map((childId) => (
                          <button
                            key={childId}
                            type="button"
                            onClick={() => void selectRuntimeSession(childId)}
                            className={cn(
                              'rounded-lg bg-white px-3 py-2 text-left text-[12px] text-[#475467] shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                              selectedRuntimeSessionId === childId && 'ring-1 ring-[#007aff]',
                            )}
                          >
                            {childId}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {currentLineageIds.length > 1 && (
                  <div className="mb-3 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">Lineage</p>
                    <div className="flex flex-wrap gap-2">
                      {currentLineageIds.map((runtimeId) => (
                        <button
                          key={runtimeId}
                          type="button"
                          onClick={() => void selectRuntimeSession(runtimeId)}
                          className={cn(
                            'rounded-lg bg-white px-3 py-2 text-[12px] text-[#475467] shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                            selectedRuntimeSessionId === runtimeId && 'ring-1 ring-[#007aff]',
                          )}
                        >
                          {runtimeId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mb-3 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">Transcript</p>
                    {selectedRuntimeSessionId && selectedRuntimeSessionId !== ticket.runtimeSessionId && (
                      <button
                        type="button"
                        onClick={() => void selectRuntimeSession(ticket.runtimeSessionId ?? '')}
                        className="rounded-md border border-black/10 px-2 py-1 text-[11px] text-[#475467] hover:bg-white"
                      >
                        Back to latest run
                      </button>
                    )}
                  </div>
                  {selectedRuntimeLoading ? (
                    <p className="text-[12px] text-[#8e8e93]">Loading runtime detail...</p>
                  ) : selectedRuntimeError ? (
                    <p className="text-[12px] text-[#ef4444]">{selectedRuntimeError}</p>
                  ) : currentRuntimeHistory.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {currentRuntimeHistory.map((message, index) => (
                        <ChatMessage
                          key={`${selectedRuntimeSessionId ?? ticket.runtimeSessionId ?? 'runtime'}-${index}`}
                          message={message}
                          showThinking
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#8e8e93]">{t('kanban.runtime.noHistory')}</p>
                  )}
                </div>
                {(currentExecutionRecords.length > 0 || currentRuntimeTools.length > 0 || currentRuntimeSkills.length > 0) && (
                  <div className="mb-3 space-y-3 rounded-xl border border-black/[0.06] bg-[#fafafa] px-3 py-3">
                    {currentExecutionRecords.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.runtime.executionPath')}</p>
                        <div className="flex flex-col gap-2">
                          {currentExecutionRecords.map((record) => {
                            const durationLabel = formatExecutionDuration(record.durationMs);
                            return (
                            <div
                              key={record.id}
                              className="rounded-lg bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[12px] font-medium text-[#111827]">{record.toolName}</span>
                                <span className="text-[11px] text-[#8e8e93]">{record.status}</span>
                              </div>
                                {record.summary && (
                                  <p className="mt-1 text-[12px] text-[#475467]">{record.summary}</p>
                                )}
                                {durationLabel && (
                                  <p className="mt-1 text-[11px] text-[#8e8e93]">{durationLabel}</p>
                                )}
                                {record.linkedRuntimeId && (
                                  <button
                                    type="button"
                                    onClick={() => void selectRuntimeSession(record.linkedRuntimeId ?? '')}
                                    aria-label={`Open linked runtime ${record.linkedRuntimeId}`}
                                    className="mt-2 rounded-md border border-black/10 px-2 py-1 text-[11px] text-[#475467] hover:bg-[#f8fafc]"
                                  >
                                    {record.linkedRuntimeId}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(currentRuntimeTools.length > 0 || currentRuntimeSkills.length > 0) && (
                      <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.runtime.capabilities')}</p>
                        <div className="flex flex-wrap gap-2">
                          {currentRuntimeSkills.map((skill) => (
                            <span
                              key={`skill-${skill}`}
                              className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#475467] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            >
                              {skill}
                            </span>
                          ))}
                          {currentRuntimeTools.map((tool) => (
                            <span
                              key={`tool-${tool.server}-${tool.name}`}
                              className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#475467] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                            >
                              {`${tool.server}.${tool.name}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mb-2 flex gap-2">
                  <input
                    aria-label={t('kanban.runtime.followupLabel')}
                    value={followup}
                    onChange={(e) => setFollowup(e.target.value)}
                    placeholder={t('kanban.runtime.followupPlaceholder')}
                    className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSteerRuntime(followup);
                      setFollowup('');
                    }}
                    disabled={!followup.trim()}
                    className="rounded-lg bg-clawx-ac px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0056b3] disabled:opacity-50"
                  >
                    {t('kanban.runtime.sendFollowup')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onStopRuntime}
                    className="rounded-lg border border-[#ef4444]/20 px-3 py-2 text-[12px] text-[#ef4444] hover:bg-[#fef2f2]"
                  >
                    {t('kanban.runtime.stop')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartRuntime(
                      selectedRuntimeSessionId && selectedRuntimeSessionId !== ticket.runtimeSessionId
                        ? {
                          runtimeSessionId: currentRuntimeView?.id,
                          runtimeSessionKey: currentRuntimeView?.sessionKey,
                        }
                        : undefined,
                    )}
                    className="rounded-lg border border-black/10 px-3 py-2 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                  >
                    {t('kanban.runtime.retry')}
                  </button>
                </div>

                {approvals.length > 0 && (
                  <div data-testid="ticket-runtime-approvals" className="mt-3 rounded-xl border border-[#f59e0b]/30 bg-[#fffbeb] px-3 py-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.runtime.approvals')}</p>
                    <div className="flex flex-col gap-2">
                      {approvals.map((approval) => (
                        <div key={approval.id} className="rounded-lg bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-[#111827]">
                                {approval.command ?? approval.prompt ?? approval.id}
                              </p>
                              {approval.requestedAt || approval.createdAt ? (
                                <p className="mt-1 text-[11px] text-[#8e8e93]">
                                  {new Date(approval.requestedAt ?? approval.createdAt ?? '').toLocaleString('zh-CN')}
                                </p>
                              ) : null}
                            </div>
                            {approval.command === 'AskUserQuestion' ? (
                              <button
                                type="button"
                                onClick={() => setWizard(approval)}
                                className="rounded-lg bg-clawx-ac px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#005fd6]"
                              >
                                {t('kanban.runtime.respond')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReviewing(approval)}
                                className="rounded-lg bg-[#111827] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#1f2937]"
                              >
                                {t('kanban.runtime.review')}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStartRuntime()}
                  className="rounded-lg bg-clawx-ac px-3 py-2 text-[12px] font-medium text-white hover:bg-[#0056b3]"
                >
                  {t('kanban.runtime.start')}
                </button>
                <span className="text-[12px] text-[#8e8e93]">{t('kanban.runtime.intro')}</span>
              </div>
            )}
          </div>

          {/* Move to column */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8e8e93]">{t('kanban.detail.moveTo')}</p>
            <div className="flex flex-wrap gap-2">
              {columns.filter((c) => c.key !== ticket.status).map((col) => (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => onUpdate({ status: col.key })}
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {wizard && (
        <AskUserQuestionWizard
          approval={wizard}
          onRespond={(answers) => {
            onApproveApproval(wizard.id, JSON.stringify(answers));
            setWizard(null);
          }}
          onDismiss={() => setWizard(null)}
        />
      )}

      {reviewing && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35" role="dialog" aria-modal="true" aria-labelledby="detail-review-modal-title" aria-label={t('kanban.approvals.reviewTitle')}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="detail-review-modal-title" className="text-[16px] font-semibold text-[#111827]">{t('kanban.approvals.reviewTitle')}</h3>
                <p className="mt-1 text-[12px] text-[#6b7280]">{t('kanban.approvals.reviewSubtitle', { agent: reviewing.agentId ?? t('kanban.approvals.unknownAgent'), command: reviewing.command ?? t('kanban.approvals.unknownCommand') })}</p>
              </div>
              <button type="button" onClick={() => setReviewing(null)} aria-label={t('kanban.approvals.closeReview')} className="text-[18px] text-[#8e8e93] hover:text-[#3c3c43]">×</button>
            </div>

            {isDangerous && (
              <div className="mb-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
                {t('kanban.approvals.danger')}
              </div>
            )}

            {reviewing.prompt ? (
              <div className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-[#6b7280]">{t('kanban.approvals.prompt')}</p>
                <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[13px] text-[#374151]">{reviewing.prompt}</div>
              </div>
            ) : null}

            <div className="mb-5">
              <p className="mb-1 text-[12px] font-medium text-[#6b7280]">{t('kanban.approvals.toolInput')}</p>
              <pre className="overflow-x-auto rounded-xl bg-[#111827] px-4 py-3 text-[12px] text-[#e5e7eb]">{reviewText || t('kanban.approvals.emptyToolInput')}</pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewing(null)}
                className="rounded-lg border border-black/10 px-3 py-2 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]"
              >
                {t('actions.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveApproval(reviewing.id);
                  setReviewing(null);
                }}
                className="rounded-lg bg-[#10b981] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#059669]"
              >
                {t('kanban.approvals.approve')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRejectApproval(reviewing.id, t('kanban.approvals.rejectReason'));
                  setReviewing(null);
                }}
                className="rounded-lg border border-[#ef4444]/30 px-3 py-2 text-[13px] text-[#ef4444] hover:bg-[#fef2f2]"
              >
                {t('kanban.approvals.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskKanban;

/* ─── Approvals Section ─── */


function ApprovalsSection({
  approvals,
  onApprove,
  onReject,
}: {
  approvals: ApprovalItem[];
  onApprove: (id: string, reason?: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const { t } = useTranslation('common');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [wizard, setWizard] = useState<ApprovalItem | null>(null);
  const [reviewing, setReviewing] = useState<ApprovalItem | null>(null);

  const reviewText = reviewing?.toolInput
    ? JSON.stringify(reviewing.toolInput, null, 2)
    : (reviewing?.prompt ?? '');
  const riskPreview = reviewText.toLowerCase();
  const isDangerous = ['rm -rf', 'sudo', 'del ', 'format ', 'powershell -command remove-item'].some((token) => riskPreview.includes(token));

  useEffect(() => {
    if (!reviewing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReviewing(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [reviewing]);

  return (
    <>
      <div className="shrink-0 border-b border-black/[0.06] px-8 pb-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f59e0b] text-[11px] font-bold text-white">
            {approvals.length}
          </span>
          <span className="text-[13px] font-semibold text-[#000000]">{t('kanban.approvals.pending')}</span>
        </div>
        <div className="flex flex-col gap-2">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-[#f59e0b]/30 bg-[#fffbeb] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#000000]">
                  {item.command ?? item.prompt ?? item.id}
                </p>
                {item.agentId && (
                  <p className="mt-0.5 text-[11px] text-[#8e8e93]">{t('kanban.approvals.agent', { agent: item.agentId })}</p>
                )}
                {(item.createdAt ?? item.requestedAt) && (
                  <p className="mt-0.5 text-[11px] text-[#8e8e93]">
                    {new Date(item.createdAt ?? item.requestedAt ?? '').toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.command === 'AskUserQuestion' ? (
                  <button
                    type="button"
                    onClick={() => setWizard(item)}
                    className="rounded-lg bg-clawx-ac px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#005fd6]"
                  >
                    {t('kanban.runtime.respond')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReviewing(item)}
                    className="rounded-lg bg-[#111827] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#1f2937]"
                  >
                    {t('kanban.runtime.review')}
                  </button>
                )}
                {item.command === 'AskUserQuestion' ? null : rejectingId === item.id ? (
                  <>
                    <input
                      autoFocus
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('kanban.approvals.rejectPlaceholder')}
                      className="w-[140px] rounded-lg border border-black/10 px-2 py-1 text-[12px] outline-none focus:border-clawx-ac"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (rejectReason.trim()) {
                          onReject(item.id, rejectReason.trim());
                          setRejectingId(null);
                          setRejectReason('');
                        }
                      }}
                      className="rounded-lg bg-[#ef4444] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#dc2626]"
                    >
                      {t('kanban.approvals.confirmReject')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      className="rounded-lg border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                    >
                      {t('kanban.approvals.cancelReject')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setRejectingId(item.id)}
                      className="rounded-lg border border-[#ef4444]/30 px-2.5 py-1 text-[12px] text-[#ef4444] hover:bg-[#fef2f2]"
                    >
                      {t('kanban.approvals.reject')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {wizard && (
        <AskUserQuestionWizard
          approval={wizard}
          onRespond={(answers) => {
            onApprove(wizard.id, JSON.stringify(answers));
            setWizard(null);
          }}
          onDismiss={() => setWizard(null)}
        />
      )}

      {reviewing && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35" role="dialog" aria-modal="true" aria-labelledby="approvals-review-modal-title" aria-label={t('kanban.approvals.reviewTitle')}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 id="approvals-review-modal-title" className="text-[16px] font-semibold text-[#111827]">{t('kanban.approvals.reviewTitle')}</h3>
                <p className="mt-1 text-[12px] text-[#6b7280]">{t('kanban.approvals.reviewSubtitle', { agent: reviewing.agentId ?? t('kanban.approvals.unknownAgent'), command: reviewing.command ?? t('kanban.approvals.unknownCommand') })}</p>
              </div>
              <button type="button" onClick={() => setReviewing(null)} aria-label={t('kanban.approvals.closeReview')} className="text-[18px] text-[#8e8e93] hover:text-[#3c3c43]">×</button>
            </div>

            {isDangerous && (
              <div className="mb-4 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
                {t('kanban.approvals.danger')}
              </div>
            )}

            {reviewing.prompt ? (
              <div className="mb-3">
                <p className="mb-1 text-[12px] font-medium text-[#6b7280]">{t('kanban.approvals.prompt')}</p>
                <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[13px] text-[#374151]">{reviewing.prompt}</div>
              </div>
            ) : null}

            <div className="mb-5">
              <p className="mb-1 text-[12px] font-medium text-[#6b7280]">{t('kanban.approvals.toolInput')}</p>
              <pre className="overflow-x-auto rounded-xl bg-[#111827] px-4 py-3 text-[12px] text-[#e5e7eb]">{reviewText || t('kanban.approvals.emptyToolInput')}</pre>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewing(null)}
                className="rounded-lg border border-black/10 px-3 py-2 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]"
              >
                {t('actions.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onApprove(reviewing.id);
                  setReviewing(null);
                }}
                className="rounded-lg bg-[#10b981] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#059669]"
              >
                {t('kanban.approvals.approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
