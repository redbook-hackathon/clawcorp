/**
 * DingTalkConfigPage — simplified config for DingTalk channel
 * Phase 6: BotBindingModal + DingTalk/WeCom/QQ config pages
 */
import { useEffect, useState } from 'react';
import { hostApiFetch } from '@/lib/host-api';
import { CHANNEL_META } from '@/types/channel';
import { toast } from 'sonner';

export interface DingTalkConfigPageProps {
  onBack: () => void;
}

export function DingTalkConfigPage({ onBack }: DingTalkConfigPageProps) {
  const meta = CHANNEL_META.dingtalk;

  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Load existing config on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await hostApiFetch<{ values?: Record<string, string> }>(
          '/api/channels/config/dingtalk?accountId=default',
        );
        if (!cancelled && result.values) {
          setConfig(result.values);
        }
      } catch {
        // Ignore load errors — start with empty config
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await hostApiFetch<{ valid: boolean; message?: string }>(
        '/api/channels/credentials/validate',
        {
          method: 'POST',
          body: JSON.stringify({ channelType: 'dingtalk', config }),
        },
      );
      setValidationResult({
        valid: result.valid ?? true,
        message: result.message ?? (result.valid ? '配置验证通过' : '配置验证失败'),
      });
    } catch (err) {
      setValidationResult({ valid: false, message: String(err) });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await hostApiFetch<{ success?: boolean; warning?: string }>(
        '/api/channels/config',
        {
          method: 'POST',
          body: JSON.stringify({
            channelType: 'dingtalk',
            config,
            accountId: 'default',
          }),
        },
      );
      if (!result.success) {
        throw new Error('保存失败');
      }
      if (result.warning) {
        toast.warning(result.warning);
      }
      toast.success('配置已保存，正在重启连接...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onBack();
    } catch (err) {
      toast.error(`保存失败: ${String(err)}`);
      setSaving(false);
    }
  };

  const isFormValid = meta.configFields
    .filter((f) => f.required)
    .every((f) => config[f.key]?.trim());

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex h-[56px] shrink-0 items-center gap-3 border-b border-black/[0.06] px-5">
        <button
          type="button"
          onClick={onBack}
          className="text-[18px] text-[#8e8e93] hover:text-[#111827]"
        >
          ←
        </button>
        <div>
          <h1 className="text-[15px] font-semibold text-[#111827]">钉钉接入配置</h1>
          <p className="text-[12px] text-[#8e8e93]">填写钉钉机器人配置信息</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-[14px] text-[#8e8e93]">加载中...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {meta.configFields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#111827]">
                  {field.label}
                  {field.required && <span className="ml-1 text-[#ef4444]">*</span>}
                </label>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={config[field.key] ?? ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  placeholder={field.placeholder ?? ''}
                  className="w-full rounded-xl border border-black/10 px-4 py-3 text-[14px] text-[#111827] outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]"
                />
                {field.description && (
                  <p className="text-[12px] text-[#8e8e93]">{field.description}</p>
                )}
              </div>
            ))}

            {/* Validate button */}
            <button
              type="button"
              onClick={() => void handleValidate()}
              disabled={validating}
              className="self-start rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-medium text-[#8e8e93] hover:border-[#6366f1] hover:text-[#6366f1] disabled:opacity-50"
            >
              {validating ? '验证中...' : '验证配置'}
            </button>

            {/* Validation result */}
            {validationResult && (
              <div
                className={`rounded-xl p-3 text-[13px] ${
                  validationResult.valid
                    ? 'bg-[#10b981]/10 text-[#10b981]'
                    : 'bg-[#ef4444]/10 text-[#ef4444]'
                }`}
              >
                {validationResult.valid ? '✓ ' : '✗ '}
                {validationResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 gap-3 border-t border-black/[0.06] px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-black/10 py-2.5 text-[13px] font-medium text-[#3c3c43] hover:bg-black/[0.04]"
        >
          返回
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !isFormValid}
          className="flex-1 rounded-xl bg-[#6366f1] py-2.5 text-[13px] font-medium text-white hover:bg-[#4f46e5] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存并连接'}
        </button>
      </div>
    </div>
  );
}
