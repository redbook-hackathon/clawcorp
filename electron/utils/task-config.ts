import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { withConfigLock } from './config-mutex';
import { getOpenClawConfigDir } from './paths';
import { logger } from './logger';
import type {
  BorrowedTaskExecution,
  CanonicalTaskExecution,
  CreateTaskRequest,
  KanbanTask,
  TaskApprovalRollup,
  TaskBlockerRollup,
  TaskExecutionEvent,
  TaskExecutionEventInput,
  TaskLatestInternalExcerpt,
  StartTaskExecutionRequest,
  WorkState,
} from '../../src/types/task';

interface TaskConfigDocument {
  tasks?: KanbanTask[];
}

const TASKS_FILE = join(getOpenClawConfigDir(), 'tasks.json');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureTaskConfigDir(): Promise<void> {
  await mkdir(getOpenClawConfigDir(), { recursive: true });
}

async function readTaskDocument(): Promise<TaskConfigDocument> {
  await ensureTaskConfigDir();
  if (!(await fileExists(TASKS_FILE))) {
    return { tasks: [] };
  }

  try {
    const content = await readFile(TASKS_FILE, 'utf8');
    return JSON.parse(content) as TaskConfigDocument;
  } catch (error) {
    logger.error('Failed to read task config', error);
    return { tasks: [] };
  }
}

