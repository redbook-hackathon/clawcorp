import { ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface TeamMapHeaderProps {
  teamName: string;
  memberCount: number;
  onAddMember?: () => void;
  addDisabled?: boolean;
}

export function TeamMapHeader({
  teamName,
  memberCount,
  onAddMember,
  addDisabled = false,
}: TeamMapHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm md:h-20 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('teamMap.header.backToOverview', {
            defaultValue: 'Back to Team Overview',
          })}
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={() => navigate('/team-overview')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900 md:text-[28px]">
            {teamName}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            {t('teamMap.header.memberCount', {
              count: memberCount,
              defaultValue: `${memberCount} members`,
            })}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="shrink-0 rounded-xl"
        onClick={onAddMember}
        disabled={addDisabled}
      >
        {t('teamMap.header.addMember', { defaultValue: 'Add Team Member' })}
      </Button>
    </header>
  );
}
