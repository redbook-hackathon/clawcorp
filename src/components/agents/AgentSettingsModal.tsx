import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAgentsStore } from '@/stores/agents';
import { useChannelsStore } from '@/stores/channels';
import { useProviderStore } from '@/stores/providers';
import { CHANNEL_ICONS, CHANNEL_NAMES, type ChannelType } from '@/types/channel';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import telegramIcon from '@/assets/channels/telegram.svg';
import discordIcon from '@/assets/channels/discord.svg';
import whatsappIcon from '@/assets/channels/whatsapp.svg';
import dingtalkIcon from '@/assets/channels/dingtalk.svg';
import feishuIcon from '@/assets/channels/feishu.svg';
import wecomIcon from '@/assets/channels/wecom.svg';
import qqIcon from '@/assets/channels/qq.svg';

const inputClasses = 'h-[44px] rounded-xl font-mono text-[13px] bg-[#eeece3] dark:bg-muted border-black/10 dark:border-white/10 focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:border-blue-500 shadow-sm transition-all text-foreground placeholder:text-foreground/40';
const labelClasses = 'text-[14px] text-foreground/80 font-bold';

function ChannelLogo({ type }: { type: ChannelType }) {
  switch (type) {
    case 'telegram': return <img src={telegramIcon} alt="Telegram" className="w-[20px] h-[20px] dark:invert" />;
    case 'discord': return <img src={discordIcon} alt="Discord" className="w-[20px] h-[20px] dark:invert" />;
    case 'whatsapp': return <img src={whatsappIcon} alt="WhatsApp" className="w-[20px] h-[20px] dark:invert" />;
    case 'dingtalk': return <img src={dingtalkIcon} alt="DingTalk" className="w-[20px] h-[20px] dark:invert" />;
    case 'feishu': return <img src={feishuIcon} alt="Feishu" className="w-[20px] h-[20px] dark:invert" />;
    case 'wecom': return <img src={wecomIcon} alt="WeCom" className="w-[20px] h-[20px] dark:invert" />;
    case 'qqbot': return <img src={qqIcon} alt="QQ" className="w-[20px] h-[20px] dark:invert" />;
    default: return <span className="text-[20px] leading-none">{CHANNEL_ICONS[type] || '💬'}</span>;
  }
}

/* PLACEHOLDER_MODAL */

function buildModelOptions(accounts: Array<{ id: string; vendorId: string; label: string; model?: string; enabled: boolean }>, vendors: Array<{ id: string; name: string; defaultModelId?: string }>) {
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const options: Array<{ value: string; label: string }> = [];
  for (const account of accounts) {
    if (!account.enabled) continue;
    const vendor = vendorMap.get(account.vendorId);
    const modelId = account.model || vendor?.defaultModelId;
    if (!modelId) continue;
    const value = `${account.vendorId}/${modelId}`;
    const label = `${vendor?.name || account.vendorId} / ${modelId}`;
    if (!options.some((o) => o.value === value)) {
      options.push({ value, label });
    }
  }
  return options;
}

