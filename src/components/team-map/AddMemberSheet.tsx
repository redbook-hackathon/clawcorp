import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';

interface AddMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  leaderId: string;
  memberIds: string[];
  onAdded?: () => Promise<void> | void;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AddMemberSheet({
  open,
  onOpenChange,
  teamId,
  leaderId,
  memberIds,
  onAdded,
}: AddMemberSheetProps) {
  const { t } = useTranslation('common');
  const { agents, fetchAgents } = useAgentsStore();
  const { addMember } = useTeamsStore();
  const [query, setQuery] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addedAgentIds, setAddedAgentIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      void fetchAgents();
    }
  }, [fetchAgents, open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedAgentIds([]);
      setAddedAgentIds([]);
      setSubmitting(false);
    }
  }, [open]);

  const inTeamIds = useMemo(
    () => new Set([leaderId, ...memberIds, ...addedAgentIds]),
    [addedAgentIds, leaderId, memberIds],
  );

  const filteredAgents = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return agents;

    return agents.filter((agent) => {
      return (
        agent.name.toLowerCase().includes(trimmed)
        || agent.persona.toLowerCase().includes(trimmed)
      );
    });
  }, [agents, query]);

  const toggleAgent = (agentId: string) => {
    if (inTeamIds.has(agentId)) return;

    setSelectedAgentIds((current) => {
      return current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId];
    });
  };

  const handleAdd = async () => {
    if (selectedAgentIds.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      for (const agentId of selectedAgentIds) {
        await addMember(teamId, agentId);
      }
      setAddedAgentIds((current) => [...current, ...selectedAgentIds]);
      setSelectedAgentIds([]);
      await onAdded?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>
            {t('teamMap.header.addMember', { defaultValue: 'Add Team Member' })}
          </SheetTitle>
          <SheetDescription>
            {t('teamMap.addMember.description', {
              defaultValue: 'Select agents to add them to this team.',
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex h-[calc(100%-2rem)] flex-col gap-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('teamMap.addMember.searchPlaceholder', {
              defaultValue: 'Search agents',
            })}
            aria-label={t('teamMap.addMember.searchPlaceholder', {
              defaultValue: 'Search agents',
            })}
          />

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredAgents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                <p>{t('teamMap.addMember.noMatch', { defaultValue: 'No matching agents' })}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setQuery('')}
                >
                  {t('teamMap.addMember.clearSearch', { defaultValue: 'Clear search' })}
                </Button>
              </div>
            ) : null}

            {filteredAgents.map((agent) => {
              const disabled = inTeamIds.has(agent.id);
              const selected = selectedAgentIds.includes(agent.id);

              return (
                <button
                  key={agent.id}
                  type="button"
                  aria-label={`Select ${agent.name}`}
                  disabled={disabled}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                    disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                      : selected
                        ? 'border-blue-500 bg-blue-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{agent.name}</p>
                    <p className="truncate text-xs text-slate-500">{agent.persona || 'No persona'}</p>
                  </div>

                  {disabled ? (
                    <Badge variant="secondary">
                      {t('teamMap.addMember.alreadyInTeam', { defaultValue: 'Already in Team' })}
                    </Badge>
                  ) : selected ? (
                    <Badge>Selected</Badge>
                  ) : null}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={() => void handleAdd()}
            disabled={selectedAgentIds.length === 0 || submitting}
          >
            {t('teamMap.header.addMember', { defaultValue: 'Add Team Member' })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
