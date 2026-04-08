import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { OpenClawReadonlyAdapter } from "../adapters/openclaw-readonly";
import { POLLING_INTERVALS_MS } from "../config";
import { commanderAlerts } from "./commander";
import { writeCommanderDigest } from "./commander-digest";
import { formatDiffSummary } from "./diff-summary";
import { saveSnapshot } from "./snapshot-store";
import { runTaskHeartbeat } from "./task-heartbeat";

const RUNTIME_DIR = join(process.cwd(), "runtime");
const TIMELINE_LOG = join(RUNTIME_DIR, "timeline.log");

export async function runMonitorOnce(adapter: OpenClawReadonlyAdapter): Promise<void> {
  const snapshot = await adapter.snapshot();
  const stored = await saveSnapshot(snapshot);
  const alerts = commanderAlerts(snapshot);
  const digest = await writeCommanderDigest(snapshot, alerts);
  const heartbeat = await runTaskHeartbeat();
  const heartbeatSummary = `heartbeat=${heartbeat.mode}:${heartbeat.executed}/${heartbeat.selected}`;

  await mkdir(RUNTIME_DIR, { recursive: true });
  await appendFile(
    TIMELINE_LOG,
    `${new Date().toISOString()} | ${formatDiffSummary(stored.diff)} | alerts=${alerts.length} | ${heartbeatSummary}\n`,
    "utf8",
  );

  console.log("[mission-control] monitor", {
    diffSummary: formatDiffSummary(stored.diff),
    alerts,
    heartbeat,
    timelineLog: TIMELINE_LOG,
    digestJson: digest.jsonPath,
    digestMarkdown: digest.markdownPath,
  });
}

export function monitorIntervalMs(): number {
  return POLLING_INTERVALS_MS.sessionsList;
}
