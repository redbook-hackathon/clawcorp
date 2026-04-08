import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

const WECHAT_QR_REFRESH_MS = 30_000;
const WECHAT_QR_POLL_MS = 2_000;

type WizardStep = 'install' | 'scan' | 'ready';

type QrState = {
  qrcode: string;
  qrcodeUrl: string;
  sessionKey: string;
  connected: boolean;
  status: string;
};

export function WeChatOnboardingWizard({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation('channels');
  const [step, setStep] = useState<WizardStep>('install');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [scanStatus, setScanStatus] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);
  };

  useEffect(() => () => clearTimers(), []);

  const fetchQr = async () => {
    setError(null);
    try {
      const result = await hostApiFetch<{
        success: boolean;
        qrcode: string;
        qrcodeUrl: string;
        sessionKey: string;
        connected: boolean;
        status: string;
      }>(
        '/api/channels/wechat/qr',
      );
      setQr({
        qrcode: result.qrcode,
        qrcodeUrl: result.qrcodeUrl,
        sessionKey: result.sessionKey,
        connected: result.connected,
        status: result.status,
      });
      setScanStatus('');
      if (result.connected || result.status === 'confirmed') {
        clearTimers();
        setStep('ready');
        return;
      }
      startPolling(result.sessionKey);
      refreshRef.current = setTimeout(() => { void fetchQr(); }, WECHAT_QR_REFRESH_MS);
    } catch (e) {
      setError(String(e));
    }
  };

  const startPolling = (sessionKey: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result = await hostApiFetch<{
          success: boolean;
          sessionKey?: string;
          connected: boolean;
          status: string;
          accountId?: string;
          message?: string;
          error?: string;
        }>(
          `/api/channels/wechat/qr/status?sessionKey=${encodeURIComponent(sessionKey)}`,
        );
        if (result.connected || result.status === 'confirmed') {
          clearTimers();
          setStep('ready');
        } else if (result.status === 'expired') {
          setScanStatus('二维码已过期，请刷新二维码');
        } else if (result.message) {
          setScanStatus(result.message);
        }
        if (result.error) {
          setError(result.error);
        }
      } catch {
        // ignore transient poll errors
      }
    }, WECHAT_QR_POLL_MS);
  };

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await hostApiFetch('/api/channels/config', {
        method: 'POST',
        body: JSON.stringify({ channelType: 'wechat', config: {} }),
      });
      setStep('scan');
      void fetchQr();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl" style={{ width: 480 }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-5">
        <div>
          <h2 className="text-[20px] font-semibold text-[#111827]">微信接入向导</h2>
          <p className="mt-1 text-[13px] text-[#6b7280]">通过扫码将微信账号接入 OpenClaw</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-[13px] text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]"
        >
          {t('common:actions.close', { defaultValue: '关闭' })}
        </button>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-6 py-3">
        {(['install', 'scan', 'ready'] as WizardStep[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#d1d5db]">→</span>}
            <span className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium',
              step === s ? 'bg-[#0ea5e9] text-white' : 'bg-[#f1f5f9] text-[#64748b]',
            )}>
              {s === 'install' ? '安装插件' : s === 'scan' ? '扫码登录' : '完成'}
            </span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4 px-6 py-5">
        {error && (
          <div className="rounded-2xl border border-[#ef4444]/20 bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
            {error}
          </div>
        )}

        {step === 'install' && (
          <div className="rounded-2xl border border-black/[0.06] bg-[#f8fafc] px-5 py-6">
            <p className="text-[14px] font-medium text-[#111827]">安装微信插件</p>
            <p className="mt-1 text-[13px] text-[#6b7280]">
              点击下方按钮安装 <code className="rounded bg-[#e2e8f0] px-1">@tencent-weixin/openclaw-weixin</code> 插件，完成后进入扫码步骤。
            </p>
            <button
              type="button"
              onClick={() => { void handleInstall(); }}
              disabled={installing}
              className="mt-4 rounded-xl bg-[#0ea5e9] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#0284c7] disabled:opacity-50"
            >
              {installing ? '安装中…' : '安装插件'}
            </button>
          </div>
        )}

        {step === 'scan' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-black/[0.06] bg-[#f8fafc] px-5 py-6">
            <p className="text-[14px] font-medium text-[#111827]">用微信扫描以下二维码</p>
            {qr ? (
              <>
                <img
                  src={qr.qrcodeUrl || `data:image/png;base64,${qr.qrcode}`}
                  alt="微信登录二维码"
                  className="h-48 w-48 rounded-xl border border-black/[0.06]"
                />
                {scanStatus && (
                  <p className="text-[12px] text-[#64748b]">{scanStatus}</p>
                )}
                <button
                  type="button"
                  onClick={() => { void fetchQr(); }}
                  className="text-[12px] text-[#0ea5e9] hover:underline"
                >
                  刷新二维码
                </button>
              </>
            ) : (
              <p className="text-[13px] text-[#94a3b8]">加载二维码…</p>
            )}
          </div>
        )}

        {step === 'ready' && (
          <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-6">
            <p className="text-[14px] font-medium text-[#15803d]">微信账号已成功接入 ✓</p>
            <p className="mt-1 text-[13px] text-[#166534]">现在可以在工作台查看并回复微信消息。</p>
            <button
              type="button"
              onClick={onComplete}
              className="mt-4 rounded-xl bg-[#16a34a] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#15803d]"
            >
              进入工作台
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
