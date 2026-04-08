import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BudgetPolicyConfig, BudgetThresholds } from "../types";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const BUDGET_POLICY_PATH = join(RUNTIME_DIR, "budgets.json");
const DEFAULT_WARN_RATIO = 0.8;

export const DEFAULT_BUDGET_POLICY: BudgetPolicyConfig = {
  defaults: {
    warnRatio: DEFAULT_WARN_RATIO,
  },
  agent: {},
  project: {},
  task: {},
};

export interface BudgetPolicyLoadResult {
  policy: BudgetPolicyConfig;
  path: string;
  loadedFromFile: boolean;
  issues: string[];
}

export async function loadBudgetPolicy(): Promise<BudgetPolicyLoadResult> {
  try {
    const raw = await readFile(BUDGET_POLICY_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const issues: string[] = [];
    const policy = normalizePolicy(parsed, issues);

    return {
      policy,
      path: BUDGET_POLICY_PATH,
      loadedFromFile: true,
      issues,
    };
  } catch (error) {
    const issues: string[] = [];
    if (!isErrorWithCode(error, "ENOENT")) {
      issues.push(`failed to load budgets policy: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    return {
      policy: clonePolicy(DEFAULT_BUDGET_POLICY),
      path: BUDGET_POLICY_PATH,
      loadedFromFile: false,
      issues,
    };
  }
}

function normalizePolicy(input: unknown, issues: string[]): BudgetPolicyConfig {
  const obj = asObject(input);
  if (!obj) {
    issues.push("budgets policy must be a JSON object");
    return clonePolicy(DEFAULT_BUDGET_POLICY);
  }

  return {
    defaults: normalizeThresholds(obj.defaults, "defaults", issues, true),
    agent: normalizeScopeRecord(obj.agent, "agent", issues),
    project: normalizeScopeRecord(obj.project, "project", issues),
    task: normalizeScopeRecord(obj.task, "task", issues),
  };
}

function normalizeScopeRecord(
  input: unknown,
  label: string,
  issues: string[],
): Record<string, BudgetThresholds> {
  const obj = asObject(input);
  if (!obj) {
    if (input !== undefined) issues.push(`${label} must be an object`);
    return {};
  }

  const out: Record<string, BudgetThresholds> = {};
  for (const [scopeId, thresholds] of Object.entries(obj)) {
    if (!scopeId.trim()) {
      issues.push(`${label} contains empty key`);
      continue;
    }
    out[scopeId] = normalizeThresholds(thresholds, `${label}.${scopeId}`, issues, false);
  }

  return out;
}

function normalizeThresholds(
  input: unknown,
  label: string,
  issues: string[],
  includeDefaultWarnRatio: boolean,
): BudgetThresholds {
  const obj = asObject(input);
  if (!obj) {
    if (input !== undefined) issues.push(`${label} must be an object`);
    return includeDefaultWarnRatio ? { warnRatio: DEFAULT_WARN_RATIO } : {};
  }

  const tokensIn = readPositiveNumber(obj.tokensIn, `${label}.tokensIn`, issues);
  const tokensOut = readPositiveNumber(obj.tokensOut, `${label}.tokensOut`, issues);
  const totalTokens = readPositiveNumber(obj.totalTokens, `${label}.totalTokens`, issues);
  const cost = readPositiveNumber(obj.cost, `${label}.cost`, issues);
  const warnRatio = readWarnRatio(obj.warnRatio, `${label}.warnRatio`, issues);

  return {
    ...(tokensIn !== undefined ? { tokensIn } : {}),
    ...(tokensOut !== undefined ? { tokensOut } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...(warnRatio !== undefined
      ? { warnRatio }
      : includeDefaultWarnRatio
        ? { warnRatio: DEFAULT_WARN_RATIO }
        : {}),
  };
}

function readPositiveNumber(input: unknown, label: string, issues: string[]): number | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    issues.push(`${label} must be a finite number > 0`);
    return undefined;
  }
  return input;
}

function readWarnRatio(input: unknown, label: string, issues: string[]): number | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0 || input >= 1) {
    issues.push(`${label} must be a finite number > 0 and < 1`);
    return undefined;
  }
  return input;
}

function clonePolicy(policy: BudgetPolicyConfig): BudgetPolicyConfig {
  return {
    defaults: { ...policy.defaults },
    agent: { ...policy.agent },
    project: { ...policy.project },
    task: { ...policy.task },
  };
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code;
}
