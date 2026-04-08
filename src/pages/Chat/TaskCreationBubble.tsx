/**
 * TaskCreationBubble Component
 * Phase 12-02: chat task creation with create-only vs create-and-start paths
 */
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import type { KanbanTask, TaskPriority } from '@/types/task';

type TaskCreationMode = 'create_only' | 'create_and_start';

interface TaskCreationBubbleProps {
  title: string;
  description: string;
  assigneeId?: string;
  priority?: TaskPriority;
  teamId?: string;
  teamName?: string;
  deadline?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function TaskCreationBubble({
  title,
  description,
  assigneeId,
  priority = 'medium',
  teamId,
  teamName,
  deadline,
  onConfirm,
  onCancel,
}: TaskCreationBubbleProps) {
  const [createdTask, setCreatedTask] = useState<KanbanTask | null>(null);
  const [createdMode, setCreatedMode] = useState<TaskCreationMode | null>(null);
  const [loadingMode, setLoadingMode] = useState<TaskCreationMode | null>(null);
  const createTask = useApprovalsStore((state) => state.createTask);
  const startTaskExecution = useApprovalsStore((state) => state.startTaskExecution);
  const agents = useAgentsStore((state) => state.agents);
  const currentAgentId = useChatStore((state) => state.currentAgentId);
  const currentSessionKey = useChatStore((state) => state.currentSessionKey);

  const finalAssigneeId = assigneeId ?? currentAgentId;
  const assignee = agents.find((agent) => agent.id === finalAssigneeId);

  const handleCreate = async (mode: TaskCreationMode) => {
    setLoadingMode(mode);
    try {
      const task = await createTask({
        title,
        description,
        priority,
        assigneeId: finalAssigneeId,
        assigneeRole: assignee?.teamRole,
        teamId,
        teamName,
        deadline,
      });

      let nextTask = task;
      if (mode === 'create_and_start') {
        const runtimeResponse = await hostApiFetch<{ session?: { id?: string; sessionKey?: string } }>('/api/sessions/spawn', {
          method: 'POST',
          body: JSON.stringify({
            parentSessionKey: currentSessionKey,
            prompt: `Start task execution: ${title}\n\n${description}`,
          }),
        });
        const sessionId = runtimeResponse?.session?.id;
        const sessionKey = runtimeResponse?.session?.sessionKey;

        if (!sessionId || !sessionKey) {
          throw new Error('Failed to create a task execution session');
        }

        nextTask = await startTaskExecution(task.id, {
          sessionId,
          sessionKey,
          entrySessionKey: currentSessionKey,
          agentId: finalAssigneeId,
        });
      }

      setCreatedTask(nextTask);
      setCreatedMode(mode);
      onConfirm?.();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoadingMode(null);
    }
  };

  if (createdTask && createdMode) {
    return (
      <Card data-testid="task-anchor-card" className="inline-block max-w-md border-accent bg-accent/10 p-3">
        <p className="text-sm font-medium text-accent-foreground">
          {createdMode === 'create_and_start' ? '✓ 任务已创建并启动' : '✓ 任务已创建'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{createdTask.title}</p>
        {createdTask.teamName ? (
          <p className="mt-1 text-xs text-muted-foreground">{createdTask.teamName}</p>
        ) : null}
        <Button
          data-testid="task-anchor-link"
          size="sm"
          variant="link"
          className="mt-2 h-auto p-0 text-xs"
          onClick={() => {
            window.location.href = `/kanban?taskId=${createdTask.id}`;
          }}
        >
          查看任务 →
        </Button>
      </Card>
    );
  }

  return (
    <Card className="inline-block max-w-md border-accent bg-accent/10 p-4">
      <h4 className="mb-3 text-sm font-semibold">创建任务</h4>
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">任务标题:</span>
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">负责人:</span>
          <span className="font-medium">{assignee?.name ?? '未分配'}</span>
        </div>
        {teamName ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">团队:</span>
            <span className="font-medium">{teamName}</span>
          </div>
        ) : null}
        {deadline ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">截止时间:</span>
            <span className="font-medium">{new Date(deadline).toLocaleDateString('zh-CN')}</span>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          data-testid="task-create-only"
          size="sm"
          variant="outline"
          disabled={loadingMode !== null}
          onClick={() => handleCreate('create_only')}
          className="flex-1"
        >
          {loadingMode === 'create_only' ? '创建中...' : '仅创建任务'}
        </Button>
        <Button
          data-testid="task-create-start"
          size="sm"
          disabled={loadingMode !== null}
          onClick={() => handleCreate('create_and_start')}
          className="flex-1"
        >
          {loadingMode === 'create_and_start' ? '启动中...' : '创建并启动'}
        </Button>
        <Button
          data-testid="task-cancel"
          size="sm"
          variant="ghost"
          disabled={loadingMode !== null}
          onClick={onCancel}
        >
          取消
        </Button>
      </div>
    </Card>
  );
}
