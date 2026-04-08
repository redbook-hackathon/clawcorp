import type { SnapshotDiff } from "./snapshot-store";

export function formatDiffSummary(diff: SnapshotDiff): string {
  const parts = [
    `sessions ${signed(diff.sessionsDelta)}`,
    `statuses ${signed(diff.statusesDelta)}`,
    `cronJobs ${signed(diff.cronJobsDelta)}`,
    `approvals ${signed(diff.approvalsDelta)}`,
    `projects ${signed(diff.projectsDelta)}`,
    `tasks ${signed(diff.tasksDelta)}`,
    `budgets ${signed(diff.budgetEvaluationsDelta)}`,
  ];

  return parts.join(" | ");
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}
