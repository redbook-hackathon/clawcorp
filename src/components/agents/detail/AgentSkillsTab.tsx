import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgentSkillsToggle } from '@/hooks/use-agent-skills-toggle';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface AgentSkillsTabProps {
  agentId: string;
}

export function AgentSkillsTab({ agentId }: AgentSkillsTabProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const {
    skills,
    loading,
    togglingSkills,
    selectedSkill,
    skillContent,
    skillLoading,
    toggleSkill,
    selectSkill,
  } = useAgentSkillsToggle(agentId);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">
          {t('skills.title', { defaultValue: 'Skills' })}
        </h2>
        <div className="mt-6 flex items-center justify-center py-8">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-slate-900">
          {t('skills.title', { defaultValue: 'Skills' })}
        </h2>
        <div className="mt-4 space-y-3">
          <p className="text-[13px] text-slate-400">
            {t('skills.noInstalled', { defaultValue: 'No skills installed yet. Install skills from the Settings page.' })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/settings?section=skills-mcp')}
          >
            {t('skills.openSettings', { defaultValue: 'Open Skills Settings' })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-slate-900">
        {t('skills.title', { defaultValue: 'Skills' })}
      </h2>
      <div className="mt-4 space-y-1">
        {skills.map((skill) => (
          <div
            key={skill.slug}
            className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className={`text-[13px] font-medium ${selectedSkill === skill.slug ? 'text-blue-600' : 'text-slate-900 hover:text-blue-600'}`}
                onClick={() => selectSkill(selectedSkill === skill.slug ? null : skill.slug)}
              >
                <span className="mr-2">{skill.icon}</span>
                {skill.name}
              </button>
              {skill.description ? (
                <p className="mt-0.5 truncate pl-7 text-[12px] text-slate-400">
                  {skill.description}
                </p>
              ) : null}
            </div>
            <Switch
              checked={skill.isAssigned}
              disabled={!!togglingSkills[skill.slug]}
              onCheckedChange={(checked) => void toggleSkill(skill.slug, checked)}
            />
          </div>
        ))}
      </div>

      {selectedSkill ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {skillLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap text-xs font-mono text-slate-700">
              {skillContent || '(empty)'}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
