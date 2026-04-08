/**
 * TitleBar Component
 * macOS: empty drag region (native traffic lights handled by hiddenInset).
 * Windows/Linux: drag region on left, minimize/maximize/close on right.
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import { useSettingsStore } from '@/stores/settings';

export function TitleBar() {
  if (window.electron?.platform === 'darwin') {
    // macOS: just a drag region, traffic lights are native
    return <div className="drag-region h-10 shrink-0 border-b bg-background" />;
  }

  return <WindowsTitleBar />;
}

function WindowsTitleBar() {
  const [maximized, setMaximized] = useState(false);
  const brandName = useSettingsStore((state) => state.brandName);
  const brandIconDataUrl = useSettingsStore((state) => state.brandIconDataUrl);
  const brandLogoDataUrl = useSettingsStore((state) => state.brandLogoDataUrl);
  const brandMarkDataUrl = brandIconDataUrl ?? brandLogoDataUrl;

  useEffect(() => {
    // Check initial state
    invokeIpc('window:isMaximized').then((val) => {
      setMaximized(val as boolean);
    });
  }, []);

  const handleMinimize = () => {
    invokeIpc('window:minimize');
  };

  const handleMaximize = () => {
    invokeIpc('window:maximize').then(() => {
      invokeIpc('window:isMaximized').then((val) => {
        setMaximized(val as boolean);
      });
    });
  };

  const handleClose = () => {
    invokeIpc('window:close');
  };

  return (
    <div className="drag-region flex h-10 shrink-0 items-center justify-between border-b bg-background">
      {/* Left: App name */}
      <div className="no-drag flex items-center gap-2 pl-4 text-[13px] font-semibold text-foreground">
        {brandMarkDataUrl ? (
          <img
            src={brandMarkDataUrl}
            alt="Brand icon"
            className="h-4 w-4 rounded-sm object-cover"
          />
        ) : null}
        <span>{brandName}</span>
      </div>

      {/* Right: Window Controls */}
      <div className="no-drag flex h-full">
        <button
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          title="Minimize"
          aria-label="Minimize window"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
          title={maximized ? 'Restore' : 'Maximize'}
          aria-label={maximized ? 'Restore window' : 'Maximize window'}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
          title="Close"
          aria-label="Close window"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
