import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAgentSkillsToggle } from '@/hooks/use-agent-skills-toggle';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { AgentSummary } from '@/types/agent';

export function MemberSkillsTab({ agent }: { agent: AgentSummary }) {
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
  } = useAgentSkillsToggle(agent.id);

  if (loading) {
    return <div className="text-sm text-slate-500">{t('status.loading')}</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        <p>{t('skills.noInstalled')}</p>
        <Button type="button" variant="outline" onClick={() => navigate('/settings?section=skills-mcp')}>
          {t('skills.openSettings')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {skills.map((skill) => (
        <div
          key={skill.slug}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
        >
          <button
            type="button"
            className={`min-w-0 flex-1 text-left text-[13px] font-medium ${selectedSkill === skill.slug ? 'text-blue-600' : 'text-slate-900 hover:text-blue-600'}`}
            onClick={() => selectSkill(selectedSkill === skill.slug ? null : skill.slug)}
          >
            <span className="mr-2">{skill.icon}</span>
            {skill.name}
            {skill.description ? (
              <span className="ml-2 text-[12px] font-normal text-slate-400">{skill.description}</span>
            ) : null}
          </button>
          <Switch
            checked={skill.isAssigned}
            disabled={!!togglingSkills[skill.slug]}
            onCheckedChange={(checked) => void toggleSkill(skill.slug, checked)}
          />
        </div>
      ))}

      {selectedSkill ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {skillLoading ? (
            <div className="flex items-center justify-center py-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap text-xs font-mono text-slate-700">
              {skillContent || '(empty)'}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}
