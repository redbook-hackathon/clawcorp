import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LOCAL_API_TOKEN,
  LOCAL_TOKEN_AUTH_REQUIRED,
  TASK_HEARTBEAT_DRY_RUN,
  TASK_HEARTBEAT_ENABLED,
  TASK_HEARTBEAT_MAX_TASKS_PER_RUN,
} from "../config";
import type { ProjectTask, TaskStoreSnapshot } from "../types";
import { loadTaskStore, saveTaskStore } from "./task-store";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const TASK_HEARTBEAT_LOG_PATH = join(RUNTIME_DIR, "task-heartbeat.log");
const DEFAULT_RECENT_RUN_LIMIT = 20;
const UNASSIGNED_OWNER_VALUES = new Set(["", "unassigned", "none", "n/a", "unknown", "na"]);

export interface TaskHeartbeatGate {
  enabled: boolean;
  dryRun: boolean;
  maxTasksPerRun: number;
  localTokenAuthRequired: boolean;
  localTokenConfigured: boolean;
}

export interface TaskHeartbeatSelection {
  projectId: string;
  taskId: string;
  title: string;
  owner: string;
  dueAt?: string;
  fromStatus: "todo";
  toStatus: "in_progress";
}

export interface TaskHeartbeatResult {
  ok: boolean;
  mode: "blocked" | "dry_run" | "live";
  message: string;
  evaluatedAt: string;
  gate: TaskHeartbeatGate;
  checked: number;
  eligible: number;
  selected: number;
  executed: number;
  selections: TaskHeartbeatSelection[];
  taskStorePath?: string;
  logPath: string;
}

export interface TaskHeartbeatRunsSnapshot {
  path: string;
  count: number;
  runs: TaskHeartbeatResult[];
}

export interface RunTaskHeartbeatOptions {
  gate?: TaskHeartbeatGate;
}

export function runtimeTaskHeartbeatGate(): TaskHeartbeatGate {
  return {
    enabled: TASK_HEARTBEAT_ENABLED,
    dryRun: TASK_HEARTBEAT_DRY_RUN,
    maxTasksPerRun: TASK_HEARTBEAT_MAX_TASKS_PER_RUN,
    localTokenAuthRequired: LOCAL_TOKEN_AUTH_REQUIRED,
    localTokenConfigured: LOCAL_API_TOKEN !== "",
  };
}

export function selectHeartbeatTasks(
  store: Pick<TaskStoreSnapshot, "tasks">,
  maxTasksPerRun: number,
): TaskHeartbeatSelection[] {
  const safeMax = Number.isFinite(maxTasksPerRun) && maxTasksPerRun > 0 ? Math.floor(maxTasksPerRun) : 0;
  if (safeMax === 0) return [];

  return store.tasks
    .filter((task) => task.status === "todo" && isAssignedOwner(task.owner))
    .sort(compareHeartbeatCandidateTasks)
    .slice(0, safeMax)
    .map((task) => ({
      projectId: task.projectId,
      taskId: task.taskId,
      title: task.title,
      owner: task.owner,
      dueAt: task.dueAt,
      fromStatus: "todo",
      toStatus: "in_progress",
    }));
}

