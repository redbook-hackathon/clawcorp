import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackBannerTone = 'info' | 'success' | 'warning' | 'error';

interface FeedbackBannerProps {
  bannerId: string;
  title: string;
  description?: string;
  tone?: FeedbackBannerTone;
  action?: ReactNode;
  className?: string;
  dismissLabel?: string;
}

const STORAGE_PREFIX = 'clawcorp:feedback-banner:';
const LEGACY_STORAGE_PREFIX = 'clawx:feedback-banner:';

const TONE_STYLES: Record<FeedbackBannerTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100',
};

const TONE_ICONS: Record<FeedbackBannerTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

function getDismissed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === 'dismissed';
  } catch {
    return false;
  }
}

export function FeedbackBanner({
  bannerId,
  title,
  description,
  tone = 'info',
  action,
  className,
  dismissLabel = 'Dismiss feedback',
}: FeedbackBannerProps) {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}${bannerId}`, [bannerId]);
  const legacyStorageKey = useMemo(() => `${LEGACY_STORAGE_PREFIX}${bannerId}`, [bannerId]);
  const [dismissed, setDismissed] = useState<boolean>(() => getDismissed(storageKey));
  const Icon = TONE_ICONS[tone];

  useEffect(() => {
    if (getDismissed(storageKey)) {
      setDismissed(true);
      return;
    }

    if (getDismissed(legacyStorageKey)) {
      try {
        window.localStorage.setItem(storageKey, 'dismissed');
        window.localStorage.removeItem(legacyStorageKey);
      } catch {
        // ignore migration issues
      }
      setDismissed(true);
      return;
    }

    setDismissed(false);
  }, [legacyStorageKey, storageKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(storageKey, 'dismissed');
      window.localStorage.removeItem(legacyStorageKey);
    } catch {
      // Ignore storage issues and still dismiss for current session.
    }
    setDismissed(true);
  };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        TONE_STYLES[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{title}</p>
        {description && <p className="mt-1 text-[12px] opacity-90">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={dismissLabel}
        className="rounded p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
