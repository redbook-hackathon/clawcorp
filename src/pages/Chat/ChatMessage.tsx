/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with markdown, thinking sections, images, and tool cards.
 */
import { useState, useCallback, useEffect, memo } from 'react';
import { Sparkles, Copy, Check, ChevronDown, ChevronRight, Wrench, FileText, Film, Music, FileArchive, File, X, FolderOpen, ZoomIn, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import MarkdownContent from './MarkdownContent';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import type { RawMessage, AttachedFileMeta } from '@/stores/chat';
import { extractText, extractThinking, extractImages, extractToolGroups, formatTimestamp, isSystemInjectedUserMessage } from './message-utils';
import { TaskCreationBubble } from './TaskCreationBubble';

interface ChatMessageProps {
  message: RawMessage;
  showThinking: boolean;
  isStreaming?: boolean;
  streamingTools?: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
  autoExpandThinking?: boolean;
  agentAvatar?: string | null;
}

interface ExtractedImage { url?: string; data?: string; mimeType: string; }

/** Resolve an ExtractedImage to a displayable src string, or null if not possible. */
function imageSrc(img: ExtractedImage): string | null {
  if (img.url) return img.url;
  if (img.data) return `data:${img.mimeType};base64,${img.data}`;
  return null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showThinking,
  isStreaming = false,
  streamingTools = [],
  autoExpandThinking = false,
  agentAvatar,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const isToolResult = role === 'toolresult' || role === 'tool_result';
  const text = extractText(message);
  const hasText = text.trim().length > 0;
  const thinking = extractThinking(message);
  const images = extractImages(message);
  const tools = extractToolGroups(message);
  const visibleThinking = showThinking ? thinking : null;
  const visibleTools = tools;
  const hasOnlyCronToolActivity = visibleTools.length > 0
    && visibleTools.every((tool) => tool.name.trim().toLowerCase() === 'cron');

  const attachedFiles = message._attachedFiles || [];
  const [lightboxImg, setLightboxImg] = useState<{ src: string; fileName: string; filePath?: string; base64?: string; mimeType?: string } | null>(null);
  const [showTaskBubble, setShowTaskBubble] = useState(true);
  const [showTaskExcerpt, setShowTaskExcerpt] = useState(false);

  // Never render tool result messages in chat UI
  if (isToolResult) return null;

  // Hide system-injected user messages (e.g. scheduled reminder triggers) —
  // the assistant's response already contains the user-facing content.
  if (isSystemInjectedUserMessage(message)) return null;
  if (hasOnlyCronToolActivity && !hasText && !visibleThinking && images.length === 0 && attachedFiles.length === 0) return null;

  // Render task creation bubble (per D-21)
  if (message._taskProposal && showTaskBubble) {
    return (
      <div className="flex justify-start mb-4">
        <TaskCreationBubble
          title={message._taskProposal.title}
          description={message._taskProposal.description}
          assigneeId={message._taskProposal.assigneeId}
          priority={message._taskProposal.priority}
          teamId={message._taskProposal.teamId}
          teamName={message._taskProposal.teamName}
          deadline={message._taskProposal.deadline}
          onCancel={() => {
            setShowTaskBubble(false);
          }}
        />
      </div>
    );
  }

  // Render task anchor card (per D-24)
  if (message._taskAnchor) {
    const deepLink = message._taskAnchor.deepLink ?? `/kanban?taskId=${message._taskAnchor.taskId}`;
    return (
      <div className="flex justify-start mb-4">
        <Card data-testid="task-anchor-card" className="inline-block max-w-md p-3 bg-accent/10 border-accent">
          <p className="text-sm font-medium text-accent-foreground">✓ 任务已创建</p>
          <p className="text-xs text-muted-foreground mt-1">{message._taskAnchor.title}</p>
          {message._taskAnchor.owningTeamLabel ? (
            <p className="text-xs text-muted-foreground mt-1">{message._taskAnchor.owningTeamLabel}</p>
          ) : null}
          {message._taskAnchor.executionStatus ? (
            <p className="text-xs text-muted-foreground mt-1">{message._taskAnchor.executionStatus}</p>
          ) : null}
          {message._taskAnchor.latestInternalExcerpt ? (
            <button
              data-testid="task-anchor-toggle"
              type="button"
              className="mt-2 text-xs text-accent-foreground underline underline-offset-2"
              onClick={() => setShowTaskExcerpt((value) => !value)}
            >
              {showTaskExcerpt ? '隐藏最新内部摘录' : '查看最新内部摘录'}
            </button>
          ) : null}
          {showTaskExcerpt && message._taskAnchor.latestInternalExcerpt ? (
            <div data-testid="task-anchor-excerpt" className="mt-2 rounded-md bg-background/70 px-2 py-2 text-xs text-muted-foreground">
              {message._taskAnchor.latestInternalExcerpt.content}
            </div>
          ) : null}
          <Button
            data-testid="task-anchor-link"
            size="sm"
            variant="link"
            className="mt-2 p-0 h-auto text-xs"
            onClick={() => {
              window.location.href = deepLink;
            }}
          >
            查看看板 →
          </Button>
        </Card>
      </div>
    );
  }

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;
  if (!hasText && !visibleThinking && images.length === 0 && visibleTools.length === 0 && attachedFiles.length === 0 && !hasStreamingToolStatus) return null;

  return (
    <div
      className={cn(
        'flex gap-4 group py-0.5',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      {!isUser && (
        agentAvatar ? (
          <img
            data-testid="chat-avatar-assistant"
            src={agentAvatar}
            alt=""
            className="mt-1.5 h-7 w-7 shrink-0 rounded-lg object-cover shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
          />
        ) : (
          <div
            data-testid="chat-avatar-assistant"
            className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-clawcorp-ac text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        )
      )}

      {/* Content */}
      <div
        className={cn(
          'flex flex-col w-full min-w-0 space-y-2.5',
          isUser ? 'max-w-[78%] items-end' : 'max-w-[86%] items-start',
        )}
      >
        {isStreaming && !isUser && streamingTools.length > 0 && (
          <ToolStatusBar tools={streamingTools} />
        )}

        {/* Thinking section */}
        {visibleThinking && (
          <ThinkingBlock content={visibleThinking} autoExpand={isStreaming || autoExpandThinking} />
        )}

        {/* Tool use cards */}
        {visibleTools.length > 0 && (
          <div className="w-full space-y-2">
            {visibleTools.map((tool, i) => (
              <ToolCard
                key={tool.id || i}
                name={tool.name}
                input={tool.input}
                resultText={tool.resultText}
                filePath={tool.filePath}
                changeCount={tool.changeCount}
                isFileChange={tool.isFileChange}
              />
            ))}
          </div>
        )}

        {/* Images — rendered ABOVE text bubble for user messages */}
        {/* Images from content blocks (Gateway session data / channel push photos) */}
        {isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImageThumbnail
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — images above text for user, file cards below */}
        {isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              // Skip image attachments if we already have images from content blocks
              if (isImage && images.length > 0) return null;
              if (isImage) {
                return file.preview ? (
                  <ImageThumbnail
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                ) : (
                  <div
                    key={`local-${i}`}
                    className="w-36 h-36 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-muted-foreground"
                  >
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              // Non-image files → file card
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Main text bubble */}
        {hasText && (
          <MessageBubble
            text={text}
            isUser={isUser}
            isStreaming={isStreaming}
          />
        )}

        {/* Images from content blocks — assistant messages (below text) */}
        {!isUser && images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => {
              const src = imageSrc(img);
              if (!src) return null;
              return (
                <ImagePreviewCard
                  key={`content-${i}`}
                  src={src}
                  fileName="image"
                  base64={img.data}
                  mimeType={img.mimeType}
                  onPreview={() => setLightboxImg({ src, fileName: 'image', base64: img.data, mimeType: img.mimeType })}
                />
              );
            })}
          </div>
        )}

        {/* File attachments — assistant messages (below text) */}
        {!isUser && attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              if (isImage && images.length > 0) return null;
              if (isImage && file.preview) {
                return (
                  <ImagePreviewCard
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                );
              }
              if (isImage && !file.preview) {
                return (
                  <div key={`local-${i}`} className="w-36 h-36 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-muted-foreground">
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        )}

        {/* Hover row for user messages — timestamp only */}
        {isUser && message.timestamp && (
          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none">
            {formatTimestamp(message.timestamp)}
          </span>
        )}

        {/* Hover row for assistant messages — only when there is real text content */}
        {!isUser && hasText && (
          <AssistantHoverBar text={text} timestamp={message.timestamp} />
        )}
      </div>

      {/* Image lightbox portal */}
      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          fileName={lightboxImg.fileName}
          filePath={lightboxImg.filePath}
          base64={lightboxImg.base64}
          mimeType={lightboxImg.mimeType}
          onClose={() => setLightboxImg(null)}
        />
      )}
    </div>
  );
});

