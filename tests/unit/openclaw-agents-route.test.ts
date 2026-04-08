import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateAgent,
  mockDeleteAgentConfig,
  mockFinalizeAgentDeletion,
  mockDeleteAgentChannelAccounts,
  mockRemoveAgentWorkspaceDirectory,
  mockReadOpenClawConfig,
  mockWriteOpenClawConfig,
  mockExec,
  mockListAgentsSnapshot,
  mockUpdateAgentProfile,
  mockAssignInstalledSkillToAgentWorkspace,
  mockUpdateAgentWorkspaceSkill,
  mockRemoveAgentWorkspaceSkill,
} = vi.hoisted(() => ({
  mockCreateAgent: vi.fn(),
  mockDeleteAgentConfig: vi.fn(),
  mockFinalizeAgentDeletion: vi.fn(),
  mockDeleteAgentChannelAccounts: vi.fn(),
  mockRemoveAgentWorkspaceDirectory: vi.fn(),
  mockReadOpenClawConfig: vi.fn(),
  mockWriteOpenClawConfig: vi.fn(),
  mockExec: vi.fn(),
  mockListAgentsSnapshot: vi.fn(),
  mockUpdateAgentProfile: vi.fn(),
  mockAssignInstalledSkillToAgentWorkspace: vi.fn(),
  mockUpdateAgentWorkspaceSkill: vi.fn(),
  mockRemoveAgentWorkspaceSkill: vi.fn(),
}));

vi.mock('@electron/api/route-utils', async () => {
  const actual = await vi.importActual<typeof import('@electron/api/route-utils')>('@electron/api/route-utils');
  return {
    ...actual,
    parseJsonBody: vi.fn(async (req: IncomingMessage & { __body?: unknown }) => req.__body ?? {}),
  };
});

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  clearChannelBinding: vi.fn(),
  createAgent: mockCreateAgent,
  deleteAgentConfig: mockDeleteAgentConfig,
  finalizeAgentDeletion: mockFinalizeAgentDeletion,
  listAgentsSnapshot: mockListAgentsSnapshot,
  removeAgentWorkspaceDirectory: mockRemoveAgentWorkspaceDirectory,
  resolveAccountIdForAgent: vi.fn(() => 'default'),
  updateAgentProfile: mockUpdateAgentProfile,
  updateAgentName: vi.fn(),
}));

vi.mock('@electron/utils/channel-config', () => ({
  deleteAgentChannelAccounts: mockDeleteAgentChannelAccounts,
  deleteChannelAccountConfig: vi.fn(),
  readOpenClawConfig: mockReadOpenClawConfig,
  writeOpenClawConfig: mockWriteOpenClawConfig,
}));

vi.mock('@electron/utils/agent-workspace-skills', () => ({
  assignInstalledSkillToAgentWorkspace: mockAssignInstalledSkillToAgentWorkspace,
  updateAgentWorkspaceSkill: mockUpdateAgentWorkspaceSkill,
  removeAgentWorkspaceSkill: mockRemoveAgentWorkspaceSkill,
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncAllProviderAuthToRuntime: vi.fn(async () => undefined),
}));

vi.mock('child_process', () => ({
  exec: mockExec,
}));

type MockResponse = ServerResponse & {
  __headers: Record<string, string>;
  __body: string;
};

function createMockResponse(): MockResponse {
  const response = {
    statusCode: 200,
    __headers: {},
    __body: '',
    setHeader: vi.fn((key: string, value: string) => {
      response.__headers[key.toLowerCase()] = String(value);
    }),
    end: vi.fn((payload?: string) => {
      response.__body = payload ?? '';
    }),
  };

  return response as unknown as MockResponse;
}

function parseBody(res: MockResponse): Record<string, unknown> {
  return JSON.parse(res.__body || '{}') as Record<string, unknown>;
}

function createRequest(method: string, body?: unknown): IncomingMessage & { __body?: unknown } {
  return {
    method,
    __body: body,
  } as IncomingMessage & { __body?: unknown };
}

