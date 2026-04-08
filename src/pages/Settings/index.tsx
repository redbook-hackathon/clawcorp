import { useEffect, useId, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { SettingsMemoryKnowledgePanel } from '@/components/settings-center/settings-memory-knowledge-panel';
import { SettingsMigrationPanel } from '@/components/settings-center/settings-migration-panel';
import { SettingsMigrationWizard } from '@/components/settings-center/settings-migration-wizard';
import { SettingsNav } from '@/components/settings-center/settings-nav';
import { SettingsSectionCard } from '@/components/settings-center/settings-section-card';
import { SettingsCostsUsagePanel } from '@/components/settings-center/settings-costs-usage-panel';
import { SettingsModelsProvidersPanel } from '@/components/settings-center/settings-models-providers-panel';
import { SettingsAppUpdatesPanel } from '@/components/settings-center/settings-app-updates-panel';
import { SettingsAboutPanel } from '@/components/settings-center/settings-about-panel';
import { ProvidersSettings } from '@/components/settings/ProvidersSettings';
import { McpTab } from '@/pages/Skills/McpTab';
import {
  parseSettingsSection,
  SETTINGS_NAV_GROUPS,
  SETTINGS_SECTION_META,
  type SettingsSectionId,
} from '@/components/settings-center/settings-shell-data';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { invokeIpc, toUserMessage } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { useSkillsStore } from '@/stores/skills';
import { useUpdateStore } from '@/stores/update';
import type { ChangeEvent, ReactNode } from 'react';

export function Settings() {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    proxyEnabled,
    proxyServer,
    proxyHttpServer,
    proxyHttpsServer,
    proxyAllServer,
    proxyBypassRules,
    setProxyEnabled,
    setProxyServer,
    setProxyHttpServer,
    setProxyHttpsServer,
    setProxyAllServer,
    setProxyBypassRules,
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
    setDevModeUnlocked,
    remoteRpcEnabled,
    setRemoteRpcEnabled,
    p2pSyncEnabled,
    setP2pSyncEnabled,
    telemetryEnabled,
    setTelemetryEnabled,
    resetSettings,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateSetAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const updateStatus = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const updateProgress = useUpdateStore((state) => state.progress);
  const updateError = useUpdateStore((state) => state.error);
  const updatePolicy = useUpdateStore((state) => state.policy);
  const updateSetChannel = useUpdateStore((state) => state.setChannel);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const downloadUpdate = useUpdateStore((state) => state.downloadUpdate);
  const installUpdate = useUpdateStore((state) => state.installUpdate);
  const initUpdate = useUpdateStore((state) => state.init);

  const [proxyEnabledDraft, setProxyEnabledDraft] = useState(proxyEnabled);
  const [proxyServerDraft, setProxyServerDraft] = useState(proxyServer);
  const [proxyHttpServerDraft, setProxyHttpServerDraft] = useState(proxyHttpServer);
  const [proxyHttpsServerDraft, setProxyHttpsServerDraft] = useState(proxyHttpsServer);
  const [proxyAllServerDraft, setProxyAllServerDraft] = useState(proxyAllServer);
  const [proxyBypassRulesDraft, setProxyBypassRulesDraft] = useState(proxyBypassRules);
  const [savingProxy, setSavingProxy] = useState(false);
  const [doctorRunning, setDoctorRunning] = useState<'diagnose' | 'fix' | null>(null);
  const [doctorSummary, setDoctorSummary] = useState('');
  const [migrationWizardOpen, setMigrationWizardOpen] = useState(false);
  const [resettingAllSettings, setResettingAllSettings] = useState(false);
  const [clearingServerData, setClearingServerData] = useState(false);
  const activeSection = parseSettingsSection(searchParams.get('section'));

  useEffect(() => setProxyEnabledDraft(proxyEnabled), [proxyEnabled]);
  useEffect(() => setProxyServerDraft(proxyServer), [proxyServer]);
  useEffect(() => setProxyHttpServerDraft(proxyHttpServer), [proxyHttpServer]);
  useEffect(() => setProxyHttpsServerDraft(proxyHttpsServer), [proxyHttpsServer]);
  useEffect(() => setProxyAllServerDraft(proxyAllServer), [proxyAllServer]);
  useEffect(() => setProxyBypassRulesDraft(proxyBypassRules), [proxyBypassRules]);
  useEffect(() => {
    if (activeSection !== 'migration-backup' && migrationWizardOpen) {
      setMigrationWizardOpen(false);
    }
  }, [activeSection, migrationWizardOpen]);
  useEffect(() => {
    const section = searchParams.get('section');
    if (section === activeSection) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', activeSection);
    setSearchParams(nextParams, { replace: true });
  }, [activeSection, searchParams, setSearchParams]);

  const activeMeta = SETTINGS_SECTION_META[activeSection];

  const handleSectionChange = (section: SettingsSectionId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('section', section);
    setSearchParams(nextParams, { replace: true });
  };

  const saveProxySettings = async () => {
    setSavingProxy(true);
    try {
      const normalizedProxyServer = proxyServerDraft.trim();
      const normalizedHttpServer = proxyHttpServerDraft.trim();
      const normalizedHttpsServer = proxyHttpsServerDraft.trim();
      const normalizedAllServer = proxyAllServerDraft.trim();
      const normalizedBypassRules = proxyBypassRulesDraft.trim();

      await invokeIpc('settings:setMany', {
        proxyEnabled: proxyEnabledDraft,
        proxyServer: normalizedProxyServer,
        proxyHttpServer: normalizedHttpServer,
        proxyHttpsServer: normalizedHttpsServer,
        proxyAllServer: normalizedAllServer,
        proxyBypassRules: normalizedBypassRules,
      });

      setProxyEnabled(proxyEnabledDraft);
      setProxyServer(normalizedProxyServer);
      setProxyHttpServer(normalizedHttpServer);
      setProxyHttpsServer(normalizedHttpsServer);
      setProxyAllServer(normalizedAllServer);
      setProxyBypassRules(normalizedBypassRules);
      toast.success(t('settings:gateway.proxySaved'));
    } catch (error) {
      toast.error(`${t('settings:gateway.proxySaveFailed')}: ${toUserMessage(error)}`);
    } finally {
      setSavingProxy(false);
    }
  };

  const runDoctor = async (mode: 'diagnose' | 'fix') => {
    setDoctorRunning(mode);
    try {
      const result = await hostApiFetch<{
        success: boolean;
        exitCode?: number;
        stderr?: string;
        stdout?: string;
      }>('/api/app/openclaw-doctor', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      const summary = result?.success
        ? `${mode}: success (exit=${result.exitCode ?? 0})`
        : `${mode}: failed (exit=${result?.exitCode ?? 'n/a'}) ${result?.stderr ?? ''}`;
      setDoctorSummary(summary);
      if (result?.success) {
        toast.success(
          mode === 'fix'
            ? t('settings:developer.doctorFixSucceeded')
            : t('settings:developer.doctorSucceeded'),
        );
      } else {
        toast.error(
          mode === 'fix'
            ? t('settings:developer.doctorFixFailed')
            : t('settings:developer.doctorFailed'),
        );
      }
    } catch (error) {
      setDoctorSummary(`${mode}: ${toUserMessage(error)}`);
      toast.error(toUserMessage(error));
    } finally {
      setDoctorRunning(null);
    }
  };

  const rerunSetup = () => {
    navigate('/setup');
  };

  const resetAllSettings = async () => {
    setResettingAllSettings(true);
    try {
      await hostApiFetch('/api/settings/reset', {
        method: 'POST',
      });
      resetSettings();
      toast.success(t('settings:maintenance.resetSuccess'));
    } catch (error) {
      toast.error(t('settings:maintenance.resetFailed', { error: toUserMessage(error) }));
    } finally {
      setResettingAllSettings(false);
    }
  };

  const clearServerData = async () => {
    setClearingServerData(true);
    try {
      await hostApiFetch('/api/app/clear-server-data', {
        method: 'POST',
      });
      toast.success(t('settings:maintenance.clearSuccess'));
    } catch (error) {
      toast.error(t('settings:maintenance.clearFailed', { error: toUserMessage(error) }));
    } finally {
      setClearingServerData(false);
    }
  };

  return (
    <div className="h-full bg-[linear-gradient(180deg,#f3f4f6_0%,#eceff3_100%)] p-6 dark:bg-background">
      <div className="mx-auto flex h-full max-w-[1360px] overflow-hidden rounded-[32px] border border-black/[0.05] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-background">
        <SettingsNav
          groups={SETTINGS_NAV_GROUPS}
          activeItemId={activeSection}
          onChange={handleSectionChange}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-white px-[60px] py-8 dark:bg-background">
          <div className="mx-auto max-w-[780px]">
            <header className="mb-8">
              <button
                onClick={() => navigate('/')}
                className="mb-4 flex items-center gap-2 text-[13px] text-[#8e8e93] transition-colors hover:text-[#000000]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回工作台
              </button>
              <h1 className="text-[24px] font-semibold text-[#000000] dark:text-foreground">
                {t(activeMeta.titleKey)}{' '}
                <span className="text-[#3c3c43]">{t(activeMeta.kickerKey)}</span>
              </h1>
              <p className="mt-2 text-[13px] text-[#3c3c43] dark:text-muted-foreground">
                {t(activeMeta.subtitleKey)}
              </p>
            </header>

            <div className="space-y-5">
              {renderActiveSection({
                activeSection,
                gatewayStatus,
                restartGateway,
                proxyEnabledDraft,
                setProxyEnabledDraft,
                proxyServerDraft,
                setProxyServerDraft,
                proxyHttpServerDraft,
                setProxyHttpServerDraft,
                proxyHttpsServerDraft,
                setProxyHttpsServerDraft,
                proxyAllServerDraft,
                setProxyAllServerDraft,
                proxyBypassRulesDraft,
                setProxyBypassRulesDraft,
                saveProxySettings,
                savingProxy,
                currentVersion,
                autoCheckUpdate,
                setAutoCheckUpdate,
                autoDownloadUpdate,
                setAutoDownloadUpdate,
                updateSetAutoDownload,
                devModeUnlocked,
                setDevModeUnlocked,
                remoteRpcEnabled,
                setRemoteRpcEnabled,
                p2pSyncEnabled,
                setP2pSyncEnabled,
                telemetryEnabled,
                setTelemetryEnabled,
                doctorRunning,
                runDoctor,
                doctorSummary,
                rerunSetup,
                resetAllSettings,
                resettingAllSettings,
                clearServerData,
                clearingServerData,
                openMigrationWizard: () => setMigrationWizardOpen(true),
                updateStatus,
                updateInfo,
                updateProgress,
                updateError,
                updatePolicy,
                updateSetChannel,
                checkForUpdates,
                downloadUpdate,
                installUpdate,
                initUpdate,
                t,
              })}
            </div>
          </div>
        </main>
      </div>

      {migrationWizardOpen ? (
        <SettingsMigrationWizard open onOpenChange={setMigrationWizardOpen} />
      ) : null}
    </div>
  );
}

/* ─── renderActiveSection ─── */

type RenderSectionArgs = {
  activeSection: SettingsSectionId;
  gatewayStatus: { state: string; port?: number };
  restartGateway: () => unknown;
  proxyEnabledDraft: boolean;
  setProxyEnabledDraft: (value: boolean) => void;
  proxyServerDraft: string;
  setProxyServerDraft: (value: string) => void;
  proxyHttpServerDraft: string;
  setProxyHttpServerDraft: (value: string) => void;
  proxyHttpsServerDraft: string;
  setProxyHttpsServerDraft: (value: string) => void;
  proxyAllServerDraft: string;
  setProxyAllServerDraft: (value: string) => void;
  proxyBypassRulesDraft: string;
  setProxyBypassRulesDraft: (value: string) => void;
  saveProxySettings: () => Promise<void>;
  savingProxy: boolean;
  currentVersion: string;
  autoCheckUpdate: boolean;
  setAutoCheckUpdate: (value: boolean) => void;
  autoDownloadUpdate: boolean;
  setAutoDownloadUpdate: (value: boolean) => void;
  updateSetAutoDownload: (value: boolean) => void;
  devModeUnlocked: boolean;
  setDevModeUnlocked: (value: boolean) => void;
  remoteRpcEnabled: boolean;
  setRemoteRpcEnabled: (value: boolean) => void;
  p2pSyncEnabled: boolean;
  setP2pSyncEnabled: (value: boolean) => void;
  telemetryEnabled: boolean;
  setTelemetryEnabled: (value: boolean) => void;
  doctorRunning: 'diagnose' | 'fix' | null;
  runDoctor: (mode: 'diagnose' | 'fix') => Promise<void>;
  doctorSummary: string;
  rerunSetup: () => void;
  resetAllSettings: () => Promise<void>;
  resettingAllSettings: boolean;
  clearServerData: () => Promise<void>;
  clearingServerData: boolean;
  openMigrationWizard: () => void;
  updateStatus: import('@/stores/update').UpdateStatus;
  updateInfo: import('@/stores/update').UpdateInfo | null;
  updateProgress: import('@/stores/update').ProgressInfo | null;
  updateError: string | null;
  updatePolicy: import('@/stores/update').UpdatePolicySnapshot | null;
  updateSetChannel: (channel: 'stable' | 'beta' | 'dev') => Promise<void>;
  checkForUpdates: (options?: { reason?: 'manual' | 'startup'; respectPolicy?: boolean }) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  initUpdate: () => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function renderActiveSection(args: RenderSectionArgs) {
  switch (args.activeSection) {
    case 'costs-usage':
      return <SettingsCostsUsagePanel />;

    case 'models-providers':
      return <SettingsModelsProvidersPanel />;

    case 'general':
      return <GeneralSettingsSection />;

    case 'memory-knowledge':
      return <SettingsMemoryKnowledgePanel />;

    case 'skills-mcp':
      return <SettingsSkillsMcpPanel />;

    case 'tool-permissions':
      return <SettingsToolPermissionsPanel />;

    case 'migration-backup':
      return <SettingsMigrationPanel onLaunchWizard={args.openMigrationWizard} />;

    case 'app-updates':
      return (
        <AutoUpdateSection
          currentVersion={args.currentVersion}
          autoCheckUpdate={args.autoCheckUpdate}
          setAutoCheckUpdate={args.setAutoCheckUpdate}
          autoDownloadUpdate={args.autoDownloadUpdate}
          setAutoDownloadUpdate={args.setAutoDownloadUpdate}
          updateSetAutoDownload={args.updateSetAutoDownload}
          updateStatus={args.updateStatus}
          updateInfo={args.updateInfo}
          updateProgress={args.updateProgress}
          updateError={args.updateError}
          updatePolicy={args.updatePolicy}
          updateSetChannel={args.updateSetChannel}
          checkForUpdates={args.checkForUpdates}
          downloadUpdate={args.downloadUpdate}
          installUpdate={args.installUpdate}
          initUpdate={args.initUpdate}
        />
      );

    case 'about':
      return (
        <>
          {/* Card 1: 实验室实验 */}
          <SettingsSectionCard
            title="实验室实验 (Experimental Flags)"
            description=""
          >
            <ToggleRow
              label="开发者专用模式 (Dev Mode)"
              desc="在主工作台解锁底层 WebSocket 抓包控制台与 RAW Payload 窗口。"
              checked={args.devModeUnlocked}
              onCheckedChange={args.setDevModeUnlocked}
            />
            <ToggleRow
              label="启用远程 API RPC 监听"
              desc="开启本地 18789 端口，允许本机的浏览器扩展或其他 Shell 直接使唤主控内核。 (有一定风险)"
              checked={args.remoteRpcEnabled}
              onCheckedChange={args.setRemoteRpcEnabled}
            />
            <ToggleRow
              label="启用 Tauri/Web P2P 同步 (预览)"
              desc="正在酝酿的能力测试：多机器设备组网互传 Agent 记忆。"
              checked={args.p2pSyncEnabled}
              onCheckedChange={args.setP2pSyncEnabled}
            />
          </SettingsSectionCard>

          {/* Card 2: 诊断排错与反馈系统 */}
          <SettingsSectionCard
            title="诊断排错与反馈系统"
            description=""
          >
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#f2f2f7] px-4 py-3">
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#2563eb]">ClawCorp Doctor</p>
                <p className="mt-0.5 text-[12px] text-[#8e8e93]">完整分析你的环境变量、Nodejs 版本与目录权限有无隐患。</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg text-[12px]"
                onClick={() => void args.runDoctor('diagnose')}
                disabled={args.doctorRunning !== null}
              >
                {args.doctorRunning === 'diagnose' ? args.t('common:status.running') : '运行诊断'}
              </Button>
            </div>

            {args.doctorSummary ? (
              <p className="mb-3 text-[12px] text-[#667085]">{args.doctorSummary}</p>
            ) : null}

            <ToggleRow
              label="崩溃时自动发送匿名报告 (Telemetry)"
              desc="帮助核心社区了解运行时发生的 Electron 异常。"
              checked={args.telemetryEnabled}
              onCheckedChange={args.setTelemetryEnabled}
            />

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => void invokeIpc('shell:openExternal', 'https://github.com/anthropics/claude-code/issues')}
                className="flex-1 rounded-xl border border-dashed border-[#c6c6c8] px-3 py-2.5 text-[13px] text-[#8e8e93] transition-colors hover:border-[#8e8e93] hover:text-[#3c3c43]"
              >
                📝 提交 Issue (GitHub)
              </button>
              <button
                type="button"
                onClick={() => {
                  const info = [
                    `Platform: ${window.electron?.platform ?? navigator.platform}`,
                    `App Version: ${args.currentVersion}`,
                    `Gateway: ${args.gatewayStatus.state} (port ${args.gatewayStatus.port ?? 'n/a'})`,
                    `User Agent: ${navigator.userAgent}`,
                  ].join('\n');
                  void navigator.clipboard.writeText(info);
                }}
                className="flex-1 rounded-xl border border-dashed border-[#c6c6c8] px-3 py-2.5 text-[13px] text-[#8e8e93] transition-colors hover:border-[#8e8e93] hover:text-[#3c3c43]"
              >
                🐛 复制本机运行环境清单
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-[#c6c6c8] bg-[#f9fafb] p-3">
              <p className="text-[12px] font-medium text-[#111827]">维护</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-[12px]"
                  onClick={args.rerunSetup}
                >
                  重新运行初始化
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-[12px]"
                  onClick={() => void args.resetAllSettings()}
                  disabled={args.resettingAllSettings || args.clearingServerData}
                >
                  {args.resettingAllSettings ? args.t('common:status.running') : '重置所有设置'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-[12px]"
                  onClick={() => void args.clearServerData()}
                  disabled={args.clearingServerData || args.resettingAllSettings}
                >
                  {args.clearingServerData ? args.t('common:status.running') : '清除服务器数据'}
                </Button>
              </div>
            </div>
          </SettingsSectionCard>
        </>
      );

    default:
      return null;
  }
}

/* ─── Primitive helpers ─── */

function SettingsCard({
  title,
  headerRight,
  children,
  ...sectionProps
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
} & React.ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4"
      {...sectionProps}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#000000]">{title}</h3>
        {headerRight}
      </div>
      <div className="divide-y divide-black/[0.04]">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  desc,
  right,
}: {
  label: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#000000]">{label}</p>
        {desc && <p className="mt-0.5 text-[12px] text-[#8e8e93]">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onCheckedChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-[13px] font-medium text-[#000000]">{label}</p>
        {desc && <p id={descriptionId} className="mt-0.5 text-[12px] text-[#8e8e93]">{desc}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={labelId}
        aria-describedby={desc ? descriptionId : undefined}
      />
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputId = useId();
  return (
    <div className="py-3">
      <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-[#000000]">
        {label}
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac focus:ring-1 focus:ring-clawx-ac/20"
      />
    </div>
  );
}

function BrandImageUploadField({
  label,
  dataUrl,
  previewAlt,
  inputLabel,
  clearLabel,
  onUpload,
  onClear,
}: {
  label: string;
  dataUrl: string | null;
  previewAlt: string;
  inputLabel: string;
  clearLabel: string;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const inputId = useId();

  return (
    <div className="py-3">
      <p className="mb-1.5 text-[13px] font-medium text-[#000000]">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-[#f2f2f7]">
          {dataUrl ? (
            <img src={dataUrl} alt={previewAlt} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-[#8e8e93]">无</span>
          )}
        </div>
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
        >
          上传
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={inputLabel}
          onChange={onUpload}
        />
        <button
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          disabled={!dataUrl}
          className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7] disabled:cursor-not-allowed disabled:opacity-50"
        >
          清除
        </button>
      </div>
    </div>
  );
}

/* ─── Section: General (07.1) ─── */

function CostsUsageSection() {
  return (
    <SettingsCard title="Costs & Usage">
      <div className="rounded-lg border border-dashed border-[#c6c6c8] bg-[#f9fafb] px-4 py-3 text-[13px] text-[#3c3c43]">
        This canonical section anchors usage monitoring, spend visibility, and budget controls inside
        Settings. Subsequent Phase 08 plans will plug the full costs surfaces into this location.
      </div>
    </SettingsCard>
  );
}

function GeneralSettingsSection() {
  return (
    <>
      <GeneralSection />
      {/* <TeamRoleSection /> */}
      {/* <ChannelAdvancedSection /> */}
      {/* <AutomationDefaultsSection /> */}
      {/* <AgentAvatarsSection /> */}
    </>
  );
}

function GeneralSection() {
  const { t } = useTranslation(['settings']);
  const {
    theme, setTheme, accentColor, setAccentColor, language, setLanguage, launchAtStartup, setLaunchAtStartup,
    brandName, setBrandName, brandSubtitle, setBrandSubtitle, brandLogoDataUrl, setBrandLogoDataUrl,
    brandIconDataUrl, setBrandIconDataUrl, myName, setMyName,
    showToolCalls, setShowToolCalls, emojiAvatar, setEmojiAvatar,
    hideAvatarBg, setHideAvatarBg, minimizeToTray, setMinimizeToTray,
  } = useSettingsStore();
  const languageSelectId = useId();
  const accentCustomColorId = useId();

  const handleBrandImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
    setDataUrl: (value: string | null) => void,
    _kind: 'logo' | 'icon',
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings:brandImageRequired'));
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDataUrl(reader.result);
      } else {
        toast.error(t('settings:brandReadFailed'));
      }
    };
    reader.onerror = () => {
      toast.error(t('settings:brandReadFailed'));
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <>
      {/* 账号与安全 */}
      <SettingsCard title="账号与安全">
        <div className="rounded-lg border border-dashed border-[#c6c6c8] bg-[#f9fafb] px-4 py-3 text-[13px] text-[#3c3c43]">
          桌面端暂不提供账号管理或注销入口，请在其他官方入口完成账户相关操作。
        </div>
      </SettingsCard>

      {/* 外观与行为 */}
      <SettingsCard title="外观与行为">
        {/* Language dropdown */}
        <div className="py-3">
          <label htmlFor={languageSelectId} className="mb-2 block text-[13px] font-medium text-[#000000]">
            界面语言
          </label>
          <select
            id={languageSelectId}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238e8e93' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '32px',
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-[#8e8e93]">切换后需重启应用。</p>
        </div>

        {/* Theme mode */}
        <SettingsRow
          label="主题模式"
          desc="选择橙白浅色或 Neon Noir 深色模式。"
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={cn(
                  'h-10 w-10 rounded-full border-2 transition-all',
                  theme === 'light' ? 'border-black/25 scale-110' : 'border-black/[0.04]',
                )}
                style={{
                  background:
                    'conic-gradient(from 90deg, #f97316 0deg 180deg, #f3f4f6 180deg 360deg)',
                }}
                title="浅色模式"
              />
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={cn(
                  'h-10 w-10 rounded-full border-2 transition-all',
                  theme === 'dark' ? 'border-white/30 scale-110' : 'border-black/[0.04]',
                )}
                style={{
                  background:
                    'conic-gradient(from 90deg, #1c1c1e 0deg 180deg, #7c3aed 180deg 360deg)',
                }}
                title="深色模式"
              />
            </div>
          }
        />

        {/* Accent color */}
        <SettingsRow
          label="主题色"
          desc="选择主色调，影响按钮、链接、选中态等全局高亮色。"
          right={
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { color: '#007aff', label: '蓝色' },
                { color: '#10b981', label: '绿色' },
                { color: '#8b5cf6', label: '紫色' },
                { color: '#f97316', label: '橙色' },
                { color: '#ef4444', label: '红色' },
                { color: '#06b6d4', label: '青色' },
              ].map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`主题色 ${label}`}
                  onClick={() => setAccentColor(color)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all hover:scale-110',
                    accentColor === color ? 'border-black/40 scale-110' : 'border-black/[0.08]',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                id={accentCustomColorId}
                type="color"
                value={accentColor || '#007aff'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-full border border-black/10"
                aria-label="自定义颜色"
              />
            </div>
          }
        />

        <ToggleRow
          label="开机自启"
          desc="登录时自动启动 ClawCorp。"
          checked={launchAtStartup}
          onCheckedChange={setLaunchAtStartup}
        />
        <ToggleRow
          label="显示工具调用"
          desc="在对话消息中展示模型的工具调用详情块。"
          checked={showToolCalls}
          onCheckedChange={setShowToolCalls}
        />
        <ToggleRow
          label="仅以 Emoji 作为头像"
          desc="关闭彩色背景，仅显示 Emoji 和玻璃质感"
          checked={emojiAvatar}
          onCheckedChange={setEmojiAvatar}
        />
        <ToggleRow
          label="隐藏侧栏头像块背景"
          desc="使用全透明样式悬浮展示个人 Logo"
          checked={hideAvatarBg}
          onCheckedChange={setHideAvatarBg}
        />
        <ToggleRow
          label="关闭时隐藏到托盘"
          desc="点击顶部关闭按钮时不退出进程，维持 Cron 和通道在线"
          checked={minimizeToTray}
          onCheckedChange={setMinimizeToTray}
        />
      </SettingsCard>

      {/* 品牌与身份 */}
      <SettingsCard title="品牌与身份">
        <InputField label="工作台名称" value={brandName} onChange={setBrandName} />
        <InputField label="副标题" value={brandSubtitle} onChange={setBrandSubtitle} />
        <InputField label="我的名字指代" value={myName} onChange={setMyName} />
      </SettingsCard>

      {/* 品牌资产 ~ 退出登录：暂时注释 */}
      {/*
      <SettingsCard title="品牌资产">
        <BrandImageUploadField
          label="品牌 Logo"
          dataUrl={brandLogoDataUrl}
          previewAlt="品牌 Logo 预览"
          inputLabel="上传品牌 Logo"
          clearLabel="清除品牌 Logo"
          onUpload={(event) => handleBrandImageUpload(event, setBrandLogoDataUrl, 'logo')}
          onClear={() => setBrandLogoDataUrl(null)}
        />
        <BrandImageUploadField
          label="品牌图标"
          dataUrl={brandIconDataUrl}
          previewAlt="品牌图标预览"
          inputLabel="上传品牌图标"
          clearLabel="清除品牌图标"
          onUpload={(event) => handleBrandImageUpload(event, setBrandIconDataUrl, 'icon')}
          onClear={() => setBrandIconDataUrl(null)}
        />
      </SettingsCard>

      <div className="py-2 text-center">
        <button
          type="button"
          className="text-[13px] text-[#8e8e93] underline-offset-2 transition-colors hover:text-[#000000] hover:underline"
        >
          退出登录
        </button>
      </div>
      */}
    </>
  );
}

/* ─── Section: Model & Provider (07.2) ─── */

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6 (Anthropic)' },
  { value: 'claude-opus-4-6', label: 'claude-opus-4-6 (Anthropic)' },
  { value: 'gpt-4o', label: 'gpt-4o (OpenAI)' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (OpenAI)' },
  { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash (Google)' },
  { value: 'deepseek-chat', label: 'deepseek-chat (DeepSeek)' },
];

function ModelProviderSection({
  gatewayStatus,
  restartGateway,
}: {
  gatewayStatus: { state: string; port?: number };
  restartGateway: () => unknown;
}) {
  const isConnected = gatewayStatus.state === 'running';
  const { gatewayPort, setGatewayPort, defaultModel, setDefaultModel, contextLimit, setContextLimit } = useSettingsStore();
  const [portDraft, setPortDraft] = useState(String(gatewayPort));
  const [savingPort, setSavingPort] = useState(false);
  const defaultModelSelectId = useId();
  const contextLimitId = useId();
  const gatewayPortId = useId();

  return (
    <>
      {/* 默认路由与偏好 */}
      <SettingsCard title="默认路由与偏好">
        <div className="py-3">
          <label htmlFor={defaultModelSelectId} className="mb-2 block text-[13px] font-medium text-[#000000]">
            全局默认模型
          </label>
          <select
            id={defaultModelSelectId}
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="py-3">
          <label htmlFor={contextLimitId} className="mb-3 block text-[13px] font-medium text-[#000000]">
            对话上下文压缩阈值
          </label>
          <input
            id={contextLimitId}
            type="range"
            min={8000}
            max={128000}
            step={1000}
            value={contextLimit}
            onChange={(e) => setContextLimit(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--ac)' }}
          />
          <div className="mt-1 text-right text-[12px] text-[#8e8e93]">
            {contextLimit.toLocaleString()} Tokens
          </div>
        </div>
      </SettingsCard>

      {/* 云端服务商配置 */}
      <ProvidersSettings />

      {/* Gateway 配置 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-[#000000]">Gateway 配置</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                isConnected ? 'bg-[#dcfce7] text-[#059669]' : 'text-[#ef4444]',
              )}
            >
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7]"
              onClick={() => restartGateway()}
            >
              重新连接
            </button>
            <button
              type="button"
              className="rounded-md bg-[#ef4444] px-2.5 py-1 text-[12px] text-white transition-colors hover:bg-[#dc2626]"
            >
              重置连接
            </button>
            <button
              type="button"
              className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7]"
            >
              诊断
            </button>
          </div>
        </div>
        <div className="divide-y divide-black/[0.04]">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <label htmlFor={gatewayPortId} className="text-[13px] font-medium text-[#000000]">
                端口 (Port)
              </label>
              <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                修改端口后 Gateway 将自动重启，请确保目标端口未被其他程序占用。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                id={gatewayPortId}
                type="number"
                value={portDraft}
                onChange={(e) => setPortDraft(e.target.value)}
                className="w-[100px] rounded-lg border border-black/10 bg-[#f9f9f9] px-3 py-1.5 font-mono text-[12px] text-[#3c3c43] outline-none focus:border-clawx-ac focus:bg-white"
              />
              <button
                type="button"
                disabled={savingPort || portDraft === String(gatewayPort)}
                onClick={async () => {
                  const p = parseInt(portDraft, 10);
                  if (!p || p < 1024 || p > 65535) return;
                  setSavingPort(true);
                  setGatewayPort(p);
                  setSavingPort(false);
                }}
                className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7] disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 自定义模型 */}
      <SettingsCard
        title="自定义模型 (Custom Models)"
        headerRight={
          <button
            type="button"
            className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] text-[#3c3c43] transition-colors hover:bg-[#f2f2f7]"
          >
            + 添加自定义模型
          </button>
        }
      >
        <div className="rounded-lg border border-dashed border-black/10 py-8 text-center text-[13px] text-[#8e8e93]">
          暂无自定义模型 (No custom model)
        </div>
      </SettingsCard>

      {/* Connection tips */}
      <div className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-5 py-4 text-[13px]">
        <p className="mb-2 font-semibold text-[#1d4ed8]">连接异常时，可按以下方式尝试修复：</p>
        <ol className="space-y-1.5 text-[#1e40af]">
          <li>
            1. <strong>重新连接</strong> —
            主动断开并重连 WebSocket，适用于网络短暂抖动后的快速恢复。
          </li>
          <li>
            2. <strong>重置连接</strong> —
            清除本地缓存的 Gateway Token 并重新握手认证，适用于 Token 不匹配报错。
          </li>
          <li>
            3. <strong>诊断</strong> — 运行{' '}
            <code className="rounded bg-[#dbeafe] px-1 font-mono text-[12px]">
              openclaw doctor --json
            </code>{' '}
            检查环境变量、端口占用和权限。
          </li>
        </ol>
      </div>
    </>
  );
}

/* ─── Section: Team & Role Strategy (08.1) ─── */

function TeamRoleSection() {
  const { autoSpawn, setAutoSpawn, modelInherit, setModelInherit, strictIsolation, setStrictIsolation, orgTemplate, setOrgTemplate } = useSettingsStore();

  return (
    <>
      {/* 组织运行模板 */}
      <SettingsCard title="组织运行模板">
        <div className="py-3">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">当前默认架构方案</p>
          <select
            value={orgTemplate}
            onChange={(e) => setOrgTemplate(e.target.value)}
            aria-label="当前默认架构方案"
            className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
          >
            <option value="three-six">三省六部制（主脑调度，专业分身执行）</option>
            <option value="single-brain">单脑独立（主脑全权处理所有任务）</option>
            <option value="flat">扁平协作（所有 Agent 平级并行）</option>
          </select>
          <p className="mt-2 text-[12px] text-[#8e8e93]">
            在"团队 Map"面板中直观可视化当前激活的子智能体。
          </p>
        </div>
      </SettingsCard>

      {/* 派生规则 */}
      <SettingsCard title="派生规则">
        <ToggleRow
          label="允许运行时自动生成新角色"
          desc="主脑判断人手不够时，无需弹窗确认即可启动全新人设的分身。"
          checked={autoSpawn}
          onCheckedChange={setAutoSpawn}
        />
        <ToggleRow
          label="默认模型继承"
          desc="所有派生出的子 Agent 默认沿用主脑的 Providers 配置，禁止单独越权发起私有计费模型调用。"
          checked={modelInherit}
          onCheckedChange={setModelInherit}
        />
      </SettingsCard>

      {/* 隔离与共享 */}
      <SettingsCard title="隔离与共享">
        <ToggleRow
          label="严格显式传参（隔离态）"
          desc="子 Agent 看不到主对话，只能看到派发给它的任务参数，保证 Token 高效且防串线。"
          checked={strictIsolation}
          onCheckedChange={setStrictIsolation}
        />
      </SettingsCard>
    </>
  );
}

/* ─── Section: Channel Advanced Config (08.2) ─── */

function ChannelAdvancedSection() {
  const {
    groupRate,
    setGroupRate,
    groupChatMode,
    setGroupChatMode,
    channelRouteRules,
    addChannelRouteRule,
    removeChannelRouteRule,
  } = useSettingsStore();
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [routeDraft, setRouteDraft] = useState('');

  const handleAddRouteRule = async () => {
    const normalized = routeDraft.trim();
    if (!normalized) {
      return;
    }
    if (channelRouteRules.includes(normalized)) {
      toast.error('该路由规则已存在');
      return;
    }
    try {
      const added = await addChannelRouteRule(normalized);
      if (!added) return;
      setRouteDraft('');
      setRouteEditorOpen(false);
      toast.success('已添加路由规则');
    } catch {
      toast.error('保存路由规则失败');
    }
  };

  return (
    <>
      {/* 群聊发言默认策略 */}
      <SettingsCard title="群聊发言默认策略">
        <div className="py-3">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">默认群聊行为模式</p>
          <select
            value={groupChatMode}
            onChange={(e) => setGroupChatMode(e.target.value)}
            aria-label="默认群聊行为模式"
            className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
          >
            <option value="at-trigger">@触发（仅被 @ 时回复）</option>
            <option value="all-listen">全量监听（所有消息都响应）</option>
            <option value="silent">静默（不主动发言）</option>
          </select>
        </div>
      </SettingsCard>

      {/* 路由分发矩阵 */}
      <SettingsCard title="路由分发矩阵">
        <EditableChipList
          items={channelRouteRules}
          emptyLabel="暂无路由规则，请先在「频道」页面配置频道后添加"
          listLabel="已配置路由规则"
          onRemove={removeChannelRouteRule}
        />
        <div className="py-2">
          <button
            type="button"
            onClick={() => setRouteEditorOpen((open) => !open)}
            className="w-full rounded-lg border border-dashed border-black/10 py-2 text-[13px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7]"
          >
            + 添加路由规则
          </button>
          {routeEditorOpen ? (
            <InlineListComposer
              label="新增路由规则"
              placeholder="例如：support-* -> planner-agent"
              value={routeDraft}
              onChange={setRouteDraft}
              onSubmit={handleAddRouteRule}
              onCancel={() => {
                setRouteDraft('');
                setRouteEditorOpen(false);
              }}
              submitLabel="保存规则"
            />
          ) : null}
        </div>
      </SettingsCard>

      {/* 风控防骚扰 */}
      <SettingsCard title="风控防骚扰">
        <div className="py-3">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">群聊每分钟发言上限</p>
          <input
            type="number"
            value={groupRate}
            onChange={(e) => setGroupRate(e.target.value)}
            aria-label="群聊每分钟发言上限"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
          />
          <p className="mt-1.5 text-[12px] text-[#8e8e93]">超出后进入 5 分钟的静默冷却。</p>
        </div>
      </SettingsCard>
    </>
  );
}

/* ─── Section: Automation Defaults (08.3) ─── */

function AutomationDefaultsSection() {
  const {
    workerSlots, setWorkerSlots, maxDailyRuns, setMaxDailyRuns,
    exponentialBackoff, setExponentialBackoff, agentSelfHeal, setAgentSelfHeal,
    suspendOnFail, setSuspendOnFail, mobileAlert, setMobileAlert,
  } = useSettingsStore();

  const selectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238e8e93' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
  };

  return (
    <>
      <SettingsCard title="调度参数限制">
        <div className="py-3">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">并行 Worker 槽位</p>
          <select
            value={workerSlots}
            onChange={(e) => setWorkerSlots(e.target.value)}
            aria-label="并行 Worker 槽位"
            className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
            style={selectStyle}
          >
            <option value="2">2 并发 (轻量)</option>
            <option value="4">4 并发 (均衡)</option>
            <option value="8">8 并发 (高性能)</option>
            <option value="16">16 并发 (企业级)</option>
          </select>
        </div>
        <div className="py-3">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">单日最大自动化运行次数</p>
          <input
            type="number"
            value={maxDailyRuns}
            onChange={(e) => setMaxDailyRuns(e.target.value)}
            aria-label="单日最大自动化运行次数"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
          />
          <p className="mt-1.5 text-[12px] text-[#8e8e93]">防止死循环剧烈消耗配额。</p>
        </div>
      </SettingsCard>

      <SettingsCard title="失败处理与重试">
        <ToggleRow
          label="断网或超时后指数退避重试 (Exponential Backoff)"
          desc="采用 1min / 5min / 15min / 1hour 进行 4 次尝试"
          checked={exponentialBackoff}
          onCheckedChange={setExponentialBackoff}
        />
        <ToggleRow
          label="工具报错让 Agent 原地思辨"
          desc="当 API 报 400 时，给 Agent 至多 3 轮机会尝试修复参数"
          checked={agentSelfHeal}
          onCheckedChange={setAgentSelfHeal}
        />
      </SettingsCard>

      <SettingsCard title="告警触发器">
        <ToggleRow
          label="连续失败将任务挂起并标红 (Suspend)"
          desc="不轻易跳过，等待人类处理"
          checked={suspendOnFail}
          onCheckedChange={setSuspendOnFail}
        />
        <ToggleRow
          label="主系统发呆、熔断推送到手机通道"
          desc="通过通知组件强制唤醒人类监管审核"
          checked={mobileAlert}
          onCheckedChange={setMobileAlert}
        />
      </SettingsCard>
    </>
  );
}

/* ─── Section: Skills & MCP (09.2) ─── */

export function SettingsSkillsMcpPanel() {
  const { skills, loading: skillsLoading, fetchSkills, enableSkill, disableSkill } = useSkillsStore();
  const { status: gatewayStatus } = useGatewayStore();
  const isGatewayConnected = gatewayStatus.state === 'running';
  const [activeTab, setActiveTab] = useState<'skills' | 'mcp'>('skills');
  const { t } = useTranslation('settings');

  useEffect(() => {
    void fetchSkills();
  }, [fetchSkills]);

  const handleSkillToggle = async (skillId: string, enabled: boolean) => {
    try {
      if (enabled) await enableSkill(skillId);
      else await disableSkill(skillId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#d1d5db] bg-[#f8fafc] p-2">
        <div className="mb-3">
          <p className="text-[14px] font-medium text-[#111827]">
            {t('skillsMcp.overview.title', { defaultValue: '全局 Skills 与 MCP 中心' })}
          </p>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            {t('skillsMcp.overview.description', { defaultValue: '成员技能分配和编辑仍由 TeamMap 负责。' })}
          </p>
        </div>
        <div
          role="tablist"
          aria-label={t('skillsMcp.overview.tabsAriaLabel', { defaultValue: 'Skills 与 MCP 视图切换' })}
          className="inline-flex rounded-xl bg-[#e5e7eb] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skills'}
            aria-controls="settings-skills-panel"
            id="settings-skills-tab"
            data-state={activeTab === 'skills' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('skills')}
            className={cn(
              'rounded-lg px-4 py-2 text-[13px] font-medium transition-colors',
              activeTab === 'skills' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6b7280] hover:text-[#111827]',
            )}
          >
            {t('skillsMcp.tabs.skills', { defaultValue: 'Skills' })}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mcp'}
            aria-controls="settings-mcp-panel"
            id="settings-mcp-tab"
            data-state={activeTab === 'mcp' ? 'active' : 'inactive'}
            onClick={() => setActiveTab('mcp')}
            className={cn(
              'rounded-lg px-4 py-2 text-[13px] font-medium transition-colors',
              activeTab === 'mcp' ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6b7280] hover:text-[#111827]',
            )}
          >
            {t('skillsMcp.tabs.mcp', { defaultValue: 'MCP' })}
          </button>
        </div>
      </div>

      {activeTab === 'skills' ? (
        <SettingsCard
          key="skills"
          aria-labelledby="settings-skills-tab"
          role="tabpanel"
          id="settings-skills-panel"
          title={t('skillsMcp.skillsCard.title', { defaultValue: '已安装内置技能 (Native Skills)' })}
          headerRight={(
            <button type="button" onClick={() => void fetchSkills()} className="text-[12px] text-[#8e8e93] hover:text-[#000000]">
              {t('skillsMcp.skillsCard.refresh', { defaultValue: '↻ 刷新' })}
            </button>
          )}
        >
          {!isGatewayConnected && (
            <div className="my-2 rounded-lg border border-[#fbbf24]/30 bg-[#fffbeb] px-3 py-2.5">
              <span className="text-[13px] text-[#92400e]">
                {t('skillsMcp.skillsCard.gatewayWarning', { defaultValue: '⚠ Gateway 未连接。请先连接 Gateway 再管理技能。' })}
              </span>
            </div>
          )}

          {skillsLoading ? (
            <div className="py-6 text-center text-[13px] text-[#8e8e93]">
              {t('skillsMcp.skillsCard.loading', { defaultValue: '加载中...' })}
            </div>
          ) : skills.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-[#8e8e93]">
              {t('skillsMcp.skillsCard.empty', { defaultValue: '暂无已安装技能' })}
            </div>
          ) : (
            skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p id={`skill-overview-${skill.id}`} className="text-[13px] font-medium text-[#000000]">
                    {skill.icon && <span className="mr-1.5">{skill.icon}</span>}
                    {skill.name}
                    {skill.version && <span className="ml-1.5 text-[11px] font-normal text-[#c6c6c8]">v{skill.version}</span>}
                    {skill.isCore ? (
                      <span className="ml-1.5 rounded-full bg-[#f2f2f7] px-1.5 py-0.5 text-[10px] text-[#8e8e93]">
                        {t('skillsMcp.skillsCard.coreBadge', { defaultValue: '核心' })}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#8e8e93]">{skill.description}</p>
                </div>
                <Switch
                  checked={skill.enabled}
                  disabled={skill.isCore}
                  onCheckedChange={(value) => void handleSkillToggle(skill.id, value)}
                  aria-label={skill.name}
                />
              </div>
            ))
          )}

          <div className="py-3 text-center">
            <button type="button" className="text-[13px] text-clawx-ac hover:underline">
              {t('skillsMcp.skillsCard.browseMarketplace', { defaultValue: '浏览技能市场...' })}
            </button>
          </div>
        </SettingsCard>
      ) : null}

      {activeTab === 'mcp' ? (
        <SettingsCard
          key="mcp"
          aria-labelledby="settings-mcp-tab"
          role="tabpanel"
          id="settings-mcp-panel"
          title={t('skillsMcp.mcpCard.title', { defaultValue: 'MCP 服务与 Runtime' })}
        >
          <McpTab />
        </SettingsCard>
      ) : null}
    </div>
  );
}

/* ─── Section: Tool Permissions (09.3) ─── */

export function SettingsToolPermissionsPanel() {
  const {
    globalRiskLevel,
    setGlobalRiskLevel,
    fileAcl,
    setFileAcl,
    terminalAcl,
    setTerminalAcl,
    networkAcl,
    setNetworkAcl,
    filePathAllowlist,
    addFilePathAllowlistEntry,
    removeFilePathAllowlistEntry,
    terminalCommandBlocklist,
    addTerminalCommandBlocklistEntry,
    removeTerminalCommandBlocklistEntry,
    customToolGrants,
    addCustomToolGrant,
    removeCustomToolGrant,
  } = useSettingsStore();
  const [whitelistEditorOpen, setWhitelistEditorOpen] = useState(false);
  const [whitelistDraft, setWhitelistDraft] = useState('');
  const [blacklistEditorOpen, setBlacklistEditorOpen] = useState(false);
  const [blacklistDraft, setBlacklistDraft] = useState('');
  const [grantEditorOpen, setGrantEditorOpen] = useState(false);
  const [grantDraft, setGrantDraft] = useState('');

  const selectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238e8e93' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
  };

  const handleAppendUniqueItem = (
    value: string,
    existingItems: string[],
    addItem: (item: string) => Promise<boolean>,
    successMessage: string,
    duplicateMessage: string,
    reset: () => void,
  ) => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }
    if (existingItems.includes(normalized)) {
      toast.error(duplicateMessage);
      return;
    }
    void (async () => {
      try {
        const added = await addItem(normalized);
        if (!added) return;
        reset();
        toast.success(successMessage);
      } catch {
        toast.error('保存失败，请稍后重试');
      }
    })();
  };

  const handleQuickGrant = (template: string) => {
    handleAppendUniqueItem(
      template,
      customToolGrants,
      addCustomToolGrant,
      `已添加工具许可：${template}`,
      `工具许可已存在：${template}`,
      () => undefined,
    );
  };

  return (
    <>
      <SettingsCard title="核心沙箱与内置权限">
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-clawx-ac" />
            <p className="text-[13px] font-medium text-[#000000]">
              全局风险级别设定
            </p>
          </div>
          <select
            className="w-[260px] shrink-0 appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[12px] text-[#3c3c43] outline-none focus:border-clawx-ac"
            style={selectStyle}
            value={globalRiskLevel}
            aria-label="全局风险级别设定"
            onChange={(event) =>
              setGlobalRiskLevel(event.target.value as 'standard' | 'strict' | 'permissive')
            }
          >
            <option value="standard">Standard 防御模式 (读受控区、写必审批)</option>
            <option value="strict">Strict 锁定模式 (只读)</option>
            <option value="permissive">Permissive 宽松模式 (全量访问)</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#000000]">本地文件操作 (File I/O ACL)</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              仅允许读写 Workspace 及指定 repo，拦截越权访问
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setWhitelistEditorOpen((open) => !open)}
              className="rounded border border-black/10 px-2 py-1 text-[11px] text-[#3c3c43] hover:bg-[#f2f2f7]"
            >
              路径白名单
            </button>
            <Switch checked={fileAcl} onCheckedChange={setFileAcl} aria-label="本地文件操作 (File I/O ACL)" />
          </div>
        </div>
        <EditableChipList
          items={filePathAllowlist}
          emptyLabel="暂无路径白名单，默认仅允许当前 Workspace。"
          listLabel="路径白名单"
          onRemove={removeFilePathAllowlistEntry}
        />
        {whitelistEditorOpen ? (
          <InlineListComposer
            label="新增允许访问路径"
            placeholder="例如：C:\\Projects\\ClawCorp"
            value={whitelistDraft}
            onChange={setWhitelistDraft}
            onSubmit={() =>
              handleAppendUniqueItem(
                whitelistDraft,
                filePathAllowlist,
                addFilePathAllowlistEntry,
                '已添加路径白名单',
                '该路径已在白名单中',
                () => {
                  setWhitelistDraft('');
                  setWhitelistEditorOpen(false);
                },
              )
            }
            onCancel={() => {
              setWhitelistDraft('');
              setWhitelistEditorOpen(false);
            }}
            submitLabel="保存路径"
          />
        ) : null}

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#000000]">终端命令执行 (Terminal ACL)</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              拦截 rm -rf、sudo 等高危命令，允许常规构建指令
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setBlacklistEditorOpen((open) => !open)}
              className="rounded border border-black/10 px-2 py-1 text-[11px] text-[#3c3c43] hover:bg-[#f2f2f7]"
            >
              ◎ 编辑黑名单
            </button>
            <Switch checked={terminalAcl} onCheckedChange={setTerminalAcl} aria-label="终端命令执行 (Terminal ACL)" />
          </div>
        </div>
        <EditableChipList
          items={terminalCommandBlocklist}
          emptyLabel="暂无终端命令黑名单。"
          listLabel="终端命令黑名单"
          onRemove={removeTerminalCommandBlocklistEntry}
        />
        {blacklistEditorOpen ? (
          <InlineListComposer
            label="新增命令黑名单"
            placeholder="例如：rm -rf /"
            value={blacklistDraft}
            onChange={setBlacklistDraft}
            onSubmit={() =>
              handleAppendUniqueItem(
                blacklistDraft,
                terminalCommandBlocklist,
                addTerminalCommandBlocklistEntry,
                '已添加命令黑名单',
                '该命令已在黑名单中',
                () => {
                  setBlacklistDraft('');
                  setBlacklistEditorOpen(false);
                },
              )
            }
            onCancel={() => {
              setBlacklistDraft('');
              setBlacklistEditorOpen(false);
            }}
            submitLabel="保存黑名单"
          />
        ) : null}

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#000000]">
              网络与依赖下载 (Network & Package Managers)
            </p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              允许 wget、curl、pip、pnpm 进系统的副作用操作
            </p>
          </div>
          <Switch checked={networkAcl} onCheckedChange={setNetworkAcl} aria-label="网络与依赖下载 (Network & Package Managers)" />
        </div>
      </SettingsCard>

      <SettingsCard
        title="自定义工具授权"
        headerRight={
          <button
            type="button"
            onClick={() => setGrantEditorOpen((open) => !open)}
            className="rounded-lg bg-[#111] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#333]"
          >
            添加工具许可
          </button>
        }
      >
        <div className="py-2">
          <p className="mb-2 text-[13px] font-medium text-[#000000]">快速授权模版 (Quick Templates)</p>
          <div className="flex flex-wrap gap-2">
            {['Python 解释器', 'Docker Socket', 'Git CLI', 'Node.js 环境'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleQuickGrant(t)}
                className="rounded-full border border-black/10 px-3 py-1 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>

        <EditableChipList
          items={customToolGrants}
          emptyLabel="暂无自定义工具授权"
          listLabel="自定义工具授权"
          onRemove={removeCustomToolGrant}
        />
        {grantEditorOpen ? (
          <InlineListComposer
            label="新增工具许可"
            placeholder="例如：github-cli --repo anthropics/claude-code"
            value={grantDraft}
            onChange={setGrantDraft}
            onSubmit={() =>
              handleAppendUniqueItem(
                grantDraft,
                customToolGrants,
                addCustomToolGrant,
                '已添加工具许可',
                '该工具许可已存在',
                () => {
                  setGrantDraft('');
                  setGrantEditorOpen(false);
                },
              )
            }
            onCancel={() => {
              setGrantDraft('');
              setGrantEditorOpen(false);
            }}
            submitLabel="保存许可"
          />
        ) : null}
      </SettingsCard>
    </>
  );
}

/* ─── Section: Agent Avatars ─── */

function AgentAvatarsSection() {
  const { t } = useTranslation(['settings']);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; avatar?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [agentStatus, setAgentStatus] = useState<Record<string, 'uploading' | 'removing' | 'success' | 'error'>>({});

  useEffect(() => {
    hostApiFetch<{ agents: Array<{ id: string; name: string; avatar?: string }> }>('/api/agents')
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = (agentId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings:avatarImageRequired'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAgentStatus((s) => ({ ...s, [agentId]: 'uploading' }));
      hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PUT',
        body: JSON.stringify({ avatar: dataUrl }),
      })
        .then(() => {
          setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, avatar: dataUrl } : a));
          setAgentStatus((s) => ({ ...s, [agentId]: 'success' }));
          toast.success(t('settings:avatarUpdated'));
          setTimeout(() => setAgentStatus((s) => { const n = { ...s }; delete n[agentId]; return n; }), 2000);
        })
        .catch(() => {
          setAgentStatus((s) => ({ ...s, [agentId]: 'error' }));
          toast.error(t('settings:avatarUploadFailed'));
          setTimeout(() => setAgentStatus((s) => { const n = { ...s }; delete n[agentId]; return n; }), 2000);
        });
    };
    reader.onerror = () => toast.error(t('settings:avatarReadFailed'));
    reader.readAsDataURL(file);
  };

  const handleRemove = (agentId: string) => {
    setAgentStatus((s) => ({ ...s, [agentId]: 'removing' }));
    hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      body: JSON.stringify({ avatar: null }),
    })
      .then(() => {
        setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, avatar: undefined } : a));
        setAgentStatus((s) => ({ ...s, [agentId]: 'success' }));
        toast.success(t('settings:avatarRemoved'));
        setTimeout(() => setAgentStatus((s) => { const n = { ...s }; delete n[agentId]; return n; }), 2000);
      })
      .catch(() => {
        setAgentStatus((s) => ({ ...s, [agentId]: 'error' }));
        toast.error(t('settings:avatarRemoveFailed'));
        setTimeout(() => setAgentStatus((s) => { const n = { ...s }; delete n[agentId]; return n; }), 2000);
      });
  };

  return (
    <SettingsCard title={t('settings:agentAvatars')}>
      {loading ? (
        <p className="py-4 text-center text-[13px] text-[#8e8e93]">{t('settings:agentAvatarsLoading')}</p>
      ) : agents.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-[#8e8e93]">{t('settings:agentAvatarsEmpty')}</p>
      ) : (
        agents.map((agent) => {
          const inputId = `agent-avatar-${agent.id}`;
          const status = agentStatus[agent.id];
          const busy = status === 'uploading' || status === 'removing';
          return (
            <div key={agent.id} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#f2f2f7]">
                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[16px]">🤖</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#000000]">{agent.name}</p>
                <p className="text-[11px] text-[#8e8e93]">{agent.id}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label
                  htmlFor={inputId}
                  className={cn(
                    'cursor-pointer rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]',
                    busy && 'pointer-events-none opacity-50',
                  )}
                >
                  {status === 'uploading' ? '...' : t('settings:uploadAvatar')}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => handleUpload(agent.id, e)}
                />
                {agent.avatar ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemove(agent.id)}
                    className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === 'removing' ? '...' : t('settings:removeAvatar')}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </SettingsCard>
  );
}


type EditableChipListProps = {
  items: string[];
  emptyLabel: string;
  listLabel: string;
  onRemove: (item: string) => void;
};

function EditableChipList({ items, emptyLabel, listLabel, onRemove }: EditableChipListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/10 py-6 text-center text-[13px] text-[#8e8e93]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul aria-label={listLabel} className="flex flex-wrap gap-2 py-3">
      {items.map((item) => (
        <li key={item}>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f8fb] px-3 py-1.5 text-[12px] text-[#3c3c43]">
            <span>{item}</span>
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="rounded-full px-1 text-[#8e8e93] transition-colors hover:bg-[#e5e5ea] hover:text-[#000000]"
              aria-label={`移除 ${item}`}
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

type InlineListComposerProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
};

function InlineListComposer({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: InlineListComposerProps) {
  const inputId = useId();
  return (
    <div className="mt-3 rounded-xl border border-black/[0.08] bg-[#fafafa] p-3">
      <label htmlFor={inputId} className="mb-2 block text-[12px] font-medium text-[#3c3c43]">{label}</label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] text-[#3c3c43] hover:bg-[#f2f2f7]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-lg bg-clawx-ac px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0056b3]"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── AutoUpdateSection ─── */

import type { UpdateStatus, UpdateInfo, ProgressInfo } from '@/stores/update';

function AutoUpdateSection({
  currentVersion,
  autoCheckUpdate,
  setAutoCheckUpdate,
  autoDownloadUpdate,
  setAutoDownloadUpdate,
  updateSetAutoDownload,
  updateStatus,
  updateInfo,
  updateProgress,
  updateError,
  updatePolicy,
  updateSetChannel,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  initUpdate,
}: {
  currentVersion: string;
  autoCheckUpdate: boolean;
  setAutoCheckUpdate: (v: boolean) => void;
  autoDownloadUpdate: boolean;
  setAutoDownloadUpdate: (v: boolean) => void;
  updateSetAutoDownload: (v: boolean) => void;
  updateStatus: UpdateStatus;
  updateInfo: UpdateInfo | null;
  updateProgress: ProgressInfo | null;
  updateError: string | null;
  updatePolicy: import('@/stores/update').UpdatePolicySnapshot | null;
  updateSetChannel: (channel: 'stable' | 'beta' | 'dev') => Promise<void>;
  checkForUpdates: (options?: { reason?: 'manual' | 'startup'; respectPolicy?: boolean }) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  initUpdate: () => Promise<void>;
}) {
  useEffect(() => { void initUpdate(); }, [initUpdate]);

  const nextEligibleLabel = updatePolicy?.nextEligibleAt
    ? new Date(updatePolicy.nextEligibleAt).toLocaleString('zh-CN')
    : 'Immediate';

  const statusLabel: Record<UpdateStatus, string> = {
    idle: '空闲',
    checking: '检查中...',
    available: '有新版本',
    'not-available': '已是最新',
    downloading: '下载中...',
    downloaded: '已下载，可安装',
    error: '出错',
  };

  return (
    <>
      <SettingsSectionCard title="当前版本" description="">
        <div className="flex items-center justify-between rounded-xl bg-[#f2f2f7] px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-[#000000]">ClawCorp v{currentVersion}</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              状态：{statusLabel[updateStatus]}
              {updateInfo ? ` — 新版本 v${updateInfo.version}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {updateStatus === 'available' && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg text-[12px]"
                onClick={() => void downloadUpdate()}
              >
                下载更新
              </Button>
            )}
            {updateStatus === 'downloaded' && (
              <Button
                size="sm"
                className="rounded-lg bg-clawx-ac text-[12px] text-white hover:bg-[#0056b3]"
                onClick={installUpdate}
              >
                立即安装
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-[12px]"
              onClick={() => void checkForUpdates()}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            >
              {updateStatus === 'checking' ? '检查中...' : '检查更新'}
            </Button>
          </div>
        </div>

        {updateStatus === 'downloading' && updateProgress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px] text-[#8e8e93]">
              <span>下载进度</span>
              <span>{Math.round(updateProgress.percent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f2f2f7]">
              <div
                className="h-full rounded-full bg-clawx-ac transition-all"
                style={{ width: `${updateProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {updateError && (
          <p className="mt-2 text-[12px] text-[#ef4444]">{updateError}</p>
        )}

        {updateInfo?.releaseNotes && (
          <div className="mt-3 rounded-xl bg-[#f2f2f7] px-4 py-3">
            <p className="mb-1 text-[12px] font-medium text-[#3c3c43]">更新说明</p>
            <p className="text-[12px] text-[#8e8e93]">{String(updateInfo.releaseNotes)}</p>
          </div>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard title="自动更新策略" description="">
        <ToggleRow
          label="自动检查更新"
          desc="启动时自动检查是否有新版本可用。"
          checked={autoCheckUpdate}
          onCheckedChange={setAutoCheckUpdate}
        />
        <ToggleRow
          label="自动下载更新"
          desc="发现新版本后自动在后台下载，下载完成后提示安装。"
          checked={autoDownloadUpdate}
          onCheckedChange={(v) => {
            setAutoDownloadUpdate(v);
            void updateSetAutoDownload(v);
          }}
        />
        <div className="mt-3 rounded-xl bg-[#f2f2f7] px-4 py-3 text-[12px] text-[#3c3c43]">
          <label className="block">
            <span className="text-[#8e8e93]">更新渠道</span>
            <select
              aria-label="更新渠道"
              value={updatePolicy?.channel ?? 'stable'}
              onChange={(event) => {
                void updateSetChannel(event.target.value as 'stable' | 'beta' | 'dev');
              }}
              className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-clawx-ac"
            >
              <option value="stable">稳定版</option>
              <option value="beta">测试版</option>
              <option value="dev">开发版</option>
            </select>
          </label>
        </div>
        <div className="mt-3 rounded-xl bg-[#f2f2f7] px-4 py-3 text-[12px] text-[#3c3c43]">
          <p className="font-medium text-[#111827]">更新策略</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-[#8e8e93]">渠道</span>
              <p className="mt-0.5">{updatePolicy?.channel ?? 'stable'}</p>
            </div>
            <div>
              <span className="text-[#8e8e93]">检查次数</span>
              <p className="mt-0.5">{updatePolicy?.attemptCount ?? 0}</p>
            </div>
            <div>
              <span className="text-[#8e8e93]">下次可检查</span>
              <p className="mt-0.5">{nextEligibleLabel}</p>
            </div>
            <div>
              <span className="text-[#8e8e93]">推送延迟</span>
              <p className="mt-0.5">{Math.round((updatePolicy?.rolloutDelayMs ?? 0) / 60000)} min</p>
            </div>
          </div>
        </div>
      </SettingsSectionCard>
    </>
  );
}
export default Settings;
