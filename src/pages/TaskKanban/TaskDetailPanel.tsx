/**
 * TaskDetailPanel - Task detail view in right panel
 * Phase 02-03: Task card interactions
 */
import { useEffect, useMemo, useState } from 'react';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import { useApprovalsStore, type ApprovalItem } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';
import type { WorkState } from '@/types/task';
import { TaskExecutionLineageSection } from './task-detail/TaskExecutionLineageSection';
import { TaskExecutionGateSection } from './task-detail/TaskExecutionGateSection';
import { TaskRelatedSessionsSection } from './task-detail/TaskRelatedSessionsSection';

interface TaskDetailPanelProps {
  taskId: string;
}

function getWorkStateDotColor(state: WorkState): string {
  const colors: Record<WorkState, string> = {
    idle: 'bg-gray-400',
    starting: 'bg-blue-400',
    working: 'bg-blue-500',
    blocked: 'bg-red-500',
    waiting_approval: 'bg-yellow-500',
    scheduled: 'bg-purple-500',
    done: 'bg-green-500',
    failed: 'bg-red-600',
  };
  return colors[state] || 'bg-gray-400';
}

function getWorkStateLabel(state: WorkState): string {
  const labels: Record<WorkState, string> = {
    idle: '空闲中',
    starting: '启动中',
    working: '工作中',
    blocked: '阻塞',
    waiting_approval: '等待审批',
    scheduled: '已排期',
    done: '完成',
    failed: '失败',
  };
  return labels[state] || state;
}

interface RuntimeTreeResponse {
  root?: {
    id: string;
    sessionKey?: string;
    status?: string;
  };
  descendants?: Array<{
    id: string;
    sessionKey?: string;
    status?: string;
  }>;
}

export function TaskDetailPanel({ taskId }: TaskDetailPanelProps) {
  const tasks = useApprovalsStore((s) => s.tasks);
  const approvals = useApprovalsStore((s) => s.approvals ?? []);
  const fetchApprovals = useApprovalsStore((s) => s.fetchApprovals);
  const approveItem = useApprovalsStore((s) => s.approveItem ?? (async () => {}));
  const rejectItem = useApprovalsStore((s) => s.rejectItem ?? (async () => {}));
  const updateTask = useApprovalsStore((s) => s.updateTask);
  const deleteTask = useApprovalsStore((s) => s.deleteTask);
  const agents = useAgentsStore((s) => s.agents);
  const closePanel = useRightPanelStore((s) => s.closePanel);

  const task = useMemo(() => tasks.find((t) => t.id === taskId), [tasks, taskId]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [runtimeTree, setRuntimeTree] = useState<RuntimeTreeResponse | null>(null);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        任务不存在
      </div>
    );
  }

  const assignee = agents.find((a) => a.id === task.assigneeId);

  const handleSave = async () => {
    await updateTask(task.id, { description: editedDescription });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    closePanel();
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    if (!fetchApprovals) return;
    void fetchApprovals();
  }, [fetchApprovals]);

  useEffect(() => {
    if (!task?.runtimeSessionId) {
      setRuntimeTree(null);
      return;
    }

    let cancelled = false;
    void hostApiFetch<{ tree?: RuntimeTreeResponse }>(`/api/sessions/subagents/${encodeURIComponent(task.runtimeSessionId)}/tree`)
      .then((response) => {
        if (!cancelled) {
          setRuntimeTree(response?.tree ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeTree(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task?.runtimeSessionId]);

  const relatedSessionKeys = [
    ...new Set([
      ...(task.relatedSessionKeys ?? []),
      ...(task.runtimeSessionKey ? [task.runtimeSessionKey] : []),
    ]),
  ];
  const taskApprovalItems = approvals.filter((approval: ApprovalItem) => {
    if (approval.sessionKey) {
      return relatedSessionKeys.includes(approval.sessionKey);
    }
    return Boolean(task.assigneeId && approval.agentId === task.assigneeId);
  });

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">
          {task.isTeamTask && task.teamName && `团队${task.teamName}：`}
          {task.title}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
            {task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
          </Badge>
          <Badge variant="outline">
            {task.status === 'todo' ? '待办' : task.status === 'in-progress' ? '进行中' : task.status === 'review' ? '审查' : '完成'}
          </Badge>
          {task.workState !== 'idle' && (
            <Badge variant="outline" className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', getWorkStateDotColor(task.workState))} />
              {getWorkStateLabel(task.workState)}
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">描述</h3>
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditedDescription(task.description);
                setIsEditing(true);
              }}
            >
              编辑
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={6}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                保存
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {task.description || '无描述'}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">负责人</span>
          <span className="font-medium">{assignee?.name ?? '未分配'}</span>
        </div>
        {task.deadline && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">截止时间</span>
            <span className="font-medium">{new Date(task.deadline).toLocaleString('zh-CN')}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">创建时间</span>
          <span className="font-medium">{new Date(task.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">更新时间</span>
          <span className="font-medium">{new Date(task.updatedAt).toLocaleString('zh-CN')}</span>
        </div>
      </div>

      <TaskExecutionLineageSection task={task} runtimeTree={runtimeTree} />
      <TaskExecutionGateSection
        task={task}
        approvals={taskApprovalItems}
        onApprove={(approvalId) => void approveItem(approvalId)}
        onReject={(approvalId) => void rejectItem(approvalId, 'Rejected from task detail')}
      />
      <TaskRelatedSessionsSection
        sessionKeys={relatedSessionKeys}
        onOpenSession={(sessionKey) => {
          window.location.href = `/chat?session=${encodeURIComponent(sessionKey)}`;
        }}
      />

      {/* Runtime execution records */}
      {task.runtimeSessionId && (
        <div>
          <h3 className="text-sm font-medium mb-2">执行记录</h3>
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="text-muted-foreground">Session ID: {task.runtimeSessionId}</p>
            {task.runtimeHistory && task.runtimeHistory.length > 0 && (
              <div className="mt-2 space-y-1">
                {task.runtimeHistory.slice(-3).map((msg, idx) => (
                  <p key={idx} className="text-xs">
                    <span className="font-medium">{msg.role}:</span> {msg.content.slice(0, 100)}
                    {msg.content.length > 100 && '...'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related session link */}
      {task.runtimeSessionKey && (
        <div>
          <h3 className="text-sm font-medium mb-2">关联会话</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Navigate to chat with this session
              window.location.href = `/chat?session=${task.runtimeSessionKey}`;
            }}
          >
            查看会话
          </Button>
        </div>
      )}

      {/* Delete button */}
      <div className="mt-auto pt-4 border-t border-border">
        {showDeleteConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">确定要删除这个任务吗？此操作无法撤销。</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="flex-1"
              >
                确认删除
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            删除任务
          </Button>
        )}
      </div>
    </div>
  );
}
