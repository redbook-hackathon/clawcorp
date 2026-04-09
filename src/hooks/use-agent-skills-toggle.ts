import { useCallback, useEffect, useMemo, useState } from 'react';
import { hostApiFetch } from '@/lib/host-api';
import { useSkillsStore } from '@/stores/skills';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type AssignedSkillsResponse = {
  success: boolean;
  skills: string[];
};

type SkillContentResponse = {
  success: boolean;
  content: string;
  exists: boolean;
};

export function useAgentSkillsToggle(agentId: string) {
  const { t } = useTranslation('common');
  const { skills: allSkills, fetchSkills } = useSkillsStore();
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingSkills, setTogglingSkills] = useState<Record<string, boolean>>({});
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState('');
  const [skillLoading, setSkillLoading] = useState(false);

  const loadAssignedSkills = useCallback(async () => {
    setLoading(true);
    try {
      const response = await hostApiFetch<AssignedSkillsResponse>(
        `/api/agents/${encodeURIComponent(agentId)}/workspace/skills`,
      );
      const nextAssigned = response.success ? response.skills : [];
      setAssignedSet(new Set(nextAssigned));
    } catch {
      setAssignedSet(new Set());
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void fetchSkills();
    void loadAssignedSkills();
  }, [agentId, fetchSkills, loadAssignedSkills]);

  useEffect(() => {
    if (!selectedSkill) {
      setSkillContent('');
      return;
    }

    let cancelled = false;

    const loadContent = async () => {
      setSkillLoading(true);
      try {
        const response = await hostApiFetch<SkillContentResponse>(
          `/api/agents/${encodeURIComponent(agentId)}/workspace/skills/${encodeURIComponent(selectedSkill)}`,
        );
        if (!cancelled) {
          setSkillContent(response.content ?? '');
        }
      } catch {
        if (!cancelled) {
          setSkillContent('');
        }
      } finally {
        if (!cancelled) {
          setSkillLoading(false);
        }
      }
    };

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, [agentId, selectedSkill]);

  const toggleSkill = useCallback(
    async (slug: string, enabled: boolean) => {
      setTogglingSkills((prev) => ({ ...prev, [slug]: true }));

      // Optimistic update
      setAssignedSet((prev) => {
        const next = new Set(prev);
        if (enabled) {
          next.add(slug);
        } else {
          next.delete(slug);
        }
        return next;
      });

      try {
        if (enabled) {
          await hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}/workspace/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug }),
          });
        } else {
          await hostApiFetch(
            `/api/agents/${encodeURIComponent(agentId)}/workspace/skills/${encodeURIComponent(slug)}`,
            { method: 'DELETE' },
          );
        }
      } catch {
        // Rollback
        setAssignedSet((prev) => {
          const next = new Set(prev);
          if (enabled) {
            next.delete(slug);
          } else {
            next.add(slug);
          }
          return next;
        });
        toast.error(
          enabled
            ? t('skills.assignFailed', { defaultValue: 'Failed to assign skill' })
            : t('skills.removeFailed', { defaultValue: 'Failed to remove skill' }),
        );
      } finally {
        setTogglingSkills((prev) => {
          const next = { ...prev };
          delete next[slug];
          return next;
        });
      }
    },
    [agentId, t],
  );

  const selectSkill = useCallback((slug: string | null) => {
    setSelectedSkill(slug);
  }, []);

  const skills = useMemo(
    () =>
      allSkills.map((skill) => {
        const slug = skill.slug ?? skill.id;
        return { ...skill, slug, isAssigned: assignedSet.has(slug) };
      }),
    [allSkills, assignedSet],
  );

  return {
    skills,
    assignedSet,
    loading,
    togglingSkills,
    selectedSkill,
    skillContent,
    skillLoading,
    toggleSkill,
    selectSkill,
  };
}
