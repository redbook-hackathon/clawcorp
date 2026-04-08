/**
 * Cron Page — Frame 06
 * 定时任务 / Cron 总览：自动化执行调度
 */
import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useCronStore } from '@/stores/cron';
import type { CronJob } from '@/types/cron';

/* ─── Helpers ─── */

function formatSchedule(schedule: CronJob['schedule'], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (typeof schedule === 'string') return schedule;
  if (schedule.kind === 'cron') return schedule.expr;
  if (schedule.kind === 'every') {
    const ms = schedule.everyMs;
    if (ms < 60_000) return t('schedule.everySeconds', { count: ms / 1000 });
    if (ms < 3_600_000) return t('schedule.everyMinutes', { count: ms / 60_000 });
    if (ms < 86_400_000) return t('schedule.everyHours', { count: ms / 3_600_000 });
    return t('schedule.everyDays', { count: ms / 86_400_000 });
  }
  if (schedule.kind === 'at') return t('schedule.onceAt', { time: schedule.at });
  return t('common.unknown');
}

function resolveDateLocale(language?: string): string {
  return language?.startsWith('zh') ? 'zh-CN' : 'en-US';
}

function formatTime(iso: string | undefined, language: string | undefined, fallback = '—'): string {
  if (!iso) return fallback;
  try {
    return new Date(iso).toLocaleString(resolveDateLocale(language), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDelivery(job: CronJob, chatOnlyLabel = 'Chat only'): string {
  const delivery = job.delivery;
  if (!delivery || delivery.mode === 'none') return chatOnlyLabel;
  if (delivery.channel) {
    return delivery.to
      ? `${delivery.channel} → ${delivery.to}`
      : delivery.channel;
  }
  return delivery.mode;
}

function formatSessionTarget(sessionTarget?: string, defaultLabel = 'default'): string {
  if (!sessionTarget) return defaultLabel;
  return sessionTarget;
}

/* ─── Schedule helpers ─── */

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
// ISO weekday: 1=Mon – 7=Sun; cron dow: 0=Sun, 1=Mon – 6=Sat, 7=Sun

/** Parse cron DOW field → set of ISO weekdays (1-7) */
function parseCronDow(expr: string): Set<number> {
  const all = new Set([1, 2, 3, 4, 5, 6, 7]);
  if (!expr || expr === '*' || expr === '?') return all;
  const result = new Set<number>();
  for (const part of expr.split(',')) {
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      for (let d = lo; d <= hi; d++) result.add(d === 0 || d === 7 ? 7 : d);
    } else if (part === '*') {
      return all;
    } else {
      const n = Number(part);
      result.add(n === 0 ? 7 : n);
    }
  }
  return result;
}

/** Which ISO weekdays (1-7) does this job run on? */
function jobWeekdays(job: CronJob): Set<number> {
  const sched = job.schedule;
  if (typeof sched === 'string') {
    const parts = sched.trim().split(/\s+/);
    if (parts.length >= 5) return parseCronDow(parts[4]);
    return new Set([1, 2, 3, 4, 5, 6, 7]);
  }
  if (sched.kind === 'cron') {
    const parts = sched.expr.trim().split(/\s+/);
    if (parts.length >= 5) return parseCronDow(parts[4]);
  }
  // 'every' and 'at' schedules run every day
  return new Set([1, 2, 3, 4, 5, 6, 7]);
}

/** Extract hour from cron expression (or return undefined) */
function jobHour(job: CronJob): number | undefined {
  const sched = job.schedule;
  const expr = typeof sched === 'string' ? sched : sched.kind === 'cron' ? sched.expr : null;
  if (!expr) return undefined;
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 2) return undefined;
  const h = Number(parts[1]);
  return Number.isFinite(h) ? h : undefined;
}

const JOB_COLORS = [
  { color: '#3b82f6', bg: '#eff6ff' },
  { color: '#f97316', bg: '#fff7ed' },
  { color: '#10b981', bg: '#f0fdf4' },
  { color: '#8b5cf6', bg: '#f5f3ff' },
  { color: '#ec4899', bg: '#fdf2f8' },
  { color: '#f59e0b', bg: '#fffbeb' },
];

const TAB_KEYS = ['overview', 'schedule', 'pipelines'] as const;
type TabKey = (typeof TAB_KEYS)[number];
type StatusFilter = 'all' | 'failed' | 'enabled';

function resolveDeepLinkedTab(raw: string | null): TabKey | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized === 'overview') return 'overview';
  if (normalized === 'schedule') return 'schedule';
  if (normalized === 'pipelines') return 'pipelines';
  return null;
}

