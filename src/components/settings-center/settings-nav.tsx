import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { SettingsNavGroup, SettingsSectionId } from './settings-shell-data';

type SettingsNavProps = {
  groups: SettingsNavGroup[];
  activeItemId: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
};

export function SettingsNav({ groups, activeItemId, onChange }: SettingsNavProps) {
  const { t } = useTranslation(['settings']);
  return (
    <nav
      aria-label="Settings sections"
      className="w-full max-w-[220px] shrink-0 border-r border-[#c6c6c8] bg-[#fcfcfc] px-3 py-7"
    >
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.id} className="flex flex-col">
            {group.labelKey ? (
              <div className="px-[10px] pb-[6px] text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8e8e93]">
                {t(group.labelKey)}
              </div>
            ) : null}
            <div className="space-y-0">
              {group.items.map((item) => {
                const active = item.id === activeItemId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'w-full rounded-lg px-[10px] py-[7px] text-left text-[13px] transition-all',
                      active
                        ? 'bg-[#e5e5ea] font-medium text-[#000000]'
                        : 'text-[#000000] hover:bg-[#e5e5ea]',
                    )}
                  >
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}
