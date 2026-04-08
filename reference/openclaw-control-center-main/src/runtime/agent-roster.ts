import { join } from "node:path";
import { readdir } from "node:fs/promises";
import {
  loadCurrentAgentCatalog,
  resolveOpenClawConfigPath,
  resolveOpenClawHomePath,
} from "./current-agent-catalog";

export type AgentRosterStatus = "connected" | "partial" | "not_connected";

export interface AgentRosterEntry {
  agentId: string;
  displayName: string;
}

export interface AgentRosterSnapshot {
  status: AgentRosterStatus;
  sourcePath: string;
  detail: string;
  entries: AgentRosterEntry[];
}

export async function loadBestEffortAgentRoster(): Promise<AgentRosterSnapshot> {
  const homePath = resolveOpenClawHomePath();
  const sourcePath = resolveOpenClawConfigPath();
  const runtimeAgentsPath = join(homePath, "agents");
  const fromConfig = await loadCurrentAgentCatalog();
  if (fromConfig.entries.length > 0) {
    return {
      status: "connected",
      sourcePath,
      detail: `${fromConfig.detail} openclaw.json is treated as the current-project source of truth; runtime folders are ignored for roster discovery.`,
      entries: fromConfig.entries.map((entry) => ({
        agentId: entry.agentId,
        displayName: entry.displayName,
      })),
    };
  }

  const fromRuntime = await loadRosterFromRuntimeDirs(runtimeAgentsPath);
  const status = resolveMergedStatus(fromConfig.status, fromRuntime.status, fromRuntime.entries.length);
  const detail = `Config: ${fromConfig.detail} Runtime: ${fromRuntime.detail} Using runtime fallback: ${fromRuntime.entries.length} agent(s).`;

  return {
    status,
    sourcePath,
    detail,
    entries: fromRuntime.entries,
  };
}

async function loadRosterFromRuntimeDirs(runtimeAgentsPath: string): Promise<{
  status: AgentRosterStatus;
  detail: string;
  entries: AgentRosterEntry[];
}> {
  try {
    const dirEntries = await readdir(runtimeAgentsPath, { withFileTypes: true });
    const entries = dirEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        agentId: entry.name,
        displayName: entry.name,
      }));

    if (entries.length === 0) {
      return {
        status: "partial",
        detail: "runtime agents directory found but empty.",
        entries: [],
      };
    }

    return {
      status: "connected",
      detail: `loaded ${entries.length} agent folder(s) from runtime.`,
      entries,
    };
  } catch (error) {
    if (isFsNotFound(error)) {
      return {
        status: "not_connected",
        detail: "runtime agents directory not found.",
        entries: [],
      };
    }
    return {
      status: "partial",
      detail: "runtime agents directory exists but could not be read.",
      entries: [],
    };
  }
}

function resolveMergedStatus(
  configStatus: AgentRosterStatus,
  runtimeStatus: AgentRosterStatus,
  totalEntries: number,
): AgentRosterStatus {
  if (totalEntries === 0) {
    return configStatus === "not_connected" && runtimeStatus === "not_connected"
      ? "not_connected"
      : "partial";
  }
  if (configStatus === "partial" || runtimeStatus === "partial") return "partial";
  return "connected";
}

function isFsNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      (error as { code: string }).code === "ENOENT",
  );
}
