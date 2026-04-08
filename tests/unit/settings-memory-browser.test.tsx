import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsMemoryBrowser } from '@/components/settings-center/settings-memory-browser';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

describe('SettingsMemoryBrowser', () => {
  beforeEach(() => {
    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (path === '/api/memory') {
        return {
          files: [
            {
              name: 'meeting-notes.md',
              path: 'memory/meeting-notes.md',
              size: 1024,
              mtime: Date.now() - 60_000,
            },
            {
              name: 'project-update.md',
              path: 'memory/project-update.md',
              size: 315 * 1024,
              mtime: Date.now() - 120_000,
            },
          ],
        };
      }

      if (typeof path === 'string' && path.startsWith('/api/memory/file?name=')) {
        if (path.includes(encodeURIComponent('memory/meeting-notes.md'))) {
          return { content: 'meeting-notes\n- follow up with QA' };
        }
        if (path.includes(encodeURIComponent('memory/project-update.md'))) {
          return { content: 'project-update\nstatus: stable' };
        }
      }

      if (path === '/api/memory/file' && init?.method === 'PUT') {
        return { success: true };
      }

      if (path === '/api/memory/reindex' && init?.method === 'POST') {
        return { ok: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });
  });

  it('renders the dual-pane layout and loads preview content through hostApiFetch', async () => {
    render(<SettingsMemoryBrowser />);

    const [listPanel, previewPanel] = screen.getAllByRole('region');

    expect(listPanel).toBeInTheDocument();
    expect(previewPanel).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /meeting-notes\.md/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /project-update\.md/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /project-update\.md/ }));

    const preview = within(previewPanel);
    expect(
      await preview.findByText(
        (content) => content.includes('project-update') && content.includes('status: stable'),
      ),
    ).toBeInTheDocument();
    expect(hostApiFetch).toHaveBeenCalledWith('/api/memory');
    expect(hostApiFetch).toHaveBeenCalledWith(
      `/api/memory/file?name=${encodeURIComponent('memory/project-update.md')}`,
    );
  });

  it('loads the correct file when duplicate names exist in different paths', async () => {
    const now = Date.now();
    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (path === '/api/memory') {
        return {
          files: [
            {
              name: 'notes.md',
              path: 'memory/team/notes.md',
              size: 512,
              mtime: now - 60_000,
            },
            {
              name: 'notes.md',
              path: 'memory/personal/notes.md',
              size: 768,
              mtime: now - 120_000,
            },
          ],
        };
      }

      if (typeof path === 'string' && path.startsWith('/api/memory/file?name=')) {
        if (path.includes(encodeURIComponent('memory/team/notes.md'))) {
          return { content: 'team-notes' };
        }
        if (path.includes(encodeURIComponent('memory/personal/notes.md'))) {
          return { content: 'personal-notes' };
        }
      }

      if (path === '/api/memory/file' && init?.method === 'PUT') {
        return { success: true };
      }

      if (path === '/api/memory/reindex' && init?.method === 'POST') {
        return { ok: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });

    render(<SettingsMemoryBrowser />);

    const fileButtons = await screen.findAllByRole('button', { name: /notes\.md/ });
    fireEvent.click(fileButtons[1]);

    const previewPanel = screen.getAllByRole('region')[1];
    expect(await within(previewPanel).findByText('personal-notes')).toBeInTheDocument();
    expect(hostApiFetch).toHaveBeenCalledWith(
      `/api/memory/file?name=${encodeURIComponent('memory/personal/notes.md')}`,
    );
  });

  it('saves changes using the selected file path when names collide', async () => {
    const now = Date.now();
    vi.mocked(hostApiFetch).mockImplementation(async (path, init) => {
      if (path === '/api/memory') {
        return {
          files: [
            {
              name: 'notes.md',
              path: 'memory/team/notes.md',
              size: 512,
              mtime: now - 60_000,
            },
            {
              name: 'notes.md',
              path: 'memory/personal/notes.md',
              size: 768,
              mtime: now - 120_000,
            },
          ],
        };
      }

      if (typeof path === 'string' && path.startsWith('/api/memory/file?name=')) {
        if (path.includes(encodeURIComponent('memory/personal/notes.md'))) {
          return { content: 'personal-notes' };
        }
      }

      if (path === '/api/memory/file' && init?.method === 'PUT') {
        return { success: true };
      }

      if (path === '/api/memory/reindex' && init?.method === 'POST') {
        return { ok: true };
      }

      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });

    render(<SettingsMemoryBrowser />);

    const fileButtons = await screen.findAllByRole('button', { name: /notes\.md/ });
    fireEvent.click(fileButtons[1]);

    await screen.findByText('personal-notes');

    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated-notes' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      const putCalls = vi.mocked(hostApiFetch).mock.calls.filter(
        ([path, init]) => path === '/api/memory/file' && init?.method === 'PUT',
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });

    const putCalls = vi.mocked(hostApiFetch).mock.calls.filter(
      ([path, init]) => path === '/api/memory/file' && init?.method === 'PUT',
    );
    const [, init] = putCalls[putCalls.length - 1];
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      relativePath: 'memory/personal/notes.md',
      content: 'updated-notes',
    });
    expect(hostApiFetch).toHaveBeenCalledWith(
      '/api/memory/reindex',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
