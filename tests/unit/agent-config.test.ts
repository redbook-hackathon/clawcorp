import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/clawx-agent-config-${suffix}`,
    testUserData: `/tmp/clawx-agent-config-user-data-${suffix}`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
  },
}));

async function writeOpenClawJson(config: unknown): Promise<void> {
  const openclawDir = join(testHome, '.openclaw');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('agent config lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('lists configured agent ids from openclaw.json', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'test3', name: 'test3' },
        ],
      },
    });

    const { listConfiguredAgentIds } = await import('@electron/utils/agent-config');

    await expect(listConfiguredAgentIds()).resolves.toEqual(['main', 'test3']);
  });

  it('falls back to the implicit main agent when no list exists', async () => {
    await writeOpenClawJson({});

    const { listConfiguredAgentIds } = await import('@electron/utils/agent-config');

    await expect(listConfiguredAgentIds()).resolves.toEqual(['main']);
  });

  it('includes canonical per-agent main session keys in the snapshot', async () => {
    await writeOpenClawJson({
      session: {
        mainKey: 'desk',
      },
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'research', name: 'Research' },
        ],
      },
    });

    const { listAgentsSnapshot } = await import('@electron/utils/agent-config');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'main',
          mainSessionKey: 'agent:main:desk',
          teamRole: 'leader',
          chatAccess: 'direct',
          responsibility: '',
        }),
        expect.objectContaining({
          id: 'research',
          mainSessionKey: 'agent:research:desk',
          teamRole: 'worker',
          chatAccess: 'direct',
          responsibility: '',
        }),
      ]),
    );
  });

  it('deletes the config entry and bindings for a removed agent, deferring destructive side effects', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'custom-custom27/MiniMax-M2.5',
            fallbacks: [],
          },
        },
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'test2',
            name: 'test2',
            workspace: '~/.openclaw/workspace-test2',
            agentDir: '~/.openclaw/agents/test2/agent',
          },
          {
            id: 'test3',
            name: 'test3',
            workspace: '~/.openclaw/workspace-test3',
            agentDir: '~/.openclaw/agents/test3/agent',
          },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
        },
      },
      bindings: [
        {
          agentId: 'test2',
          match: {
            channel: 'feishu',
          },
        },
      ],
    });

    const test2RuntimeDir = join(testHome, '.openclaw', 'agents', 'test2');
    const test2WorkspaceDir = join(testHome, '.openclaw', 'workspace-test2');
    await mkdir(join(test2RuntimeDir, 'agent'), { recursive: true });
    await mkdir(join(test2RuntimeDir, 'sessions'), { recursive: true });
    await mkdir(join(test2WorkspaceDir, '.openclaw'), { recursive: true });
    await writeFile(
      join(test2RuntimeDir, 'agent', 'auth-profiles.json'),
      JSON.stringify({ version: 1, profiles: {} }, null, 2),
      'utf8',
    );
    await writeFile(join(test2WorkspaceDir, 'AGENTS.md'), '# test2', 'utf8');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deleteAgentConfig } = await import('@electron/utils/agent-config');

    const { snapshot } = await deleteAgentConfig('test2');

    expect(snapshot.agents.map((agent) => agent.id)).toEqual(['main', 'test3']);
    expect(snapshot.channelOwners.feishu).toBe('main');

    const config = await readOpenClawJson();
    expect((config.agents as { list: Array<{ id: string }> }).list.map((agent) => agent.id)).toEqual([
      'main',
      'test3',
    ]);
    expect(config.bindings).toEqual([]);
    await expect(access(test2RuntimeDir)).resolves.toBeUndefined();
    // Workspace deletion is intentionally deferred by `deleteAgentConfig` to avoid
    // ENOENT errors during Gateway restart, so it should still exist here.
    await expect(access(test2WorkspaceDir)).resolves.toBeUndefined();

    infoSpy.mockRestore();
  });

  it('preserves unmanaged custom workspaces when deleting an agent', async () => {
    const customWorkspaceDir = join(testHome, 'custom-workspace-test2');

    await writeOpenClawJson({
      agents: {
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'test2',
            name: 'test2',
            workspace: customWorkspaceDir,
            agentDir: '~/.openclaw/agents/test2/agent',
          },
        ],
      },
    });

    await mkdir(join(testHome, '.openclaw', 'agents', 'test2', 'agent'), { recursive: true });
    await mkdir(customWorkspaceDir, { recursive: true });
    await writeFile(join(customWorkspaceDir, 'AGENTS.md'), '# custom', 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deleteAgentConfig } = await import('@electron/utils/agent-config');

    await deleteAgentConfig('test2');

    await expect(access(customWorkspaceDir)).resolves.toBeUndefined();

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('persists persona, team role, and model when creating an agent profile and returns createdAgentId', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
        ],
      },
    });

    await mkdir(join(testHome, '.openclaw', 'agents', 'main', 'agent'), { recursive: true });
    await mkdir(join(testHome, '.openclaw', 'workspace'), { recursive: true });
    await writeFile(join(testHome, '.openclaw', 'workspace', 'AGENTS.md'), '# Main', 'utf8');

    const { createAgent, listAgentsSnapshot, updateAgentProfile } = await import('@electron/utils/agent-config');

    const created = await createAgent({
      name: 'Research Helper',
      persona: 'Review code with a skeptical senior-engineer mindset.',
      teamRole: 'worker',
      model: 'openai/gpt-5.4',
    });
    expect(created.createdAgentId).toBe('research-helper');
    await updateAgentProfile('research-helper', {
      persona: 'Coordinate release readiness and keep reviews strict.',
      teamRole: 'worker',
      chatAccess: 'leader_only',
      responsibility: 'Research and evidence synthesis',
    });

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'research-helper',
          name: 'Research Helper',
          persona: 'Coordinate release readiness and keep reviews strict.',
          model: 'openai/gpt-5.4',
          modelDisplay: 'gpt-5.4',
          inheritedModel: false,
          teamRole: 'worker',
          chatAccess: 'leader_only',
          responsibility: 'Research and evidence synthesis',
        }),
      ]),
    );

    const config = await readOpenClawJson();
    expect((config.agents as { list: Array<{ id: string; persona?: string }> }).list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'research-helper',
          persona: 'Coordinate release readiness and keep reviews strict.',
          model: 'openai/gpt-5.4',
          teamRole: 'worker',
          chatAccess: 'leader_only',
          responsibility: 'Research and evidence synthesis',
        }),
      ]),
    );
    expect(created.snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'research-helper',
          persona: 'Review code with a skeptical senior-engineer mindset.',
          model: 'openai/gpt-5.4',
          teamRole: 'worker',
        }),
      ]),
    );
  });
});
