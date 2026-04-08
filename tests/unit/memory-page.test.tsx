import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '@/pages/Memory';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

type ScopeId = 'main' | 'analyst';

function buildMemoryResponse(scope: ScopeId, query: string) {
  const filesByScope = {
    main: [
      {
        label: 'Main Notes',
        path: `/workspace/main/memory/main.md`,
        relativePath: 'memory/main.md',
        content: 'main scope summary',
        lastModified: '2026-03-24T00:00:00.000Z',
        sizeBytes: 120,
        category: 'evergreen' as const,
      },
    ],
    analyst: [
      {
        label: 'Analyst Notes',
        path: `/workspace/analyst/memory/analyst.md`,
        relativePath: 'memory/analyst.md',
        content: 'alpha alpha trend',
        lastModified: '2026-03-24T00:00:00.000Z',
        sizeBytes: 150,
        category: 'evergreen' as const,
      },
      {
        label: 'Tools',
        path: `/workspace/analyst/TOOLS.md`,
        relativePath: 'TOOLS.md',
        content: 'debug helper',
        lastModified: '2026-03-24T00:00:00.000Z',
        sizeBytes: 80,
        category: 'evergreen' as const,
      },
      {
        label: 'Team Docs: Plan',
        path: `/workspace/analyst/docs/plan.qmd`,
        relativePath: 'qmd/team-docs/plan.qmd',
        content: 'qmd collection note',
        lastModified: '2026-03-24T00:00:00.000Z',
        sizeBytes: 90,
        category: 'other' as const,
        writable: false,
      },
    ],
  };

  const q = query.trim().toLowerCase();
  const baseFiles = filesByScope[scope];
  const files = q
    ? baseFiles
      .filter((file) => file.content.toLowerCase().includes(q))
      .map((file) => ({
        ...file,
        search: {
          hitCount: (file.content.toLowerCase().match(new RegExp(q, 'g')) ?? []).length,
          highlights: [{ start: 0, end: 5, snippet: `...${q}...` }],
        },
      }))
    : baseFiles.map((file) => ({ ...file, search: { hitCount: 0, highlights: [] } }));

  return {
    files,
      config: {
        memorySearch: {
        enabled: true,
        provider: 'openai',
        model: 'text-embedding-3-small',
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          temporalDecay: { enabled: true, halfLifeDays: 30 },
          mmr: { enabled: true, lambda: 0.7 },
        },
          cache: { enabled: true, maxEntries: 128 },
          extraPaths: [],
        },
        qmdCollections: [
          { name: 'team-docs', path: 'docs', pattern: '**/*.qmd' },
        ],
        memoryFlush: { enabled: false, softThresholdTokens: 80_000 },
        configFound: true,
      },
    status: {
      indexed: true,
      lastIndexed: '2026-03-24T00:00:00.000Z',
      totalEntries: 8,
      vectorAvailable: true,
      embeddingProvider: 'openai',
      raw: '{}',
    },
    stats: {
      totalFiles: files.length,
      totalSizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      dailyLogCount: 0,
      evergreenCount: files.length,
      oldestDaily: null,
      newestDaily: null,
      dailyTimeline: [],
    },
    health: {
      score: 95,
      checks: [],
      staleDailyLogs: [],
    },
    workspaceDir: `/workspace/${scope}`,
    scopes: [
      { id: 'main', label: 'main', workspaceDir: '/workspace/main' },
      { id: 'analyst', label: 'analyst', workspaceDir: '/workspace/analyst' },
    ],
    activeScope: scope,
    search: {
      query,
      totalHits: files.reduce((sum, file) => sum + (file.search?.hitCount ?? 0), 0),
    },
  };
}