export function AgentSettingsModal({
  agent,
  channels,
  onClose,
}: {
  agent: AgentSummary;
  channels: Array<{ type: string; name: string; status: 'connected' | 'connecting' | 'disconnected' | 'error'; error?: string }>;
  onClose: () => void;
}) {
  const { t } = useTranslation('agents');
  const { updateAgent, assignChannel, removeChannel } = useAgentsStore();
  const { fetchChannels } = useChannelsStore();
  const { accounts, vendors, refreshProviderSnapshot } = useProviderStore();
  const [name, setName] = useState(agent.name);
  const [persona, setPersona] = useState(agent.persona);
  const [model, setModel] = useState(agent.model || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelToRemove, setChannelToRemove] = useState<ChannelType | null>(null);

  useEffect(() => {
    setName(agent.name);
    setPersona(agent.persona);
    setModel(agent.model || '');
  }, [agent.name, agent.persona, agent.model]);

  useEffect(() => {
    void refreshProviderSnapshot();
  }, [refreshProviderSnapshot]);

  const modelOptions = useMemo(() => buildModelOptions(accounts, vendors), [accounts, vendors]);

  const runtimeChannelsByType = useMemo(
    () => Object.fromEntries(channels.map((ch) => [ch.type, ch])),
    [channels],
  );

  const hasProfileChanges = name.trim() !== agent.name
    || persona.trim() !== agent.persona
    || model !== (agent.model || '');

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    if (!hasProfileChanges) return;
    setSavingProfile(true);
    try {
      await updateAgent(agent.id, {
        name: name.trim(),
        persona: persona.trim(),
        model,
      });
      toast.success(t('toast.agentUpdated'));
    } catch (error) {
      toast.error(t('toast.agentUpdateFailed', { error: String(error) }));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChannelSaved = async (channelType: ChannelType) => {
    try {
      await assignChannel(agent.id, channelType);
      await fetchChannels();
      toast.success(t('toast.channelAssigned', { channel: CHANNEL_NAMES[channelType] || channelType }));
    } catch (error) {
      toast.error(t('toast.channelAssignFailed', { error: String(error) }));
      throw error;
    }
  };

  const assignedChannels = agent.channelTypes.map((channelType) => {
    const runtimeChannel = runtimeChannelsByType[channelType];
    return {
      channelType: channelType as ChannelType,
      name: runtimeChannel?.name || CHANNEL_NAMES[channelType as ChannelType] || channelType,
      status: runtimeChannel?.status || 'disconnected',
      error: runtimeChannel?.error,
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border-0 shadow-2xl bg-[#f3f1e9] dark:bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between pb-2 shrink-0">
          <div>
            <CardTitle className="text-2xl font-serif font-normal tracking-tight">
              {t('settingsDialog.title', { name: agent.name })}
            </CardTitle>
            <CardDescription className="text-[15px] mt-1 text-foreground/70">
              {t('settingsDialog.description')}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 -mr-2 -mt-2 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 pt-4 overflow-y-auto flex-1 p-6">
          {/* PLACEHOLDER_SETTINGS_BODY */}
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor="agent-settings-name" className={labelClasses}>{t('settingsDialog.nameLabel')}</Label>
              <Input
                id="agent-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                readOnly={agent.isDefault}
                className={inputClasses}
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="agent-settings-persona" className={labelClasses}>
                {t('settingsDialog.personaLabel', { defaultValue: 'Persona / Role' })}
              </Label>
              <textarea
                id="agent-settings-persona"
                value={persona}
                onChange={(event) => setPersona(event.target.value)}
                readOnly={agent.isDefault}
                placeholder={t('settingsDialog.personaPlaceholder', { defaultValue: 'Describe the clone persona, specialty, or tone' })}
                className="min-h-[120px] w-full rounded-xl border border-black/10 bg-[#eeece3] px-3 py-2 text-[13px] text-foreground outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/10 dark:bg-muted"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="agent-settings-model" className={labelClasses}>
                {t('settingsDialog.modelLabel', { defaultValue: '模型' })}
              </Label>
              <select
                id="agent-settings-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className={`${inputClasses} w-full cursor-pointer`}
              >
                <option value="">{t('settingsDialog.inheritModel', { defaultValue: '继承默认模型' })}</option>
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-[12px] text-foreground/60">
                {agent.inheritedModel
                  ? t('settingsDialog.modelInherited', { defaultValue: `当前继承默认: ${agent.modelDisplay}`, model: agent.modelDisplay })
                  : t('settingsDialog.modelDirect', { defaultValue: `当前: ${agent.modelDisplay}`, model: agent.modelDisplay })}
              </p>
            </div>

            {hasProfileChanges && (
              <div className="flex justify-end">
                <Button
                  onClick={() => void handleSaveProfile()}
                  disabled={savingProfile || !name.trim()}
                  className="h-9 text-[13px] font-medium rounded-full px-4 shadow-none"
                >
                  {savingProfile ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {t('common:actions.save')}
                </Button>
              </div>
            )}

            <div className="space-y-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent p-4">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80 font-medium">
                {t('settingsDialog.agentIdLabel')}
              </p>
              <p className="font-mono text-[13px] text-foreground">{agent.id}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-serif text-foreground font-normal tracking-tight">
                  {t('settingsDialog.channelsTitle')}
                </h3>
                <p className="text-[14px] text-foreground/70 mt-1">{t('settingsDialog.channelsDescription')}</p>
              </div>
              <Button onClick={() => setShowChannelModal(true)} className="h-9 text-[13px] font-medium rounded-full px-4 shadow-none">
                <Plus className="h-3.5 w-3.5 mr-2" />
                {t('settingsDialog.addChannel')}
              </Button>
            </div>

            {assignedChannels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4 text-[13.5px] text-muted-foreground">
                {t('settingsDialog.noChannels')}
              </div>
            ) : (
              <div className="space-y-3">
                {assignedChannels.map((channel) => (
                  <div key={channel.channelType} className="flex items-center justify-between rounded-2xl bg-black/5 dark:bg-white/5 border border-transparent p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-[40px] w-[40px] shrink-0 flex items-center justify-center text-foreground bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full shadow-sm">
                        <ChannelLogo type={channel.channelType} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">{channel.name}</p>
                        <p className="text-[13.5px] text-muted-foreground">{CHANNEL_NAMES[channel.channelType]}</p>
                        {channel.error && <p className="text-xs text-destructive mt-1">{channel.error}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={channel.status} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setChannelToRemove(channel.channelType)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showChannelModal && (
        <ChannelConfigModal
          configuredTypes={agent.channelTypes}
          showChannelName={false}
          allowExistingConfig
          agentId={agent.id}
          onClose={() => setShowChannelModal(false)}
          onChannelSaved={async (channelType) => {
            await handleChannelSaved(channelType);
            setShowChannelModal(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!channelToRemove}
        title={t('removeChannelDialog.title')}
        message={channelToRemove ? t('removeChannelDialog.message', { name: CHANNEL_NAMES[channelToRemove] || channelToRemove }) : ''}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!channelToRemove) return;
          try {
            await removeChannel(agent.id, channelToRemove);
            await fetchChannels();
            toast.success(t('toast.channelRemoved', { channel: CHANNEL_NAMES[channelToRemove] || channelToRemove }));
          } catch (error) {
            toast.error(t('toast.channelRemoveFailed', { error: String(error) }));
          } finally {
            setChannelToRemove(null);
          }
        }}
        onCancel={() => setChannelToRemove(null)}
      />
    </div>
  );
}