describe('agents route deletion restart safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    mockExec.mockImplementation(
      (
        _command: string,
        optionsOrCallback: unknown,
        maybeCallback?: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        const callback =
          typeof optionsOrCallback === 'function'
            ? optionsOrCallback as (error: Error | null, stdout: string, stderr: string) => void
            : maybeCallback;
        callback?.(null, '', '');
        return {} as never;
      },
    );
    mockDeleteAgentConfig.mockResolvedValue({
      snapshot: { agents: [{ id: 'main', name: 'Main' }], channelOwners: {} },
      removedEntry: { id: 'agent-a', workspace: '~/.openclaw/workspace-a' },
    });
    mockCreateAgent.mockResolvedValue({
      createdAgentId: 'researcher',
      snapshot: {
        agents: [{ id: 'researcher', name: 'Researcher' }],
        defaultAgentId: 'main',
        configuredChannelTypes: [],
        channelOwners: {},
      },
    });
    mockDeleteAgentChannelAccounts.mockResolvedValue(undefined);
    mockFinalizeAgentDeletion.mockResolvedValue(undefined);
    mockRemoveAgentWorkspaceDirectory.mockResolvedValue(undefined);
    mockListAgentsSnapshot.mockResolvedValue({
      agents: [
        { id: 'main', name: 'Main', channelTypes: ['feishu'] },
        { id: 'researcher', name: 'Researcher', channelTypes: ['telegram', 'discord'] },
      ],
      channelOwners: {},
    });
    mockUpdateAgentProfile.mockResolvedValue({
      agents: [
        {
          id: 'researcher',
          name: 'Researcher',
          teamRole: 'worker',
          chatAccess: 'leader_only',
          responsibility: 'Research and evidence synthesis',
        },
      ],
      defaultAgentId: 'main',
      configuredChannelTypes: [],
      channelOwners: {},
    });
    mockReadOpenClawConfig.mockResolvedValue({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'agent-a', name: 'Agent A' },
        ],
      },
    });
  });

  it('returns failure when gateway restart fails after deleting agent config', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = { method: 'DELETE' } as IncomingMessage;
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/agent-a');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        restart: vi.fn().mockRejectedValue(new Error('gateway restart failed')),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    const body = parseBody(res);
    expect(res.statusCode).toBe(500);
    expect(String(body.error ?? '')).toContain('gateway');
    killSpy.mockRestore();
  });

  it('rolls back agent config when gateway restart fails', async () => {
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');
    const originalConfig = {
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'agent-a', name: 'Agent A' },
        ],
      },
    };

    mockReadOpenClawConfig.mockResolvedValueOnce(originalConfig);

    const req = { method: 'DELETE' } as IncomingMessage;
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/agent-a');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        restart: vi.fn().mockRejectedValue(new Error('gateway restart failed')),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockWriteOpenClawConfig).toHaveBeenCalledWith(originalConfig);
    expect(mockFinalizeAgentDeletion).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });

  it('does not attempt port-based process kill when pid is unavailable', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = { method: 'DELETE' } as IncomingMessage;
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/agent-a');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: undefined, port: 18789 }),
        restart: vi.fn().mockResolvedValue(undefined),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockExec).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });

  it('returns agent-specific cron relations with deep links', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = { method: 'GET' } as IncomingMessage;
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/researcher/cron-relations');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        rpc: vi.fn(async (method: string) => {
          if (method === 'cron.list') {
            return {
              jobs: [
                {
                  id: 'job-status-report',
                  name: 'Status Report',
                  payload: { message: 'Send a morning status update' },
                  schedule: '0 9 * * 1-5',
                  sessionTarget: 'researcher',
                  enabled: true,
                  createdAtMs: Date.parse('2026-01-01T08:00:00Z'),
                  updatedAtMs: Date.parse('2026-02-01T08:00:00Z'),
                  delivery: { mode: 'announce', channel: 'telegram', to: 'ops-room' },
                  state: {
                    lastRunAtMs: Date.parse('2026-03-24T08:00:00Z'),
                    lastStatus: 'ok',
                  },
                },
              ],
            };
          }
          throw new Error(`Unexpected RPC method: ${method}`);
        }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.relations).toEqual([
      expect.objectContaining({
        relationReason: 'session-target',
        deepLink: '/cron?jobId=job-status-report&agentId=researcher&tab=pipelines',
        job: expect.objectContaining({
          id: 'job-status-report',
          name: 'Status Report',
          sessionTarget: 'researcher',
        }),
      }),
    ]);
  });

  it('forwards team metadata through the update route', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = createRequest('PUT', {
      teamRole: 'worker',
      chatAccess: 'leader_only',
      responsibility: 'Research and evidence synthesis',
    });
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/researcher');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockUpdateAgentProfile).toHaveBeenCalledWith('researcher', {
      teamRole: 'worker',
      chatAccess: 'leader_only',
      responsibility: 'Research and evidence synthesis',
    });

    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.agents).toEqual([
      expect.objectContaining({
        id: 'researcher',
        teamRole: 'worker',
        chatAccess: 'leader_only',
        responsibility: 'Research and evidence synthesis',
      }),
    ]);
  });

  it('forwards the rich create payload and returns createdAgentId', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = createRequest('POST', {
      name: 'Researcher',
      persona: 'Finds supporting evidence',
      teamRole: 'worker',
      model: 'openai/gpt-5.4',
    });
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockCreateAgent).toHaveBeenCalledWith({
      name: 'Researcher',
      persona: 'Finds supporting evidence',
      teamRole: 'worker',
      model: 'openai/gpt-5.4',
    });

    const body = parseBody(res);
    expect(res.statusCode).toBe(200);
    expect(body.createdAgentId).toBe('researcher');
    expect(body.agents).toEqual([
      expect.objectContaining({
        id: 'researcher',
      }),
    ]);
  });

  it('assigns an installed skill into the agent workspace', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = createRequest('POST', { slug: 'skill-a' });
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/researcher/workspace/skills');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockAssignInstalledSkillToAgentWorkspace).toHaveBeenCalledWith('researcher', 'skill-a');
    expect(res.statusCode).toBe(200);
  });

  it('updates an assigned workspace skill file', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = createRequest('PUT', { content: '# Updated Skill' });
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/researcher/workspace/skills/skill-a');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockUpdateAgentWorkspaceSkill).toHaveBeenCalledWith('researcher', 'skill-a', '# Updated Skill');
    expect(res.statusCode).toBe(200);
  });

  it('removes an assigned workspace skill directory', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');

    const req = createRequest('DELETE');
    const res = createMockResponse();
    const url = new URL('http://localhost/api/agents/researcher/workspace/skills/skill-a');
    const ctx = {
      gatewayManager: {
        getStatus: () => ({ state: 'running', pid: 24561, port: 18789 }),
        debouncedReload: vi.fn(),
      },
    } as unknown;

    await handleAgentRoutes(req, res, url, ctx as never);

    expect(mockRemoveAgentWorkspaceSkill).toHaveBeenCalledWith('researcher', 'skill-a');
    expect(res.statusCode).toBe(200);
  });
});
