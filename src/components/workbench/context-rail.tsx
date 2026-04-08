import { useMemo, useState } from 'react';
import { ChevronDown, Clock3, Download, Pin, Plus, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { CHANNEL_ICONS } from '@/types/channel';
import type { AttachedFileMeta } from '@/stores/chat';
import {
  buildConversationExportFileName,
  buildConversationMarkdownExport,
  encodeUtf8ToBase64,
} from '@/lib/chat-session-export';
import { hostApiFetch } from '@/lib/host-api';
import { usePinnedSessions } from '@/lib/pinned-sessions';
import { resolveSessionDisplayLabel } from '@/lib/session-label';
import { toast } from 'sonner';

export function ContextRail() {
  const rightPanelMode = useSettingsStore((state) => state.rightPanelMode);
  const setRightPanelMode = useSettingsStore((state) => state.setRightPanelMode);
  const [openModules, setOpenModules] = useState({
    about: true,
    capabilities: true,
    context: false,
    memory: false,
  });

  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessions = useChatStore((s) => s.sessions);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const newSession = useChatStore((s) => s.newSession);
  const agents = useAgentsStore((s) => s.agents);
  const defaultAgentId = useAgentsStore((s) => s.defaultAgentId);
  const currentAgent = agents.find((a) => a.id === (currentAgentId ?? defaultAgentId)) ?? agents[0] ?? null;
  const { pinnedSessionKeySet, toggleSessionPinned } = usePinnedSessions();

  // Aggregate all attached files from current session messages
  const messages = useChatStore((s) => s.messages);
  const sessionFiles = useMemo<AttachedFileMeta[]>(() => {
    const seen = new Set<string>();
    const files: AttachedFileMeta[] = [];
    for (const msg of messages) {
      for (const f of msg._attachedFiles ?? []) {
        const key = f.filePath ?? f.fileName;
        if (!seen.has(key)) {
          seen.add(key);
          files.push(f);
        }
      }
    }
    return files;
  }, [messages]);
  const currentSession = useMemo(
    () => sessions.find((session) => session.key === currentSessionKey) ?? null,
    [currentSessionKey, sessions],
  );
  const currentSessionLabel = resolveSessionDisplayLabel(currentSession, sessionLabels) || currentSessionKey;
  const currentSessionActivity = sessionLastActivity[currentSessionKey]
    ?? currentSession?.updatedAt
    ?? null;
  const isPinnedSession = pinnedSessionKeySet.has(currentSessionKey);
  const isMainSession = currentSessionKey.endsWith(':main');

  const toggleModule = (key: keyof typeof openModules) => {
    setOpenModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (rightPanelMode === null) return null;

  if (rightPanelMode === 'files') {
    return (
      <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.06] bg-white dark:border-white/10 dark:bg-background">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5">
          <span className="text-[14px] font-semibold text-[#000000]">会话文件</span>
          <button
            type="button"
            aria-label="关闭文件面板"
            onClick={() => setRightPanelMode(null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7] hover:text-[#000000]"
          >
            ✕
          </button>
        </header>
        {sessionFiles.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
            <span className="text-[40px]">📂</span>
            <p className="text-[13px] text-[#8e8e93]">当前会话暂无文件</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0 px-4 py-3">
            <p className="mb-2 text-[12px] text-[#8e8e93]">{sessionFiles.length} 个文件</p>
            {sessionFiles.map((f, i) => (
              <FileRow key={f.filePath ?? f.fileName ?? i} file={f} />
            ))}
          </div>
        )}
      </aside>
    );
  }

  if (rightPanelMode === 'session') {
    const handleExportSession = async () => {
      if (messages.length === 0) {
        toast.info('当前会话还没有可导出的消息');
        return;
      }

      try {
        const markdown = buildConversationMarkdownExport(messages, currentSessionKey);
        const result = await hostApiFetch<{ success?: boolean; savedPath?: string; error?: string }>('/api/files/save-image', {
          method: 'POST',
          body: JSON.stringify({
            base64: encodeUtf8ToBase64(markdown),
            mimeType: 'text/markdown',
            defaultFileName: buildConversationExportFileName(currentSessionKey),
          }),
        });

        if (result?.success) {
          toast.success(result.savedPath ? `已导出到 ${result.savedPath}` : '会话导出成功');
          return;
        }
        if (result?.error) {
          toast.info(`已取消导出：${result.error}`);
          return;
        }
        toast.info('已取消导出');
      } catch (error) {
        toast.error(`导出会话失败：${String(error)}`);
      }
    };

    const handleDeleteSession = async () => {
      await deleteSession(currentSessionKey);
      setRightPanelMode(null);
    };

    const handleNewSession = () => {
      newSession();
      setRightPanelMode(null);
    };

    return (
      <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.06] bg-white dark:border-white/10 dark:bg-background">
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5">
          <span className="text-[14px] font-semibold text-[#000000]">会话详情</span>
          <button
            type="button"
            aria-label="关闭会话详情面板"
            onClick={() => setRightPanelMode(null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7] hover:text-[#000000]"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-5">
          <div className="rounded-2xl border border-black/[0.06] bg-[#fafafc] p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-[#000000]">{currentSessionLabel}</p>
                <p className="mt-1 text-[12px] text-[#8e8e93]">{currentAgent?.name ?? 'ClawCorp'}</p>
              </div>
              {isPinnedSession ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2 py-1 text-[11px] text-[#3c3c43]">
                  <Pin className="h-3 w-3" />
                  已置顶
                </span>
              ) : null}
            </div>

            <div className="space-y-2 text-[12px] text-[#3c3c43]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#8e8e93]">会话 Key</span>
                <span className="max-w-[180px] truncate font-mono">{currentSessionKey}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#8e8e93]">消息数</span>
                <span>{messages.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#8e8e93]">最后活跃</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {formatSessionActivity(currentSessionActivity)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={handleNewSession}
              aria-label="新建会话"
              className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white px-3 py-3 text-left text-[13px] font-medium text-[#000000] transition-colors hover:bg-[#f2f2f7]"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新建会话
              </span>
              <span className="text-[11px] text-[#8e8e93]">开始新上下文</span>
            </button>

            <button
              type="button"
              onClick={() => void handleExportSession()}
              aria-label="导出 Markdown"
              className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white px-3 py-3 text-left text-[13px] font-medium text-[#000000] transition-colors hover:bg-[#f2f2f7]"
            >
              <span className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                导出 Markdown
              </span>
              <span className="text-[11px] text-[#8e8e93]">当前会话</span>
            </button>

            {!isMainSession ? (
              <button
                type="button"
                onClick={() => toggleSessionPinned(currentSessionKey)}
                aria-label={isPinnedSession ? '取消置顶会话' : '置顶会话'}
                className="flex w-full items-center justify-between rounded-xl border border-black/[0.08] bg-white px-3 py-3 text-left text-[13px] font-medium text-[#000000] transition-colors hover:bg-[#f2f2f7]"
              >
                <span className="inline-flex items-center gap-2">
                  <Pin className="h-4 w-4" />
                  {isPinnedSession ? '取消置顶会话' : '置顶会话'}
                </span>
                <span className="text-[11px] text-[#8e8e93]">同步侧边栏排序</span>
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-black/[0.08] px-3 py-3 text-[12px] text-[#8e8e93]">
                主会话会跟随分身固定存在，因此不提供置顶或删除。
              </div>
            )}

            {!isMainSession ? (
              <button
                type="button"
                onClick={() => void handleDeleteSession()}
                aria-label="删除会话"
                className="flex w-full items-center justify-between rounded-xl border border-[#ef4444]/20 bg-[#fef2f2] px-3 py-3 text-left text-[13px] font-medium text-[#b91c1c] transition-colors hover:bg-[#fee2e2]"
              >
                <span className="inline-flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  删除会话
                </span>
                <span className="text-[11px] text-[#ef4444]">仅移除当前会话</span>
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.06] bg-white dark:border-white/10 dark:bg-background">
      {/* Header */}
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5">
        <span className="text-[14px] font-semibold text-[#000000]">Agent 检查器</span>
        <button
          type="button"
          aria-label="关闭 Agent 检查器"
          onClick={() => setRightPanelMode(null)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7] hover:text-[#000000]"
        >
          ✕
        </button>
      </header>

      {/* Agent Profile */}
      <div className="flex flex-col items-center px-5 py-6">
        <div className="mb-3 flex h-[80px] w-[80px] items-center justify-center rounded-full bg-clawx-ac text-[32px] text-white shadow-[0_4px_16px_rgba(0,122,255,0.25)]">
          ✦
        </div>
        <p className="text-[16px] font-semibold text-[#000000]">{currentAgent?.name ?? 'ClawCorp 主脑'}</p>
        <p className="mt-0.5 text-[13px] text-[#8e8e93]">{currentAgent?.id ?? 'AI coworker'}</p>
      </div>

      {/* Accordions */}
      <div className="flex flex-col gap-0 border-t border-black/[0.06] px-4 pb-6 pt-2">

        {/* 基础设定（关于我） */}
        <AccordionRow
          label="基础设定（关于我）"
          open={openModules.about}
          onToggle={() => toggleModule('about')}
        >
          <KVRow label="模型" value={currentAgent?.modelDisplay ?? '—'} />
          {currentAgent?.inheritedModel && <KVRow label="继承" value="是" />}
          {currentAgent?.isDefault && <KVRow label="默认 Agent" value="是" />}
        </AccordionRow>

        {/* 能力与工具 */}
        <AccordionRow
          label="能力与工具"
          open={openModules.capabilities}
          onToggle={() => toggleModule('capabilities')}
        >
          {currentAgent && currentAgent.channelTypes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {currentAgent.channelTypes.map((ch) => (
                <span key={ch} className="rounded-md bg-[#f2f2f7] px-2 py-0.5 text-[12px] text-[#3c3c43]">
                  {CHANNEL_ICONS[ch as keyof typeof CHANNEL_ICONS] ?? '📡'} {ch}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {['file_system', 'terminal', 'browser', 'git_ops'].map((tag) => (
                <span key={tag} className="rounded-md bg-[#f2f2f7] px-2 py-0.5 text-[12px] text-[#3c3c43]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </AccordionRow>

        {/* 我眼中的你 */}
        <AccordionRow
          label="我眼中的你"
          open={openModules.context}
          onToggle={() => toggleModule('context')}
        >
          <KVRow label="专注" value="coding" />
          <KVRow label="时区" value="Asia/Shanghai" />
        </AccordionRow>

        {/* 工作记忆 */}
        <AccordionRow
          label="工作记忆"
          open={openModules.memory}
          onToggle={() => toggleModule('memory')}
        >
          <div className="space-y-2">
            <div>
              <p className="text-[12px] font-medium text-[#3c3c43]">
                最近笔记 <span className="text-[#8e8e93]">🔗</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[#8e8e93]">当前项目暂无记录</p>
            </div>
            <div className="rounded-lg border border-[#f59e0b]/30 bg-[#fffbeb] px-3 py-2">
              <p className="text-[12px] font-medium text-[#92400e]">重要教训</p>
              <p className="mt-0.5 text-[11px] text-[#b45309]">
                执行高风险操作前请先确认...
              </p>
            </div>
          </div>
        </AccordionRow>
      </div>
    </aside>
  );
}

function AccordionRow({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/[0.06] py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[13px] font-medium text-[#3c3c43]">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#8e8e93] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12px] text-[#8e8e93]">{label}</span>
      <span className="text-[12px] text-[#3c3c43]">{value}</span>
    </div>
  );
}

function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.startsWith('text/')) return '📝';
  return '📎';
}

function FileRow({ file }: { file: AttachedFileMeta }) {
  const name = file.fileName || file.filePath?.split(/[\\/]/).pop() || '未知文件';
  const icon = fileIcon(file.mimeType);
  const sizeKb = file.fileSize > 0 ? `${(file.fileSize / 1024).toFixed(1)} KB` : '';
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#f2f2f7]">
      {file.preview ? (
        <img src={file.preview} alt={name} className="h-8 w-8 rounded object-cover" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded bg-[#f2f2f7] text-[18px]">{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[#000000]">{name}</p>
        {sizeKb && <p className="text-[11px] text-[#8e8e93]">{sizeKb}</p>}
      </div>
    </div>
  );
}

function formatSessionActivity(value: number | null): string {
  if (!value || !Number.isFinite(value)) return '暂无记录';
  return new Date(value).toLocaleString();
}
