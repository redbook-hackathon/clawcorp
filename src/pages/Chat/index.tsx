/**
 * Chat Page
 * Native React implementation communicating with OpenClaw Gateway
 * via gateway:rpc IPC. The page now acts as the main KaiTianClaw
 * workbench surface while retaining the existing chat runtime wiring.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Sparkles, PanelRight, FileText, Bot } from 'lucide-react';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { hostApiFetch } from '@/lib/host-api';
import { toast } from 'sonner';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import { useSettingsStore } from '@/stores/settings';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { WorkbenchEmptyState } from '@/components/workbench/workbench-empty-state';
import { ContextRail } from '@/components/workbench/context-rail';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { extractImages, extractText, extractThinking, extractToolUse, isSystemInjectedUserMessage, extractReminderContent } from './message-utils';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';
import { useMinLoading } from '@/hooks/use-min-loading';
import { useNotificationsStore } from '@/stores/notifications';
import {
  buildLeaderOnlyBlockedMessage,
  isDirectMainSessionBlocked,
  resolveReportingLeader,
} from '@/lib/team-chat-access';
import { buildLeaderProgressBrief } from '@/lib/team-progress-brief';

export function Chat() {
  const { t } = useTranslation(['chat', 'common']);
  const navigate = useNavigate();
  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const rightPanelMode = useSettingsStore((s) => s.rightPanelMode);
  const setRightPanelMode = useSettingsStore((s) => s.setRightPanelMode);
  const openPanel = useRightPanelStore((s) => s.openPanel);

  const messages = useChatStore((s) => s.messages);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const loading = useChatStore((s) => s.loading);
  const sending = useChatStore((s) => s.sending);
  const error = useChatStore((s) => s.error);
  const showThinking = useChatStore((s) => s.showThinking);
  const streamingMessage = useChatStore((s) => s.streamingMessage);
  const streamingTools = useChatStore((s) => s.streamingTools);
  const pendingFinal = useChatStore((s) => s.pendingFinal);
  const isRunActive = sending;
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abortRun = useChatStore((s) => s.abortRun);
  const clearError = useChatStore((s) => s.clearError);
  const cleanupEmptySession = useChatStore((s) => s.cleanupEmptySession);

  const agents = useAgentsStore((s) => s.agents);
  const configuredChannelTypes = useAgentsStore((s) => s.configuredChannelTypes);
  const channelOwners = useAgentsStore((s) => s.channelOwners);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const minLoading = useMinLoading(loading && messages.length > 0);
  const { contentRef, scrollRef } = useStickToBottomInstant(currentSessionKey);
  const [streamingTimestamp, setStreamingTimestamp] = useState(0);
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const [teamBriefOpen, setTeamBriefOpen] = useState(false);
  const agentPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setAgentPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [agentPickerOpen]);

  const switchSession = useChatStore((s) => s.switchSession);
  const currentAgentName = agents.find((agent) => agent.id === currentAgentId)?.name ?? 'ClawCorp';
  const currentAgent = agents.find((agent) => agent.id === currentAgentId) ?? null;
  const teamBrief = useMemo(
    () => buildLeaderProgressBrief({
      leaderId: currentAgentId ?? 'main',
      agents,
      sessionLastActivity,
      configuredChannelTypes,
      channelOwners,
    }),
    [agents, channelOwners, configuredChannelTypes, currentAgentId, sessionLastActivity],
  );

  useEffect(() => {
    return () => {
      cleanupEmptySession();
    };
  }, [cleanupEmptySession]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (currentSessionKey || agents.length === 0) return;
    const mainAgent = agents.find((agent) => agent.isDefault) ?? agents.find((agent) => agent.id === 'main') ?? null;
    if (mainAgent?.mainSessionKey) {
      switchSession(mainAgent.mainSessionKey);
    }
  }, [agents, currentSessionKey, switchSession]);

  // Push notification to the bell when system-injected reminder messages arrive
  const notifiedKeysRef = useRef(new Set<string>());
  useEffect(() => {
    for (const msg of messages) {
      if (!isSystemInjectedUserMessage(msg)) continue;
      // Use id, or fall back to a content-based fingerprint for messages without id
      const key = msg.id
        || `ts:${msg.timestamp ?? 0}:${String(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)).slice(0, 80)}`;
      if (notifiedKeysRef.current.has(key)) continue;
      notifiedKeysRef.current.add(key);
      const reminder = extractReminderContent(msg);
      useNotificationsStore.getState().addNotification({
        level: 'info',
        title: reminder ? `提醒：${reminder}` : '定时提醒已触发',
        source: 'reminder',
      });
    }
  }, [messages]);

  const streamMsg = streamingMessage && typeof streamingMessage === 'object'
    ? streamingMessage as { role?: string; content?: unknown; timestamp?: number }
    : null;
  const streamText = streamMsg ? extractText(streamMsg) : (typeof streamingMessage === 'string' ? streamingMessage : '');
  const hasStreamText = streamText.trim().length > 0;
  const streamThinking = streamMsg ? extractThinking(streamMsg) : null;
  const hasStreamThinking = showThinking && !!streamThinking && streamThinking.trim().length > 0;
  const streamTools = streamMsg ? extractToolUse(streamMsg) : [];
  const hasStreamTools = streamTools.length > 0;
  const streamImages = streamMsg ? extractImages(streamMsg) : [];
  const hasStreamImages = streamImages.length > 0;
  const hasStreamToolStatus = streamingTools.length > 0;
  const shouldRenderStreaming = sending && (hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus);
  const hasAnyStreamContent = hasStreamText || hasStreamThinking || hasStreamTools || hasStreamImages || hasStreamToolStatus;

  const isEmpty = messages.length === 0 && !sending;

  const [extracting, setExtracting] = useState(false);
  const handleExtractMemory = useCallback(async () => {
    if (extracting || messages.length < 2) return;
    setExtracting(true);
    try {
      const payload = messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));
      const res = await hostApiFetch<{ ok: boolean; skipped?: boolean; reason?: string; extracted?: string; scopeId?: string; usedLlm?: boolean }>('/api/memory/extract', {
        method: 'POST',
        body: JSON.stringify({
          messages: payload,
          sessionKey: currentSessionKey ?? '',
          label: currentAgentName,
          agentId: currentAgentId ?? 'main',
          useLlm: true,
        }),
      });
      if (res.skipped) {
        toast.info('对话中未发现可记忆的内容');
      } else {
        toast.success(res.usedLlm ? '✨ AI 已提取记忆并写入今日日志' : '记忆已提取并写入今日日志');
      }
    } catch {
      toast.error('记忆提取失败');
    } finally {
      setExtracting(false);
    }
  }, [extracting, messages, currentSessionKey, currentAgentName, currentAgentId]);

  const handleSendMessage = (
    text: string,
    attachments?: Parameters<typeof sendMessage>[1],
    targetAgentId?: Parameters<typeof sendMessage>[2],
    workingDir?: Parameters<typeof sendMessage>[3],
  ) => {
    setStreamingTimestamp(Date.now() / 1000);
    sendMessage(text, attachments, targetAgentId, workingDir);
  };

  return (
    <div className={cn('relative flex h-full min-h-0 bg-white transition-colors duration-500 dark:bg-background')}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] shrink-0 items-center justify-between gap-4 bg-white px-5 dark:bg-background">
          <div ref={agentPickerRef} className="relative flex min-w-0 items-center gap-[6px]">
          <button
            type="button"
            onClick={() => setAgentPickerOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-[#f2f2f7]"
          >
            <h1 className="truncate text-[15px] font-semibold text-foreground">
              {currentAgentName}
            </h1>
            <span className="text-[12px] text-[#8e8e93]">▾</span>
          </button>
          {isRunActive && (
            <span className="text-[12px] font-medium text-muted-foreground whitespace-nowrap">
              {currentAgentName} 正在思考中
            </span>
          )}
            {agentPickerOpen && agents.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[200px] overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      if (isDirectMainSessionBlocked(agent, agent.mainSessionKey)) {
                        toast.error(buildLeaderOnlyBlockedMessage(agent, resolveReportingLeader(agent, agents)));
                        setAgentPickerOpen(false);
                        return;
                      }
                      switchSession(agent.mainSessionKey);
                      setAgentPickerOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-[#f2f2f7]',
                      agent.id === currentAgentId && 'bg-[#f2f2f7] font-medium',
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clawcorp-ac text-[11px] text-white">✦</span>
                    <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                    {agent.id === currentAgentId && <span className="shrink-0 text-[10px] text-clawcorp-ac">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('common:rightPanel.openFiles', { defaultValue: 'Open files panel' })}
              onClick={() => openPanel('file', currentAgentId ?? undefined)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                rightPanelMode === 'files'
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <FileText className="h-4 w-4" strokeWidth={1.5} />
              <span>{t('common:workbench.files')}</span>
            </button>
            <button
              type="button"
              aria-label={t('common:rightPanel.openAgent', { defaultValue: 'Open agent panel' })}
              onClick={() => openPanel('agent', currentAgentId ?? undefined)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                rightPanelMode === 'agent'
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Bot className="h-4 w-4" strokeWidth={1.5} />
              <span>{t('common:workbench.agent')}</span>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#fafafc] px-8 py-5 dark:bg-background">
              <div ref={contentRef} className="mx-auto flex min-h-full max-w-[1000px] flex-col space-y-6">
                {isEmpty ? (
                  <WorkbenchEmptyState />
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <ChatMessage
                        key={msg.id || `msg-${idx}`}
                        message={msg}
                        showThinking={showThinking}
                      />
                    ))}

                    {shouldRenderStreaming && (
                      <ChatMessage
                        message={(streamMsg
                          ? {
                              ...(streamMsg as Record<string, unknown>),
                              role: (typeof streamMsg.role === 'string' ? streamMsg.role : 'assistant') as RawMessage['role'],
                              content: streamMsg.content ?? streamText,
                              timestamp: streamMsg.timestamp ?? streamingTimestamp,
                            }
                          : {
                              role: 'assistant',
                              content: streamText,
                              timestamp: streamingTimestamp,
                            }) as RawMessage}
                        showThinking={showThinking}
                        isStreaming
                        streamingTools={streamingTools}
                        autoExpandThinking={hasStreamThinking}
                      />
                    )}

                    {sending && pendingFinal && !shouldRenderStreaming && (
                      <ActivityIndicator phase="tool_processing" />
                    )}

                    {sending && !pendingFinal && !hasAnyStreamContent && (
                      <TypingIndicator />
                    )}
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="border-t border-destructive/20 bg-destructive/10 px-6 py-2">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </p>
                  <button
                    onClick={clearError}
                    className="text-xs text-destructive/60 underline hover:text-destructive"
                  >
                    {t('common:actions.dismiss')}
                  </button>
                </div>
              </div>
            )}

            <div className="px-2 pb-2 pt-6">
              <ChatInput
                onSend={handleSendMessage}
                onStop={abortRun}
                disabled={!isGatewayRunning}
                sending={sending}
                isEmpty={isEmpty}
              />
            </div>
          </div>

          {rightPanelMode !== null && <ContextRail />}
        </div>
      </div>

      {minLoading && !sending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/20 backdrop-blur-[1px] pointer-events-auto">
          <div className="rounded-full border border-border bg-background p-2.5 shadow-lg">
            <LoadingSpinner size="md" />
          </div>
        </div>
      )}
      {teamBriefOpen && (
        <aside className="absolute right-0 top-0 z-40 flex h-full w-[340px] flex-col overflow-y-auto border-l border-black/[0.06] bg-white">
          <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5">
            <span className="text-[14px] font-semibold text-[#000000]">{t('common:teamBrief.title')}</span>
            <button
              type="button"
              aria-label="close-team-brief"
              onClick={() => setTeamBriefOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] text-[#8e8e93] transition-colors hover:bg-[#f2f2f7]"
            >
              ×
            </button>
          </header>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-2xl border border-black/[0.06] bg-[#fffaf3] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b45309]">{t('common:teamBrief.summary')}</p>
              <p className="mt-2 text-[13px] leading-6 text-[#4b5563]">{teamBrief.summaryText}</p>
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[12px] text-[#334155]">{teamBrief.dashboard.primaryNextAction}</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-black/[0.06] bg-[#f8fafc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">{t('common:teamBrief.activeWork')}</p>
                <div className="mt-2 space-y-2">
                  {teamBrief.dashboard.activeWorkItems.length > 0 ? teamBrief.dashboard.activeWorkItems.slice(0, 3).map((item) => (
                    <p key={`${item.memberId}-${item.title}`} className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#111827]">
                      {item.memberName}: {item.title}
                    </p>
                  )) : (
                    <p className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#64748b]">{t('common:teamBrief.noActiveWork')}</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-black/[0.06] bg-[#f8fafc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">{t('common:teamBrief.blockers')}</p>
                <div className="mt-2 space-y-2">
                  {teamBrief.blockedItems.length > 0 ? teamBrief.blockedItems.map((item) => (
                    <p key={item} className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#111827]">{item}</p>
                  )) : (
                    <p className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#64748b]">{t('common:teamBrief.noBlockers')}</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-black/[0.06] bg-[#f8fafc] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748b]">{t('common:teamBrief.nextSteps')}</p>
                <div className="mt-2 space-y-2">
                  {teamBrief.nextSteps.length > 0 ? teamBrief.nextSteps.slice(0, 3).map((item) => (
                    <p key={item} className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#111827]">{item}</p>
                  )) : (
                    <p className="rounded-xl bg-white px-3 py-2 text-[12px] text-[#64748b]">{t('common:teamBrief.noNextSteps')}</p>
                  )}
                </div>
              </div>
            </div>
            {teamBrief.members.map((member) => (
              <div key={member.id} className="rounded-xl border border-black/[0.06] bg-[#fafafc] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#111827]">{member.name}</p>
                  <span className="text-[11px] text-[#8e8e93]">{t(`common:teamMap.status.${member.statusKey}`)}</span>
                </div>
                <p className="mt-2 text-[11px] text-[#8e8e93]">{member.etaText}</p>
                {member.currentWorkTitles.map((title) => (
                  <p key={title} className="mt-2 text-[12px] text-[#374151]">{title}</p>
                ))}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/agents/${encodeURIComponent(member.id)}`)}
                    className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] text-[#374151]"
                  >
                    {t('common:teamBrief.openMember')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/kanban')}
                    className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[11px] text-[#374151]"
                  >
                    {t('common:teamBrief.openKanban')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground dark:bg-white/5">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-black/5 px-4 py-3 text-foreground dark:bg-white/5">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function ActivityIndicator({ phase }: { phase: 'tool_processing' }) {
  void phase;
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground dark:bg-white/5">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl bg-black/5 px-4 py-3 text-foreground dark:bg-white/5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>工具调用处理中...</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
