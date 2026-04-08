import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { hostApiFetch } from '@/lib/host-api';
import { useSkillsStore } from '@/stores/skills';
import type { AgentSummary } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type AssignedSkillsResponse = {
  success: boolean;
  skills: string[];
};

type SkillContentResponse = {
  success: boolean;
  content: string;
  exists: boolean;
};

export function MemberSkillsTab({ agent }: { agent: AgentSummary }) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { skills, fetchSkills } = useSkillsStore();
  const [assignedSkills, setAssignedSkills] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [assignableSkill, setAssignableSkill] = useState('');
  const [skillContent, setSkillContent] = useState('');
  const [loading, setLoading] = useState(true);

  const availableSkills = useMemo(() => {
    return skills.filter((skill) => {
      const slug = skill.slug ?? skill.id;
      return !assignedSkills.includes(slug);
    });
  }, [assignedSkills, skills]);

  const loadAssignedSkills = async () => {
    setLoading(true);
    const response = await hostApiFetch<AssignedSkillsResponse>(
      `/api/agents/${encodeURIComponent(agent.id)}/workspace/skills`,
    );
    const nextAssigned = response.success ? response.skills : [];
    setAssignedSkills(nextAssigned);
    setSelectedSkill((current) => current ?? nextAssigned[0] ?? null);
    setAssignableSkill((current) => current || (nextAssigned[0] ? '' : (availableSkills[0]?.slug ?? availableSkills[0]?.id ?? '')));
    setLoading(false);
  };

  useEffect(() => {
    void fetchSkills();
    void loadAssignedSkills();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  useEffect(() => {
    if (!selectedSkill) {
      setSkillContent('');
      return;
    }

    let cancelled = false;

    const loadSkill = async () => {
      const response = await hostApiFetch<SkillContentResponse>(
        `/api/agents/${encodeURIComponent(agent.id)}/workspace/skills/${encodeURIComponent(selectedSkill)}`,
      );
      if (!cancelled) {
        setSkillContent(response.content ?? '');
      }
    };

    void loadSkill();

    return () => {
      cancelled = true;
    };
  }, [agent.id, selectedSkill]);

  useEffect(() => {
    if (!assignableSkill && availableSkills.length > 0) {
      setAssignableSkill(availableSkills[0]?.slug ?? availableSkills[0]?.id ?? '');
    }
  }, [assignableSkill, availableSkills]);

  const handleAssign = async () => {
    if (!assignableSkill) return;

    await hostApiFetch(`/api/agents/${encodeURIComponent(agent.id)}/workspace/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: assignableSkill }),
    });
    await loadAssignedSkills();
  };

  const handleSave = async () => {
    if (!selectedSkill) return;

    await hostApiFetch(
      `/api/agents/${encodeURIComponent(agent.id)}/workspace/skills/${encodeURIComponent(selectedSkill)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: skillContent }),
      },
    );
  };

  const handleRemove = async () => {
    if (!selectedSkill) return;

    await hostApiFetch(
      `/api/agents/${encodeURIComponent(agent.id)}/workspace/skills/${encodeURIComponent(selectedSkill)}`,
      {
        method: 'DELETE',
      },
    );

    const removedSkill = selectedSkill;
    setAssignedSkills((current) => current.filter((skill) => skill !== removedSkill));
    setSelectedSkill((current) => (current === removedSkill ? null : current));
    setSkillContent('');
  };

  if (loading) {
    return <div className="text-sm text-slate-500">{t('status.loading')}</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        <p>{t('teamMap.skills.empty', { defaultValue: 'No skills assigned' })}</p>
        <Button type="button" variant="outline" onClick={() => navigate('/settings?section=skills-mcp')}>
          {t('teamMap.skills.openSkillsPage', { defaultValue: 'Open Skills Page' })}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Assign Skill
          <select
            aria-label="Assign Skill"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={assignableSkill}
            onChange={(event) => setAssignableSkill(event.target.value)}
          >
            {availableSkills.map((skill) => (
              <option key={skill.slug ?? skill.id} value={skill.slug ?? skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>

        <Button type="button" onClick={() => void handleAssign()} disabled={!assignableSkill}>
          {t('teamMap.skills.assign', { defaultValue: 'Assign Skill' })}
        </Button>

        <div className="space-y-2">
          {assignedSkills.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t('teamMap.skills.empty', { defaultValue: 'No skills assigned' })}
            </p>
          ) : (
            assignedSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedSkill === skill ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                onClick={() => setSelectedSkill(skill)}
              >
                {skill}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        {selectedSkill ? (
          <>
            <Textarea value={skillContent} onChange={(event) => setSkillContent(event.target.value)} className="min-h-[220px]" />
            <div className="flex gap-3">
              <Button type="button" onClick={() => void handleSave()}>
                Save Skill
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleRemove()}>
                Remove Skill
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <p>{t('teamMap.skills.empty', { defaultValue: 'No skills assigned' })}</p>
            <Button type="button" variant="outline" onClick={() => navigate('/settings?section=skills-mcp')}>
              {t('teamMap.skills.openSkillsPage', { defaultValue: 'Open Skills Page' })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
