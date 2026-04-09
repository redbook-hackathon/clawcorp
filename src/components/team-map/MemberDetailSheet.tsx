import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AgentSummary } from '@/types/agent';
import { MemberMemoryTab } from './MemberMemoryTab';
import { MemberSkillsTab } from './MemberSkillsTab';
import { MemberActivityTab } from './MemberActivityTab';

interface MemberDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentSummary | null;
  teamId: string;
  isLeader: boolean;
  ownedEntryPoints: string[];
  activity?: {
    statusLabel?: string;
    currentWorkTitles?: string[];
    blockingReason?: string | null;
    nextStep?: string;
  };
  onRemoveMember: (agentId: string) => Promise<void>;
  onOpenChat: (agent: AgentSummary) => void;
}

export function MemberDetailSheet({
  open,
  onOpenChange,
  agent,
  teamId,
  isLeader,
  ownedEntryPoints,
  activity,
  onRemoveMember,
  onOpenChat,
}: MemberDetailSheetProps) {
  const { t } = useTranslation('common');
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!agent) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>{agent.name}</SheetTitle>
            <SheetDescription>
              {t('teamMap.memberDetail.description')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">{t('teamMap.drawer.profilePolicy')}</TabsTrigger>
                <TabsTrigger value="memory">Memory</TabsTrigger>
                <TabsTrigger value="skills">{t('skills.title')}</TabsTrigger>
                <TabsTrigger value="activity">{t('teamMap.rail.runtimeWork')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => onOpenChat(agent)}>
                    {t('teamMap.memberDetail.openChat')}
                  </Button>
                  {!isLeader ? (
                    <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)}>
                      {t('teamMap.memberDetail.removeFromTeam')}
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">{t('teamMap.memberDetail.role')}</span>
                    <span className="font-medium text-slate-900">{agent.teamRole}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">{t('teamMap.memberDetail.chatAccess')}</span>
                    <span className="font-medium text-slate-900">{agent.chatAccess}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">{t('teamMap.memberDetail.responsibility')}</span>
                    <span className="font-medium text-slate-900">{agent.responsibility || t('teamMap.memberDetail.none')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">{t('teamMap.memberDetail.team')}</span>
                    <span className="font-medium text-slate-900">{teamId}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">{t('teamMap.memberDetail.ownedEntryPoints')}</span>
                    <span className="font-medium text-slate-900">
                      {ownedEntryPoints.length > 0 ? ownedEntryPoints.join(', ') : t('teamMap.memberDetail.none')}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="memory" className="pt-4">
                <MemberMemoryTab agent={agent} />
              </TabsContent>

              <TabsContent value="skills" className="pt-4">
                <MemberSkillsTab agent={agent} />
              </TabsContent>

              <TabsContent value="activity" className="pt-4">
                <MemberActivityTab
                  agent={agent}
                  statusLabel={activity?.statusLabel}
                  currentWorkTitles={activity?.currentWorkTitles}
                  blockingReason={activity?.blockingReason}
                  nextStep={activity?.nextStep}
                />
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        title={t('teamMap.memberDetail.removeFromTeam')}
        message={t('teamMap.memberDetail.removeConfirm', { name: agent.name })}
        confirmLabel={t('teamMap.memberDetail.removeFromTeam')}
        cancelLabel={t('actions.cancel', { defaultValue: 'Cancel' })}
        variant="destructive"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await onRemoveMember(agent.id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
