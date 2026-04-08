type FeishuWorkbenchPlaceholderProps = {
  channelName?: string | null;
  actionLabel: string;
  onAction: () => void;
};

export function FeishuWorkbenchPlaceholder({
  channelName,
  actionLabel,
  onAction,
}: FeishuWorkbenchPlaceholderProps) {
  return (
    <div
      data-testid="feishu-workbench-placeholder"
      className="absolute inset-0 z-10 flex items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_44%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.98))] px-6 py-8"
    >
      <div className="w-full max-w-[680px] rounded-[32px] border border-black/10 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/20 bg-[#fff7ed] px-3 py-1 text-[12px] font-medium text-[#c2410c]">
          <span className="text-[14px]">施工中</span>
          <span>功能尚未开发完毕</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[440px]">
            <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-[#0f172a]">
              飞书同步工作台开发中
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-[#475569]">
              当前仅保留飞书渠道接入与基础配置能力，消息同步、会话处理和工作台收发体验会在后续版本开放。
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#2563eb,#0f766e)] text-[30px] text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)]">
            🐦
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#e0f2fe] px-3 py-1 text-[12px] font-medium text-[#0369a1]">
            渠道接入保留
          </span>
          <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] font-medium text-[#64748b]">
            会话同步待开放
          </span>
          <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[12px] font-medium text-[#64748b]">
            消息工作台待开放
          </span>
        </div>

        {channelName ? (
          <p className="mt-5 text-[13px] text-[#64748b]">
            当前频道：<span className="font-medium text-[#0f172a]">{channelName}</span>
          </p>
        ) : (
          <p className="mt-5 text-[13px] text-[#64748b]">
            你现在仍可以先完成飞书接入和基础配置，后续开发完成后会直接接回这里。
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center rounded-2xl bg-[#0f172a] px-5 py-3 text-[14px] font-medium text-white transition hover:bg-[#1e293b]"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
