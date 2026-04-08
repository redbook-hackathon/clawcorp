import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  APPROVAL_ACTIONS_DRY_RUN,
  APPROVAL_ACTIONS_ENABLED,
  READONLY_MODE,
} from "../config";
import type { ApprovalsActionResponse } from "../contracts/openclaw-tools";
import type { ToolClient } from "../clients/tool-client";

const RUNTIME_DIR = join(process.cwd(), "runtime");
export const APPROVAL_ACTION_AUDIT_LOG_PATH = join(RUNTIME_DIR, "approval-actions.log");

export interface ApprovalRuntimeGate {
  readonlyMode: boolean;
  actionsEnabled: boolean;
  dryRun: boolean;
}

export interface ApprovalActionInput {
  action: "approve" | "reject";
  approvalId: string;
  reason?: string;
}

export interface ApprovalActionResult {
  ok: boolean;
  executed: boolean;
  mode: "blocked" | "dry_run" | "live";
  action: "approve" | "reject";
  approvalId: string;
  reason?: string;
  message: string;
  gate: ApprovalRuntimeGate;
  rawText?: string;
  auditLogPath: string;
  timestamp: string;
}

export class ApprovalActionService {
  constructor(
    private readonly client: ToolClient,
    private readonly gate: ApprovalRuntimeGate = runtimeApprovalGate(),
  ) {}

  async execute(input: ApprovalActionInput): Promise<ApprovalActionResult> {
    const approvalId = input.approvalId.trim();
    const reason = input.reason?.trim();
    const timestamp = new Date().toISOString();

    if (!approvalId) {
      return this.audit({
        ok: false,
        executed: false,
        mode: "blocked",
        action: input.action,
        approvalId: input.approvalId,
        reason,
        message: "approvalId is required.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }

    if (input.action === "reject" && !reason) {
      return this.audit({
        ok: false,
        executed: false,
        mode: "blocked",
        action: input.action,
        approvalId,
        message: "reason is required for reject action.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }

    if (!this.gate.actionsEnabled) {
      return this.audit({
        ok: false,
        executed: false,
        mode: "blocked",
        action: input.action,
        approvalId,
        reason,
        message:
          "Approval actions are disabled by runtime gate. Set APPROVAL_ACTIONS_ENABLED=true to allow execution.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }

    if (this.gate.dryRun) {
      return this.audit({
        ok: true,
        executed: false,
        mode: "dry_run",
        action: input.action,
        approvalId,
        reason,
        message: "Dry-run mode active. No approve/reject command executed.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }

    if (this.gate.readonlyMode) {
      return this.audit({
        ok: false,
        executed: false,
        mode: "blocked",
        action: input.action,
        approvalId,
        reason,
        message: "Readonly mode blocks approval actions. Set READONLY_MODE=false for live execution.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }

    try {
      const response = await this.invokeClient(input.action, { approvalId, reason });
      return this.audit({
        ok: response.ok,
        executed: true,
        mode: "live",
        action: input.action,
        approvalId,
        reason,
        message: response.ok ? "Approval action executed." : "Approval action response indicated failure.",
        gate: this.gate,
        rawText: response.rawText,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    } catch (error) {
      return this.audit({
        ok: false,
        executed: true,
        mode: "live",
        action: input.action,
        approvalId,
        reason,
        message: error instanceof Error ? error.message : "Unknown approval action error.",
        gate: this.gate,
        auditLogPath: APPROVAL_ACTION_AUDIT_LOG_PATH,
        timestamp,
      });
    }
  }

  private async invokeClient(
    action: "approve" | "reject",
    payload: { approvalId: string; reason?: string },
  ): Promise<ApprovalsActionResponse> {
    if (action === "approve") {
      return this.client.approvalsApprove({
        approvalId: payload.approvalId,
        reason: payload.reason,
      });
    }

    return this.client.approvalsReject({
      approvalId: payload.approvalId,
      reason: payload.reason ?? "",
    });
  }

  private async audit(result: ApprovalActionResult): Promise<ApprovalActionResult> {
    await mkdir(RUNTIME_DIR, { recursive: true });
    await appendFile(APPROVAL_ACTION_AUDIT_LOG_PATH, `${JSON.stringify(result)}\n`, "utf8");
    return result;
  }
}

export function runtimeApprovalGate(): ApprovalRuntimeGate {
  return {
    readonlyMode: READONLY_MODE,
    actionsEnabled: APPROVAL_ACTIONS_ENABLED,
    dryRun: APPROVAL_ACTIONS_DRY_RUN,
  };
}
