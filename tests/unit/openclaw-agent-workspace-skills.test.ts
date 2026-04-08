import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockListAgentsSnapshot,
  mockCp,
  mockMkdir,
  mockRm,
  mockWriteFile,
} = vi.hoisted(() => ({
  mockListAgentsSnapshot: vi.fn(),
  mockCp: vi.fn(),
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  listAgentsSnapshot: mockListAgentsSnapshot,
}));

vi.mock('@electron/utils/paths', () => ({
  expandPath: vi.fn((path: string) => path.replace('~', '/home/test')),
}));

vi.mock('os', () => ({
  homedir: () => '/home/test',
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    cp: mockCp,
    mkdir: mockMkdir,
    rm: mockRm,
    writeFile: mockWriteFile,
  };
});

describe('agent workspace skills helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAgentsSnapshot.mockResolvedValue({
      agents: [
        {
          id: 'researcher',
          workspace: '~/workspace-researcher',
        },
      ],
    });
  });

  it('copies an installed skill into the agent workspace', async () => {
    const { assignInstalledSkillToAgentWorkspace } = await import('@electron/utils/agent-workspace-skills');

    await assignInstalledSkillToAgentWorkspace('researcher', 'skill-a');

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('workspace-researcher'), {
      recursive: true,
    });
    expect(mockCp).toHaveBeenCalledWith(
      expect.stringContaining('.openclaw'),
      expect.stringContaining('workspace-researcher'),
      { recursive: true },
    );
  });

  it('writes SKILL.md updates inside the agent workspace', async () => {
    const { updateAgentWorkspaceSkill } = await import('@electron/utils/agent-workspace-skills');

    await updateAgentWorkspaceSkill('researcher', 'skill-a', '# Updated Skill');

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('workspace-researcher'), {
      recursive: true,
    });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('SKILL.md'),
      '# Updated Skill',
      'utf8',
    );
  });

  it('removes the assigned skill directory from the agent workspace', async () => {
    const { removeAgentWorkspaceSkill } = await import('@electron/utils/agent-workspace-skills');

    await removeAgentWorkspaceSkill('researcher', 'skill-a');

    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('workspace-researcher'), {
      recursive: true,
      force: true,
    });
  });
});
