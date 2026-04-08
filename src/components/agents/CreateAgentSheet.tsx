import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { useProviderStore } from '@/stores/providers';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const inputClasses = 'h-[44px] rounded-xl border border-black/10 bg-[#eeece3] px-3 text-[13px] text-foreground shadow-sm transition-all placeholder:text-foreground/40 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/10 dark:bg-muted';
const labelClasses = 'text-[14px] font-bold text-foreground/80';

function buildModelOptions(
  accounts: Array<{ id: string; vendorId: string; label: string; model?: string; enabled: boolean }>,
  vendors: Array<{ id: string; name: string; defaultModelId?: string }>,
) {
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const options: Array<{ value: string; label: string }> = [];

  for (const account of accounts) {
    if (!account.enabled) continue;
    const vendor = vendorMap.get(account.vendorId);
    const modelId = account.model || vendor?.defaultModelId;
    if (!modelId) continue;

    const value = `${account.vendorId}/${modelId}`;
    const label = `${vendor?.name || account.vendorId} / ${modelId}`;
    if (!options.some((option) => option.value === value)) {
      options.push({ value, label });
    }
  }

  return options;
}

interface CreateAgentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentSheet({ open, onOpenChange }: CreateAgentSheetProps) {
  const { t } = useTranslation('agents');
  const { createAgent, updateAgent } = useAgentsStore();
  const { teams, addMember } = useTeamsStore();
  const { accounts, vendors, refreshProviderSnapshot } = useProviderStore();

  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [teamRole, setTeamRole] = useState<'leader' | 'worker'>('worker');
  const [model, setModel] = useState('');
  const [teamId, setTeamId] = useState('');
  const [saving, setSaving] = useState(false);

  const modelOptions = useMemo(() => buildModelOptions(accounts, vendors), [accounts, vendors]);

  useEffect(() => {
    if (!open) return;
    void refreshProviderSnapshot();
  }, [open, refreshProviderSnapshot]);

  const resetForm = () => {
    setName('');
    setPersona('');
    setTeamRole('worker');
    setModel('');
    setTeamId('');
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const { createdAgentId } = await createAgent({
        name: name.trim(),
        ...(persona.trim() ? { persona: persona.trim() } : {}),
        teamRole,
        ...(model ? { model } : {}),
      });

      if (teamId) {
        await addMember(teamId, createdAgentId);
        const team = teams.find((entry) => entry.id === teamId);
        if (team) {
          await updateAgent(createdAgentId, { reportsTo: team.leaderId });
        }
      }

      toast.success(t('toast.agentCreated'));
      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(t('toast.agentCreateFailed', { error: String(error) }));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label={t('common:actions.cancel', { defaultValue: 'Cancel' })}
        className="flex-1 bg-black/40"
        onClick={handleClose}
      />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-[#f7f4ec] shadow-2xl dark:bg-card">
        <div className="flex items-start justify-between border-b border-black/5 px-6 py-6">
          <div>
            <h2 className="text-2xl font-serif font-normal tracking-tight text-foreground">
              {t('createDialog.title', { defaultValue: 'Create Agent' })}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-foreground/70">
              {t('createDialog.description', {
                defaultValue: 'Create a new agent and optionally attach it to a team.',
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-9 w-9 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-2.5">
            <Label htmlFor="create-agent-name" className={labelClasses}>
              {t('createDialog.nameLabel', { defaultValue: 'Name' })}
            </Label>
            <Input
              id="create-agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('createDialog.namePlaceholder', { defaultValue: 'Researcher' })}
              className={inputClasses}
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="create-agent-persona" className={labelClasses}>
              {t('createDialog.personaLabel', { defaultValue: 'Persona' })}
            </Label>
            <textarea
              id="create-agent-persona"
              value={persona}
              onChange={(event) => setPersona(event.target.value)}
              placeholder={t('createDialog.personaPlaceholder', { defaultValue: 'Describe the clone persona, specialty, or tone' })}
              rows={4}
              className="min-h-[120px] w-full rounded-xl border border-black/10 bg-[#eeece3] px-3 py-2 text-[13px] text-foreground outline-none transition-all focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:border-white/10 dark:bg-muted"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="create-agent-role" className={labelClasses}>
                {t('detail.teamRole', { defaultValue: 'Team role' })}
              </Label>
              <select
                id="create-agent-role"
                value={teamRole}
                onChange={(event) => setTeamRole(event.target.value as 'leader' | 'worker')}
                className={`${inputClasses} w-full cursor-pointer`}
              >
                <option value="leader">{t('detail.teamRoleLeader', { defaultValue: 'leader' })}</option>
                <option value="worker">{t('detail.teamRoleWorker', { defaultValue: 'worker' })}</option>
              </select>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="create-agent-model" className={labelClasses}>
                {t('settingsDialog.modelLabel', { defaultValue: 'Model' })}
              </Label>
              <select
                id="create-agent-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className={`${inputClasses} w-full cursor-pointer`}
              >
                <option value="">{t('settingsDialog.inheritModel', { defaultValue: 'Inherit default model' })}</option>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="create-agent-team" className={labelClasses}>
              {t('createDialog.teamLabel', { defaultValue: 'Team' })}
            </Label>
            <select
              id="create-agent-team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className={`${inputClasses} w-full cursor-pointer`}
            >
              <option value="">{t('createDialog.noTeam', { defaultValue: 'No team' })}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/5 px-6 py-5">
          <Button variant="outline" onClick={handleClose} className="rounded-full px-4">
            {t('common:actions.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim()}
            className="rounded-full px-4"
          >
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('createDialog.submitLabel', { defaultValue: 'Create Agent' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
