import { type ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FeedbackStateProps {
  state: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  align?: 'center' | 'start';
  className?: string;
  testId?: string;
}

export function FeedbackState({
  state,
  title,
  description,
  action,
  icon,
  align = 'center',
  className,
  testId,
}: FeedbackStateProps) {
  const defaultIcon = state === 'loading'
    ? <Loader2 className="h-8 w-8 animate-spin text-primary" />
    : state === 'error'
      ? <AlertCircle className="h-8 w-8 text-destructive" />
      : <Inbox className="h-8 w-8 text-muted-foreground" />;
  const isStartAligned = align === 'start';
  const role = state === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={state === 'loading' ? 'polite' : undefined}
      data-testid={testId}
      className={cn(
        'flex flex-col justify-center py-8',
        isStartAligned ? 'items-start text-left' : 'items-center text-center',
        className,
      )}
    >
      <div className="mb-3">{icon ?? defaultIcon}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
