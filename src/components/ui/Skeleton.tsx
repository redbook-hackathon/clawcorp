/**
 * Skeleton Loader Components
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  animated?: boolean;
}

/** Single-line skeleton */
export function Skeleton({ className, animated = true }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton-base rounded-md bg-[#e5e5ea] dark:bg-[#3a3a3c]',
        animated && 'skeleton-motion',
        className,
      )}
    />
  );
}

/** Multiple lines of text skeleton */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-2xl border border-black/[0.06] bg-white p-5 dark:border-white/[0.06] dark:bg-[#1c1c1e]', className)}
    >
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Structured activity-log style skeleton list */
export function SkeletonActivityFeed({
  rows = 4,
  className,
  testId,
}: {
  rows?: number;
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} aria-hidden="true" className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`activity-skeleton-${index}`}
          className="rounded-xl border border-[#f2f2f7] bg-white p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