async function writeTaskDocument(document: TaskConfigDocument): Promise<void> {
  await ensureTaskConfigDir();
  await writeFile(TASKS_FILE, JSON.stringify({ tasks: document.tasks ?? [] }, null, 2), 'utf8');
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function normalizeLatestInternalExcerpt(
  excerpt: TaskLatestInternalExcerpt | undefined,
): TaskLatestInternalExcerpt | undefined {
  if (!excerpt?.content) return undefined;
  return {
    content: excerpt.content,
    createdAt: excerpt.createdAt,
    ...(excerpt.sessionKey ? { sessionKey: excerpt.sessionKey } : {}),
    ...(excerpt.role ? { role: excerpt.role } : {}),
  };
}

function normalizeBlocker(blocker: TaskBlockerRollup | undefined): TaskBlockerRollup | undefined {
  if (!blocker?.summary) return undefined;
  return {
    state: blocker.state,
    summary: blocker.summary,
    ...(blocker.detail ? { detail: blocker.detail } : {}),
    ...(blocker.updatedAt ? { updatedAt: blocker.updatedAt } : {}),
    ...(blocker.source ? { source: blocker.source } : {}),
  };
}

function normalizeApprovalState(approvalState: TaskApprovalRollup | undefined): TaskApprovalRollup | undefined {
  if (!approvalState?.state) return undefined;
  return {
    state: approvalState.state,
    ...(approvalState.updatedAt ? { updatedAt: approvalState.updatedAt } : {}),
    ...(approvalState.approverId ? { approverId: approvalState.approverId } : {}),
  };
}

function normalizeBorrowedExecutions(
  borrowedExecutions: BorrowedTaskExecution[] | undefined,
): BorrowedTaskExecution[] | undefined {
  if (!borrowedExecutions?.length) return undefined;
  return borrowedExecutions.map((execution) => ({
    teamId: execution.teamId,
    sessionKey: execution.sessionKey,
    agentIds: [...execution.agentIds],
  }));
}

function normalizeCanonicalExecution(
  canonicalExecution: CanonicalTaskExecution | null | undefined,
): CanonicalTaskExecution | null {
  if (!canonicalExecution) return null;
  return {
    sessionId: canonicalExecution.sessionId,
    sessionKey: canonicalExecution.sessionKey,
    status: canonicalExecution.status,
    startedAt: canonicalExecution.startedAt,
    ...(canonicalExecution.updatedAt ? { updatedAt: canonicalExecution.updatedAt } : {}),
    ...(canonicalExecution.agentId ? { agentId: canonicalExecution.agentId } : {}),
    ...(canonicalExecution.parentSessionId ? { parentSessionId: canonicalExecution.parentSessionId } : {}),
    ...(canonicalExecution.rootSessionId ? { rootSessionId: canonicalExecution.rootSessionId } : {}),
    ...(canonicalExecution.parentSessionKey ? { parentSessionKey: canonicalExecution.parentSessionKey } : {}),
    ...(canonicalExecution.depth !== undefined ? { depth: canonicalExecution.depth } : {}),
    ...(canonicalExecution.entrySessionKey ? { entrySessionKey: canonicalExecution.entrySessionKey } : {}),
  };
}

function normalizeExecutionEvents(events: TaskExecutionEvent[] | undefined): TaskExecutionEvent[] | undefined {
  if (!events?.length) return undefined;
  return events.map((event) => ({
    type: event.type,
    createdAt: event.createdAt,
    ...(event.status ? { status: event.status } : {}),
    ...(event.content ? { content: event.content } : {}),
    ...(event.sessionKey ? { sessionKey: event.sessionKey } : {}),
    ...(event.actorId ? { actorId: event.actorId } : {}),
  }));
}

function normalizeTask(task: KanbanTask): KanbanTask {
  const teamId = task.teamId;
  const teamName = task.teamName;
  const canonicalExecution = normalizeCanonicalExecution(task.canonicalExecution);
  const relatedSessionKeys = uniqueStrings([
    ...(task.relatedSessionKeys ?? []),
    task.runtimeSessionKey,
    task.runtimeParentSessionKey,
    canonicalExecution?.sessionKey,
    canonicalExecution?.entrySessionKey,
  ]);

  return {
    ...task,
    isTeamTask: Boolean(teamId),
    ...(teamId ? { teamId } : {}),
    ...(teamName ? { teamName } : {}),
    canonicalExecution,
    ...(normalizeBorrowedExecutions(task.borrowedExecutions)
      ? { borrowedExecutions: normalizeBorrowedExecutions(task.borrowedExecutions) }
      : {}),
    ...(normalizeExecutionEvents(task.executionEvents)
      ? { executionEvents: normalizeExecutionEvents(task.executionEvents) }
      : {}),
    ...(normalizeLatestInternalExcerpt(task.latestInternalExcerpt)
      ? { latestInternalExcerpt: normalizeLatestInternalExcerpt(task.latestInternalExcerpt) }
      : {}),
    ...(normalizeBlocker(task.blocker) ? { blocker: normalizeBlocker(task.blocker) } : {}),
    ...(normalizeApprovalState(task.approvalState)
      ? { approvalState: normalizeApprovalState(task.approvalState) }
      : {}),
    ...(relatedSessionKeys.length > 0 ? { relatedSessionKeys } : {}),
  };
}

function findTaskIndex(tasks: KanbanTask[], taskId: string): number {
  return tasks.findIndex((task) => task.id === taskId);
}

function requireTask(tasks: KanbanTask[], taskId: string): { task: KanbanTask; index: number } {
  const index = findTaskIndex(tasks, taskId);
  if (index === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return { task: tasks[index], index };
}

function resolveWorkStateFromEvent(
  currentWorkState: WorkState,
  status: WorkState | undefined,
): WorkState {
  return status ?? currentWorkState;
}

function deriveBlocker(
  existing: TaskBlockerRollup | undefined,
  status: WorkState | undefined,
  content: string | undefined,
  sessionKey: string | undefined,
  createdAt: string,
): TaskBlockerRollup | undefined {
  if (status === 'blocked' || status === 'waiting_approval') {
    return {
      state: status,
      summary: content ?? existing?.summary ?? status,
      ...(content ? { detail: content } : {}),
      updatedAt: createdAt,
      ...(sessionKey ? { source: sessionKey } : {}),
    };
  }

  if (status && status !== 'blocked' && status !== 'waiting_approval') {
    return undefined;
  }

  return existing;
}

function deriveApprovalState(
  existing: TaskApprovalRollup | undefined,
  status: WorkState | undefined,
  createdAt: string,
): TaskApprovalRollup | undefined {
  if (status === 'waiting_approval') {
    return {
      state: 'waiting_leader',
      updatedAt: createdAt,
    };
  }

  if (status && status !== 'waiting_approval') {
    return existing?.state === 'waiting_leader' || existing?.state === 'waiting_user'
      ? { state: 'idle', updatedAt: createdAt }
      : existing;
  }

  return existing;
}

export async function listTaskSnapshots(): Promise<KanbanTask[]> {
  const document = await readTaskDocument();
  return (document.tasks ?? []).map((task) => normalizeTask(task));
}

export async function createTask(input: CreateTaskRequest): Promise<KanbanTask> {
  return withConfigLock(async () => {
    const document = await readTaskDocument();
    const tasks = [...(document.tasks ?? [])];
    const now = new Date().toISOString();
    const task = normalizeTask({
      id: `task-${randomUUID()}`,
      title: input.title,
      description: input.description,
      status: 'todo',
      priority: input.priority,
      assigneeId: input.assigneeId,
      assigneeRole: input.assigneeRole,
      workState: 'idle',
      teamId: input.teamId,
      teamName: input.teamName,
      isTeamTask: Boolean(input.teamId),
      canonicalExecution: null,
      createdAt: now,
      updatedAt: now,
      ...(input.deadline ? { deadline: input.deadline } : {}),
    });

    tasks.push(task);
    await writeTaskDocument({ tasks });
    return task;
  });
}

export async function updateTask(taskId: string, updates: Partial<KanbanTask>): Promise<KanbanTask> {
  return withConfigLock(async () => {
    const document = await readTaskDocument();
    const tasks = [...(document.tasks ?? [])];
    const { task, index } = requireTask(tasks, taskId);
    const updatedTask = normalizeTask({
      ...task,
      ...updates,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
      teamId: updates.teamId ?? task.teamId,
      teamName: updates.teamName ?? task.teamName,
      isTeamTask: Boolean(updates.teamId ?? task.teamId),
      canonicalExecution: updates.canonicalExecution ?? task.canonicalExecution ?? null,
    });

    tasks[index] = updatedTask;
    await writeTaskDocument({ tasks });
    return updatedTask;
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  return withConfigLock(async () => {
    const document = await readTaskDocument();
    const tasks = [...(document.tasks ?? [])];
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    if (nextTasks.length === tasks.length) {
      throw new Error(`Task not found: ${taskId}`);
    }
    await writeTaskDocument({ tasks: nextTasks });
  });
}

export async function startTaskExecution(
  taskId: string,
  input: StartTaskExecutionRequest,
): Promise<KanbanTask> {
  return withConfigLock(async () => {
    const document = await readTaskDocument();
    const tasks = [...(document.tasks ?? [])];
    const { task, index } = requireTask(tasks, taskId);
    const startedAt = input.startedAt ?? new Date().toISOString();
    const canonicalExecution = normalizeCanonicalExecution({
      sessionId: input.sessionId,
      sessionKey: input.sessionKey,
      status: 'active',
      startedAt,
      updatedAt: startedAt,
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
      ...(input.rootSessionId ? { rootSessionId: input.rootSessionId } : {}),
      ...(input.parentSessionKey ? { parentSessionKey: input.parentSessionKey } : {}),
      ...(input.depth !== undefined ? { depth: input.depth } : {}),
      ...(input.entrySessionKey ? { entrySessionKey: input.entrySessionKey } : {}),
    });

    const updatedTask = normalizeTask({
      ...task,
      canonicalExecution,
      workState: 'starting',
      workStartedAt: startedAt,
      runtimeSessionId: input.sessionId,
      runtimeRootSessionId: input.rootSessionId ?? input.sessionId,
      ...(input.parentSessionId ? { runtimeParentSessionId: input.parentSessionId } : {}),
      runtimeSessionKey: input.sessionKey,
      ...(input.parentSessionKey ? { runtimeParentSessionKey: input.parentSessionKey } : {}),
      runtimeDepth: input.depth ?? 0,
      runtimeLineageSessionKeys: uniqueStrings([
        ...(task.runtimeLineageSessionKeys ?? []),
        input.sessionKey,
        input.parentSessionKey,
        input.entrySessionKey,
      ]),
      relatedSessionKeys: uniqueStrings([
        ...(task.relatedSessionKeys ?? []),
        input.entrySessionKey,
        input.sessionKey,
      ]),
      updatedAt: startedAt,
    });

    tasks[index] = updatedTask;
    await writeTaskDocument({ tasks });
    return updatedTask;
  });
}

export async function appendTaskExecutionEvent(
  taskId: string,
  input: TaskExecutionEventInput,
): Promise<KanbanTask> {
  return withConfigLock(async () => {
    const document = await readTaskDocument();
    const tasks = [...(document.tasks ?? [])];
    const { task, index } = requireTask(tasks, taskId);
    const createdAt = input.createdAt ?? new Date().toISOString();
    const event: TaskExecutionEvent = {
      type: input.type,
      createdAt,
      ...(input.status ? { status: input.status } : {}),
      ...(input.content ? { content: input.content } : {}),
      ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
    };

    const latestInternalExcerpt = input.content
      ? {
        content: input.content,
        createdAt,
        ...(input.sessionKey ? { sessionKey: input.sessionKey } : {}),
        role: input.type.includes('assistant') ? 'assistant' : undefined,
      }
      : task.latestInternalExcerpt;

    const canonicalExecution = task.canonicalExecution
      ? {
        ...task.canonicalExecution,
        updatedAt: createdAt,
        status: input.status === 'blocked' || input.status === 'waiting_approval'
          ? input.status
          : task.canonicalExecution.status,
      }
      : null;

    const updatedTask = normalizeTask({
      ...task,
      canonicalExecution,
      executionEvents: [...(task.executionEvents ?? []), event],
      ...(latestInternalExcerpt ? { latestInternalExcerpt } : {}),
      workState: resolveWorkStateFromEvent(task.workState, input.status),
      blocker: deriveBlocker(task.blocker, input.status, input.content, input.sessionKey, createdAt),
      approvalState: deriveApprovalState(task.approvalState, input.status, createdAt),
      relatedSessionKeys: uniqueStrings([
        ...(task.relatedSessionKeys ?? []),
        input.sessionKey,
      ]),
      updatedAt: createdAt,
    });

    tasks[index] = updatedTask;
    await writeTaskDocument({ tasks });
    return updatedTask;
  });
}
