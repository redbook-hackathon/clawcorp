import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TaskKanban } from '@/pages/TaskKanban';

const { agentsStoreState, approvalsStoreState, hostApiFetchMock } = vi.hoisted(() => ({
  agentsStoreState: {
    agents: [] as Array<{ id: string; name: string }>,
    fetchAgents: vi.fn(async () => undefined),
  },
  approvalsStoreState: {
    approvals: [] as Array<{ id: string; command?: string; prompt?: string; toolInput?: Record<string, unknown>; agentId?: string }>,
    fetchApprovals: vi.fn(async () => undefined),
    approveItem: vi.fn(async () => undefined),
    rejectItem: vi.fn(async () => undefined),
  },
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => agentsStoreState,
}));

vi.mock('@/stores/approvals', () => ({
  useApprovalsStore: () => approvalsStoreState,
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

function readStoredTicket(id: string): Record<string, unknown> | undefined {
  const raw = localStorage.getItem('clawport-kanban');
  const tickets = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
  return tickets.find((ticket) => ticket.id === id);
}

const respondButtonName = /^(Respond|回复)$/i;
const reviewButtonName = /^(Review|审查)$/i;
const approvalDialogName = /^(Approval review|工具审批审查)$/i;
const approveButtonName = /^(Approve|批准)$/i;
const startWorkButtonName = /^(Start work|开始处理)$/i;
const followUpMessageName = /^(Follow-up message|追问消息)$/i;
const sendFollowUpButtonName = /^(Send follow-up|发送追问)$/i;
const stopRuntimeButtonName = /^(Stop runtime|停止 runtime)$/i;
const retryWorkButtonName = /^(Retry work|重试处理)$/i;

describe('TaskKanban', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    approvalsStoreState.approvals = [];
    agentsStoreState.agents = [];
  });

  it('renders a readable AskUserQuestion action label', () => {
    approvalsStoreState.approvals = [
      {
        id: 'approval-1',
        command: 'AskUserQuestion',
        prompt: '{"question":"Pick one","options":["A","B"]}',
      },
    ];

    render(<TaskKanban />);

    expect(screen.getByRole('button', { name: respondButtonName })).toBeInTheDocument();
  });

  it('opens structured toolInput questions with context and prefills the previous answer', async () => {
    approvalsStoreState.approvals = [
      {
        id: 'approval-ask',
        command: 'AskUserQuestion',
        toolInput: {
          questions: [
            {
              question: 'Pick one',
              header: 'Choice',
              options: [{ label: 'A' }, { label: 'B' }],
            },
          ],
          answers: { 'Pick one': 'B' },
          context: {
            requestedToolInput: { command: 'rm -rf /tmp/unsafe' },
          },
        },
        agentId: 'agent-1',
      },
    ];

    render(<TaskKanban />);

    fireEvent.click(screen.getByRole('button', { name: respondButtonName }));
    await screen.findByText('Pick one');

    expect(screen.getByText('Command: rm -rf /tmp/unsafe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a dedicated approval dialog for non-question tool approvals with danger warning', async () => {
    approvalsStoreState.approvals = [
      {
        id: 'approval-shell',
        command: 'ShellExec',
        prompt: 'run shell command',
        agentId: 'agent-1',
        toolInput: {
          command: 'rm -rf /tmp/unsafe',
          cwd: '/workspace',
        },
      },
    ];

    render(<TaskKanban />);

    fireEvent.click(screen.getByRole('button', { name: reviewButtonName }));

    expect(await screen.findByRole('dialog', { name: approvalDialogName })).toBeInTheDocument();
    expect(screen.getByText(/rm -rf \/tmp\/unsafe/)).toBeInTheDocument();
    expect(screen.getByText(/危险操作/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: approveButtonName }));

    expect(approvalsStoreState.approveItem).toHaveBeenCalledWith('approval-shell', undefined);
  });

  it('does not submit on Enter while IME composition is active', () => {
    render(<TaskKanban />);

    fireEvent.click(screen.getByRole('button', { name: '+ 创建任务' }));
    expect(screen.getByRole('heading', { name: '创建任务' })).toBeInTheDocument();

    const [titleInput] = screen.getAllByRole('textbox');
    fireEvent.change(titleInput, { target: { value: 'IME title' } });

    fireEvent.compositionStart(titleInput);
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(screen.getByRole('heading', { name: '创建任务' })).toBeInTheDocument();
    expect(titleInput).toHaveValue('IME title');

    fireEvent.compositionEnd(titleInput);
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(screen.queryByRole('heading', { name: '创建任务' })).not.toBeInTheDocument();
    expect(screen.getByText('IME title')).toBeInTheDocument();
  });

  it('shows assigneeRole in detail and locks dragging for active work items', () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-locked',
        title: 'Runtime task',
        description: 'Waiting for agent runtime',
        status: 'todo',
        priority: 'high',
        assigneeRole: 'planner',
        workState: 'working',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    render(<TaskKanban />);

    const card = screen.getByTestId('ticket-card-ticket-locked');
    expect(card).toHaveAttribute('draggable', 'false');

    fireEvent.click(screen.getByText('Runtime task'));

    expect(screen.getAllByText('planner').length).toBeGreaterThan(0);
    expect(screen.getByText(/运行中任务不可拖拽/)).toBeInTheDocument();
  });

  it('spawns a runtime session and shows transcript in the ticket detail panel', async () => {
    agentsStoreState.agents = [{ id: 'planner-1', name: 'Planner' }];
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime',
        title: 'Ship runtime task',
        description: 'Ask planner to investigate',
        status: 'todo',
        priority: 'medium',
        assigneeId: 'planner-1',
        workState: 'idle',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));
    hostApiFetchMock.mockResolvedValueOnce({
      success: true,
      session: {
        id: 'runtime-1',
        sessionKey: 'agent:planner-1:main:subagent:runtime-1',
        prompt: 'Ship runtime task\n\nAsk planner to investigate',
        transcript: ['Ship runtime task\n\nAsk planner to investigate'],
        status: 'running',
      },
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Ship runtime task'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: startWorkButtonName }));
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/spawn', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => {
      expect(screen.getAllByText(/runtime-1/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Ask planner to investigate/).length).toBeGreaterThan(0);
    expect(readStoredTicket('ticket-runtime')).toEqual(expect.objectContaining({
      status: 'in-progress',
      workState: 'working',
      runtimeSessionId: 'runtime-1',
      runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-1',
    }));
  });

  it('steers and kills an active runtime session from the detail panel', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-steer',
        title: 'Investigate costs',
        description: 'Need more detail',
        status: 'todo',
        priority: 'medium',
        workState: 'working',
        runtimeSessionId: 'runtime-2',
        runtimeTranscript: ['Investigate costs'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));
    hostApiFetchMock
      .mockResolvedValueOnce({
        success: true,
        session: {
          id: 'runtime-2',
          status: 'running',
          transcript: ['Investigate costs', 'Follow up on anomalies'],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        session: {
          id: 'runtime-2',
          status: 'killed',
          transcript: ['Investigate costs', 'Follow up on anomalies'],
        },
      });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Investigate costs'));
    fireEvent.change(screen.getByRole('textbox', { name: followUpMessageName }), {
      target: { value: 'Follow up on anomalies' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: sendFollowUpButtonName }));
    });
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-2/steer', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => {
      expect(screen.getByText(/Follow up on anomalies/)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: stopRuntimeButtonName }));
    });
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-2/kill', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByText(/Runtime killed|Manually stopped/)).toBeInTheDocument();
  });

  it('polls wait for active runtime work and maps blocked state back into ticket metadata', async () => {
    vi.useFakeTimers();
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-blocked',
        title: 'Blocked runtime',
        description: 'Needs approval',
        status: 'todo',
        priority: 'medium',
        workState: 'working',
        runtimeSessionId: 'runtime-blocked',
        runtimeTranscript: ['Investigate failure'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents/runtime-blocked/wait') {
        return {
          success: true,
          session: {
            id: 'runtime-blocked',
            status: 'blocked',
            lastError: 'Waiting on dependency',
            transcript: ['Investigate failure', 'Blocked by missing data'],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/sessions/subagents/runtime-blocked/wait',
      expect.objectContaining({ method: 'POST' }),
    );

    expect(readStoredTicket('ticket-blocked')).toEqual(expect.objectContaining({
      status: 'in-progress',
      workState: 'blocked',
      workError: 'Waiting on dependency',
      runtimeTranscript: ['Investigate failure', 'Blocked by missing data'],
    }));
  });

  it('maps waiting_approval then completed runtime states to review-ready ticket output', async () => {
    vi.useFakeTimers();
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-review',
        title: 'Need review',
        description: 'Generate patch',
        status: 'in-progress',
        priority: 'medium',
        workState: 'working',
        runtimeSessionId: 'runtime-review',
        runtimeTranscript: ['Started task'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock
      .mockResolvedValueOnce({
        success: true,
        session: {
          id: 'runtime-review',
          status: 'waiting_approval',
          lastError: 'Need manual approval',
          transcript: ['Started task', 'Please approve command'],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        session: {
          id: 'runtime-review',
          status: 'completed',
          result: 'Patch prepared and ready for review',
          transcript: ['Started task', 'Patch prepared and ready for review'],
        },
      });

    render(<TaskKanban />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(readStoredTicket('ticket-review')).toEqual(expect.objectContaining({
      status: 'review',
      workState: 'waiting_approval',
      workError: 'Need manual approval',
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(readStoredTicket('ticket-review')).toEqual(expect.objectContaining({
      status: 'review',
      workState: 'done',
      workResult: 'Patch prepared and ready for review',
    }));
  });

  it('keeps a reminder ticket scheduled after the setup runtime completes and binds the created cron job', async () => {
    vi.useFakeTimers();
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-reminder-scheduled',
        title: '40秒后叫我喝水',
        description: '帮我设置一个40秒后的提醒',
        status: 'in-progress',
        priority: 'medium',
        workState: 'working',
        runtimeSessionId: 'runtime-reminder-setup',
        runtimeSessionKey: 'agent:main:main:subagent:runtime-reminder-setup',
        workStartedAt: '2026-03-26T13:32:00.000Z',
        cronBaselineJobIds: [],
        createdAt: '2026-03-26T13:32:00.000Z',
        updatedAt: '2026-03-26T13:32:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents/runtime-reminder-setup/wait') {
        return {
          success: true,
          session: {
            id: 'runtime-reminder-setup',
            status: 'completed',
            result: '提醒已设置！40秒后会提醒你喝水。',
            transcript: ['提醒已设置！40秒后会提醒你喝水。'],
          },
        };
      }
      if (path === '/api/cron/jobs') {
        return [
          {
            id: 'job-drink-water',
            name: '40秒后叫我喝水',
            message: '40秒后提醒我喝水',
            schedule: { kind: 'at', at: '2026-03-26T13:32:40.000Z' },
            delivery: { mode: 'none' },
            sessionTarget: 'main',
            enabled: true,
            createdAt: '2026-03-26T13:32:01.000Z',
            updatedAt: '2026-03-26T13:32:01.000Z',
            nextRun: '2026-03-26T13:32:40.000Z',
          },
        ];
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(readStoredTicket('ticket-reminder-scheduled')).toEqual(expect.objectContaining({
      status: 'in-progress',
      workState: 'scheduled',
      workResult: '提醒已设置！40秒后会提醒你喝水。',
      cronJobId: 'job-drink-water',
    }));
  });

  it('moves a one-shot reminder ticket to done only after the cron run completes', async () => {
    vi.useFakeTimers();
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-reminder-done',
        title: '40秒后叫我喝水',
        description: '帮我设置一个40秒后的提醒',
        status: 'in-progress',
        priority: 'medium',
        workState: 'scheduled',
        workResult: '提醒已设置！40秒后会提醒你喝水。',
        cronJobId: 'job-drink-water',
        cronScheduleKind: 'at',
        workStartedAt: '2026-03-26T13:32:00.000Z',
        createdAt: '2026-03-26T13:32:00.000Z',
        updatedAt: '2026-03-26T13:32:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/cron/jobs') {
        return [
          {
            id: 'job-drink-water',
            name: '40秒后叫我喝水',
            message: '40秒后提醒我喝水',
            schedule: { kind: 'at', at: '2026-03-26T13:32:40.000Z' },
            delivery: { mode: 'none' },
            sessionTarget: 'main',
            enabled: true,
            createdAt: '2026-03-26T13:32:01.000Z',
            updatedAt: '2026-03-26T13:32:40.000Z',
          },
        ];
      }
      if (path === '/api/cron/runs/job-drink-water') {
        return {
          runs: [
            {
              status: 'ok',
              summary: '到时间了，记得喝水。',
              ts: Date.parse('2026-03-26T13:32:40.000Z'),
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(readStoredTicket('ticket-reminder-done')).toEqual(expect.objectContaining({
      status: 'done',
      workState: 'done',
      workResult: '到时间了，记得喝水。',
      cronJobId: 'job-drink-water',
    }));
  });

  it.each(['error', 'killed', 'stopped'] as const)(
    'maps %s runtime state into failed work while preserving retry controls',
    async (runtimeStatus) => {
      vi.useFakeTimers();
      localStorage.setItem('clawport-kanban', JSON.stringify([
        {
          id: `ticket-${runtimeStatus}`,
          title: `Runtime ${runtimeStatus}`,
          description: 'Check status mapping',
          status: 'in-progress',
          priority: 'medium',
          workState: 'working',
          runtimeSessionId: `runtime-${runtimeStatus}`,
          runtimeTranscript: ['Start'],
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z',
        },
      ]));

      hostApiFetchMock.mockResolvedValue({
        success: true,
        session: {
          id: `runtime-${runtimeStatus}`,
          status: runtimeStatus,
          lastError: `Runtime ${runtimeStatus}`,
          transcript: ['Start'],
        },
      });

      render(<TaskKanban />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(readStoredTicket(`ticket-${runtimeStatus}`)).toEqual(expect.objectContaining({
        workState: 'failed',
        workError: `Runtime ${runtimeStatus}`,
        runtimeSessionId: `runtime-${runtimeStatus}`,
      }));

      fireEvent.click(screen.getByText(`Runtime ${runtimeStatus}`));
      expect(screen.getByRole('button', { name: retryWorkButtonName })).toBeInTheDocument();
    },
  );

  it('shows session-linked approvals in the ticket detail panel', async () => {
    approvalsStoreState.approvals = [
      {
        id: 'approval-linked',
        sessionKey: 'agent:planner-1:main:subagent:runtime-approval',
        command: 'ShellExec',
        agentId: 'planner-1',
        toolInput: {
          command: 'rm -rf /tmp/unsafe',
          cwd: '/workspace',
        },
      },
      {
        id: 'approval-parent',
        sessionKey: 'agent:planner-1:main',
        command: 'ToolRead',
        agentId: 'planner-1',
        toolInput: {
          path: '/workspace/README.md',
        },
      },
    ];
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-approval',
        title: 'Needs approval binding',
        description: 'Review a dangerous command',
        status: 'review',
        priority: 'high',
        assigneeId: 'planner-1',
        workState: 'waiting_approval',
        runtimeSessionId: 'runtime-approval',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-approval',
        runtimeParentSessionKey: 'agent:planner-1:main',
        runtimeTranscript: ['Started task', 'Need approval'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Needs approval binding'));

    const approvalsPanel = screen.getByTestId('ticket-runtime-approvals');
    expect(within(approvalsPanel).getByText('ShellExec')).toBeInTheDocument();
    expect(within(approvalsPanel).getByText('ToolRead')).toBeInTheDocument();

    const shellExecCard = within(approvalsPanel).getByText('ShellExec').closest('div.rounded-lg');
    expect(shellExecCard).not.toBeNull();
    fireEvent.click(within(shellExecCard as HTMLElement).getByRole('button', { name: reviewButtonName }));

    expect(await screen.findByRole('dialog', { name: approvalDialogName })).toBeInTheDocument();
  });

  it('retries runtime work as a child session and preserves lineage metadata', async () => {
    agentsStoreState.agents = [{ id: 'planner-1', name: 'Planner' }];
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-retry',
        title: 'Retry runtime task',
        description: 'Need a follow-up run',
        status: 'review',
        priority: 'medium',
        assigneeId: 'planner-1',
        workState: 'failed',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeTranscript: ['First run failed'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));
    hostApiFetchMock.mockResolvedValueOnce({
      success: true,
      session: {
        id: 'runtime-child',
        parentRuntimeId: 'runtime-parent',
        rootRuntimeId: 'runtime-parent',
        depth: 1,
        sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child',
        parentSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        transcript: ['Retry runtime task\n\nNeed a follow-up run'],
        status: 'running',
      },
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Retry runtime task'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: retryWorkButtonName }));
    });

    const [, init] = hostApiFetchMock.mock.calls[0] as [string, { body?: string }];
    expect(JSON.parse(String(init.body))).toEqual(expect.objectContaining({
      parentRuntimeId: 'runtime-parent',
    }));
    expect(readStoredTicket('ticket-runtime-retry')).toEqual(expect.objectContaining({
      runtimeSessionId: 'runtime-child',
      runtimeParentSessionId: 'runtime-parent',
      runtimeRootSessionId: 'runtime-parent',
    }));
  });

  it('loads child runtime sessions into the detail panel', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-tree',
        title: 'Review runtime tree',
        description: 'Inspect child runs',
        status: 'review',
        priority: 'medium',
        assigneeId: 'planner-1',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1', 'runtime-child-2'],
        runtimeTranscript: ['parent transcript'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents') {
        return {
          success: true,
          sessions: [
            {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['parent transcript'],
              childRuntimeIds: ['runtime-child-1', 'runtime-child-2'],
            },
            {
              id: 'runtime-child-1',
              parentRuntimeId: 'runtime-parent',
              depth: 1,
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
              status: 'completed',
              transcript: ['child run 1 complete'],
            },
            {
              id: 'runtime-child-2',
              parentRuntimeId: 'runtime-parent',
              depth: 1,
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-2',
              status: 'waiting_approval',
              transcript: ['child run 2 waiting'],
            },
          ],
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Review runtime tree'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents');
    });

    expect(await screen.findByText('runtime-child-1')).toBeInTheDocument();
    expect(screen.getByText('runtime-child-2')).toBeInTheDocument();
    expect(screen.getByText(/child run 1 complete/)).toBeInTheDocument();
  });

  it('switches the child list to the selected runtime subtree using the rooted tree snapshot', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-subtree',
        title: 'Review runtime subtree',
        description: 'Inspect nested child runs',
        status: 'review',
        priority: 'medium',
        assigneeId: 'planner-1',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1'],
        runtimeTranscript: ['parent transcript'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents/runtime-parent/tree') {
        return {
          success: true,
          tree: {
            root: {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['parent transcript'],
              childRuntimeIds: ['runtime-child-1'],
            },
            descendants: [
              {
                id: 'runtime-child-1',
                parentRuntimeId: 'runtime-parent',
                sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
                status: 'completed',
                transcript: ['child transcript'],
                childRuntimeIds: ['runtime-grandchild-1'],
              },
              {
                id: 'runtime-grandchild-1',
                parentRuntimeId: 'runtime-child-1',
                sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1:subagent:runtime-grandchild-1',
                status: 'waiting_approval',
                transcript: ['grandchild transcript'],
              },
            ],
          },
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-1') {
        return {
          success: true,
          session: {
            id: 'runtime-child-1',
            parentRuntimeId: 'runtime-parent',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            status: 'completed',
            transcript: ['child transcript'],
            childRuntimeIds: ['runtime-grandchild-1'],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Review runtime subtree'));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-parent/tree');
    });
    expect(await screen.findByRole('button', { name: /runtime-child-1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /runtime-child-1/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-child-1');
    });
    expect(screen.getByText(/(Latest run|最新运行)/)).toBeInTheDocument();
    expect(screen.getByText(/(Active subtree|活跃子树)/)).toBeInTheDocument();
    expect(screen.getByText(/waiting_approval/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /runtime-grandchild-1/i })).toBeInTheDocument();
    expect(screen.getByText(/grandchild transcript/)).toBeInTheDocument();
  });

  it('renders structured runtime history with thinking and tool cards', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-structured-history',
        title: 'Inspect structured history',
        description: 'Show thinking and tools',
        status: 'review',
        priority: 'medium',
        workState: 'done',
        runtimeSessionId: 'runtime-structured',
        runtimeHistory: [
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'Need to inspect the workspace first.' },
              { type: 'text', text: 'Collected the initial state.' },
              { type: 'tool_use', id: 'tool-1', name: 'ShellExec', input: { command: 'dir' } },
              { type: 'tool_result', id: 'tool-1', name: 'ShellExec', content: 'Listed the workspace files.' },
            ],
          },
        ],
        runtimeTranscript: ['Collected the initial state.'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Inspect structured history'));

    expect(await screen.findByText('思考过程')).toBeInTheDocument();
    expect(screen.getByText('ShellExec')).toBeInTheDocument();
    expect(screen.getByText(/Collected the initial state/)).toBeInTheDocument();
  });

  it('switches the runtime detail view when a child run is selected', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-child-switch',
        title: 'Switch child run',
        description: 'Open child drill-down',
        status: 'review',
        priority: 'medium',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1'],
        runtimeHistory: [
          {
            role: 'assistant',
            content: 'Parent run summary',
          },
        ],
        runtimeTranscript: ['Parent run summary'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents') {
        return {
          success: true,
          sessions: [
            {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['Parent run summary'],
              childRuntimeIds: ['runtime-child-1'],
            },
            {
              id: 'runtime-child-1',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
              status: 'completed',
              transcript: ['Child run output'],
            },
          ],
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-1') {
        return {
          success: true,
          session: {
            id: 'runtime-child-1',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            status: 'completed',
            history: [
              {
                role: 'assistant',
                content: 'Child run output',
              },
            ],
            transcript: ['Child run output'],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Switch child run'));

    expect(await screen.findByText('Parent run summary')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /runtime-child-1/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-child-1');
    });
    expect((await screen.findAllByText('Child run output')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /back to latest run/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to latest run/i }));
    expect(await screen.findByText('Parent run summary')).toBeInTheDocument();
  });

  it('retries work from the selected child runtime instead of the ticket root runtime', async () => {
    agentsStoreState.agents = [{ id: 'planner-1', name: 'Planner' }];
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-retry-selected-child',
        title: 'Retry from selected child',
        description: 'Pick the child branch before retrying',
        status: 'review',
        priority: 'medium',
        assigneeId: 'planner-1',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1'],
        runtimeTranscript: ['Parent output'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    let spawnBody: Record<string, unknown> | null = null;
    hostApiFetchMock.mockImplementation(async (path: string, init?: { body?: string }) => {
      if (path === '/api/sessions/subagents') {
        return {
          success: true,
          sessions: [
            {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['Parent output'],
              childRuntimeIds: ['runtime-child-1'],
            },
            {
              id: 'runtime-child-1',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
              status: 'completed',
              transcript: ['Child branch output'],
            },
          ],
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-1') {
        return {
          success: true,
          session: {
            id: 'runtime-child-1',
            parentRuntimeId: 'runtime-parent',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            status: 'completed',
            transcript: ['Child branch output'],
          },
        };
      }
      if (path === '/api/sessions/spawn') {
        spawnBody = init?.body ? JSON.parse(String(init.body)) : null;
        return {
          success: true,
          session: {
            id: 'runtime-child-retry',
            parentRuntimeId: 'runtime-child-1',
            rootRuntimeId: 'runtime-parent',
            depth: 2,
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1:subagent:runtime-child-retry',
            parentSessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            transcript: ['Retry branch output'],
            status: 'running',
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Retry from selected child'));
    fireEvent.click(await screen.findByRole('button', { name: /runtime-child-1/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-child-1');
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: retryWorkButtonName }));
    });

    expect(spawnBody).toEqual(expect.objectContaining({
      parentRuntimeId: 'runtime-child-1',
      parentSessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
    }));
    expect(readStoredTicket('ticket-retry-selected-child')).toEqual(expect.objectContaining({
      runtimeSessionId: 'runtime-child-retry',
      runtimeParentSessionId: 'runtime-child-1',
      runtimeRootSessionId: 'runtime-parent',
    }));
  });

  it('renders execution records for the selected runtime detail', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-execution',
        title: 'Inspect execution path',
        description: 'Show tool execution records',
        status: 'review',
        priority: 'medium',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1'],
        runtimeHistory: [
          {
            role: 'assistant',
            content: 'Parent output',
          },
        ],
        runtimeTranscript: ['Parent output'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents') {
        return {
          success: true,
          sessions: [
            {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['Parent output'],
              childRuntimeIds: ['runtime-child-1'],
            },
            {
              id: 'runtime-child-1',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
              status: 'completed',
              transcript: ['Child output'],
            },
          ],
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-1') {
        return {
          success: true,
          session: {
            id: 'runtime-child-1',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            status: 'completed',
            history: [
              {
                role: 'assistant',
                content: 'Child output',
              },
            ],
            transcript: ['Child output'],
            executionRecords: [
              {
                id: 'tool-1',
                toolName: 'ShellExec',
                status: 'completed',
                summary: 'Listed the workspace files.',
                durationMs: 1200,
              },
              {
                id: 'tool-2',
                toolName: 'skill:planner-review',
                status: 'completed',
                summary: 'Delegated planner review.',
              },
            ],
            skillSnapshot: ['planner-review'],
            toolSnapshot: [{ server: 'filesystem', name: 'read_file' }],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Inspect execution path'));
    fireEvent.click(await screen.findByRole('button', { name: /runtime-child-1/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-child-1');
    });
    expect(screen.getByText(/^(Execution path|执行路径)$/)).toBeInTheDocument();
    expect(screen.getByText('ShellExec')).toBeInTheDocument();
    expect(screen.getByText('Listed the workspace files.')).toBeInTheDocument();
    expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/^(Runtime capabilities|Runtime 能力)$/)).toBeInTheDocument();
    expect(screen.getByText('planner-review')).toBeInTheDocument();
    expect(screen.getByText('filesystem.read_file')).toBeInTheDocument();
  });

  it('navigates to the parent runtime from the lineage panel', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-lineage',
        title: 'Inspect lineage navigation',
        description: 'Open parent runtime',
        status: 'review',
        priority: 'medium',
        workState: 'done',
        runtimeSessionId: 'runtime-child',
        runtimeParentSessionId: 'runtime-parent',
        runtimeRootSessionId: 'runtime-root',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child',
        runtimeHistory: [
          {
            role: 'assistant',
            content: 'Child output',
          },
        ],
        runtimeTranscript: ['Child output'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents/runtime-parent') {
        return {
          success: true,
          session: {
            id: 'runtime-parent',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
            status: 'completed',
            history: [
              {
                role: 'assistant',
                content: 'Parent output',
              },
            ],
            transcript: ['Parent output'],
            parentRuntimeId: 'runtime-root',
            rootRuntimeId: 'runtime-root',
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Inspect lineage navigation'));
    fireEvent.click(screen.getByRole('button', { name: /runtime-parent/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-parent');
    });
    expect(await screen.findByText('Parent output')).toBeInTheDocument();
  });

  it('opens the linked runtime from an execution record card', async () => {
    localStorage.setItem('clawport-kanban', JSON.stringify([
      {
        id: 'ticket-runtime-linked-execution',
        title: 'Linked execution runtime',
        description: 'Open linked child runtime',
        status: 'review',
        priority: 'medium',
        workState: 'done',
        runtimeSessionId: 'runtime-parent',
        runtimeSessionKey: 'agent:planner-1:main:subagent:runtime-parent',
        runtimeChildSessionIds: ['runtime-child-1'],
        runtimeHistory: [
          {
            role: 'assistant',
            content: 'Parent output',
          },
        ],
        runtimeTranscript: ['Parent output'],
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
      },
    ]));

    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/sessions/subagents') {
        return {
          success: true,
          sessions: [
            {
              id: 'runtime-parent',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent',
              status: 'completed',
              transcript: ['Parent output'],
              childRuntimeIds: ['runtime-child-1'],
            },
            {
              id: 'runtime-child-1',
              sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
              status: 'completed',
              transcript: ['Child execution output'],
            },
          ],
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-1') {
        return {
          success: true,
          session: {
            id: 'runtime-child-1',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-1',
            status: 'completed',
            history: [
              {
                role: 'assistant',
                content: 'Child execution output',
              },
            ],
            transcript: ['Child execution output'],
            executionRecords: [
              {
                id: 'tool-linked',
                toolName: 'skill:planner-review',
                status: 'completed',
                summary: 'Opened a linked child runtime.',
                linkedRuntimeId: 'runtime-child-linked',
              },
            ],
          },
        };
      }
      if (path === '/api/sessions/subagents/runtime-child-linked') {
        return {
          success: true,
          session: {
            id: 'runtime-child-linked',
            sessionKey: 'agent:planner-1:main:subagent:runtime-parent:subagent:runtime-child-linked',
            status: 'completed',
            history: [
              {
                role: 'assistant',
                content: 'Linked child output',
              },
            ],
            transcript: ['Linked child output'],
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<TaskKanban />);
    fireEvent.click(screen.getByText('Linked execution runtime'));
    fireEvent.click(await screen.findByRole('button', { name: /runtime-child-1/i }));

    fireEvent.click(await screen.findByRole('button', { name: /open linked runtime runtime-child-linked/i }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/sessions/subagents/runtime-child-linked');
    });
    expect(await screen.findByText('Linked child output')).toBeInTheDocument();
  });
});
