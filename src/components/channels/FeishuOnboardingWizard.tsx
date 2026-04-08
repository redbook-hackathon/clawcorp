import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { CHANNEL_NAMES } from '@/types/channel';

type FeishuIntegrationStatus = {
  docsVersion: string;
  openClaw: {
    version: string | null;
    minVersion: string;
    compatible: boolean;
  };
  plugin: {
    bundledVersion: string | null;
    bundledSource: string | null;
    installedVersion: string | null;
    installedPath: string | null;
    recommendedVersion: string;
    installed: boolean;
    needsUpdate: boolean;
  };
  channel: {
    configured: boolean;
    accountIds: string[];
    pluginEnabled: boolean;
  };
  nextAction: 'upgrade-openclaw' | 'install-plugin' | 'update-plugin' | 'configure-channel' | 'ready';
};

type FeishuDoctorSummary = {
  doctor: {
    success: boolean;
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
    error?: string;
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  status: FeishuIntegrationStatus;
};

type FeishuAuthSessionRecord = {
  id: string;
  accountId: string;
  appId: string;
  brand: string;
  state: 'pending' | 'success' | 'failed';
  verificationUriComplete: string;
  qrCodeDataUrl: string;
  userCode: string;
  scopeCount: number;
  createdAt: string;
  expiresAt: string;
  message?: string;
  userOpenId?: string;
  appPermissionUrl?: string;
  missingAppScopes?: string[];
};

type FeishuRobotCreationEntry = {
  url: string;
  qrCodeDataUrl: string;
};

export type FeishuWizardStep = 'choose' | 'create' | 'configure';

interface FeishuOnboardingWizardProps {
  accountId?: string;
  autoStartAuthorization?: boolean;
  initialConfigValues?: Partial<Record<'appId' | 'appSecret', string>>;
  initialChannelName?: string;
  initialStep?: FeishuWizardStep;
  onClose: () => void;
  onConfigured?: (params: { channelName: string }) => void | Promise<void>;
}

export function FeishuOnboardingWizard({
  accountId = 'default',
  autoStartAuthorization = false,
  initialConfigValues,
  initialChannelName = '',
  initialStep = 'choose',
  onClose,
  onConfigured,
}: FeishuOnboardingWizardProps) {
  const { t } = useTranslation(['channels', 'common']);
  const [status, setStatus] = useState<FeishuIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [doctoring, setDoctoring] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorSummary, setDoctorSummary] = useState<FeishuDoctorSummary | null>(null);
  const [authSession, setAuthSession] = useState<FeishuAuthSessionRecord | null>(null);
  const [creationEntry, setCreationEntry] = useState<FeishuRobotCreationEntry | null>(null);
  const [step, setStep] = useState<FeishuWizardStep>(initialStep);
  const [channelName] = useState(initialChannelName.trim());
  const [appId, setAppId] = useState(initialConfigValues?.appId ?? '');
  const [appSecret, setAppSecret] = useState(initialConfigValues?.appSecret ?? '');
  const autoStartRef = useRef(false);

  const loadStatus = async (): Promise<FeishuIntegrationStatus | null> => {
    setLoading(true);
    setError(null);
    try {
      const next = await hostApiFetch<FeishuIntegrationStatus>('/api/feishu/status');
      setStatus(next);
      return next;
    } catch (nextError) {
      setError(String(nextError));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (appId || appSecret) return;
    let active = true;
    void hostApiFetch<{ values?: Record<string, string> }>(
      `/api/channels/config/feishu?accountId=${encodeURIComponent(accountId)}`,
    )
      .then((result) => {
        if (!active) return;
        setAppId((current) => current || result.values?.appId || '');
        setAppSecret((current) => current || result.values?.appSecret || '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [accountId, appId, appSecret]);

  const primaryAction = useMemo(() => {
    if (!status) return null;
    if (status.nextAction === 'install-plugin') {
      return { label: t('wizard.actions.installPlugin'), path: '/api/feishu/install' };
    }
    if (status.nextAction === 'update-plugin') {
      return { label: t('wizard.actions.updatePlugin'), path: '/api/feishu/update' };
    }
    return null;
  }, [status, t]);

  const authNeedsAppPermission = Boolean(authSession?.state === 'failed' && authSession?.appPermissionUrl);
  const canStartAuthorization = Boolean(status?.channel?.configured && status?.channel?.pluginEnabled);

  const handleInstallOrUpdate = async () => {
    if (!primaryAction) return;
    setInstalling(true);
    setError(null);
    try {
      await hostApiFetch(primaryAction.path, { method: 'POST' });
      await loadStatus();
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setInstalling(false);
    }
  };

  const handleDoctor = async () => {
    setDoctoring(true);
    setError(null);
    try {
      const result = await hostApiFetch<FeishuDoctorSummary>('/api/feishu/doctor', { method: 'POST' });
      setDoctorSummary(result);
      setStatus(result.status);
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setDoctoring(false);
    }
  };

  useEffect(() => {
    if (!authSession || authSession.state !== 'pending') return undefined;

    const timer = window.setInterval(async () => {
      try {
        const next = await hostApiFetch<FeishuAuthSessionRecord>(`/api/feishu/auth/status?sessionId=${encodeURIComponent(authSession.id)}`);
        setAuthSession(next);
      } catch (nextError) {
        setError(String(nextError));
      }
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [authSession]);

  const handleStartAuthorization = async () => {
    setAuthorizing(true);
    setError(null);
    try {
      const next = await hostApiFetch<FeishuAuthSessionRecord>('/api/feishu/auth/start', {
        method: 'POST',
        body: JSON.stringify({ accountId }),
      });
      setAuthSession(next);
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setAuthorizing(false);
    }
  };

  useEffect(() => {
    if (
      !autoStartAuthorization
      || autoStartRef.current
      || loading
      || !canStartAuthorization
      || authSession
    ) {
      return;
    }

    autoStartRef.current = true;
    void handleStartAuthorization();
  }, [autoStartAuthorization, loading, canStartAuthorization, authSession]);

  const handleStartRobotCreation = async () => {
    setAuthorizing(true);
    setError(null);
    try {
      const next = await hostApiFetch<FeishuRobotCreationEntry>('/api/feishu/create/start', {
        method: 'POST',
      });
      setCreationEntry(next);
      setStep('create');
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!appId.trim() || !appSecret.trim()) return;
    setSavingConfig(true);
    setError(null);
    try {
      const result = await hostApiFetch<{ success?: boolean; error?: string }>('/api/channels/config', {
        method: 'POST',
        body: JSON.stringify({
          channelType: 'feishu',
          accountId,
          config: {
            appId: appId.trim(),
            appSecret: appSecret.trim(),
          },
        }),
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save Feishu config');
      }

      await onConfigured?.({
        channelName: channelName || CHANNEL_NAMES.feishu,
      });

      setAuthSession(null);
      setCreationEntry(null);
      setStep('choose');
      await loadStatus();
      await handleStartAuthorization();
    } catch (nextError) {
      setError(String(nextError));
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-3xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-black/[0.06] px-6 py-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[#111827]">{t('wizard.title')}</h2>
            <p className="mt-1 text-[13px] text-[#6b7280]">
              {t('wizard.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-[13px] text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
          >
            {t('common:actions.close')}
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {loading ? (
            <div className="rounded-2xl border border-black/[0.06] bg-[#f8fafc] px-4 py-6 text-[13px] text-[#6b7280]">
              {t('wizard.loadingStatus')}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-[#ef4444]/20 bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
              {error}
            </div>
          ) : status ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <StatusCard
                  title={t('wizard.cards.openClawVersion')}
                  subtitle={status.openClaw?.version ?? t('wizard.cards.unknownVersion')}
                  tone={status.openClaw?.compatible ? 'ok' : 'warn'}
                  detail={t('wizard.cards.minVersion', { version: status.openClaw?.minVersion ?? 'unknown' })}
                />
                <StatusCard
                  title={t('wizard.cards.pluginVersion')}
                  subtitle={status.plugin?.installedVersion ?? t('wizard.cards.notInstalled')}
                  tone={status.plugin?.installed ? (status.plugin?.needsUpdate ? 'warn' : 'ok') : 'warn'}
                  detail={t('wizard.cards.recommendedVersion', { version: status.plugin?.recommendedVersion ?? 'unknown' })}
                />
                <StatusCard
                  title={t('wizard.cards.channelConfig')}
                  subtitle={status.channel?.configured
                    ? t('wizard.cards.accountCount', { count: status.channel?.accountIds?.length ?? 0 })
                    : t('wizard.cards.notConfigured')}
                  tone={status.channel?.configured && status.channel?.pluginEnabled ? 'ok' : 'neutral'}
                  detail={status.channel?.pluginEnabled ? t('wizard.cards.pluginEnabled') : t('wizard.cards.pluginDisabled')}
                />
              </div>

              {primaryAction ? (
                <div className="rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-[#1d4ed8]">{primaryAction.label}</p>
                      <p className="mt-1 text-[12px] text-[#3b82f6]">
                        {t('wizard.actions.installHint', { version: status.plugin?.recommendedVersion ?? 'unknown' })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleInstallOrUpdate()}
                      disabled={installing}
                      className="rounded-full bg-[#2563eb] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {installing ? t('wizard.actions.processing') : primaryAction.label}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 'choose' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] px-4 py-4">
                    <p className="text-[15px] font-medium text-[#111827]">{t('wizard.existing.title')}</p>
                    <p className="mt-1 text-[13px] leading-6 text-[#6b7280]">
                      {t('wizard.existing.description')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setStep('configure');
                      }}
                      className="mt-4 rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium text-[#111827] hover:bg-white"
                    >
                      {t('wizard.existing.action')}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] px-4 py-4">
                    <p className="text-[15px] font-medium text-[#111827]">{t('wizard.newRobot.title')}</p>
                    <p className="mt-1 text-[13px] leading-6 text-[#6b7280]">
                      {t('wizard.newRobot.description')}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleStartRobotCreation()}
                      disabled={authorizing}
                      className="mt-4 rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium text-[#111827] hover:bg-white disabled:opacity-50"
                    >
                      {authorizing ? t('wizard.actions.preparingQr') : t('wizard.newRobot.action')}
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 'create' && creationEntry ? (
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[#111827]">{t('wizard.create.title')}</p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {t('wizard.create.description')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3">
                      <img
                        src={creationEntry.qrCodeDataUrl}
                        alt="Feishu robot creation QR code"
                        className="h-[196px] w-[196px] rounded-xl bg-white object-contain"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl bg-[#eff6ff] px-3 py-3 text-[12px] text-[#1d4ed8]">
                        {t('wizard.create.tip')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setStep('configure')}
                          className="rounded-full bg-[#111827] px-4 py-2 text-[12px] font-medium text-white hover:bg-black"
                        >
                          {t('wizard.create.continue')}
                        </button>
                        <a
                          href={creationEntry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-[#111827] hover:bg-[#f9fafb]"
                        >
                          {t('wizard.create.openOfficial')}
                        </a>
                        <button
                          type="button"
                          onClick={() => setStep('choose')}
                          className="rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-[#111827] hover:bg-[#f9fafb]"
                        >
                          {t('common:actions.back')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 'configure' ? (
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[#111827]">{t('wizard.configure.title')}</p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {t('wizard.configure.description')}
                      </p>
                      {channelName ? (
                        <p className="mt-2 text-[12px] text-[#8e8e93]">
                          {t('common:channels.channelName')}：{channelName}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('choose')}
                      className="rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-[#111827] hover:bg-[#f9fafb]"
                    >
                      {t('common:actions.back')}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="feishu-app-id" className="text-[12px] font-medium text-[#111827]">{t('wizard.configure.appIdLabel')}</label>
                      <input
                        id="feishu-app-id"
                        value={appId}
                        onChange={(event) => setAppId(event.target.value)}
                        placeholder={t('wizard.configure.appIdPlaceholder')}
                        className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-[13px] text-[#111827] outline-none focus:border-[#2563eb]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="feishu-app-secret" className="text-[12px] font-medium text-[#111827]">{t('wizard.configure.appSecretLabel')}</label>
                      <input
                        id="feishu-app-secret"
                        type="password"
                        value={appSecret}
                        onChange={(event) => setAppSecret(event.target.value)}
                        placeholder={t('wizard.configure.appSecretPlaceholder')}
                        className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-[13px] text-[#111827] outline-none focus:border-[#2563eb]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-[#f8fafc] px-3 py-3 text-[12px] text-[#475467]">
                    {t('wizard.configure.help')}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveConfiguration()}
                      disabled={savingConfig || !appId.trim() || !appSecret.trim()}
                      className="rounded-full bg-[#111827] px-4 py-2 text-[13px] font-medium text-white hover:bg-black disabled:opacity-50"
                    >
                      {savingConfig ? t('common:status.saving') : t('wizard.configure.saveAndContinue')}
                    </button>
                  </div>
                </div>
              ) : null}

              {authNeedsAppPermission && authSession ? (
                <div className="rounded-2xl border border-[#f59e0b]/20 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[#111827]">{t('wizard.permission.title')}</p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {t('wizard.permission.description')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3">
                      <img
                        src={authSession.qrCodeDataUrl}
                        alt="Feishu application permission QR code"
                        className="h-[196px] w-[196px] rounded-xl bg-white object-contain"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl bg-[#fffbeb] px-3 py-3 text-[12px] text-[#92400e]">
                        <p className="font-medium">{t('wizard.permission.missingScopes')}</p>
                        <p className="mt-2 break-all">{(authSession.missingAppScopes || []).join(', ') || t('wizard.permission.unknownScopes')}</p>
                      </div>
                      {authSession.message ? (
                        <div className="rounded-xl bg-[#fef2f2] px-3 py-3 text-[12px] text-[#b91c1c]">
                          {authSession.message}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={authSession.appPermissionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-[#111827] hover:bg-[#f9fafb]"
                        >
                          {t('wizard.permission.openLink')}
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleStartAuthorization()}
                          disabled={authorizing}
                          className="rounded-full bg-[#111827] px-4 py-2 text-[12px] font-medium text-white hover:bg-black disabled:opacity-50"
                        >
                          {authorizing ? t('wizard.permission.checking') : t('wizard.permission.recheck')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {authSession && !authNeedsAppPermission ? (
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[#111827]">{t('wizard.auth.title')}</p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {t('wizard.auth.stateLine', { state: authSession.state, scopeCount: authSession.scopeCount })}
                      </p>
                    </div>
                    {authSession.state === 'success' ? (
                      <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[12px] font-medium text-[#166534]">
                        {t('wizard.auth.successBadge')}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3">
                      <img
                        src={authSession.qrCodeDataUrl}
                        alt="Feishu authorization QR code"
                        className="h-[196px] w-[196px] rounded-xl bg-white object-contain"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-xl bg-[#f8fafc] px-3 py-3 text-[12px] text-[#475467]">
                        <p>{t('wizard.auth.description')}</p>
                        <p className="mt-2 font-mono text-[11px] text-[#6b7280]">{t('wizard.auth.userCode', { code: authSession.userCode })}</p>
                      </div>
                      {authSession.message ? (
                        <div className={cn(
                          'rounded-xl px-3 py-3 text-[12px]',
                          authSession.state === 'failed'
                            ? 'bg-[#fef2f2] text-[#b91c1c]'
                            : authSession.state === 'success'
                              ? 'bg-[#f0fdf4] text-[#166534]'
                              : 'bg-[#eff6ff] text-[#1d4ed8]',
                        )}>
                          {authSession.message}
                        </div>
                      ) : null}
                      {authSession.state === 'failed' ? (
                        <button
                          type="button"
                          onClick={() => void handleStartAuthorization()}
                          disabled={authorizing}
                          className="rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-[#111827] hover:bg-[#f9fafb] disabled:opacity-50"
                        >
                          {authorizing ? t('wizard.auth.regenerating') : t('wizard.auth.regenerate')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {canStartAuthorization && !authSession ? (
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-[#111827]">{t('wizard.auth.readyTitle')}</p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {t('wizard.auth.readyDescription')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleStartAuthorization()}
                      disabled={authorizing}
                      className="rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium text-[#111827] hover:bg-[#f9fafb] disabled:opacity-50"
                    >
                      {authorizing ? t('wizard.actions.preparingQr') : t('wizard.auth.start')}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-[#111827]">{t('wizard.doctor.title')}</p>
                    <p className="mt-1 text-[12px] text-[#6b7280]">
                      {t('wizard.doctor.description', { version: status.docsVersion ?? 'unknown' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDoctor()}
                    disabled={doctoring}
                    className="rounded-full border border-black/10 px-4 py-2 text-[13px] font-medium text-[#111827] hover:bg-[#f9fafb] disabled:opacity-50"
                  >
                    {doctoring ? t('wizard.doctor.running') : t('wizard.doctor.run')}
                  </button>
                </div>

                {doctorSummary ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-black/[0.06] bg-[#fafafa] px-4 py-3">
                    <p className={cn('text-[13px] font-medium', doctorSummary.doctor.success ? 'text-[#059669]' : 'text-[#b91c1c]')}>
                      {t('wizard.doctor.openClawDoctor', {
                        status: doctorSummary.doctor.success ? t('wizard.doctor.pass') : t('wizard.doctor.fail'),
                      })}
                    </p>
                    <p className={cn('text-[13px] font-medium', doctorSummary.validation.valid ? 'text-[#059669]' : 'text-[#b91c1c]')}>
                      {t('wizard.doctor.channelValidation', {
                        status: doctorSummary.validation.valid ? t('wizard.doctor.pass') : t('wizard.doctor.fail'),
                      })}
                    </p>
                    {doctorSummary.validation.errors.map((item) => (
                      <p key={item} className="text-[12px] text-[#b91c1c]">{item}</p>
                    ))}
                    {doctorSummary.validation.warnings.map((item) => (
                      <p key={item} className="text-[12px] text-[#92400e]">{item}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  title,
  subtitle,
  detail,
  tone,
}: {
  title: string;
  subtitle: string;
  detail: string;
  tone: 'ok' | 'warn' | 'neutral';
}) {
  return (
    <div className={cn(
      'rounded-2xl border px-4 py-4',
      tone === 'ok' ? 'border-[#10b981]/20 bg-[#f0fdf4]' :
        tone === 'warn' ? 'border-[#f59e0b]/20 bg-[#fffbeb]' :
          'border-black/[0.06] bg-white',
    )}>
      <p className="text-[12px] font-medium text-[#6b7280]">{title}</p>
      <p className="mt-2 text-[18px] font-semibold text-[#111827]">{subtitle}</p>
      <p className="mt-2 text-[12px] text-[#6b7280]">{detail}</p>
    </div>
  );
}