function formatDuration(durationMs?: number): string | null {
  if (!durationMs || !Number.isFinite(durationMs)) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function ToolStatusBar({
  tools,
}: {
  tools: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
}) {
  return (
    <div className="w-full space-y-2">
      {tools.map((tool) => {
        const duration = formatDuration(tool.durationMs);
        const isRunning = tool.status === 'running';
        const isError = tool.status === 'error';
        const statusLabel = isRunning ? '执行中' : isError ? '执行失败' : '已完成';
        return (
          <div
            key={tool.toolCallId || tool.id || tool.name}
            className={cn(
              'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs transition-colors bg-zinc-50/90 dark:bg-white/[0.03]',
              isRunning && 'border-sky-200/80 text-sky-700 dark:border-sky-500/30 dark:text-sky-300',
              !isRunning && !isError && 'border-black/10 text-muted-foreground dark:border-white/10',
              isError && 'border-destructive/40 text-destructive',
            )}
          >
            {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-current shrink-0" />}
            {!isRunning && !isError && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            {isError && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <Wrench className="h-3 w-3 shrink-0 opacity-60" />
            <span className="font-mono text-[12px] font-medium">{tool.name}</span>
            <span className="ml-auto rounded-full border border-current/20 px-2 py-0.5 text-[10px] leading-none opacity-80">{statusLabel}</span>
            {duration && <span className="text-[11px] opacity-60">{tool.summary ? `(${duration})` : duration}</span>}
            {tool.summary && (
              <span className="truncate text-[11px] opacity-70">{tool.summary}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Assistant hover bar (timestamp + copy, shown on group hover) ─

function AssistantHoverBar({ text, timestamp }: { text: string; timestamp?: number }) {
  const [copied, setCopied] = useState(false);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="flex items-center justify-between w-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none px-1">
      <span className="text-xs text-muted-foreground">
        {timestamp ? formatTimestamp(timestamp) : ''}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={copyContent}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────

function MessageBubble({
  text,
  isUser,
  isStreaming,
}: {
  text: string;
  isUser: boolean;
  isStreaming: boolean;
}) {
  return (
    <div
      data-testid={isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}
      className={cn(
        'relative rounded-2xl px-[14px] py-[10px]',
        !isUser && 'w-full',
        isUser
          ? 'rounded-tr-[4px] bg-clawcorp-ac text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
          : 'rounded-tl-[4px] bg-white text-black shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.04)] dark:bg-white/[0.04] dark:text-white',
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words break-all text-[14px] leading-[1.65]">{text}</p>
      ) : (
        <div className="relative">
          <MarkdownContent content={text} />
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Thinking Block ──────────────────────────────────────────────

interface ThinkingBlockProps {
  content: string;
  autoExpand?: boolean;
}

function ThinkingBlock({ content, autoExpand = false }: ThinkingBlockProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const expanded = autoExpand || manualExpanded;

  return (
    <div className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/90 dark:bg-white/[0.03] text-[14px]">
      <button
        className="flex items-center gap-2 w-full px-3.5 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          if (!autoExpand) {
            setManualExpanded(!manualExpanded);
          }
        }}
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium">思考过程</span>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3 text-muted-foreground">
          <div className="opacity-75">
            <MarkdownContent content={content} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Card (for user-uploaded non-image files) ───────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') return <FileText className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <FileArchive className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  return <File className={className} />;
}

function FileCard({ file }: { file: AttachedFileMeta }) {
  const handleOpen = useCallback(() => {
    if (file.filePath) {
      invokeIpc('shell:openPath', file.filePath);
    }
  }, [file.filePath]);

  return (
    <div 
      className={cn(
        "flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 px-3 py-2.5 bg-black/5 dark:bg-white/5 max-w-[220px]",
        file.filePath && "cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      )}
      onClick={handleOpen}
      title={file.filePath ? "Open file" : undefined}
    >
      <FileIcon mimeType={file.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 overflow-hidden">
        <p className="text-xs font-medium truncate">{file.fileName}</p>
        <p className="text-[10px] text-muted-foreground">
          {file.fileSize > 0 ? formatFileSize(file.fileSize) : 'File'}
        </p>
      </div>
    </div>
  );
}

// ── Image Thumbnail (user bubble — square crop with zoom hint) ──

function ImageThumbnail({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative w-36 h-36 rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group/img cursor-zoom-in"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
}

// ── Image Preview Card (assistant bubble — natural size with overlay actions) ──

function ImagePreviewCard({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="relative max-w-xs rounded-xl border overflow-hidden border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 group/img cursor-zoom-in"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} className="block w-full" />
      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow" />
      </div>
    </div>
  );
}

// ── Image Lightbox ───────────────────────────────────────────────

function ImageLightbox({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onClose,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onClose: () => void;
}) {
  void src; void base64; void mimeType; void fileName;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShowInFolder = useCallback(() => {
    if (filePath) {
      invokeIpc('shell:showItemInFolder', filePath);
    }
  }, [filePath]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Image + buttons stacked */}
      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={fileName}
          className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
        />

        {/* Action buttons below image */}
        <div className="flex items-center gap-2">
          {filePath && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
              onClick={handleShowInFolder}
              title="在文件夹中显示"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Tool Card ───────────────────────────────────────────────────

function ToolCard({
  name,
  input,
  resultText,
  filePath,
  changeCount,
  isFileChange = false,
}: {
  name: string;
  input: unknown;
  resultText?: string;
  filePath?: string;
  changeCount?: number;
  isFileChange?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const badgeLabel = isFileChange ? '文件变更预览' : '工具执行';
  const helperLabel = expanded ? '收起调用详情' : '展开查看调用详情';
  const changeLabel = typeof changeCount === 'number' ? `${changeCount} edits` : null;

  return (
    <div className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/90 dark:bg-white/[0.03] text-[14px] overflow-hidden">
      <button
        className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        <Wrench className="h-3 w-3 shrink-0 opacity-60" />
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-black/10 dark:border-white/15 px-2 py-0.5 text-[10px] leading-none tracking-wide text-muted-foreground">{badgeLabel}</span>
            <span className="font-mono text-xs text-foreground truncate">{name}</span>
          </div>
          {(filePath || changeLabel) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/85">
              {filePath && <span className="font-mono">{filePath}</span>}
              {changeLabel && (
                <span className="rounded-full border border-black/10 px-2 py-0.5 leading-none dark:border-white/10">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
          <span className="mt-1 block text-[11px] text-muted-foreground/85">{helperLabel}</span>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0" />}
      </button>
      {expanded && (
        <div className="border-t border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02]">
          {input != null && (
            <div className="px-3.5 py-2.5">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Input</div>
              <pre className="overflow-x-auto text-xs text-muted-foreground">
                {typeof input === 'string' ? input : JSON.stringify(input, null, 2) as string}
              </pre>
            </div>
          )}
          {resultText && (
            <div className="border-t border-black/10 px-3.5 py-2.5 dark:border-white/10">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Result</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {resultText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