export async function runTaskHeartbeat(
  options: RunTaskHeartbeatOptions = {},
): Promise<TaskHeartbeatResult> {
  const gate = options.gate ?? runtimeTaskHeartbeatGate();
  const evaluatedAt = new Date().toISOString();

  try {
    const store = await loadTaskStore();
    const selections = selectHeartbeatTasks(store, gate.maxTasksPerRun);
    const base = {
      evaluatedAt,
      gate,
      checked: store.tasks.length,
      eligible: store.tasks.filter((task) => task.status === "todo" && isAssignedOwner(task.owner)).length,
      selected: selections.length,
      selections,
      logPath: TASK_HEARTBEAT_LOG_PATH,
    };

    if (!gate.enabled) {
      return await writeHeartbeatAudit({
        ok: false,
        mode: "blocked",
        message: "Task heartbeat is disabled by runtime gate.",
        executed: 0,
        ...base,
      });
    }

    if (gate.maxTasksPerRun <= 0) {
      return await writeHeartbeatAudit({
        ok: false,
        mode: "blocked",
        message: "Task heartbeat maxTasksPerRun must be > 0.",
        executed: 0,
        ...base,
      });
    }

    if (gate.dryRun) {
      return await writeHeartbeatAudit({
        ok: true,
        mode: "dry_run",
        message:
          selections.length === 0
            ? "Heartbeat dry-run found no assigned backlog tasks."
            : `Heartbeat dry-run selected ${selections.length} assigned backlog task(s).`,
        executed: 0,
        ...base,
      });
    }

    if (gate.localTokenAuthRequired && !gate.localTokenConfigured) {
      return await writeHeartbeatAudit({
        ok: false,
        mode: "blocked",
        message: "Task heartbeat live mode requires LOCAL_API_TOKEN when local token auth gate is enabled.",
        executed: 0,
        ...base,
      });
    }

    if (selections.length === 0) {
      return await writeHeartbeatAudit({
        ok: true,
        mode: "live",
        message: "Heartbeat live run found no assigned backlog tasks.",
        executed: 0,
        ...base,
      });
    }

    const selectionKeys = new Set(selections.map((item) => taskSelectionKey(item.projectId, item.taskId)));
    const updatedAt = new Date().toISOString();
    const nextStore: TaskStoreSnapshot = {
      ...store,
      tasks: store.tasks.map((task) => {
        if (!selectionKeys.has(taskSelectionKey(task.projectId, task.taskId))) {
          return task;
        }

        return {
          ...task,
          status: "in_progress",
          updatedAt,
        };
      }),
      updatedAt,
    };

    const taskStorePath = await saveTaskStore(nextStore);

    return await writeHeartbeatAudit({
      ok: true,
      mode: "live",
      message: `Heartbeat started ${selections.length} assigned backlog task(s).`,
      executed: selections.length,
      taskStorePath,
      ...base,
    });
  } catch (error) {
    return await writeHeartbeatAudit({
      ok: false,
      mode: "blocked",
      message: error instanceof Error ? error.message : "Task heartbeat failed.",
      evaluatedAt,
      gate,
      checked: 0,
      eligible: 0,
      selected: 0,
      executed: 0,
      selections: [],
      logPath: TASK_HEARTBEAT_LOG_PATH,
    });
  }
}

export async function readTaskHeartbeatRuns(limit = DEFAULT_RECENT_RUN_LIMIT): Promise<TaskHeartbeatRunsSnapshot> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : DEFAULT_RECENT_RUN_LIMIT;

  try {
    const raw = await readFile(TASK_HEARTBEAT_LOG_PATH, "utf8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const runs: TaskHeartbeatResult[] = [];
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (runs.length >= safeLimit) break;
      try {
        const parsed = JSON.parse(lines[index]) as TaskHeartbeatResult;
        if (parsed && typeof parsed === "object" && typeof parsed.evaluatedAt === "string") {
          runs.push(parsed);
        }
      } catch {
        continue;
      }
    }

    return {
      path: TASK_HEARTBEAT_LOG_PATH,
      count: runs.length,
      runs,
    };
  } catch {
    return {
      path: TASK_HEARTBEAT_LOG_PATH,
      count: 0,
      runs: [],
    };
  }
}

async function writeHeartbeatAudit(result: TaskHeartbeatResult): Promise<TaskHeartbeatResult> {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await appendFile(TASK_HEARTBEAT_LOG_PATH, `${JSON.stringify(result)}\n`, "utf8");
  return result;
}

function compareHeartbeatCandidateTasks(a: ProjectTask, b: ProjectTask): number {
  const dueDiff = compareOptionalIsoAscending(a.dueAt, b.dueAt);
  if (dueDiff !== 0) return dueDiff;

  const updatedDiff = compareOptionalIsoAscending(a.updatedAt, b.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  const ownerDiff = a.owner.localeCompare(b.owner);
  if (ownerDiff !== 0) return ownerDiff;

  const projectDiff = a.projectId.localeCompare(b.projectId);
  if (projectDiff !== 0) return projectDiff;

  return a.taskId.localeCompare(b.taskId);
}

function compareOptionalIsoAscending(left: string | undefined, right: string | undefined): number {
  if (left && right) {
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
      return leftMs - rightMs;
    }
    return left.localeCompare(right);
  }
  if (left) return -1;
  if (right) return 1;
  return 0;
}

function isAssignedOwner(owner: string | undefined): boolean {
  if (!owner) return false;
  const normalized = owner.trim().toLowerCase();
  if (normalized === "") return false;
  return !UNASSIGNED_OWNER_VALUES.has(normalized);
}

function taskSelectionKey(projectId: string, taskId: string): string {
  return `${projectId}::${taskId}`;
}
