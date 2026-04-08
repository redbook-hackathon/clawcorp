import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExportBundle, ReadModelSnapshot } from "../types";
import { loadBudgetPolicy } from "./budget-policy";
import { commanderExceptions, commanderExceptionsFeed } from "./commander";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const EXPORTS_DIR = join(RUNTIME_DIR, "exports");

export interface ExportBundleWriteResult {
  fileName: string;
  path: string;
  sizeBytes: number;
}

export async function buildExportBundle(
  snapshot: ReadModelSnapshot,
  source: "api" | "command",
  requestId?: string,
): Promise<ExportBundle> {
  const budgetPolicy = await loadBudgetPolicy();

  return {
    ok: true,
    schemaVersion: "phase-9",
    source,
    requestId,
    exportedAt: new Date().toISOString(),
    snapshotGeneratedAt: snapshot.generatedAt,
    sessions: snapshot.sessions,
    projects: snapshot.projects,
    tasks: snapshot.tasks,
    budgets: {
      policy: budgetPolicy.policy,
      issues: budgetPolicy.issues,
      summary: snapshot.budgetSummary,
    },
    exceptions: commanderExceptions(snapshot),
    exceptionsFeed: commanderExceptionsFeed(snapshot),
  };
}

export async function writeExportBundle(
  bundle: ExportBundle,
  label: string,
): Promise<ExportBundleWriteResult> {
  await mkdir(EXPORTS_DIR, { recursive: true });
  const stamp = compactIsoStamp(bundle.exportedAt);
  const safeLabel = sanitizeSegment(label, "export");
  const safeRequest = sanitizeSegment(bundle.requestId, "req");
  const fileName = `${stamp}-${safeLabel}-${safeRequest}.json`;
  const path = join(EXPORTS_DIR, fileName);
  const body = `${JSON.stringify(bundle, null, 2)}\n`;
  await writeFile(path, body, "utf8");
  return {
    fileName,
    path,
    sizeBytes: Buffer.byteLength(body, "utf8"),
  };
}

function sanitizeSegment(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return sanitized || fallback;
}

function compactIsoStamp(iso: string): string {
  const parsed = Date.parse(iso);
  const value = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
}