describe('Memory page', () => {
  let memoryRequests: string[] = [];

  beforeEach(() => {
    memoryRequests = [];
    let staleOnce = true;

    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (typeof path !== 'string') {
        throw new Error('Unexpected path type');
      }

      if (path.startsWith('/api/memory') && !init) {
        memoryRequests.push(path);
        const parsed = new URL(path, 'http://127.0.0.1');
        const scope = (parsed.searchParams.get('scope') as ScopeId | null) ?? 'main';
        const query = parsed.searchParams.get('q') ?? '';
        return buildMemoryResponse(scope, query);
      }

      if (path === '/api/memory/file' && init?.method === 'PUT') {
        if (staleOnce) {
          staleOnce = false;
          throw new Error('Stale write conflict');
        }
        return { ok: true };
      }

      if (path === '/api/memory/reindex' && init?.method === 'POST') {
        return { ok: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${path}`);
    });
  });

  it('switches agent scope, uses server-side search filtering, and surfaces unsaved/stale warnings', async () => {
    render(<Memory />);

    fireEvent.click(await screen.findByRole('button', { name: '文件浏览' }));
    expect(await screen.findByRole('button', { name: /Main Notes/i })).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText('Agent Scope'), { target: { value: 'analyst' } });

    await waitFor(() => {
      expect(memoryRequests.some((request) => request.includes('scope=analyst'))).toBe(true);
    });

    fireEvent.change(screen.getByLabelText('Search Memory'), { target: { value: 'alpha' } });

    await waitFor(() => {
      expect(memoryRequests.some((request) => request.includes('scope=analyst') && request.includes('q=alpha'))).toBe(true);
    });

    expect((await screen.findAllByText('2 hits')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Analyst Notes/i }));
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], { target: { value: 'updated alpha content' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText(/stale write conflict/i)).toBeInTheDocument();

    const putCall = vi.mocked(hostApiFetch).mock.calls.find(
      ([path, init]) => path === '/api/memory/file' && init?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse(String(putCall?.[1]?.body)) as { expectedMtime?: string };
    expect(body.expectedMtime).toEqual(expect.any(String));
  });

  it('copies file content and reindexes after a successful save', async () => {
    const clipboardWriteText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (typeof path !== 'string') {
        throw new Error('Unexpected path type');
      }

      if (path.startsWith('/api/memory') && !init) {
        const parsed = new URL(path, 'http://127.0.0.1');
        const scope = (parsed.searchParams.get('scope') as ScopeId | null) ?? 'main';
        const query = parsed.searchParams.get('q') ?? '';
        return buildMemoryResponse(scope, query);
      }

      if (path === '/api/memory/file' && init?.method === 'PUT') {
        return { ok: true };
      }

      if (path === '/api/memory/reindex' && init?.method === 'POST') {
        return { ok: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${path}`);
    });

    render(<Memory />);

    fireEvent.click(await screen.findByRole('button', { name: /文件浏览/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Main Notes/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(clipboardWriteText).toHaveBeenCalledWith('main scope summary');

    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], { target: { value: 'saved content' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/memory/reindex',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('creates a snapshot, renders analysis output, and manages extra paths locally', async () => {
    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (typeof path !== 'string') {
        throw new Error('Unexpected path type');
      }

      if (path.startsWith('/api/memory') && !init) {
        const parsed = new URL(path, 'http://127.0.0.1');
        const scope = (parsed.searchParams.get('scope') as ScopeId | null) ?? 'main';
        const query = parsed.searchParams.get('q') ?? '';
        return buildMemoryResponse(scope, query);
      }

      if (path === '/api/memory/snapshot' && init?.method === 'POST') {
        return {
          success: true,
          commitHash: 'abc123',
          message: 'memory snapshot 2026-03-25 15:00:00',
        };
      }

      if (path === '/api/memory/analyze' && init?.method === 'POST') {
        return {
          healthScore: 72,
          staleFiles: ['memory/daily/2026-03-01.md'],
          largeFiles: ['memory/handbook.md'],
          emptyFiles: ['memory/empty.md'],
          recommendations: ['Review 1 stale file.', 'Split 1 large file.'],
          totalFiles: 3,
          lastModified: '2026-03-24T00:00:00.000Z',
        };
      }

      throw new Error(`Unexpected hostApiFetch call: ${path}`);
    });

    render(<Memory />);

    fireEvent.click(await screen.findByRole('button', { name: 'Git 快照' }));

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/memory/snapshot',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText(/快照成功/)).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'AI 分析' }));

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/memory/analyze',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText('AI 分析结果')).toBeInTheDocument();
    expect(screen.getByText(/健康度 72/)).toBeInTheDocument();
    expect(screen.getByText(/memory\/handbook\.md/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '额外来源' }));
    fireEvent.change(screen.getByPlaceholderText('输入绝对路径或相对路径…'), {
      target: { value: 'knowledge/brief.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(await screen.findByText('knowledge/brief.md')).toBeInTheDocument();
    expect(localStorage.getItem('memory_extra_paths')).toBe(JSON.stringify(['knowledge/brief.md']));

    fireEvent.click(screen.getByRole('button', { name: '移除额外路径 knowledge/brief.md' }));

    await waitFor(() => {
      expect(screen.queryByText('knowledge/brief.md')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem('memory_extra_paths')).toBe(JSON.stringify([]));
  });

  it('renders QMD collection files as read-only browser sources', async () => {
    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (typeof path !== 'string') {
        throw new Error('Unexpected path type');
      }

      if (path.startsWith('/api/memory') && !path.includes('/api/memory/reindex') && !path.includes('/api/memory/file') && !path.includes('/api/memory/status') && !path.includes('/api/memory/extract') && !path.includes('/api/memory/flush') && !path.includes('/api/memory/analyze') && !path.includes('/api/memory/snapshot')) {
        const parsed = new URL(path, 'http://127.0.0.1');
        const scope = (parsed.searchParams.get('scope') as ScopeId | null) ?? 'main';
        const query = parsed.searchParams.get('q') ?? '';
        return buildMemoryResponse(scope, query);
      }

      throw new Error(`Unexpected hostApiFetch call: ${path}`);
    });

    render(<Memory />);

    fireEvent.click(await screen.findByRole('button', { name: /文件浏览/ }));
    fireEvent.change(await screen.findByRole('combobox', { name: 'Agent Scope' }), {
      target: { value: 'analyst' },
    });

    expect(await screen.findByText('Team Docs: Plan')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Team Docs: Plan'));
    expect(await screen.findByText(/qmd\/team-docs\/plan\.qmd/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编辑/ })).toBeDisabled();
  });
});
