import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238e8e93' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 12px center',
  paddingRight: '32px',
};

export function SettingsMemoryStrategy() {
  const { t } = useTranslation('settings');
  const [contextConsolidation, setContextConsolidation] = useState(true);
  const [nightlyReflection, setNightlyReflection] = useState(true);

  return (
    <div className="space-y-4">
      {/* 全局长期记忆策略 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('memoryStrategy.global.title')}</h3>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-[#000000]">{t('memoryStrategy.global.storageLabel')}</p>
            <select
              className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
              style={selectStyle}
            >
              <option>{t('memoryStrategy.global.storageOptions.sqlite')}</option>
              <option>{t('memoryStrategy.global.storageOptions.postgres')}</option>
              <option>{t('memoryStrategy.global.storageOptions.chroma')}</option>
            </select>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-[#000000]">{t('memoryStrategy.global.embeddingLabel')}</p>
            <select
              className="w-full appearance-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-[#000000] outline-none focus:border-clawx-ac"
              style={selectStyle}
            >
              <option>{t('memoryStrategy.global.embeddingOptions.small')}</option>
              <option>{t('memoryStrategy.global.embeddingOptions.large')}</option>
              <option>{t('memoryStrategy.global.embeddingOptions.local')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* 自动浓缩与总结 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-1 text-[15px] font-semibold text-[#000000]">{t('memoryStrategy.automation.title')}</h3>
        <div className="divide-y divide-black/[0.04]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#000000]">
                {t('memoryStrategy.automation.contextConsolidation.title')}
              </p>
              <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                {t('memoryStrategy.automation.contextConsolidation.description')}
              </p>
            </div>
            <Switch checked={contextConsolidation} onCheckedChange={setContextConsolidation} />
          </div>
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[#000000]">
                {t('memoryStrategy.automation.nightlyReflection.title')}
              </p>
              <p className="mt-0.5 text-[12px] text-[#8e8e93]">
                {t('memoryStrategy.automation.nightlyReflection.description')}
              </p>
            </div>
            <Switch checked={nightlyReflection} onCheckedChange={setNightlyReflection} />
          </div>
        </div>
      </section>

      {/* 挂载本地目录知识 */}
      <section className="rounded-xl border border-[#c6c6c8] bg-white px-5 py-4">
        <h3 className="mb-4 text-[15px] font-semibold text-[#000000]">{t('memoryStrategy.localKnowledge.title')}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-black/10 bg-[#f9f9f9] px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-[#000000]">{t('memoryStrategy.localKnowledge.examplePath')}</p>
              <p className="mt-0.5 text-[12px] text-[#8e8e93]">{t('memoryStrategy.localKnowledge.exampleStats')}</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-black/10 px-2.5 py-1 text-[12px] text-[#3c3c43] hover:bg-[#e5e5ea]"
            >
              {t('memoryStrategy.localKnowledge.reindex')}
            </button>
          </div>
          <button
            type="button"
            className="w-full rounded-lg border border-dashed border-black/10 py-2.5 text-[13px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7]"
          >
            {t('memoryStrategy.localKnowledge.addDirectory')}
          </button>
        </div>
      </section>
    </div>
  );
}
