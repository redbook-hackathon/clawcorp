import type { KanbanTask } from '@/types/task';

interface RuntimeTreeNode {
  id: string;
  sessionKey?: string;
  status?: string;
}

interface TaskExecutionLineageSectionProps {
  task: KanbanTask;
  runtimeTree?: {
    root?: RuntimeTreeNode;
    descendants?: RuntimeTreeNode[];
  } | null;
}

export function TaskExecutionLineageSection({
  task,
  runtimeTree,
}: TaskExecutionLineageSectionProps) {
  const rootSessionKey = task.canonicalExecution?.sessionKey ?? task.runtimeSessionKey;
  const rootSessionId = task.canonicalExecution?.sessionId ?? task.runtimeSessionId;
  const descendants = runtimeTree?.descendants ?? [];

  return (
    <section data-testid="task-lineage-section" className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Execution Lineage</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Task-owned execution root, latest internal excerpt, and runtime descendants.
        </p>
      </div>

      <div data-testid="task-lineage-root" className="rounded-lg bg-muted/40 px-3 py-3 text-sm">
        <div className="font-medium">{task.title}</div>
        {task.teamName ? (
          <div className="mt-1 text-xs text-muted-foreground">Owning team: {task.teamName}</div>
        ) : null}
        {rootSessionId ? (
          <div className="mt-1 text-xs text-muted-foreground">Runtime ID: {rootSessionId}</div>
        ) : null}
        {rootSessionKey ? (
          <div className="mt-1 break-all text-xs text-muted-foreground">{rootSessionKey}</div>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">No canonical execution thread started yet.</div>
        )}
      </div>

      {task.latestInternalExcerpt ? (
        <div className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest Internal Excerpt</div>
          <div className="mt-2 text-sm text-foreground">{task.latestInternalExcerpt.content}</div>
        </div>
      ) : null}

      {descendants.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Runtime Descendants</div>
          {descendants.map((node) => (
            <div key={node.id} data-testid="task-lineage-descendant" className="rounded-lg border border-border/70 px-3 py-2 text-sm">
              <div className="font-medium">{node.id}</div>
              {node.sessionKey ? (
                <div className="mt-1 break-all text-xs text-muted-foreground">{node.sessionKey}</div>
              ) : null}
              {node.status ? (
                <div className="mt-1 text-xs text-muted-foreground">Status: {node.status}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
