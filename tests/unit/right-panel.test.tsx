import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RightPanel } from '@/components/layout/RightPanel';
import { useRightPanelStore } from '@/stores/rightPanelStore';

const { updateAgentMock, toastSuccessMock } = vi.hoisted(() => ({
  updateAgentMock: vi.fn(async () => undefined),
  toastSuccessMock: vi.fn(),
}));

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
  updateAgent: updateAgentMock,
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
        'common:rightPanel.agent': 'Agent',
        'common:rightPanel.noFiles': 'No files yet',
        'common:rightPanel.noAgent': 'No agent selected',
        'common:rightPanel.name': 'Name',
        'common:rightPanel.model': 'Model',
        'common:rightPanel.role': 'Role',
        'common:rightPanel.created': 'Created',
        'common:rightPanel.save': 'Save',
        'common:rightPanel.role.leader': 'Leader',
      }[key] ?? key),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

describe('RightPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRightPanelStore.setState({ open: false, type: null, agentId: null });
  });

  it('renders attached files when opened in file mode', () => {
    useRightPanelStore.getState().openPanel('file', 'main');

    render(<RightPanel />);

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('brief.md')).toBeInTheDocument();
  });

  it('edits and saves the selected agent in agent mode', async () => {
    useRightPanelStore.getState().openPanel('agent', 'main');

    render(<RightPanel />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Command Agent' },
    });
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'claude-sonnet-4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateAgentMock).toHaveBeenCalledWith('main', {
        name: 'Command Agent',
        model: 'claude-sonnet-4',
      });
    });
  });
});
