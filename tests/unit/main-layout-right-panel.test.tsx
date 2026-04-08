import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useRightPanelStore } from '@/stores/rightPanelStore';

const agentsState = {
  agents: [
    {
      id: 'main',
      name: 'Main Agent',
      persona: 'Helpful',
      isDefault: true,
      model: 'gpt-5',
      modelDisplay: 'GPT-5',
      inheritedModel: false,
      workspace: 'C:/workspace',
      agentDir: 'C:/agents/main',
      mainSessionKey: 'agent:main:main',
      channelTypes: [],
      avatar: '🤖',
      teamRole: 'leader' as const,
      chatAccess: 'direct' as const,
      responsibility: 'Coordinate work',
      reportsTo: null,
    },
  ],
  defaultAgentId: 'main',
  updateAgent: vi.fn(async () => undefined),
};

const chatState = {
  currentAgentId: 'main',
  messages: [
    {
      role: 'user',
      timestamp: Date.parse('2026-03-31T10:00:00.000Z'),
      content: 'Upload docs',
      _attachedFiles: [
        {
          fileName: 'brief.md',
          mimeType: 'text/markdown',
          fileSize: 1024,
          preview: null,
          filePath: 'C:/tmp/brief.md',
        },
      ],
    },
  ],
};

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div>sidebar</div>,
}));

vi.mock('@/components/layout/TitleBar', () => ({
  TitleBar: () => <div>titlebar</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div>outlet</div>,
  };
});

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'common:rightPanel.files': 'Files',
        'common:rightPanel.noFiles': 'No files yet',
      }[key] ?? key),
  }),
}));

describe('MainLayout right panel mount', () => {
  beforeEach(() => {
    useRightPanelStore.setState({ open: false, type: null, agentId: null });
  });

  it('mounts the global right panel alongside the main outlet', () => {
    useRightPanelStore.getState().openPanel('file', 'main');

    render(<MainLayout />);

    expect(screen.getByText('sidebar')).toBeInTheDocument();
    expect(screen.getByText('titlebar')).toBeInTheDocument();
    expect(screen.getByText('outlet')).toBeInTheDocument();
    expect(screen.getByText('brief.md')).toBeInTheDocument();
  });
});
