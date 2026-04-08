import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { hostApiFetch } from '@/lib/host-api';
import { MemberSkillsTab } from '@/components/team-map/MemberSkillsTab';

const { skillsStoreState, navigateMock } = vi.hoisted(() => ({
  skillsStoreState: {
    skills: [] as Array<{ id: string; slug: string; name: string }>,
    fetchSkills: vi.fn(async () => {}),
  },
  navigateMock: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: () => skillsStoreState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue && typeof options.defaultValue === 'string') {
        return options.defaultValue;
      }
      return key;
    },
  }),
}));

const agent: AgentSummary = {
  id: 'researcher',
  name: 'Researcher',
  persona: 'Finds information',
  isDefault: false,
  model: 'claude-sonnet-4',
  modelDisplay: 'Claude Sonnet 4',
  inheritedModel: true,
  workspace: '~/workspace-researcher',
  agentDir: '~/agents/researcher',
  mainSessionKey: 'agent:researcher:main',
  channelTypes: [],
  teamRole: 'worker',
  chatAccess: 'leader_only',
  responsibility: 'Finds information',
};

describe('MemberSkillsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    skillsStoreState.skills = [
      { id: 'skill-a', slug: 'skill-a', name: 'Skill A' },
      { id: 'skill-b', slug: 'skill-b', name: 'Skill B' },
    ];

    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (path === '/api/agents/researcher/workspace/skills') {
        if (init?.method === 'POST') return { success: true };
        return { success: true, skills: ['skill-a'] };
      }

      if (path === '/api/agents/researcher/workspace/skills/skill-a') {
        if (init?.method === 'PUT') return { success: true };
        if (init?.method === 'DELETE') return { success: true };
        return { success: true, content: '# Skill A', exists: true };
      }

      if (path === '/api/agents/researcher/workspace/skills/skill-b') {
        return { success: true, content: '# Skill B', exists: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });
  });

  it('loads assigned skills and supports assign, save, and remove flows', async () => {
    render(<MemberSkillsTab agent={agent} />);

    await waitFor(() => {
      expect(skillsStoreState.fetchSkills).toHaveBeenCalled();
    });

    expect(await screen.findByRole('button', { name: 'skill-a' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('# Skill A')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Assign Skill'), { target: { value: 'skill-b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign Skill' }));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith(
        '/api/agents/researcher/workspace/skills',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Updated Skill A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Skill' }));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith(
        '/api/agents/researcher/workspace/skills/skill-a',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Skill' }));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith(
        '/api/agents/researcher/workspace/skills/skill-a',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('routes the user to the canonical settings Skills and MCP center when no installed skills are available', async () => {
    skillsStoreState.skills = [];
    vi.mocked(hostApiFetch).mockResolvedValue({ success: true, skills: [] });

    render(<MemberSkillsTab agent={agent} />);

    expect(await screen.findByText('No skills assigned')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Skills Page' }));
    expect(navigateMock).toHaveBeenCalledWith('/settings?section=skills-mcp');
  });
});