/* ─── Main component ─── */

export function Cron() {
  const { t, i18n } = useTranslation('cron');
  const resolvedLanguage = i18n?.resolvedLanguage;
  const deepLinkParams = new URLSearchParams(window.location.search);
  const deepLinkedJobId = deepLinkParams.get('jobId');
  const initialTab = resolveDeepLinkedTab(deepLinkParams.get('tab'));
  const [activeTab, setActiveTab] = useState<TabKey>(deepLinkedJobId ? 'pipelines' : initialTab ?? 'overview');
  const [expandedPipelineJobId, setExpandedPipelineJobId] = useState<string | null>(deepLinkedJobId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [createName, setCreateName] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [createSchedule, setCreateSchedule] = useState('0 7 * * *');
  const [createDeliveryMode, setCreateDeliveryMode] = useState('none');
  const [createDeliveryChannel, setCreateDeliveryChannel] = useState('');
  const [createDeliveryTo, setCreateDeliveryTo] = useState('');
  const [createFailureAlertAfter, setCreateFailureAlertAfter] = useState('3');
  const [createFailureAlertCooldownSeconds, setCreateFailureAlertCooldownSeconds] = useState('600');
  const [createFailureAlertChannel, setCreateFailureAlertChannel] = useState('ops-alerts');
  const [createDeliveryBestEffort, setCreateDeliveryBestEffort] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const { jobs, loading, error, fetchJobs, createJob, updateJob, deleteJob, toggleJob, triggerJob } = useCronStore();

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  const resetWizard = () => {
    setCreateName('');
    setCreateMessage('');
    setCreateSchedule('0 7 * * *');
    setCreateDeliveryMode('none');
    setCreateDeliveryChannel('');
    setCreateDeliveryTo('');
    setCreateFailureAlertAfter('3');
    setCreateFailureAlertCooldownSeconds('600');
    setCreateFailureAlertChannel('ops-alerts');
    setCreateDeliveryBestEffort(false);
    setEditingJob(null);
  };

  const openCreateWizard = () => {
    resetWizard();
    setCreateOpen(true);
  };

  const openEditWizard = (job: CronJob) => {
    setEditingJob(job);
    setCreateName(job.name);
    setCreateMessage(job.message);
    setCreateSchedule(typeof job.schedule === 'string' ? job.schedule : formatSchedule(job.schedule, t));
    setCreateDeliveryMode(job.delivery?.mode ?? 'none');
    setCreateDeliveryChannel(job.delivery?.channel ?? '');
    setCreateDeliveryTo(job.delivery?.to ?? '');
    setCreateFailureAlertAfter(String(job.failureAlertAfter ?? 3));
    setCreateFailureAlertCooldownSeconds(String(job.failureAlertCooldownSeconds ?? 600));
    setCreateFailureAlertChannel(job.failureAlertChannel ?? 'ops-alerts');
    setCreateDeliveryBestEffort(job.deliveryBestEffort ?? false);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createMessage.trim()) return;
    setCreateLoading(true);
    try {
      const payload = {
        name: createName.trim(),
        message: createMessage.trim(),
        schedule: createSchedule.trim(),
        enabled: true,
        delivery: {
          mode: createDeliveryMode,
          ...(createDeliveryChannel.trim() ? { channel: createDeliveryChannel.trim() } : {}),
          ...(createDeliveryTo.trim() ? { to: createDeliveryTo.trim() } : {}),
        },
        failureAlertAfter: Number(createFailureAlertAfter) || undefined,
        failureAlertCooldownSeconds: Number(createFailureAlertCooldownSeconds) || undefined,
        failureAlertChannel: createFailureAlertChannel.trim() || undefined,
        deliveryBestEffort: createDeliveryBestEffort,
      };

      if (editingJob) {
        await updateJob(editingJob.id, payload);
      } else {
        await createJob(payload);
      }
      setCreateOpen(false);
      resetWizard();
    } finally {
      setCreateLoading(false);
    }
  };

  const enabledCount = jobs.filter((j) => j.enabled).length;
  const latestUpdatedAt = jobs.reduce<string | null>((latest, job) => {
    if (!latest) return job.updatedAt;
    return new Date(job.updatedAt).getTime() > new Date(latest).getTime() ? job.updatedAt : latest;
  }, null);
  const hasJobErrors = jobs.some((job) => job.lastRun?.error);

  useEffect(() => {
    if (!deepLinkedJobId) return;
    if (!jobs.some((job) => job.id === deepLinkedJobId)) return;
    setActiveTab('pipelines');
    setExpandedPipelineJobId(deepLinkedJobId);
  }, [deepLinkedJobId, jobs]);

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7] p-6">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between px-8 pb-1 pt-8">
          <div>
            <h1 className="text-[26px] font-semibold text-[#000000]">{t('header.title')}</h1>
            <p className="mt-1 text-[13px] text-[#8e8e93]">
              {loading
                ? t('header.loading')
                : error
                  ? t('header.error')
                  : t('header.summary', { total: jobs.length, enabled: enabledCount })}
            </p>
            {!loading && !error && latestUpdatedAt && (
              <p className="mt-1 text-[12px] text-[#8e8e93]">
                {t('header.lastUpdated', { time: formatTime(latestUpdatedAt, resolvedLanguage, t('common.unknown')) })}
              </p>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchJobs()}
              className="text-[13px] text-[#8e8e93] transition-colors hover:text-[#3c3c43]"
            >
              ↻ {t('actions.refresh')}
            </button>
            <button
              type="button"
              onClick={openCreateWizard}
              className="rounded-lg bg-clawx-ac px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#0056b3]"
            >
              + {t('actions.newTask')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-0 border-b border-black/[0.06] px-8 pt-4">
          {TAB_KEYS.map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={cn(
                'relative mr-6 pb-3 text-[14px] font-medium transition-colors',
                activeTab === tabKey ? 'text-[#10b981]' : 'text-[#8e8e93] hover:text-[#3c3c43]',
              )}
            >
              {t(`tabs.${tabKey}`)}
              {activeTab === tabKey && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#10b981]" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <>
            <div className="border-b border-black/[0.06] px-8 py-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn('rounded-full px-3 py-1 text-[12px] font-medium transition-colors', statusFilter === 'all' ? 'bg-[#10b981] text-white' : 'bg-[#f2f2f7] text-[#3c3c43] hover:bg-[#e5e7eb]')}
                >
                  {t('filters.all')}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('failed')}
                  className={cn('rounded-full px-3 py-1 text-[12px] font-medium transition-colors', statusFilter === 'failed' ? 'bg-[#ef4444] text-white' : 'bg-[#fef2f2] text-[#ef4444] hover:bg-[#fee2e2]')}
                >
                  {t('filters.failed')}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('enabled')}
                  className={cn('rounded-full px-3 py-1 text-[12px] font-medium transition-colors', statusFilter === 'enabled' ? 'bg-[#3b82f6] text-white' : 'bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#dbeafe]')}
                >
                  {t('filters.enabled')}
                </button>
              </div>
              {hasJobErrors && (
                <div className="rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
                  {t('status.deliveryIssue')}
                </div>
              )}
            </div>
            <OverviewTab
              jobs={jobs}
              statusFilter={statusFilter}
              loading={loading}
              error={error}
              onToggle={(id, enabled) => void toggleJob(id, enabled)}
              onTrigger={(id) => void triggerJob(id)}
              onDelete={(id) => void deleteJob(id)}
              onEdit={openEditWizard}
            />
          </>
        )}

        {activeTab === 'schedule' && <ScheduleTab jobs={jobs} />}

        {activeTab === 'pipelines' && (
          <PipelinesTab
            jobs={jobs}
            loading={loading}
            expandedJobId={expandedPipelineJobId}
            onExpandedJobChange={setExpandedPipelineJobId}
            onTrigger={(id) => void triggerJob(id)}
            onEdit={openEditWizard}
          />
        )}
      </div>

      {/* Create modal */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-[400px] rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-[16px] font-semibold text-[#000000]">{editingJob ? t('dialog.editTitle') : t('dialog.createTitle')}</h2>
              <div className="mb-4 rounded-xl border border-black/[0.06] bg-[#f8fafc] px-4 py-3">
                <p className="text-[12px] font-medium text-[#6b7280]">{t('dialog.pipelineWizardLabel')}</p>
                <p className="mt-1 text-[13px] text-[#334155]">{t('dialog.pipelineSummary')}</p>
              </div>
              <div className="mb-3">
                <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.taskName')}</p>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t('dialog.taskNamePlaceholder')} className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac" />
              </div>
              <div className="mb-3">
                <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.message')}</p>
                <textarea value={createMessage} onChange={(e) => setCreateMessage(e.target.value)} placeholder={t('dialog.messagePlaceholder')} rows={3} className="w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac" />
              </div>
              <div className="mb-5">
                <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.schedule')}</p>
                <input value={createSchedule} onChange={(e) => setCreateSchedule(e.target.value)} placeholder="0 7 * * *" className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-[13px] outline-none focus:border-clawx-ac" />
                <p className="mt-1 text-[11px] text-[#8e8e93]">{t('dialog.cronHelp')}</p>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.deliveryMode')}</p>
                  <select
                    aria-label={t('dialog.deliveryModeAria')}
                    value={createDeliveryMode}
                    onChange={(e) => setCreateDeliveryMode(e.target.value)}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                  >
                    <option value="none">{t('dialog.deliveryModes.none')}</option>
                    <option value="announce">{t('dialog.deliveryModes.announce')}</option>
                  </select>
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.deliveryChannel')}</p>
                  <input
                    value={createDeliveryChannel}
                    onChange={(e) => setCreateDeliveryChannel(e.target.value)}
                  placeholder="feishu"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                />
              </label>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.deliveryTarget')}</p>
                  <input
                    value={createDeliveryTo}
                    onChange={(e) => setCreateDeliveryTo(e.target.value)}
                  placeholder="release-room"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                />
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.failureAlertAfter')}</p>
                  <input
                    value={createFailureAlertAfter}
                    onChange={(e) => setCreateFailureAlertAfter(e.target.value)}
                  placeholder="3"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                />
              </label>
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3">
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.failureAlertCooldown')}</p>
                  <input
                    value={createFailureAlertCooldownSeconds}
                    onChange={(e) => setCreateFailureAlertCooldownSeconds(e.target.value)}
                  placeholder="600"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                />
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{t('dialog.failureAlertChannel')}</p>
                  <input
                    value={createFailureAlertChannel}
                    onChange={(e) => setCreateFailureAlertChannel(e.target.value)}
                  placeholder="ops-alerts"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-clawx-ac"
                />
              </label>
            </div>
              <label className="mb-5 flex items-center gap-2 text-[13px] text-[#3c3c43]">
                <input
                  aria-label={t('dialog.bestEffortAria')}
                  type="checkbox"
                  checked={createDeliveryBestEffort}
                  onChange={(e) => setCreateDeliveryBestEffort(e.target.checked)}
                />
                {t('dialog.bestEffort')}
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setCreateOpen(false); resetWizard(); }} className="flex-1 rounded-xl border border-black/10 py-2 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]">{t('dialog.cancel')}</button>
                <button type="button" onClick={() => void handleCreate()} disabled={createLoading || !createName.trim() || !createMessage.trim()} className="flex-1 rounded-xl bg-clawx-ac py-2 text-[13px] font-medium text-white hover:bg-[#0056b3] disabled:opacity-50">
                  {createLoading ? (editingJob ? t('dialog.savingChanges') : t('dialog.creating')) : (editingJob ? t('dialog.saveChanges') : t('dialog.confirmCreate'))}
                </button>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

