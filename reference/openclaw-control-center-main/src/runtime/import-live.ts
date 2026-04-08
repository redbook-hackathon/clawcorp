import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  IMPORT_MUTATION_DRY_RUN,
  IMPORT_MUTATION_ENABLED,
  LOCAL_API_TOKEN,
  LOCAL_TOKEN_AUTH_REQUIRED,
  READONLY_MODE,
} from "../config";
import type { ImportDryRunResult, ProjectStoreSnapshot, TaskStoreSnapshot } from "../types";
import { BUDGET_POLICY_PATH } from "./budget-policy";
import { resolveExportPath, validateExportBundleDryRun } from "./import-dry-run";
import { saveProjectStore } from "./project-store";
import { saveTaskStore } from "./task-store";

export type ImportMutationMode = "blocked" | "dry_run" | "live";

export interface ImportMutationGuardInput {
  mutationEnabled: boolean;
  mutationDryRunDefault: boolean;
  readonlyMode: boolean;
  routeLabel: string;
  requestedDryRun?: boolean;
}

export interface ImportMutationGuardDecision {
  ok: boolean;
  statusCode: number;
  mode: ImportMutationMode;
  dryRun: boolean;
  message: string;
}

export interface ImportMutationGuardState {
  readonlyMode: boolean;
  localTokenAuthRequired: boolean;
  localTokenConfigured: boolean;
  mutationEnabled: boolean;
  mutationDryRunDefault: boolean;
  defaultMode: ImportMutationMode;
  defaultMessage: string;
}

export interface ImportMutationRequest {
  fileName?: string;
  bundle?: unknown;
  dryRun?: boolean;
}

export interface ImportMutationApplyResult {
  ok: boolean;
  statusCode: number;
  mode: ImportMutationMode;
  message: string;
  validation?: ImportDryRunResult;
  guard: ImportMutationGuardState;
  source?: string;
  applied?: {
    projectsPath: string;
    tasksPath: string;
    budgetsPath: string;
    projects: number;
    tasks: number;
    sessions: number;
    exceptions: number;
  };
}

export async function applyImportMutation(request: ImportMutationRequest): Promise<ImportMutationApplyResult> {
  const gate = evaluateImportMutationGuard({
    mutationEnabled: IMPORT_MUTATION_ENABLED,
    mutationDryRunDefault: IMPORT_MUTATION_DRY_RUN,
    readonlyMode: READONLY_MODE,
    routeLabel: "/api/import/live",
    requestedDryRun: request.dryRun,
  });
  const guard = readImportMutationGuardState();

  if (!gate.ok) {
    return {
      ok: false,
      statusCode: gate.statusCode,
      mode: gate.mode,
      message: gate.message,
      guard,
    };
  }

  const loaded = await resolveImportInput(request);
  if (!loaded.ok) {
    return {
      ok: false,
      statusCode: 400,
      mode: gate.mode,
      message: loaded.message,
      validation: loaded.validation,
      guard,
      source: loaded.source,
    };
  }

  if (!loaded.validation.valid) {
    return {
      ok: false,
      statusCode: 400,
      mode: gate.mode,
      message: "Import payload validation failed.",
      validation: loaded.validation,
      guard,
      source: loaded.source,
    };
  }

  if (gate.mode === "dry_run") {
    return {
      ok: true,
      statusCode: 200,
      mode: gate.mode,
      message: "Import dry-run passed; no files were mutated.",
      validation: loaded.validation,
      guard,
      source: loaded.source,
    };
  }

  const root = asObject(loaded.bundle);
  if (!root) {
    return {
      ok: false,
      statusCode: 400,
      mode: gate.mode,
      message: "Import payload must be a JSON object.",
      validation: loaded.validation,
      guard,
      source: loaded.source,
    };
  }

  const projectsRoot = asObject(root.projects);
  const tasksRoot = asObject(root.tasks);
  const budgetsRoot = asObject(root.budgets);
  const policyRoot = asObject(budgetsRoot?.policy);
  if (!projectsRoot || !tasksRoot || !policyRoot) {
    return {
      ok: false,
      statusCode: 400,
      mode: gate.mode,
      message: "Import payload is missing required projects/tasks/budgets.policy objects.",
      validation: loaded.validation,
      guard,
      source: loaded.source,
    };
  }

  const [projectsPath, tasksPath, budgetsPath] = await Promise.all([
    saveProjectStore(projectsRoot as unknown as ProjectStoreSnapshot),
    saveTaskStore(tasksRoot as unknown as TaskStoreSnapshot),
    writeBudgetPolicy(policyRoot),
  ]);

  return {
    ok: true,
    statusCode: 200,
    mode: gate.mode,
    message: "Import applied to local runtime stores.",
    validation: loaded.validation,
    guard,
    source: loaded.source,
    applied: {
      projectsPath,
      tasksPath,
      budgetsPath,
      projects: loaded.validation.summary.projects,
      tasks: loaded.validation.summary.tasks,
      sessions: loaded.validation.summary.sessions,
      exceptions: loaded.validation.summary.exceptions,
    },
  };
}

