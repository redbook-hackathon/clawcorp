import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BudgetThresholds,
  ProjectRecord,
  ProjectState,
  ProjectStoreSnapshot,
} from "../types";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const PROJECTS_PATH = join(RUNTIME_DIR, "projects.json");
const DEFAULT_WARN_RATIO = 0.8;
const PROJECT_ID_REGEX = /^[A-Za-z0-9._:-]+$/;

export const PROJECT_STATES: ProjectState[] = ["planned", "active", "blocked", "done"];

const EMPTY_STORE: ProjectStoreSnapshot = {
  projects: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
};

export class ProjectStoreValidationError extends Error {
  readonly statusCode: number;
  readonly issues: string[];

  constructor(message: string, issues: string[] = [], statusCode = 400) {
    super(message);
    this.name = "ProjectStoreValidationError";
    this.statusCode = statusCode;
    this.issues = issues;
  }
}

export interface CreateProjectInput {
  projectId: string;
  title: string;
  status?: ProjectState;
  owner?: string;
}

export interface UpdateProjectInput {
  projectId: string;
  title?: string;
  status?: ProjectState;
  owner?: string;
}

export interface ProjectMutationResult {
  path: string;
  project: ProjectRecord;
}

export async function loadProjectStore(): Promise<ProjectStoreSnapshot> {
  try {
    const raw = await readFile(PROJECTS_PATH, "utf8");
    return normalizeProjectStore(JSON.parse(raw));
  } catch {
    return cloneEmptyStore();
  }
}

export async function saveProjectStore(next: ProjectStoreSnapshot): Promise<string> {
  const normalized = normalizeProjectStore({
    ...next,
    updatedAt: new Date().toISOString(),
  });

  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(PROJECTS_PATH, JSON.stringify(normalized, null, 2), "utf8");
  return PROJECTS_PATH;
}

export function listProjects(store: ProjectStoreSnapshot): ProjectRecord[] {
  return [...store.projects].sort((a, b) => a.projectId.localeCompare(b.projectId));
}

export async function createProject(input: unknown): Promise<ProjectMutationResult> {
  const payload = validateCreateProjectInput(input);
  const store = await loadProjectStore();

  if (store.projects.some((item) => item.projectId === payload.projectId)) {
    throw new ProjectStoreValidationError(
      `projectId '${payload.projectId}' already exists.`,
      ["projectId"],
      409,
    );
  }

  const now = new Date().toISOString();
  const project: ProjectRecord = {
    projectId: payload.projectId,
    title: payload.title,
    status: payload.status ?? "planned",
    owner: payload.owner ?? "unassigned",
    budget: normalizeThresholds(undefined),
    updatedAt: now,
  };

  store.projects.push(project);
  store.updatedAt = now;

  const path = await saveProjectStore(store);
  return { path, project };
}

export async function updateProject(input: unknown): Promise<ProjectMutationResult> {
  const payload = validateUpdateProjectInput(input);
  const store = await loadProjectStore();
  const project = store.projects.find((item) => item.projectId === payload.projectId);

  if (!project) {
    throw new ProjectStoreValidationError(`projectId '${payload.projectId}' was not found.`, [], 404);
  }

  const now = new Date().toISOString();
  if (payload.title !== undefined) project.title = payload.title;
  if (payload.status !== undefined) project.status = payload.status;
  if (payload.owner !== undefined) project.owner = payload.owner;
  project.updatedAt = now;
  store.updatedAt = now;

  const path = await saveProjectStore(store);
  return { path, project };
}

function validateCreateProjectInput(input: unknown): CreateProjectInput {
  const obj = ensureObject(input, "create project payload");
  const issues: string[] = [];

  const projectId = requiredProjectId(obj.projectId, "projectId", issues);
  const title = requiredBoundedString(obj.title, "title", 120, issues);
  const status = optionalProjectState(obj.status, "status", issues);
  const owner = optionalBoundedString(obj.owner, "owner", 80, issues);

  if (issues.length > 0) {
    throw new ProjectStoreValidationError("Invalid create project payload.", issues, 400);
  }

  return { projectId, title, status, owner };
}

