import { useState } from 'react';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';

type WorkbenchEmptyStateProps = Record<string, never>;

const quickActions = [
  { label: '解释代码', prompt: '请解释这段代码的作用和原理', skillHints: ['code-assist', 'file-tools'] },
  { label: '写单测', prompt: '为这个函数编写单元测试，覆盖边界情况', skillHints: ['python-env', 'code-assist'] },
  { label: '代码审查', prompt: '请帮我做代码审查，找出潜在的 bug 和改进点', skillHints: ['code-assist'] },
  { label: '优化性能', prompt: '分析并优化这段代码的性能瓶颈', skillHints: ['code-assist', 'terminal'] },
  { label: 'SQL 生成', prompt: '根据以下需求生成对应的 SQL 查询语句：', skillHints: ['file-tools'] },
  { label: '文档生成', prompt: '为这段代码生成清晰的注释和 API 文档', skillHints: ['code-assist', 'file-tools'] },
];

const suggestions = [
  {
    icon: '🔧',
    title: '代码重构方案',
    description: '提取 src/utils 核心逻辑并编写单测',
  },
  {
    icon: '📊',
    title: '检查系统健康度',
    description: '调出监控面板，查昨日定时任务状态',
  },
  {
    icon: '📝',
    title: '撰写周报汇总',
    description: '收集近 5 天 Git commit 生成团队周报',
  },
  {
    icon: '🧠',
    title: '查看团队记忆',
    description: '总结关于架构设计的长期记忆',
  },
];

export function WorkbenchEmptyState(_props: WorkbenchEmptyStateProps) {
  const setComposerDraft = useChatStore((s) => s.setComposerDraft);
  const isGatewayRunning = useGatewayStore((s) => s.status.state === 'running');
  const [selectedQuickActionIndex, setSelectedQuickActionIndex] = useState(0);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');

  const selectedQuickAction = quickActions[selectedQuickActionIndex] ?? quickActions[0];

  const openPromptPanel = (prompt: string) => {
    if (!isGatewayRunning) return;
    setPromptDraft(prompt);
    setPromptPanelOpen(true);
  };

  const fillComposer = () => {
    setComposerDraft(promptDraft);
    setPromptPanelOpen(false);
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 pb-8 pt-12 text-center">
      <div
        data-testid="workbench-empty-illustration"
        className="relative mb-6 flex h-[92px] w-[160px] items-center justify-center"
      >
        <div className="absolute left-3 top-6 h-10 w-10 rounded-2xl bg-[#dbeafe]" />
        <div className="absolute right-4 top-3 h-12 w-12 rounded-[18px] bg-[#dcfce7]" />
        <div className="absolute bottom-3 left-10 h-8 w-8 rounded-full bg-[#fde68a]" />
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-[26px] text-white"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
        >
          ✦
        </div>
      </div>

      <h2 className="mb-4 text-[26px] font-medium text-foreground">有什么我可以帮你的？</h2>

      {!isGatewayRunning && (
        <div className="mb-5 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          Gateway disconnected. Start the Gateway to enable actions.
        </div>
      )}

      {/* Quick Action Bar */}
      <div
        role="toolbar"
        aria-label="Quick action bar"
        className="mb-6 w-full max-w-[640px] rounded-2xl border border-black/[0.08] bg-white/95 p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((action, index) => {
            const isSelected = index === selectedQuickActionIndex;
            return (
              <button
                key={action.label}
                type="button"
                aria-label={`Quick action: ${action.label}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setSelectedQuickActionIndex(index);
                  openPromptPanel(action.prompt);
                }}
                disabled={!isGatewayRunning}
                className={`rounded-full border px-4 py-1.5 text-[13px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? 'border-clawx-ac/40 bg-clawx-ac/10 text-clawx-ac'
                    : 'border-black/[0.08] bg-white text-[#3c3c43] hover:-translate-y-[1px] hover:border-clawx-ac/30 hover:bg-clawx-ac/5 hover:text-clawx-ac hover:shadow-[0_4px_12px_rgba(0,122,255,0.1)]'
                }`}
              >
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-[#f8faff] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">Ready to run</p>
            <p className="truncate text-[13px] font-semibold text-foreground">{selectedQuickAction.label}</p>
          </div>
          <button
            type="button"
            aria-label="Use selected action"
            onClick={() => openPromptPanel(selectedQuickAction.prompt)}
            disabled={!isGatewayRunning}
            className="shrink-0 rounded-lg border border-clawx-ac/40 bg-clawx-ac/10 px-3 py-1.5 text-[12px] font-semibold text-clawx-ac transition-all hover:bg-clawx-ac/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use selected action
          </button>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="grid w-full max-w-[640px] grid-cols-1 gap-4 text-left sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() => isGatewayRunning && openPromptPanel(suggestion.description)}
            disabled={!isGatewayRunning}
            className={`flex flex-col gap-[6px] rounded-xl border border-black/[0.06] bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all dark:border-white/10 dark:bg-white/[0.04] ${
              isGatewayRunning
                ? 'cursor-pointer hover:-translate-y-0.5 hover:border-black/[0.15] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
                : 'cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[18px]">{suggestion.icon}</span>
              <span className="text-[15px] font-semibold text-foreground">{suggestion.title}</span>
            </div>
            <p className="text-[13px] leading-[1.4] text-[#3c3c43]">{suggestion.description}</p>
          </button>
        ))}
      </div>

      {promptPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
          <div
            role="dialog"
            aria-label="Quick action prompt"
            className="w-full max-w-[560px] rounded-2xl border border-black/[0.08] bg-white p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.16)]"
          >
            <div className="mb-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6b7280]">Mapped skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(selectedQuickAction.skillHints ?? []).map((hint) => (
                  <span key={hint} className="rounded-full border border-clawx-ac/20 bg-clawx-ac/5 px-3 py-1 text-[12px] font-medium text-clawx-ac">
                    {hint}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-[13px] font-medium text-[#111827]">{selectedQuickAction.label}</p>
              <textarea
                value={promptDraft}
                onChange={(event) => setPromptDraft(event.target.value)}
                rows={6}
                className="w-full resize-none rounded-xl border border-black/[0.08] bg-[#f8fafc] px-4 py-3 text-[13px] outline-none focus:border-clawx-ac"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromptPanelOpen(false)}
                className="rounded-lg border border-black/[0.08] px-3 py-2 text-[13px] text-[#3c3c43] hover:bg-[#f2f2f7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={fillComposer}
                className="rounded-lg bg-clawx-ac px-3 py-2 text-[13px] font-medium text-white hover:bg-[#005fd6]"
              >
                Fill composer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
