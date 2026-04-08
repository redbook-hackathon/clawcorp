import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpTab } from '@/pages/Skills/McpTab';
import { SettingsSkillsMcpPanel } from '@/components/settings-center/settings-skills-mcp-panel';
import { hostApiFetch } from '@/lib/host-api';

const { skillsStoreState, gatewayState } = vi.hoisted(() => ({
  skillsStoreState: {
    skills: [] as Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      enabled: boolean;
      version?: string;
      isCore?: boolean;
      isBundled?: boolean;
      source?: string;
      baseDir?: string;
    }>,
    loading: false,
    error: null as string | null,
    searchResults: [],
    searching: false,
    searchError: null as string | null,
    installing: {} as Record<string, boolean>,
    fetchSkills: vi.fn(async () => {}),
    enableSkill: vi.fn(async () => {}),
    disableSkill: vi.fn(async () => {}),
    searchSkills: vi.fn(async () => {}),
    installSkill: vi.fn(async () => {}),
    uninstallSkill: vi.fn(async () => {}),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: () => skillsStoreState,
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector?: (state: typeof gatewayState) => unknown) =>
    selector ? selector(gatewayState) : gatewayState,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

vi.mock('@/lib/telemetry', () => ({
  trackUiEvent: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === 'string') {
        return options;
      }
      return options?.defaultValue ?? key;
    },
  }),
}));

describe('McpTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    skillsStoreState.skills = [
      {
        id: 'skill-a',
        slug: 'skill-a',
        name: 'Skill A',
        description: 'Global skill',
        enabled: false,
        version: '1.0.0',
        isCore: false,
        isBundled: false,
        source: 'openclaw-managed',
        baseDir: 'C:/skills/skill-a',
      },
    ];
  });

  it('loads runtime-aware server cards and tool visibility from /api/mcp', async () => {
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      servers: [{
        name: 'docs-server',
        command: 'npx',
        args: ['-y', '@example/docs-mcp'],
        env: {},
        enabled: true,
        transport: 'stdio',
        addedAt: '2026-03-25T12:00:00.000Z',
        status: 'running',
        connected: true,
        toolCount: 1,
        tools: [{ server: 'docs-server', name: 'search_docs', description: 'Search docs', inputSchema: {} }],
        lastError: null,
        pid: 1234,
      }],
    });

    render(<McpTab />);

    expect(await screen.findByText('docs-server')).toBeInTheDocument();
    expect(screen.getAllByText('search_docs').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 tools?/i)).toBeInTheDocument();
    const toggle = await screen.findByRole('switch', { name: /docs-server/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('starts a stopped server from the runtime action button', async () => {
    vi.mocked(hostApiFetch)
      .mockResolvedValueOnce({
        servers: [{
          name: 'docs-server',
          command: 'npx',
          args: ['-y', '@example/docs-mcp'],
          env: {},
          enabled: true,
          transport: 'stdio',
          addedAt: '2026-03-25T12:00:00.000Z',
          status: 'stopped',
          connected: false,
          toolCount: 0,
          tools: [],
          lastError: null,
          pid: null,
        }],
      })
      .mockResolvedValueOnce({
        server: {
          name: 'docs-server',
          command: 'npx',
          args: ['-y', '@example/docs-mcp'],
          env: {},
          enabled: true,
          transport: 'stdio',
          addedAt: '2026-03-25T12:00:00.000Z',
          status: 'running',
          connected: true,
          toolCount: 1,
          tools: [{ server: 'docs-server', name: 'search_docs', description: 'Search docs', inputSchema: {} }],
          lastError: null,
          pid: 1234,
        },
      });

    render(<McpTab />);

    await screen.findByText('docs-server');
    await act(async () => {
      fireEvent.click(screen.getByTestId('mcp-start-docs-server'));
    });

    expect(hostApiFetch).toHaveBeenCalledWith('/api/mcp/docs-server/start', { method: 'POST' });
    expect(await screen.findByText(/running/i)).toBeInTheDocument();
  });

  it('runs a tool and loads server logs from the inline panels', async () => {
    vi.mocked(hostApiFetch)
      .mockResolvedValueOnce({
        servers: [{
          name: 'docs-server',
          command: 'npx',
          args: ['-y', '@example/docs-mcp'],
          env: {},
          enabled: true,
          transport: 'stdio',
          addedAt: '2026-03-25T12:00:00.000Z',
          status: 'running',
          connected: true,
          toolCount: 1,
          tools: [{ server: 'docs-server', name: 'search_docs', description: 'Search docs', inputSchema: {} }],
          lastError: null,
          pid: 1234,
        }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'search_docs:gateway auth' }],
        isError: false,
      })
      .mockResolvedValueOnce({
        logs: [{ timestamp: '2026-03-25T12:00:00.000Z', level: 'stderr', message: 'first warning' }],
      });

    render(<McpTab />);

    await screen.findByText('docs-server');
    fireEvent.change(screen.getByTestId('mcp-tool-args-docs-server'), {
      target: { value: '{"query":"gateway auth"}' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('mcp-call-docs-server'));
    });

    expect(hostApiFetch).toHaveBeenCalledWith('/api/mcp/docs-server/call', expect.objectContaining({
      method: 'POST',
    }));
    expect(await screen.findByText('search_docs:gateway auth')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('mcp-load-logs-docs-server'));
    });

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith('/api/mcp/docs-server/logs?tail=50');
    });
    expect(await screen.findByText('first warning')).toBeInTheDocument();
  });

  it('toggles enabled state via the switch control', async () => {
    vi.mocked(hostApiFetch)
      .mockResolvedValueOnce({
        servers: [{
          name: 'docs-server',
          command: 'npx',
          args: ['-y', '@example/docs-mcp'],
          env: {},
          enabled: true,
          transport: 'stdio',
          addedAt: '2026-03-25T12:00:00.000Z',
          status: 'running',
          connected: true,
          toolCount: 1,
          tools: [{ server: 'docs-server', name: 'search_docs', description: 'Search docs', inputSchema: {} }],
          lastError: null,
          pid: 1234,
        }],
      })
      .mockResolvedValueOnce({
        server: {
          name: 'docs-server',
          command: 'npx',
          args: ['-y', '@example/docs-mcp'],
          env: {},
          enabled: false,
          transport: 'stdio',
          addedAt: '2026-03-25T12:00:00.000Z',
          status: 'running',
          connected: true,
          toolCount: 1,
          tools: [{ server: 'docs-server', name: 'search_docs', description: 'Search docs', inputSchema: {} }],
          lastError: null,
          pid: 1234,
        },
      });

    render(<McpTab />);

    const toggle = await screen.findByRole('switch', { name: /docs-server/i });

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(hostApiFetch).toHaveBeenLastCalledWith('/api/mcp/docs-server/toggle', { method: 'PATCH' });
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('renders the reusable global Skills and MCP panel without taking TeamMap member ownership', async () => {
    vi.mocked(hostApiFetch).mockResolvedValueOnce({ servers: [] });

    render(<SettingsSkillsMcpPanel />);

    await waitFor(() => {
      expect(skillsStoreState.fetchSkills).toHaveBeenCalled();
    });

    expect(screen.getByText('全局 Skills 与 MCP 中心')).toBeInTheDocument();
    expect(screen.getByText('成员技能分配和编辑仍由 TeamMap 负责。')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Skill A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Skill A' }));

    await waitFor(() => {
      expect(skillsStoreState.enableSkill).toHaveBeenCalledWith('skill-a');
    });

    fireEvent.click(screen.getByRole('tab', { name: 'MCP' }));

    expect(await screen.findByText('MCP services')).toBeInTheDocument();
  });
});