function validateUpdateProjectInput(input: unknown): UpdateProjectInput {
  const obj = ensureObject(input, "update project payload");
  const issues: string[] = [];

  const projectId = requiredProjectId(obj.projectId, "projectId", issues);
  const title = optionalBoundedString(obj.title, "title", 120, issues);
  const status = optionalProjectState(obj.status, "status", issues);
  const owner = optionalBoundedString(obj.owner, "owner", 80, issues);

  if (title === undefined && status === undefined && owner === undefined) {
    issues.push("at least one updatable field is required: title, status, owner");
  }

  if (issues.length > 0) {
    throw new ProjectStoreValidationError("Invalid update project payload.", issues, 400);
  }

  return { projectId, title, status, owner };
}

function normalizeProjectStore(input: unknown): ProjectStoreSnapshot {
  const obj = asObject(input);
  if (!obj) return cloneEmptyStore();

  return {
    projects: normalizeProjects(asArray(obj.projects)),
    updatedAt: asIsoString(obj.updatedAt),
  };
}

function normalizeProjects(projects: unknown[] | undefined): ProjectRecord[] {
  if (!projects) return [];

  const unique = new Map<string, ProjectRecord>();
  for (const input of projects) {
    const project = normalizeProject(input);
    if (!project) continue;
    unique.set(project.projectId, project);
  }

  return [...unique.values()].sort((a, b) => a.projectId.localeCompare(b.projectId));
}

function normalizeProject(input: unknown): ProjectRecord | null {
  const obj = asObject(input);
  if (!obj) return null;

  const projectId = asString(obj.projectId)?.trim();
  if (!projectId || !PROJECT_ID_REGEX.test(projectId)) return null;

  return {
    projectId,
    title: asString(obj.title)?.trim() || projectId,
    status: normalizeProjectState(asString(obj.status)),
    owner: asString(obj.owner)?.trim() || "unassigned",
    budget: normalizeThresholds(asObject(obj.budget)),
    updatedAt: asIsoString(obj.updatedAt),
  };
}

function normalizeProjectState(input: string | undefined): ProjectState {
  if (input === "planned" || input === "active" || input === "blocked" || input === "done") {
    return input;
  }
  return "planned";
}

function normalizeThresholds(input: Record<string, unknown> | undefined): BudgetThresholds {
  const warnRatio = asNumber(input?.warnRatio) ?? DEFAULT_WARN_RATIO;

  return {
    tokensIn: asPositiveNumber(input?.tokensIn),
    tokensOut: asPositiveNumber(input?.tokensOut),
    totalTokens: asPositiveNumber(input?.totalTokens),
    cost: asPositiveNumber(input?.cost),
    warnRatio: warnRatio > 0 && warnRatio < 1 ? warnRatio : DEFAULT_WARN_RATIO,
  };
}

function cloneEmptyStore(): ProjectStoreSnapshot {
  return {
    projects: [],
    updatedAt: EMPTY_STORE.updatedAt,
  };
}

function ensureObject(input: unknown, label: string): Record<string, unknown> {
  const obj = asObject(input);
  if (!obj) throw new ProjectStoreValidationError(`${label} must be a JSON object.`, [], 400);
  return obj;
}

function requiredProjectId(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${field} must be a non-empty string`);
    return "";
  }

  const trimmed = value.trim();
  if (!PROJECT_ID_REGEX.test(trimmed)) {
    issues.push(`${field} may only contain letters, numbers, '.', '_', ':', '-'`);
  }
  if (trimmed.length > 100) {
    issues.push(`${field} must be <= 100 characters`);
  }
  return trimmed;
}

function requiredBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
  issues: string[],
): string {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push(`${field} must be a non-empty string`);
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    issues.push(`${field} must be <= ${maxLength} characters`);
  }
  return trimmed;
}

function optionalBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
  issues: string[],
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    issues.push(`${field} must be a string`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    issues.push(`${field} cannot be empty when provided`);
    return undefined;
  }
  if (trimmed.length > maxLength) {
    issues.push(`${field} must be <= ${maxLength} characters`);
    return undefined;
  }
  return trimmed;
}

function optionalProjectState(
  value: unknown,
  field: string,
  issues: string[],
): ProjectState | undefined {
  if (value === undefined) return undefined;
  if (value === "planned" || value === "active" || value === "blocked" || value === "done") {
    return value;
  }
  issues.push(`${field} must be one of: planned, active, blocked, done`);
  return undefined;
}

function asIsoString(v: unknown): string {
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return new Date().toISOString();
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asPositiveNumber(v: unknown): number | undefined {
  const parsed = asNumber(v);
  if (parsed === undefined || parsed <= 0) return undefined;
  return parsed;
}
