import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Clock, CheckSquare, MoreVertical, Crown, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamSummary, TeamStatus } from '@/types/team';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TeamNameEditor, type TeamNameEditorRef } from './TeamNameEditor';

interface TeamCardProps {
  team: TeamSummary;
  onDelete: (teamId: string) => void;
}

function formatLastActive(
  ts: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!ts) return t('teamOverview.time.never');

  const diff = Date.now() - ts;
  if (diff < 60_000) return t('teamOverview.time.justNow');
  if (diff < 3_600_000) {
    return t('teamOverview.time.minutesAgo_other', { count: Math.floor(diff / 60_000) });
  }
  if (diff < 86_400_000) {
    return t('teamOverview.time.hoursAgo_other', { count: Math.floor(diff / 3_600_000) });
  }
  return t('teamOverview.time.daysAgo_other', { count: Math.floor(diff / 86_400_000) });
}

function getStatusConfig(
  status: TeamStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
): {
  text: string;
  dotColor: string;
  textColor: string;
} {
  switch (status) {
    case 'active':
      return {
        text: t('teamOverview.status.active'),
        dotColor: 'bg-green-500',
        textColor: 'text-green-700',
      };
    case 'idle':
      return {
        text: t('teamOverview.status.idle'),
        dotColor: 'bg-slate-400',
        textColor: 'text-slate-600',
      };
    case 'blocked':
      return {
        text: t('teamOverview.status.blocked'),
        dotColor: 'bg-amber-500',
        textColor: 'text-amber-700',
      };
  }
}

export function TeamCard({ team, onDelete }: TeamCardProps) {
  const { t } = useTranslation('common');
  const statusConfig = getStatusConfig(team.status, t);
  const [showMenu, setShowMenu] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const nameEditorRef = useRef<TeamNameEditorRef>(null);

  const displayAvatars = team.memberAvatars.slice(0, 3);
  const overflowCount = team.memberCount > 3 ? team.memberCount - 3 : 0;

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    setDeleteDialogOpen(true);
  };

  const handleEditRequest = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    nameEditorRef.current?.startEditing();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}
        className="group relative flex h-[240px] flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
      >
        <Link to={`/team-map/${team.id}`} className="flex flex-1 flex-col">
          <div className="mb-4 flex items-start justify-between">
            <TeamNameEditor
              ref={nameEditorRef}
              teamId={team.id}
              initialName={team.name}
              className="text-lg font-semibold text-slate-800"
            />
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu((current) => !current);
                }}
                aria-label={t('teamOverview.card.moreActions', { defaultValue: '更多操作' })}
                className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {showMenu ? (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={handleEditRequest}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    {t('actions.edit')}
                  </button>
                  <button
                    onClick={handleDeleteRequest}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('actions.delete')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-sm font-semibold text-blue-600 ring-2 ring-white shadow-sm">
                  {team.leaderName.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
                  <Crown className="h-2.5 w-2.5 text-white" />
                </div>
              </div>
              <span className="text-sm font-medium text-slate-700">{team.leaderName}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {displayAvatars.map((member) => (
                  <div
                    key={member.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-medium text-slate-600 shadow-sm"
                    title={member.name}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {overflowCount > 0 ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-600">
                    +{overflowCount}
                  </div>
                ) : null}
              </div>
              <span className="text-xs font-medium text-slate-500">
                {team.memberCount} {t('teamOverview.card.members')}
              </span>
            </div>
          </div>

          <div className="mt-auto space-y-3">
            <div className="border-t border-slate-100" />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', statusConfig.dotColor)} />
                <span className={cn('text-xs font-medium', statusConfig.textColor)}>
                  {statusConfig.text}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="h-3 w-3" />
                <span className="text-xs">{formatLastActive(team.lastActiveTime, t)}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <CheckSquare className="h-3 w-3" />
                <span className="text-xs">
                  {team.activeTaskCount} {t('teamOverview.card.tasks')}
                </span>
              </div>
            </div>

            {team.description ? (
              <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                {team.description}
              </p>
            ) : null}
          </div>
        </Link>
      </motion.div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={t('actions.delete')}
        message={t('teamOverview.card.confirmDelete')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        variant="destructive"
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
          await onDelete(team.id);
          setDeleteDialogOpen(false);
        }}
      />
    </>
  );
}
