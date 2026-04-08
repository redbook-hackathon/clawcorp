import { Button } from '@/components/ui/button';

interface TaskRelatedSessionsSectionProps {
  sessionKeys: string[];
  onOpenSession?: (sessionKey: string) => void;
}

export function TaskRelatedSessionsSection({
  sessionKeys,
  onOpenSession,
}: TaskRelatedSessionsSectionProps) {
  if (sessionKeys.length === 0) {
    return null;
  }

  return (
    <section data-testid="task-related-sessions" className="space-y-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-medium">Related Sessions</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          User-facing sessions and runtime threads linked to this task.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {sessionKeys.map((sessionKey) => (
          <Button
            key={sessionKey}
            data-testid="task-related-session-link"
            size="sm"
            variant="outline"
            className="justify-start"
            onClick={() => onOpenSession?.(sessionKey)}
          >
            {sessionKey}
          </Button>
        ))}
      </div>
    </section>
  );
}
