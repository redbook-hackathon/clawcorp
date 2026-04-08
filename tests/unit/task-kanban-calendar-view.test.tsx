/**
 * Tests for CalendarView component
 * Phase 02 Plan 02 Task 2 - board/calendar regression coverage
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarView } from '@/pages/TaskKanban/CalendarView';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import type { KanbanTask } from '@/types/task';
import type { AgentSummary } from '@/types/agent';

vi.mock('@/stores/approvals', () => ({
  useApprovalsStore: vi.fn(),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: vi.fn(),
}));

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders FullCalendar component', () => {
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) =>
      selector({
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            description: 'Test',
            status: 'todo',
            priority: 'medium',
            isTeamTask: false,
            deadline: '2026-04-01T00:00:00Z',
            createdAt: '2026-03-31T00:00:00Z',
            updatedAt: '2026-03-31T00:00:00Z',
            workState: 'idle',
          } as KanbanTask,
        ],
      }),
    );

    vi.mocked(useAgentsStore).mockImplementation((selector: any) =>
      selector({
        agents: [] as AgentSummary[],
      }),
    );

    render(<CalendarView />);

    expect(document.querySelector('.fc')).toBeTruthy();
  });

  it('only shows tasks with deadline field', () => {
    const tasksWithAndWithoutDeadline: KanbanTask[] = [
      {
        id: '1',
        title: 'Task with deadline',
        description: 'Test',
        status: 'todo',
        priority: 'medium',
        isTeamTask: false,
        deadline: '2026-04-01T00:00:00Z',
        createdAt: '2026-03-31T00:00:00Z',
        updatedAt: '2026-03-31T00:00:00Z',
        workState: 'idle',
      },
      {
        id: '2',
        title: 'Task without deadline',
        description: 'Test',
        status: 'todo',
        priority: 'medium',
        isTeamTask: false,
        createdAt: '2026-03-31T00:00:00Z',
        updatedAt: '2026-03-31T00:00:00Z',
        workState: 'idle',
      },
    ];

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) =>
      selector({
        tasks: tasksWithAndWithoutDeadline,
      }),
    );

    vi.mocked(useAgentsStore).mockImplementation((selector: any) =>
      selector({
        agents: [] as AgentSummary[],
      }),
    );

    render(<CalendarView />);

    expect(document.querySelectorAll('.fc-event').length).toBe(1);
  });

  it('team tasks use the team styling classes in event content', () => {
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) =>
      selector({
        tasks: [
          {
            id: '1',
            title: 'Team Task',
            description: 'Test',
            status: 'todo',
            priority: 'medium',
            isTeamTask: true,
            teamId: 'team1',
            teamName: 'Alpha',
            deadline: '2026-04-01T00:00:00Z',
            createdAt: '2026-03-31T00:00:00Z',
            updatedAt: '2026-03-31T00:00:00Z',
            workState: 'idle',
          } as KanbanTask,
        ],
      }),
    );

    vi.mocked(useAgentsStore).mockImplementation((selector: any) =>
      selector({
        agents: [] as AgentSummary[],
      }),
    );

    render(<CalendarView />);

    expect(document.querySelector('.bg-indigo-50.border-indigo-200.text-indigo-700')).toBeTruthy();
  });

  it('supports dayGridMonth, dayGridYear, timeGridWeek views', () => {
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) =>
      selector({
        tasks: [
          {
            id: '1',
            title: 'Test Task',
            description: 'Test',
            status: 'todo',
            priority: 'medium',
            isTeamTask: false,
            deadline: '2026-04-01T00:00:00Z',
            createdAt: '2026-03-31T00:00:00Z',
            updatedAt: '2026-03-31T00:00:00Z',
            workState: 'idle',
          } as KanbanTask,
        ],
      }),
    );

    vi.mocked(useAgentsStore).mockImplementation((selector: any) =>
      selector({
        agents: [] as AgentSummary[],
      }),
    );

    render(<CalendarView />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('shows empty state when no tasks have deadlines', () => {
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) =>
      selector({
        tasks: [
          {
            id: '1',
            title: 'Task without deadline',
            description: 'Test',
            status: 'todo',
            priority: 'medium',
            isTeamTask: false,
            createdAt: '2026-03-31T00:00:00Z',
            updatedAt: '2026-03-31T00:00:00Z',
            workState: 'idle',
          } as KanbanTask,
        ],
      }),
    );

    vi.mocked(useAgentsStore).mockImplementation((selector: any) =>
      selector({
        agents: [] as AgentSummary[],
      }),
    );

    render(<CalendarView />);

    expect(screen.getByText('暂无排期任务')).toBeTruthy();
    expect(screen.getByText(/为任务设置截止日期后,将在日程视图中显示/)).toBeTruthy();
  });
});
