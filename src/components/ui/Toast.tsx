import { Toaster } from 'sonner';

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      visibleToasts={5}
      offset={24}
      gap={12}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast: 'rounded-2xl border border-black/5 shadow-[0_18px_48px_rgba(15,23,42,0.14)]',
          title: 'text-[13px] font-medium',
          description: 'text-[12px] leading-5 text-muted-foreground',
          actionButton: 'rounded-xl',
          cancelButton: 'rounded-xl',
        },
      }}
    />
  );
}
