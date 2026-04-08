import type { TaskStoreSnapshot, TasksSummary } from "../types";

export function computeTasksSummary(tasks: TaskStoreSnapshot, totalProjects?: number): TasksSummary {
  const owners = new Set<string>();
  const projectIds = new Set<string>();
  let taskCount = 0;
  let todo = 0;
  let inProgress = 0;
  let blocked = 0;
  let done = 0;
  let artifacts = 0;

  for (const task of tasks.tasks) {
    taskCount += 1;
    projectIds.add(task.projectId);
    owners.add(task.owner);
    artifacts += task.artifacts.length;

    if (task.status === "todo") todo += 1;
    if (task.status === "in_progress") inProgress += 1;
    if (task.status === "blocked") blocked += 1;
    if (task.status === "done") done += 1;
  }

  return {
    projects: typeof totalProjects === "number" ? totalProjects : projectIds.size,
    tasks: taskCount,
    todo,
    inProgress,
    blocked,
    done,
    owners: owners.size,
    artifacts,
  };
}
