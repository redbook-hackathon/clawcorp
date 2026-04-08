import type {
  ProjectStoreSnapshot,
  ProjectSummary,
  TaskStoreSnapshot,
} from "../types";

export function computeProjectSummaries(
  projectStore: ProjectStoreSnapshot,
  taskStore: TaskStoreSnapshot,
): ProjectSummary[] {
  const nowMs = Date.now();
  const tasksByProject = new Map<string, TaskStoreSnapshot["tasks"]>();

  for (const task of taskStore.tasks) {
    const list = tasksByProject.get(task.projectId);
    if (list) {
      list.push(task);
    } else {
      tasksByProject.set(task.projectId, [task]);
    }
  }

  return projectStore.projects
    .map((project) => {
      const tasks = tasksByProject.get(project.projectId) ?? [];
      let todo = 0;
      let inProgress = 0;
      let blocked = 0;
      let done = 0;
      let due = 0;

      for (const task of tasks) {
        if (task.status === "todo") todo += 1;
        if (task.status === "in_progress") inProgress += 1;
        if (task.status === "blocked") blocked += 1;
        if (task.status === "done") done += 1;
        if (task.dueAt && task.status !== "done" && Date.parse(task.dueAt) <= nowMs) {
          due += 1;
        }
      }

      return {
        projectId: project.projectId,
        title: project.title,
        status: project.status,
        owner: project.owner,
        totalTasks: tasks.length,
        todo,
        inProgress,
        blocked,
        done,
        due,
        updatedAt: project.updatedAt,
      };
    })
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
}
