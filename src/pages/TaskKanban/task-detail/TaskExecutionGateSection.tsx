import { Button } from '@/components/ui/button';
import type { KanbanTask } from '@/types/task';

interface TaskApprovalLike {
  id: string;
  prompt?: string;
  command?: string;
}

interface TaskExecutionGateSectionProps {
  task: KanbanTask;
  approvals?: TaskApprovalLike[];
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}

export function TaskExecutionGateSection({
  task,
  approvals = [],
  onApprove,
  onReject,
}: TaskExecutionGateSectionProps) {
  const gateSummary = task.blocker?.summary
    ?? (task.approvalState?.state === 'waiting_leader' ? 'Waiting on leader approval' : null);

  if (!gateSummary && approvals.length === 0) {
    return null;
  }

  const primaryApproval = approvals[0];

  return (
    <section data-testid="task-gate-section" className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Execution Gate</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Blockers and approvals stay here instead of leaking into summary surfaces.
        </p>
      </div>

      {gateSummary ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          {gateSummary}
        </div>
      ) : null}

      {primaryApproval ? (
        <div className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm">
          <div className="font-medium">{primaryApproval.command ?? primaryApproval.prompt ?? primaryApproval.id}</div>
          <div className="mt-3 flex gap-2">
            <Button data-testid="task-approve-action" size="sm" onClick={() => onApprove?.(primaryApproval.id)}>
              Approve
            </Button>
            <Button
              data-testid="task-reject-action"
              size="sm"
              variant="outline"
              onClick={() => onReject?.(primaryApproval.id)}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
