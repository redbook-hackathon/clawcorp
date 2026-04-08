import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgentsStore } from '@/stores/agents';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { Radio, ArrowLeft, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export function BroadcastChat() {
  const { t } = useTranslation('common');
  const agents = useAgentsStore((s) => s.agents);

  // Per D-12: only leaders whose chatAccess is NOT leader_only
  const selectableLeaders = useMemo(
    () => agents.filter((a) => a.teamRole === 'leader' && a.chatAccess !== 'leader_only'),
    [agents],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [broadcastText, setBroadcastText] = useState('');
  const [sentState, setSentState] = useState<Record<string, SendState>>({});

  const toggleLeader = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedIds(selectableLeaders.map((l) => l.id));
  };

  const canSend = selectedIds.length > 0 && broadcastText.trim().length > 0;
  const isSending = Object.values(sentState).some((s) => s === 'sending');

  const handleSend = async () => {
    if (!canSend || isSending) return;

    // Mark all selected as sending
    const initial: Record<string, SendState> = {};
    for (const id of selectedIds) initial[id] = 'sending';
    setSentState(initial);

    // Fire all in parallel
    await Promise.allSettled(
      selectedIds.map(async (leaderId) => {
        const leader = agents.find((a) => a.id === leaderId);
        if (!leader) return;
        try {
          await hostApiFetch('/api/chat/send-with-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionKey: leader.mainSessionKey,
              message: broadcastText.trim(),
              idempotencyKey: `broadcast-${Date.now()}-${leader.id}`,
              deliver: false,
            }),
          });
          setSentState((prev) => ({ ...prev, [leaderId]: 'sent' }));
        } catch {
          setSentState((prev) => ({ ...prev, [leaderId]: 'error' }));
        }
      }),
    );
  };

  const hasSentAny = Object.values(sentState).some((s) => s === 'sent' || s === 'error');

  return (
    <div className="flex h-full flex-col bg-slate-50 p-6 xl:p-8">
      <div className="flex flex-1 flex-col overflow-y-auto rounded-[32px] bg-white p-8 shadow-sm border border-slate-200/60">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link to="/team-overview" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t('broadcast.back', { defaultValue: 'Back' })}
          </Link>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-blue-600" />
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {t('broadcast.title', { defaultValue: 'Group Meeting' })}
            </h1>
          </div>
        </div>

        {/* Leader selector */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {t('broadcast.selectLeaders', { defaultValue: 'Select Team Leaders' })}
            </p>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('broadcast.selectAll', { defaultValue: 'Select All' })}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectableLeaders.map((leader) => (
              <label
                key={leader.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                  selectedIds.includes(leader.id)
                    ? 'border-blue-300 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(leader.id)}
                  onChange={() => toggleLeader(leader.id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-900">{leader.name}</span>
              </label>
            ))}
          </div>
          {selectableLeaders.length === 0 && (
            <p className="mt-2 text-sm text-slate-400">
              {t('broadcast.noLeaders', { defaultValue: 'No Team Leaders available.' })}
            </p>
          )}
        </section>

        {/* Message input */}
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {t('broadcast.message', { defaultValue: 'Message' })}
          </p>
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder={t('broadcast.placeholder', { defaultValue: 'Type your message to all selected leaders...' })}
            className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
            rows={4}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-400">{broadcastText.length} chars</span>
            <button
              type="button"
              disabled={!canSend || isSending}
              onClick={() => void handleSend()}
              className="rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending
                ? t('broadcast.sending', { defaultValue: 'Sending...' })
                : t('broadcast.send', { defaultValue: 'Send to Selected' })}
            </button>
          </div>
        </section>

        {/* Per-leader status */}
        {hasSentAny && (
          <section>
            <p className="mb-3 text-sm font-medium text-slate-700">
              {t('broadcast.results', { defaultValue: 'Results' })}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedIds.map((id) => {
                const leader = agents.find((a) => a.id === id);
                if (!leader) return null;
                const state = sentState[id] ?? 'idle';
                return (
                  <div key={id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {state === 'sent' && <Check className="h-4 w-4 text-emerald-500" />}
                      {state === 'error' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                      <span className="text-sm font-medium text-slate-900">{leader.name}</span>
                    </div>
                    {state === 'sent' && (
                      <Link
                        to={`/?agent=${encodeURIComponent(leader.id)}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        {t('broadcast.openChat', { defaultValue: 'Open chat' })}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default BroadcastChat;
