/**
 * Task type definitions for ClawCorp Kanban board
 * Phase 02: Task Board Redesign
 */

/**
 * Task status - 4 columns (backlog merged into todo per D-01)
 */
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * Work state - runtime execution status
 */
export type WorkState =
  | 'idle'
  | 'starting'
  | 'working'
  | 'blocked'
  | 'waiting_approval'
  | 'scheduled'
  | 'done'
  | 'failed';

export type TaskExecutionStatus = 'active' | 'blocked' | 'waiting_approval' | 'done' | 'failed';

export interface CanonicalTaskExecution {
  sessionId: string;
  sessionKey: string;
  status: TaskExecutionStatus;
  startedAt: string;
  updatedAt?: string;
  agentId?: string;
  parentSessionId?: string;
  rootSessionId?: string;
  parentSessionKey?: string;
  depth?: number;
  entrySessionKey?: string;
}

export interface BorrowedTaskExecution {
  teamId: string;
  sessionKey: string;
  agentIds: string[];
}

export interface TaskExecutionEvent {
  type: string;
  createdAt: string;
  status?: WorkState;
  content?: string;
  sessionKey?: string;
  actorId?: string;
}

export interface TaskLatestInternalExcerpt {
  content: string;
  createdAt: string;
  sessionKey?: string;
  role?: string;
}

export interface TaskBlockerRollup {
  state: 'blocked' | 'waiting_approval';
  summary: string;
  detail?: string;
  updatedAt?: string;
  source?: string;
}

export interface TaskApprovalRollup {
  state: 'idle' | 'waiting_leader' | 'waiting_user' | 'approved' | 'rejected';
  updatedAt?: string;
  approverId?: string;
}

/**
 * Kanban task with team metadata and runtime fields
 */
export interface KanbanTask {
  // Core fields
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeRole?: string;
  workState: WorkState;

  // Team metadata (D-13, D-14)
  teamId?: string;
  teamName?: string;
  isTeamTask: boolean;
  canonicalExecution?: CanonicalTaskExecution | null;
  borrowedExecutions?: BorrowedTaskExecution[];
  executionEvents?: TaskExecutionEvent[];
  latestInternalExcerpt?: TaskLatestInternalExcerpt;
  blocker?: TaskBlockerRollup;
  approvalState?: TaskApprovalRollup;
  relatedSessionKeys?: string[];

  // Runtime fields (preserve from existing KanbanTicket)
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
  runtimeHistory?: Array<{ role: string; content: string }>;
  runtimeTranscript?: string[];
  runtimeChildSessionIds?: string[];

  // Cron fields (preserve from existing)
  cronJobId?: string;
  cronScheduleKind?: string;
  cronBaselineJobIds?: string[];
  cronNextRunAt?: string;
  cronLastRunAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  deadline?: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeRole?: string;
  teamId?: string;
  teamName?: string;
  deadline?: string;
}

export interface StartTaskExecutionRequest {
  sessionId: string;
  sessionKey: string;
  entrySessionKey?: string;
  agentId?: string;
  startedAt?: string;
  parentSessionId?: string;
  rootSessionId?: string;
  parentSessionKey?: string;
  depth?: number;
}

export interface TaskExecutionEventInput {
  type: string;
  status?: WorkState;
  content?: string;
  sessionKey?: string;
  createdAt?: string;
  actorId?: string;
}

export interface TasksSnapshot {
  tasks: KanbanTask[];
  task?: KanbanTask;
}
