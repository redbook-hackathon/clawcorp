/**
 * Task Kanban Manual Creation Tests
 * Phase 02-04: Weakened manual task creation entry
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskKanban from '@/pages/TaskKanban/index';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import { useRightPanelStore } from '@/stores/rightPanelStore';

// Mock stores
vi.mock('@/stores/approvals');
vi.mock('@/stores/agents');
vi.mock('@/stores/rightPanelStore');

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'kanban.title': '任务看板',
        'kanban.subtitle': '进行中: {{count}} 个任务',
        'kanban.emptyAgent': '空闲中',
        'kanban.workState.idle': '空闲中',
        'kanban.workState.working': '工作中',
      };
      let result = translations[key] || key;
      if (params) {
        Object.keys(params).forEach((param) => {
          result = result.replace(`{{${param}}}`, params[param]);
        });
      }
      return result;
    },
  }),
}));

// Mock ManualTaskForm
vi.mock('@/pages/TaskKanban/ManualTaskForm', () => ({
  ManualTaskForm: ({ open, onOpenChange }: any) =>
    open ? (
      <div data-testid="manual-task-form">
        <h2>创建任务</h2>
        <button onClick={() => onOpenChange(false)}>关闭</button>
      </div>
    ) : null,
}));

describe('TaskKanban - Manual Creation', () => {
  const mockFetchAgents = vi.fn();
  const mockFetchTasks = vi.fn();
  const mockOpenPanel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock approvals store
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => {
      const state = {
        tasks: [],
        fetchTasks: mockFetchTasks,
      };
      return selector ? selector(state) : state;
    });

    // Mock agents store
    vi.mocked(useAgentsStore).mockImplementation((selector: any) => {
      const state = {
        agents: [
          { id: 'agent-1', name: 'Agent Alpha', teamRole: 'developer' },
          { id: 'agent-2', name: 'Agent Beta', teamRole: 'designer' },
        ],
        fetchAgents: mockFetchAgents,
      };
      return selector ? selector(state) : state;
    });

    // Mock right panel store
    vi.mocked(useRightPanelStore).mockImplementation((selector: any) => {
      const state = {
        openPanel: mockOpenPanel,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders manual creation button in header', () => {
    render(<TaskKanban />);

    const button = screen.getByRole('button', { name: /创建任务/i });
    expect(button).toBeInTheDocument();
  });

  it('manual creation button has outline variant (weakened style)', () => {
    const { container } = render(<TaskKanban />);

    const button = screen.getByRole('button', { name: /创建任务/i });
    // Check for outline variant class
    expect(button.className).toContain('outline');
  });

  it('clicking manual creation button opens dialog form', async () => {
    render(<TaskKanban />);

    const button = screen.getByRole('button', { name: /创建任务/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('manual-task-form')).toBeInTheDocument();
    });
  });

  it('dialog form can be closed', async () => {
    render(<TaskKanban />);

    // Open form
    const openButton = screen.getByRole('button', { name: /创建任务/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByTestId('manual-task-form')).toBeInTheDocument();
    });

    // Close form
    const closeButton = screen.getByText('关闭');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('manual-task-form')).not.toBeInTheDocument();
    });
  });
});
