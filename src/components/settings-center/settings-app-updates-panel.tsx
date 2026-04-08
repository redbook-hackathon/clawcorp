import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSectionCard } from '@/components/settings-center/settings-section-card';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settings';
import { useUpdateStore, type UpdateStatus } from '@/stores/update';

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '从未';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function getStatusCopy(
  t: (key: string, options?: Record<string, unknown>) => string,
  status: UpdateStatus,
  version?: string,
  error?: string | null,
  autoInstallCountdown?: number | null,
): string {
  if (status === 'downloaded' && autoInstallCountdown != null && autoInstallCountdown >= 0) {
    return t('updates.status.autoInstalling', {
      defaultValue: 'Restarting to install update in {{seconds}}s...',
      seconds: autoInstallCountdown,
    });
  }

  switch (status) {
    case 'checking':
      return t('updates.status.checking', { defaultValue: 'Checking for updates...' });
    case 'downloading':
      return t('updates.status.downloading', { defaultValue: 'Downloading update...' });
    case 'available':
      return t('updates.status.available', {
        defaultValue: 'Update available: v{{version}}',
        version,
      });
    case 'downloaded':
      return t('updates.status.downloaded', {
        defaultValue: 'Ready to install: v{{version}}',
        version,
      });
    case 'error':
      return error || t('updates.status.failed', { defaultValue: 'Update check failed' });
    case 'not-available':
      return t('updates.status.latest', { defaultValue: 'You have the latest version' });
    default:
      return t('updates.status.check', {
        defaultValue: 'Check for updates to get the latest features',
      });
  }
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-[13px] font-medium text-[#000000]">
          {label}
        </p>
        <p id={descriptionId} className="mt-0.5 text-[12px] text-[#8e8e93]">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      />
    </div>
  );
}

