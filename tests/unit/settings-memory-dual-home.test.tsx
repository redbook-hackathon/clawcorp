import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { SettingsMemoryBrowser } from '@/components/settings-center/settings-memory-browser';
import { SettingsMemoryKnowledgePanel } from '@/components/settings-center/settings-memory-knowledge-panel';
import { MemberMemoryTab } from '@/components/team-map/MemberMemoryTab';
import {
  getMemoryFile,
  getMemoryOverview,
  normalizeMemoryFiles,
  reindexMemory,
  saveMemoryFile,
} from '@/lib/memory-client';

vi.mock('@/lib/memory-client', () => ({
  getMemoryOverview: vi.fn(),
  getMemoryFile: vi.fn(),
  saveMemoryFile: vi.fn(),
  reindexMemory: vi.fn(),
  normalizeMemoryFiles: vi.fn((response: { files: Array<Record<string, unknown>> }) => response.files),
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

describe('Settings memory shared contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getMemoryOverview).mockImplementation(async (params) => {
      if (params?.scope === 'researcher') {
        return {
          files: [
            {
              relativePath: 'MEMORY.md',
              label: 'MEMORY.md',
              content: 'member memory',
              lastModified: '2026-04-02T00:00:00.000Z',
            },
          ],
          workspaceDir: '/workspace/researcher',
          activeScope: 'researcher',
        } as Awaited<ReturnType<typeof getMemoryOverview>>;
      }

      return {
        files: [
          {
            name: 'MEMORY.md',
            path: 'memory/MEMORY.md',
            relativePath: 'memory/MEMORY.md',
            size: 256,
            mtime: Date.now() - 60_000,
          },
        ],
        workspaceDir: '/workspace/main',
        activeScope: 'main',
        stats: {
          totalFiles: 1,
          totalSizeBytes: 256,
        },
      } as Awaited<ReturnType<typeof getMemoryOverview>>;
    });

    vi.mocked(getMemoryFile).mockResolvedValue({
      content: 'existing memory',
    });

    vi.mocked(saveMemoryFile).mockResolvedValue({ ok: true });
    vi.mocked(reindexMemory).mockResolvedValue({ ok: true });
  });

  it('loads settings overview data through the shared memory client', async () => {
    render(<SettingsMemoryKnowledgePanel />);

    expect(getMemoryOverview).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Shared memory spine' })).toBeInTheDocument();
    expect(normalizeMemoryFiles).toHaveBeenCalled();
    expect(await screen.findByText('/workspace/main')).toBeInTheDocument();
  });

  it('saves settings edits through the shared client and reindexes on success', async () => {
    render(<SettingsMemoryBrowser />);

    fireEvent.click(await screen.findByRole('button', { name: /MEMORY\.md/ }));
    expect(await screen.findByText('existing memory')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'settings draft' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveMemoryFile).toHaveBeenCalledWith({
        relativePath: 'memory/MEMORY.md',
        content: 'settings draft',
      });
    });
    expect(reindexMemory).toHaveBeenCalledTimes(1);
  });

  it('routes Team Map edits through the same shared client contract', async () => {
    render(<MemberMemoryTab agent={agent} />);

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'member draft' } });

    await new Promise((resolve) => setTimeout(resolve, 1600));

    await waitFor(() => {
      expect(saveMemoryFile).toHaveBeenCalledWith({
        relativePath: 'MEMORY.md',
        content: 'member draft',
        scope: 'researcher',
        expectedMtime: '2026-04-02T00:00:00.000Z',
      });
    });
    expect(reindexMemory).toHaveBeenCalled();
  });
});
