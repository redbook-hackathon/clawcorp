import { type ChangeEvent, useId } from 'react';
import { SettingsSectionCard } from '@/components/settings-center/settings-section-card';
import { Switch } from '@/components/ui/switch';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';

type ThemeOption = {
  value: 'light' | 'dark' | 'system';
  label: string;
  preview: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: '浅色模式',
    preview: 'conic-gradient(from 90deg, #f97316 0deg 180deg, #f3f4f6 180deg 360deg)',
  },
  {
    value: 'dark',
    label: '深色模式',
    preview: 'conic-gradient(from 90deg, #111827 0deg 180deg, #334155 180deg 360deg)',
  },
  {
    value: 'system',
    label: '跟随系统',
    preview: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #111827 50%, #020617 100%)',
  },
];

export function SettingsGeneralPanel() {
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    launchAtStartup,
    setLaunchAtStartup,
    startMinimized,
    setStartMinimized,
    minimizeToTray,
    setMinimizeToTray,
    mobileAlert,
    setMobileAlert,
    brandName,
    setBrandName,
    brandSubtitle,
    setBrandSubtitle,
    myName,
    setMyName,
    brandLogoDataUrl,
    setBrandLogoDataUrl,
    brandIconDataUrl,
    setBrandIconDataUrl,
  } = useSettingsStore();

  const languageSelectId = useId();
  const brandNameId = useId();
  const brandSubtitleId = useId();
  const myNameId = useId();

  const handleBrandImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
    setDataUrl: (value: string | null) => void,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <SettingsSectionCard title="账号与安全">
        <div className="rounded-xl border border-dashed border-black/10 bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475569]">
          桌面端暂不提供账号管理或注销入口，请在其他官方入口完成账户相关操作。
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="外观与行为">
        <div className="space-y-2">
          <label htmlFor={languageSelectId} className="block text-[13px] font-medium text-[#0f172a]">
            界面语言
          </label>
          <select
            id={languageSelectId}
            aria-label="界面语言"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-[#0f172a] outline-none focus:border-[#2563eb]"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-[#64748b]">切换语言后，新的界面文案会按当前设置加载。</p>
        </div>

        <SettingsRow
          label="主题模式"
          description="选择当前工作台默认外观。"
          right={
            <div className="flex items-center gap-2">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'h-10 w-10 rounded-full border-2 transition-all hover:scale-105',
                    theme === option.value ? 'border-black/25 scale-105' : 'border-black/5',
                  )}
                  style={{ background: option.preview }}
                  title={option.label}
                />
              ))}
            </div>
          }
        />

        <ToggleRow
          label="开机自启"
          description="登录系统后自动启动 ClawCorp。"
          checked={launchAtStartup}
          onCheckedChange={setLaunchAtStartup}
        />
        <ToggleRow
          label="启动后最小化"
          description="应用启动后直接停留在后台，减少桌面干扰。"
          checked={startMinimized}
          onCheckedChange={setStartMinimized}
        />
        <ToggleRow
          label="关闭时隐藏到托盘"
          description="点击关闭时保留后台进程，维持通道与定时任务在线。"
          checked={minimizeToTray}
          onCheckedChange={setMinimizeToTray}
        />
        <ToggleRow
          label="通知提醒"
          description="启用任务、同步和运行状态提醒。"
          checked={mobileAlert}
          onCheckedChange={setMobileAlert}
        />
      </SettingsSectionCard>

      <SettingsSectionCard title="品牌与身份">
        <TextField
          id={brandNameId}
          label="工作台名称"
          value={brandName}
          onChange={setBrandName}
        />
        <TextField
          id={brandSubtitleId}
          label="副标题"
          value={brandSubtitle}
          onChange={setBrandSubtitle}
        />
        <TextField
          id={myNameId}
          label="我的名字指代"
          value={myName}
          onChange={setMyName}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <BrandImageUploadField
            label="品牌 Logo"
            dataUrl={brandLogoDataUrl}
            previewAlt="品牌 Logo 预览"
            inputLabel="上传品牌 Logo"
            clearLabel="清除品牌 Logo"
            onUpload={(event) => handleBrandImageUpload(event, setBrandLogoDataUrl)}
            onClear={() => setBrandLogoDataUrl(null)}
          />
          <BrandImageUploadField
            label="品牌图标"
            dataUrl={brandIconDataUrl}
            previewAlt="品牌图标预览"
            inputLabel="上传品牌图标"
            clearLabel="清除品牌图标"
            onUpload={(event) => handleBrandImageUpload(event, setBrandIconDataUrl)}
            onClear={() => setBrandIconDataUrl(null)}
          />
        </div>
      </SettingsSectionCard>
    </>
  );
}

function SettingsRow({
  label,
  description,
  right,
}: {
  label: string;
  description: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-[#f8fafc] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#0f172a]">{label}</p>
        <p className="mt-1 text-[12px] text-[#64748b]">{description}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
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
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-[#f8fafc] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#0f172a]">{label}</p>
        <p className="mt-1 text-[12px] text-[#64748b]">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="block text-[13px] font-medium text-[#0f172a]">{label}</span>
      <input
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] text-[#0f172a] outline-none focus:border-[#2563eb]"
      />
    </label>
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
    <div className="rounded-xl border border-black/5 bg-[#f8fafc] p-4">
      <p className="text-[13px] font-medium text-[#0f172a]">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white">
          {dataUrl ? (
            <img src={dataUrl} alt={previewAlt} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-[#94a3b8]">无</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-[#334155] hover:bg-[#f1f5f9]"
          >
            {inputLabel}
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
            onClick={onClear}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[12px] text-[#334155] hover:bg-[#f1f5f9]"
          >
            {clearLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