/* ─── Overview Tab ─── */

function OverviewTab({
  jobs, statusFilter, loading, error, onToggle, onTrigger, onDelete, onEdit,
}: {
  jobs: CronJob[];
  statusFilter: StatusFilter;
  loading: boolean;
  error: string | null;
  onToggle: (id: string, enabled: boolean) => void;
  onTrigger: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (job: CronJob) => void;
}) {
  const { t, i18n } = useTranslation('cron');
  const resolvedLanguage = i18n?.resolvedLanguage;
  if (loading) return <div className="flex flex-1 items-center justify-center text-[14px] text-[#8e8e93]">{t('common.loading')}</div>;
  if (error) return <div className="flex flex-1 items-center justify-center text-[14px] text-[#ef4444]">{error}</div>;
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === 'failed') return Boolean(job.lastRun && !job.lastRun.success);
    if (statusFilter === 'enabled') return job.enabled;
    return true;
  });
  if (filteredJobs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="text-[40px]">⏰</span>
        <p className="text-[14px] text-[#8e8e93]">
          {statusFilter === 'all' ? t('overview.empty.title') : t('overview.empty.filteredTitle')}
        </p>
        <p className="text-[12px] text-[#c6c6c8]">{t('overview.empty.description')}</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-8 py-4">
      <div className="flex flex-col gap-3">
        {filteredJobs.map((job) => (
          <div key={job.id} className="flex items-center gap-4 rounded-xl border border-black/[0.06] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', job.enabled ? 'bg-[#10b981]' : 'bg-[#d1d5db]')} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-semibold text-[#000000]">{job.name}</p>
                {job.lastRun && (
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', job.lastRun.success ? 'bg-[#dcfce7] text-[#059669]' : 'bg-[#fee2e2] text-[#ef4444]')}>
                    {job.lastRun.success ? t('overview.badges.success') : t('overview.badges.failed')}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-[#8e8e93]">{job.message}</p>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-[#c6c6c8]">
                <span>⏱ {formatSchedule(job.schedule, t)}</span>
                {job.nextRun && (
                  <span>
                    {t('overview.timestamps.next')}: {formatTime(job.nextRun, resolvedLanguage, t('common.unknown'))}
                  </span>
                )}
                {job.lastRun && (
                  <span>
                    {t('overview.timestamps.last')}: {formatTime(job.lastRun.time, resolvedLanguage, t('common.unknown'))}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#8e8e93]">
                <span>
                  <span className="text-[#c6c6c8]">{t('overview.labels.delivery')}</span>
                  <span>{formatDelivery(job, t('overview.labels.chatOnly'))}</span>
                </span>
                <span>
                  <span className="text-[#c6c6c8]">{t('overview.labels.sessionTarget')}</span>
                  <span>{formatSessionTarget(job.sessionTarget, t('overview.labels.sessionTargetDefault'))}</span>
                </span>
                {typeof job.failureAlertAfter === 'number' && (
                  <span>{t('overview.labels.alertAfter', { count: job.failureAlertAfter })}</span>
                )}
              </div>
              {job.lastRun?.error ? (
                <p className="mt-1 truncate text-[11px] text-[#ef4444]">{job.lastRun.error}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => onTrigger(job.id)} className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]">
                ▶ {t('overview.actions.run')}
              </button>
              <button type="button" onClick={() => onEdit(job)} className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]">
                {t('overview.actions.edit')}
              </button>
              <button
                type="button"
                onClick={() => onToggle(job.id, !job.enabled)}
                className={cn('rounded-md border px-2.5 py-1 text-[12px] transition-colors', job.enabled ? 'border-[#f59e0b]/30 text-[#b45309] hover:bg-[#fef9c3]' : 'border-[#10b981]/30 text-[#059669] hover:bg-[#dcfce7]')}
              >
                {job.enabled ? t('overview.actions.pause') : t('overview.actions.resume')}
              </button>
              <button type="button" onClick={() => onDelete(job.id)} className="rounded-md border border-[#ef4444]/20 px-2.5 py-1 text-[12px] text-[#ef4444] hover:bg-[#fef2f2]">
                {t('overview.actions.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Schedule Tab ─── */

function ScheduleTab({ jobs }: { jobs: CronJob[] }) {
  const { t, i18n } = useTranslation('cron');
  const resolvedLanguage = i18n?.resolvedLanguage;
  const upcoming = jobs
    .filter((j) => j.enabled && j.nextRun)
    .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime())
    .slice(0, 10);

  // Build per-day job lists (ISO weekday 1=Mon … 7=Sun → index 0-6)
  const dayJobs: CronJob[][] = Array.from({ length: 7 }, () => []);
  for (const job of jobs) {
    const days = jobWeekdays(job);
    for (const d of days) {
      dayJobs[d - 1].push(job);
    }
  }

  const hasAnyJob = jobs.length > 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Weekly grid */}
      <div className="flex flex-1 flex-col overflow-auto">
        {/* Day headers */}
        <div className="flex shrink-0 border-b border-black/[0.06]">
          {DAYS.map((day, i) => (
            <div key={day} className={cn('flex-1 py-3 text-center text-[12px] font-medium', i < 5 ? 'text-[#3c3c43]' : 'text-[#c6c6c8]')}>
              {t(`scheduleDetails.weekdays.${day}`)}
            </div>
          ))}
        </div>

        {/* Job cells */}
        <div className="flex flex-1 overflow-y-auto">
          {!hasAnyJob ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <span className="text-[32px]">📅</span>
              <p className="text-[13px] text-[#8e8e93]">{t('scheduleDetails.empty.title')}</p>
              <p className="text-[12px] text-[#c6c6c8]">{t('scheduleDetails.empty.description')}</p>
            </div>
          ) : (
            DAYS.map((day, dayIdx) => (
              <div key={day} className="flex flex-1 flex-col gap-2 border-r border-black/[0.04] p-2">
                {dayJobs[dayIdx].length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <span className="text-[11px] text-[#e5e5ea]">—</span>
                  </div>
                ) : (
                  dayJobs[dayIdx].map((job, i) => {
                    const { color, bg } = JOB_COLORS[i % JOB_COLORS.length];
                    const hour = jobHour(job);
                    return (
                      <div
                        key={job.id}
                        className="rounded-lg px-2.5 py-2"
                        style={{ background: bg, borderLeft: `3px solid ${color}` }}
                      >
                        <p className="text-[12px] font-semibold leading-tight text-[#1c1c1e]">{job.name}</p>
                        <p className="mt-0.5 text-[10px]" style={{ color }}>
                          {hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : formatSchedule(job.schedule, t)}
                        </p>
                        <span className={cn('mt-1 inline-block h-1.5 w-1.5 rounded-full', job.enabled ? 'bg-[#10b981]' : 'bg-[#d1d5db]')} />
                      </div>
                    );
                  })
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: upcoming panel */}
        <div className="flex w-[220px] shrink-0 flex-col border-l border-black/[0.06] bg-[#f9f9f9]">
          <div className="border-b border-black/[0.06] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#3c3c43]">{t('scheduleDetails.upcoming.title')}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                <span className="text-[24px]">⏰</span>
                <p className="text-[12px] text-[#c6c6c8]">{t('scheduleDetails.upcoming.emptyTitle')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {upcoming.map((job) => (
                  <div key={job.id} className="border-b border-black/[0.04] px-4 py-3">
                    <p className="truncate text-[13px] font-medium text-[#000000]">{job.name}</p>
                    <p className="mt-0.5 text-[11px] text-clawx-ac">{formatTime(job.nextRun, resolvedLanguage, t('common.unknown'))}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#c6c6c8]">{formatSchedule(job.schedule, t)}</p>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pipelines Tab ─── */

function formatDuration(ms: number | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!ms) return t('common.unknown');
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

interface RunEntry {
  sessionId?: string;
  status: string;
  summary?: string;
  error?: string;
  durationMs?: number;
  ts?: number;
  model?: string;
  provider?: string;
}

function RunDetailPanel({ job, onClose }: { job: CronJob; onClose: () => void }) {
  const { t, i18n } = useTranslation('cron');
  const resolvedLanguage = i18n?.resolvedLanguage;
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    import('@/lib/host-api').then(({ hostApiFetch }) =>
      hostApiFetch<{ runs: RunEntry[] }>(`/api/cron/runs/${encodeURIComponent(job.id)}`)
        .then((data) => setRuns(data.runs ?? []))
        .catch(() => setRuns([]))
        .finally(() => setLoading(false))
    );
  }, [job.id]);

  return (
    <tr>
      <td colSpan={6} className="bg-[#f9fafb] px-8 pb-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-[#3c3c43]">{t('pipelines.details.title')}</span>
          <button type="button" onClick={onClose} className="text-[11px] text-[#8e8e93] hover:text-[#3c3c43]">{t('pipelines.buttons.collapse')}</button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-3 text-[12px] text-[#3c3c43]">
          <div>
            <span className="text-[#8e8e93]">{t('pipelines.details.labels.delivery')} </span>
            <span>{formatDelivery(job, t('overview.labels.chatOnly'))}</span>
          </div>
          <div>
            <span className="text-[#8e8e93]">{t('pipelines.details.labels.sessionTarget')} </span>
            <span>{formatSessionTarget(job.sessionTarget, t('overview.labels.sessionTargetDefault'))}</span>
          </div>
          <div>
            <span className="text-[#8e8e93]">{t('pipelines.details.labels.schedule')} </span>
            <span>{formatSchedule(job.schedule, t)}</span>
          </div>
          <div>
            <span className="text-[#8e8e93]">{t('pipelines.details.labels.nextRun')} </span>
            <span>{job.nextRun ? formatTime(job.nextRun, resolvedLanguage, t('common.unknown')) : t('common.unknown')}</span>
          </div>
        </div>
        {job.lastRun?.error ? (
          <div className="mb-3 rounded-xl border border-[#ef4444]/20 bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">
            {job.lastRun.error}
          </div>
        ) : null}
        {loading ? (
          <p className="text-[12px] text-[#8e8e93]">{t('pipelines.details.loading')}</p>
        ) : runs.length === 0 ? (
          <p className="text-[12px] text-[#c6c6c8]">{t('pipelines.details.noRecords')}</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-black/[0.06]">
                {[
                  t('pipelines.table.lastRun'),
                  t('pipelines.table.status'),
                  t('pipelines.table.duration'),
                  t('pipelines.table.model'),
                  t('pipelines.table.summary'),
                ].map((h) => (
                  <th key={h} className="pb-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.4px] text-[#c6c6c8]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r, i) => {
                const isOk = (r.status || '').toLowerCase() !== 'error';
                const summary = r.summary || r.error || (isOk ? t('pipelines.details.summarySuccess') : t('pipelines.details.summaryFailed'));
                return (
                  <tr key={r.sessionId ?? i} className="border-b border-black/[0.04]">
                    <td className="py-2 pr-4 text-[#3c3c43]">
                      {r.ts ? new Date(r.ts).toLocaleString(resolveDateLocale(resolvedLanguage), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('common.unknown')}
                    </td>
                    <td className="py-2 pr-4">
                      {isOk ? (
                        <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-medium text-[#059669]">{t('pipelines.details.status.success')}</span>
                      ) : (
                        <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-medium text-[#ef4444]">{t('pipelines.details.status.failed')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[#8e8e93]">{formatDuration(r.durationMs, t)}</td>
                    <td className="py-2 pr-4 text-[#8e8e93]">{r.model ?? t('common.unknown')}</td>
                    <td className="py-2 max-w-[320px] truncate text-[#3c3c43]" title={summary}>{summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  );
}

function PipelinesTab({
  jobs,
  loading,
  expandedJobId,
  onExpandedJobChange,
  onTrigger,
  onEdit,
}: {
  jobs: CronJob[];
  loading: boolean;
  expandedJobId: string | null;
  onExpandedJobChange: (jobId: string | null) => void;
  onTrigger: (id: string) => void;
  onEdit: (job: CronJob) => void;
}) {
  const { t, i18n } = useTranslation('cron');
  const resolvedLanguage = i18n?.resolvedLanguage;
  const ran = jobs.filter((j) => j.lastRun);
  const succeeded = ran.filter((j) => j.lastRun?.success).length;
  const failed = ran.filter((j) => !j.lastRun?.success).length;
  const successRate = ran.length > 0 ? Math.round((succeeded / ran.length) * 100) : null;

  const sorted = [...jobs].sort((a, b) => {
    const ta = a.lastRun?.time ? new Date(a.lastRun.time).getTime() : 0;
    const tb = b.lastRun?.time ? new Date(b.lastRun.time).getTime() : 0;
    return tb - ta;
  });

  if (loading) return <div className="flex flex-1 items-center justify-center text-[14px] text-[#8e8e93]">{t('common.loading')}</div>;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex shrink-0 items-center gap-6 border-b border-black/[0.06] px-8 py-4">
        <StatPill label={t('pipelines.stats.total')} value={String(jobs.length)} color="#3c3c43" />
        <StatPill label={t('pipelines.stats.ran')} value={String(ran.length)} color="var(--ac)" />
        <StatPill label={t('pipelines.stats.success')} value={String(succeeded)} color="#10b981" />
        <StatPill label={t('pipelines.stats.failed')} value={String(failed)} color={failed > 0 ? '#ef4444' : '#c6c6c8'} />
        {successRate !== null && (
          <StatPill label={t('pipelines.stats.successRate')} value={`${successRate}%`} color={successRate >= 80 ? '#10b981' : successRate >= 50 ? '#f59e0b' : '#ef4444'} />
        )}
      </div>

      {/* Run log */}
      {jobs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="text-[40px]">🔁</span>
          <p className="text-[14px] text-[#8e8e93]">{t('pipelines.empty.title')}</p>
          <p className="text-[12px] text-[#c6c6c8]">{t('pipelines.empty.description')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06]">
                {[
                  t('pipelines.table.task'),
                  t('pipelines.table.schedule'),
                  t('pipelines.table.lastRun'),
                  t('pipelines.table.duration'),
                  t('pipelines.table.status'),
                  t('pipelines.table.actions'),
                ].map((h) => (
                  <th key={h} className="pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => {
                const run = job.lastRun;
                const isExpanded = expandedJobId === job.id;
                return (
                  <Fragment key={job.id}>
                    <tr className="group border-b border-black/[0.04] transition-colors hover:bg-[#f9f9f9]">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', job.enabled ? 'bg-[#10b981]' : 'bg-[#d1d5db]')} />
                          <span className="font-medium text-[#000000]">{job.name}</span>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-[11px] text-[#3c3c43]">{t('pipelines.labels.triggerHint')}</p>
                        <p className="mt-0.5 truncate pl-4 text-[11px] text-[#8e8e93]">{`${t('pipelines.details.labels.delivery')} ${formatDelivery(job, t('overview.labels.chatOnly'))}`}</p>
                        {typeof job.failureAlertAfter === 'number' && (
                          <p className="mt-0.5 truncate pl-4 text-[11px] text-[#8e8e93]">
                            {`${t('pipelines.labels.alertAfter', { count: job.failureAlertAfter })}${job.failureAlertChannel ? ` → ${job.failureAlertChannel}` : ''}`}
                          </p>
                        )}
                        {run?.error && (
                          <p className="mt-0.5 truncate pl-4 text-[11px] text-[#ef4444]">{run.error}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <code className="rounded bg-[#f2f2f7] px-1.5 py-0.5 font-mono text-[11px] text-[#3c3c43]">
                          {formatSchedule(job.schedule, t)}
                        </code>
                      </td>
                      <td className="py-3 pr-4 text-[#3c3c43]">{run ? formatTime(run.time, resolvedLanguage, t('common.unknown')) : <span className="text-[#c6c6c8]">{t('pipelines.details.labels.neverRan')}</span>}</td>
                      <td className="py-3 pr-4 font-mono text-[#3c3c43]">{run ? formatDuration(run.duration, t) : t('common.unknown')}</td>
                      <td className="py-3 pr-4">
                        {!run ? (
                          <span className="text-[12px] text-[#c6c6c8]">{t('common.unknown')}</span>
                        ) : run.success ? (
                          <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[11px] font-medium text-[#059669]">{t('pipelines.details.status.success')}</span>
                        ) : (
                          <span className="rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-[11px] font-medium text-[#ef4444]">{t('pipelines.details.status.failed')}</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => onTrigger(job.id)}
                            className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                          >
                            ▶ {t('pipelines.buttons.run')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(job)}
                            className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
                          >
                            {t('overview.actions.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => onExpandedJobChange(isExpanded ? null : job.id)}
                            className={cn('rounded-md border px-2.5 py-1 text-[12px] transition-colors', isExpanded ? 'border-clawx-ac/30 bg-clawx-ac/5 text-clawx-ac' : 'border-black/10 text-[#3c3c43] hover:bg-[#f2f2f7]')}
                          >
                            {isExpanded ? t('pipelines.buttons.collapse') : t('pipelines.buttons.details')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <RunDetailPanel
                        key={`history-${job.id}`}
                        job={job}
                        onClose={() => onExpandedJobChange(null)}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[#8e8e93]">{label}</span>
      <span className="text-[20px] font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

export default Cron;
