import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SettingsSectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SettingsSectionCard({
  title,
  description,
  children,
  className,
}: SettingsSectionCardProps) {
  void description;
  return (
    <section
      className={cn(
        'rounded-xl border border-[#c6c6c8] bg-white p-5',
        className,
      )}
    >
      <header className="mb-[14px]">
        <h3 className="text-[15px] font-semibold text-[#000000]">{title}</h3>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}