export function SettingsAppUpdatesPanel() {
  const { t } = useTranslation('settings');
  const autoCheckUpdate = useSettingsStore((state) => state.autoCheckUpdate);
  const setAutoCheckUpdate = useSettingsStore((state) => state.setAutoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((state) => state.autoDownloadUpdate);
  const setAutoDownloadUpdate = useSettingsStore((state) => state.setAutoDownloadUpdate);

  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const status = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const progress = useUpdateStore((state) => state.progress);
  const error = useUpdateStore((state) => state.error);
  const policy = useUpdateStore((state) => state.policy);
  const autoInstallCountdown = useUpdateStore((state) => state.autoInstallCountdown);
  const init = useUpdateStore((state) => state.init);
  const clearError = useUpdateStore((state) => state.clearError);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const downloadUpdate = useUpdateStore((state) => state.downloadUpdate);
  const installUpdate = useUpdateStore((state) => state.installUpdate);
  const cancelAutoInstall = useUpdateStore((state) => state.cancelAutoInstall);
  const setChannel = useUpdateStore((state) => state.setChannel);
  const setAutoDownload = useUpdateStore((state) => state.setAutoDownload);

  useEffect(() => {
    void init();
  }, [init]);

  const statusText = getStatusCopy(
    t,
    status,
    updateInfo?.version,
    error,
    autoInstallCountdown,
  );

  const handleCheckForUpdates = () => {
    clearError();
    void checkForUpdates({ reason: 'manual' });
  };

  const handleAutoDownloadChange = (value: boolean) => {
    setAutoDownloadUpdate(value);
    void setAutoDownload(value);
  };

  const handleCopyChangelog = async () => {
    if (!updateInfo?.releaseNotes) {
      return;
    }
    await navigator.clipboard?.writeText(String(updateInfo.releaseNotes));
  };

  return (
    <div className="space-y-4">
      <SettingsSectionCard
        title={t('settingsShell.meta.app-updates.title', { defaultValue: 'App Updates' })}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-[#f2f2f7] px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#000000]">ClawCorp v{currentVersion}</p>
            <p className="mt-1 text-[12px] text-[#667085]">{statusText}</p>
            {updateInfo?.releaseDate ? (
              <p className="mt-1 text-[12px] text-[#8e8e93]">
                {t('updates.whatsNew', { defaultValue: "What's New:" }).replace(':', '')}:{' '}
                {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {status === 'available' ? (
              <button
                type="button"
                onClick={() => void downloadUpdate()}
                className="rounded-lg bg-[#0a7aff] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#075ac4]"
              >
                {t('updates.action.download', { defaultValue: 'Download Update' })}
              </button>
            ) : null}
            {status === 'downloaded' ? (
              autoInstallCountdown != null && autoInstallCountdown >= 0 ? (
                <button
                  type="button"
                  onClick={() => void cancelAutoInstall()}
                  className="rounded-lg border border-black/10 px-3 py-2 text-[12px] font-medium text-[#000000] transition hover:bg-[#f2f2f7]"
                >
                  {t('updates.action.cancelAutoInstall', { defaultValue: 'Cancel' })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={installUpdate}
                  className="rounded-lg bg-[#0a7aff] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#075ac4]"
                >
                  {t('updates.action.install', { defaultValue: 'Install & Restart' })}
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={handleCheckForUpdates}
              disabled={status === 'checking' || status === 'downloading'}
              className="rounded-lg border border-black/10 px-3 py-2 text-[12px] font-medium text-[#000000] transition hover:bg-[#f2f2f7] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'checking'
                ? t('updates.action.checking', { defaultValue: 'Checking...' })
                : t('updates.action.check', { defaultValue: 'Check for Updates' })}
            </button>
          </div>
        </div>

        {status === 'downloading' && progress ? (
          <div className="rounded-xl bg-[#f9fafb] px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-[12px] text-[#667085]">
              <span>{t('updates.action.downloading', { defaultValue: 'Downloading...' })}</span>
              <span>{Math.round(progress.percent)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
              <div
                className="h-full rounded-full bg-[#0a7aff] transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[12px] text-[#b91c1c]">
            {error}
          </div>
        ) : null}
      </SettingsSectionCard>

      <SettingsSectionCard title="更新策略">
        <ToggleRow
          label={t('updates.autoCheck', { defaultValue: 'Auto-check for updates' })}
          description={t('updates.autoCheckDesc', { defaultValue: 'Check for updates on startup' })}
          checked={autoCheckUpdate}
          onCheckedChange={setAutoCheckUpdate}
        />
        <ToggleRow
          label={t('updates.autoDownload', { defaultValue: 'Auto-update' })}
          description={t('updates.autoDownloadDesc', {
            defaultValue: 'Automatically download and install updates',
          })}
          checked={autoDownloadUpdate}
          onCheckedChange={handleAutoDownloadChange}
        />

        <label className="block">
          <span className="text-[13px] font-medium text-[#000000]">更新渠道</span>
          <select
            aria-label="更新渠道"
            value={policy?.channel ?? 'stable'}
            onChange={(event) => {
              void setChannel(event.target.value as 'stable' | 'beta' | 'dev');
            }}
            className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#0a7aff]"
          >
            <option value="stable">稳定版</option>
            <option value="beta">测试版</option>
            <option value="dev">开发版</option>
          </select>
        </label>

        <div className="grid gap-3 rounded-xl bg-[#f9fafb] px-4 py-3 text-[12px] text-[#3c3c43] sm:grid-cols-2">
          <div>
            <span className="text-[#8e8e93]">检查次数</span>
            <p className="mt-0.5 font-medium text-[#111827]">{policy?.attemptCount ?? 0}</p>
          </div>
          <div>
            <span className="text-[#8e8e93]">上次原因</span>
            <p className="mt-0.5 font-medium text-[#111827]">{policy?.lastCheckReason ?? 'manual'}</p>
          </div>
          <div>
            <span className="text-[#8e8e93]">上次检查</span>
            <p className="mt-0.5 font-medium text-[#111827]">
              {formatDateTime(policy?.lastAttemptAt ?? null)}
            </p>
          </div>
          <div>
            <span className="text-[#8e8e93]">下次可检查</span>
            <p className="mt-0.5 font-medium text-[#111827]">
              {formatDateTime(policy?.nextEligibleAt ?? null)}
            </p>
          </div>
          <div>
            <span className="text-[#8e8e93]">上次成功</span>
            <p className="mt-0.5 font-medium text-[#111827]">
              {formatDateTime(policy?.lastSuccessAt ?? null)}
            </p>
          </div>
          <div>
            <span className="text-[#8e8e93]">推送延迟</span>
            <p className="mt-0.5 font-medium text-[#111827]">
              {Math.round((policy?.rolloutDelayMs ?? 0) / 60000)} min
            </p>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="更新日志">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#000000]">
              {updateInfo
                ? `Version ${updateInfo.version}`
                : t('updates.currentVersion', { defaultValue: 'Current Version' })}
            </p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              {updateInfo?.releaseDate
                ? formatDateTime(updateInfo.releaseDate)
                : '成功检查更新后，发布说明将显示在此处。'}
            </p>
          </div>
          {updateInfo?.releaseNotes ? (
            <button
              type="button"
              onClick={() => void handleCopyChangelog()}
              className="rounded-lg border border-black/10 px-3 py-2 text-[12px] font-medium text-[#000000] transition hover:bg-[#f2f2f7]"
            >
              复制更新日志
            </button>
          ) : null}
        </div>
        <div className="rounded-xl bg-[#f9fafb] px-4 py-3 text-[12px] leading-6 text-[#3c3c43]">
          {updateInfo?.releaseNotes || '暂无更新日志，检测到新版本后将自动显示。'}
        </div>
      </SettingsSectionCard>
    </div>
  );
}