export function evaluateImportMutationGuard(input: ImportMutationGuardInput): ImportMutationGuardDecision {
  const effectiveDryRun = input.requestedDryRun ?? input.mutationDryRunDefault;

  if (!input.mutationEnabled) {
    return {
      ok: false,
      statusCode: 403,
      mode: "blocked",
      dryRun: effectiveDryRun,
      message: `${input.routeLabel} is disabled. Set IMPORT_MUTATION_ENABLED=true to allow live import mutation endpoint usage.`,
    };
  }

  if (input.readonlyMode && !effectiveDryRun) {
    return {
      ok: false,
      statusCode: 403,
      mode: "blocked",
      dryRun: effectiveDryRun,
      message:
        `${input.routeLabel} is blocked by readonly mode. Set READONLY_MODE=false or send {\"dryRun\":true} for non-mutating validation mode.`,
    };
  }

  return {
    ok: true,
    statusCode: 200,
    mode: effectiveDryRun ? "dry_run" : "live",
    dryRun: effectiveDryRun,
    message: effectiveDryRun
      ? "Import mutation request accepted in dry-run mode."
      : "Import mutation request accepted in live mode.",
  };
}

export function readImportMutationGuardState(): ImportMutationGuardState {
  const decision = evaluateImportMutationGuard({
    mutationEnabled: IMPORT_MUTATION_ENABLED,
    mutationDryRunDefault: IMPORT_MUTATION_DRY_RUN,
    readonlyMode: READONLY_MODE,
    routeLabel: "/api/import/live",
  });

  return {
    readonlyMode: READONLY_MODE,
    localTokenAuthRequired: LOCAL_TOKEN_AUTH_REQUIRED,
    localTokenConfigured: LOCAL_API_TOKEN !== "",
    mutationEnabled: IMPORT_MUTATION_ENABLED,
    mutationDryRunDefault: IMPORT_MUTATION_DRY_RUN,
    defaultMode: decision.mode,
    defaultMessage: decision.message,
  };
}

async function resolveImportInput(
  request: ImportMutationRequest,
): Promise<
  | {
      ok: true;
      source: string;
      bundle: unknown;
      validation: ImportDryRunResult;
      message: string;
    }
  | {
      ok: false;
      source: string;
      bundle: undefined;
      validation: ImportDryRunResult;
      message: string;
    }
> {
  if (typeof request.fileName === "string" && request.fileName.trim() !== "") {
    let sourcePath = "";
    let source = `file:${request.fileName.trim()}`;
    try {
      sourcePath = resolveExportPath(request.fileName);
      source = `file:${sourcePath}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resolve import file.";
      return {
        ok: false,
        source,
        bundle: undefined,
        validation: {
          validatedAt: new Date().toISOString(),
          source,
          valid: false,
          issues: [message],
          warnings: [],
          summary: {
            sessions: 0,
            projects: 0,
            tasks: 0,
            exceptions: 0,
          },
        },
        message,
      };
    }

    try {
      const raw = await readFile(sourcePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const validation = validateExportBundleDryRun(parsed, source);
      if (!validation.valid) {
        return {
          ok: false,
          source,
          bundle: undefined,
          validation,
          message: "Import payload validation failed.",
        };
      }
      return {
        ok: true,
        source,
        bundle: parsed,
        validation,
        message: "Import payload loaded from file.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read import file.";
      return {
        ok: false,
        source,
        bundle: undefined,
        validation: {
          validatedAt: new Date().toISOString(),
          source,
          valid: false,
          issues: [message],
          warnings: [],
          summary: {
            sessions: 0,
            projects: 0,
            tasks: 0,
            exceptions: 0,
          },
        },
        message,
      };
    }
  }

  const source = request.bundle !== undefined ? "payload.bundle" : "payload";
  const bundle = request.bundle !== undefined ? request.bundle : (request as unknown);
  const validation = validateExportBundleDryRun(bundle, source);
  if (!validation.valid) {
    return {
      ok: false,
      source,
      bundle: undefined,
      validation,
      message: "Import payload validation failed.",
    };
  }

  return {
    ok: true,
    source,
    bundle,
    validation,
    message: "Import payload loaded.",
  };
}

export async function resolveImportInputForSmoke(
  request: ImportMutationRequest,
): ReturnType<typeof resolveImportInput> {
  return resolveImportInput(request);
}

async function writeBudgetPolicy(policy: Record<string, unknown>): Promise<string> {
  await mkdir(dirname(BUDGET_POLICY_PATH), { recursive: true });
  await writeFile(BUDGET_POLICY_PATH, `${JSON.stringify(policy, null, 2)}\n`, "utf8");
  return BUDGET_POLICY_PATH;
}

function asObject(input: unknown): Record<string, unknown> | undefined {
  return input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;
}
