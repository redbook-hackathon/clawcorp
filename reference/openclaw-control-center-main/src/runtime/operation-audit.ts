import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const OPERATION_AUDIT_LOG_PATH = join(RUNTIME_DIR, "operation-audit.log");

export type OperationAuditAction =
  | "import_dry_run"
  | "backup_export"
  | "import_apply"
  | "ack_prune"
  | "task_heartbeat";
export type OperationAuditSource = "api" | "command";

export interface OperationAuditInput {
  action: OperationAuditAction;
  source: OperationAuditSource;
  ok: boolean;
  requestId?: string;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface OperationAuditEntry extends OperationAuditInput {
  timestamp: string;
}

export async function appendOperationAudit(input: OperationAuditInput): Promise<OperationAuditEntry> {
  const entry: OperationAuditEntry = {
    ...input,
    timestamp: new Date().toISOString(),
  };
  await mkdir(RUNTIME_DIR, { recursive: true });
  await appendFile(OPERATION_AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}
