/**
 * FolderSelectorPopover — 工作目录选择器
 * 点击弹出，提供"选择文件夹"和"最近文件夹"两个入口。
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FolderPlus, Clock, Folder, ChevronRight } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';

const RECENT_KEY = 'clawcorp-recent-cwds';
const LEGACY_RECENT_KEY = 'clawx-recent-cwds';
const MAX_RECENT = 10;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      return JSON.parse(raw) as string[];
    }

    const legacyRaw = localStorage.getItem(LEGACY_RECENT_KEY);
    const legacy = legacyRaw ? (JSON.parse(legacyRaw) as string[]) : [];
    if (legacyRaw) {
      localStorage.setItem(RECENT_KEY, JSON.stringify(legacy));
      localStorage.removeItem(LEGACY_RECENT_KEY);
    }
    return legacy;
  } catch {
    return [];
  }
}

function saveRecent(path: string) {
  const prev = loadRecent().filter((p) => p !== path);
  localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...prev].slice(0, MAX_RECENT)));
  localStorage.removeItem(LEGACY_RECENT_KEY);
}

function isWindowsDriveRoot(p: string): boolean {
  return /^[A-Za-z]:[/\\]?$/.test(p.trim());
}

function getLastSegment(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}

interface FolderSelectorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (path: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function FolderSelectorPopover({
  isOpen,
  onClose,
  onSelectFolder,
  anchorRef,
}: FolderSelectorPopoverProps) {
  const [showRecent, setShowRecent] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimer = useRef<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const handleClose = useCallback(() => {
    setShowRecent(false);
    onClose();
  }, [onClose]);

  const recentFolders = useMemo(() => (showRecent ? loadRecent() : []), [showRecent]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  const handleAddFolder = useCallback(async () => {
    handleClose();
    try {
      const result = await invokeIpc('dialog:open', {
        properties: ['openDirectory'],
      }) as { canceled?: boolean; filePaths?: string[] };
      if (result.canceled || !result.filePaths?.length) return;
      const path = result.filePaths[0];
      if (isWindowsDriveRoot(path)) return;
      saveRecent(path);
      onSelectFolder(path);
    } catch (err) {
      console.error('[FolderSelector] dialog failed:', err);
    }
  }, [handleClose, onSelectFolder]);

  const handleSelectRecent = useCallback((path: string) => {
    if (isWindowsDriveRoot(path)) return;
    saveRecent(path);
    onSelectFolder(path);
    handleClose();
  }, [handleClose, onSelectFolder]);

  const handleSubmenuEnter = useCallback(() => {
    if (submenuCloseTimer.current) {
      clearTimeout(submenuCloseTimer.current);
      submenuCloseTimer.current = null;
    }
    setShowRecent(true);
  }, []);

  const handleSubmenuLeave = useCallback(() => {
    submenuCloseTimer.current = window.setTimeout(() => {
      setShowRecent(false);
    }, 150);
  }, []);

  useEffect(() => () => {
    if (submenuCloseTimer.current) clearTimeout(submenuCloseTimer.current);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const updateAnchorRect = () => {
      setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null);
    };

    updateAnchorRect();
    window.addEventListener('resize', updateAnchorRect);
    window.addEventListener('scroll', updateAnchorRect, true);

    return () => {
      window.removeEventListener('resize', updateAnchorRect);
      window.removeEventListener('scroll', updateAnchorRect, true);
    };
  }, [anchorRef, isOpen]);

  if (!isOpen) return null;

  const popoverStyle = anchorRect
    ? { top: anchorRect.top - 8, left: anchorRect.left, transform: 'translateY(-100%)' }
    : { top: 0, left: 0 };

  return createPortal(
    <div className="fixed inset-0 z-[200]" onMouseDown={handleClose}>
      {/* Main popover */}
      <div
        ref={popoverRef}
        className="fixed z-[201] w-52 overflow-hidden rounded-xl border border-[#c6c6c8] bg-white shadow-lg"
        style={popoverStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 选择新文件夹 */}
        <button
          type="button"
          onClick={handleAddFolder}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#000000] transition-colors hover:bg-[#f2f2f7]"
        >
          <FolderPlus className="h-4 w-4 text-[#8e8e93]" />
          <span>选择文件夹</span>
        </button>

        {/* 最近文件夹 — hover 展开子菜单 */}
        <div
          ref={recentRef}
          className="relative border-t border-[#f2f2f7]"
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-left text-[13px] text-[#000000] transition-colors hover:bg-[#f2f2f7]"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-[#8e8e93]" />
              <span>最近文件夹</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-[#8e8e93]" />
          </button>

          {/* Submenu */}
          {showRecent && (
            <div
              ref={submenuRef}
              className="absolute bottom-0 left-full z-[210] ml-1 w-64 max-h-72 overflow-y-auto rounded-xl border border-[#c6c6c8] bg-white shadow-lg"
              onMouseEnter={handleSubmenuEnter}
              onMouseLeave={handleSubmenuLeave}
            >
              {recentFolders.length === 0 ? (
                <div className="px-3 py-2.5 text-[13px] text-[#8e8e93]">暂无最近文件夹</div>
              ) : (
                recentFolders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => handleSelectRecent(folder)}
                    title={folder}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#000000] transition-colors hover:bg-[#f2f2f7] first:rounded-t-xl last:rounded-b-xl"
                  >
                    <Folder className="h-4 w-4 shrink-0 text-[#8e8e93]" />
                    <span className="truncate">{getLastSegment(folder)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FolderSelectorPopover;
