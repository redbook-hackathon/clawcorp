import { cn } from '@/lib/utils';

interface AccordionGroupProps {
  title: string;
  icon?: React.ReactNode;
  collapsed?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function AccordionGroup({
  title,
  icon,
  collapsed = false,
  open = true,
  onToggle,
  children,
  headerAction,
}: AccordionGroupProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={title}
        className={cn(
          'flex h-10 w-full items-center justify-center rounded-lg text-[#3c3c43] transition-colors',
          'hover:bg-[#e5e5ea] hover:text-[#000000] dark:hover:bg-white/10',
        )}
      >
        {icon}
      </button>
    );
  }

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between px-[10px] pb-[6px] pt-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#8e8e93]">
            {title}
          </span>
          <span className="text-[10px] text-[#8e8e93]">{open ? '▾' : '▸'}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {headerAction}
        </div>
      </div>
      {open ? <div className="flex flex-col gap-0">{children}</div> : null}
    </section>
  );
}
