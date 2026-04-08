import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';

type SettingsMigrationPanelProps = {
  onLaunchWizard: () => void;
};

export function SettingsMigrationPanel({ onLaunchWizard }: SettingsMigrationPanelProps) {
  const { t } = useTranslation('settings');
  const [autoBackup, setAutoBackup] = useState(true);

  return (
    <div className="space-y-4">
      {/* 从 OpenClaw 迁移配置 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-[#000000]">
              {t('migrationPanel.migrate.title')}
            </h3>
            <p className="mt-1 text-[12px] text-[#8e8e93]">
              {t('migrationPanel.migrate.description')}
            </p>
          </div>
          <button
            type="button"
            onClick={onLaunchWizard}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#0a7aff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#075ac4]"
          >
            {t('migrationPanel.migrate.cta')}
          </button>
        </div>
      </section>

      {/* 冷备与导出 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('migrationPanel.backup.title')}</h3>
        <div className="divide-y divide-black/[0.04]">
          <div className="pb-4">
            <p className="text-[13px] font-medium text-[#000000]">{t('migrationPanel.backup.snapshotTitle')}</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              {t('migrationPanel.backup.snapshotDescription')}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#000000]">{t('migrationPanel.backup.importTitle')}</p>
              <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                {t('migrationPanel.backup.importDescription')}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-black/10 px-4 py-2 text-[13px] font-medium text-[#000000] transition hover:bg-[#f2f2f7]"
            >
              {t('migrationPanel.backup.importButton')}
            </button>
          </div>
        </div>
      </section>

      {/* 自动增量备份 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('migrationPanel.autoBackup.title')}</h3>
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#000000]">{t('migrationPanel.autoBackup.itemTitle')}</p>
            <p className="mt-0.5 text-[12px] text-[#8e8e93]">
              {t('migrationPanel.autoBackup.itemDescription')}
            </p>
          </div>
          <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
        </div>
      </section>

      {/* 恢复出厂 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('migrationPanel.hardReset.title')}</h3>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[13px] text-[#ef4444]">
            {t('migrationPanel.hardReset.warning')}
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-2 text-[13px] font-semibold text-[#b91c1c] transition hover:bg-[#fee2e2]"
          >
            {t('migrationPanel.hardReset.button')}
          </button>
        </div>
      </section>
    </div>
  );
}
