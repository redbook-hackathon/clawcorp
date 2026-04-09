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
    <div className="flex h-full flex-col gap-5 p-6 bg-[#f5f5f7]">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 leading-snug">
          {task.isTeamTask && task.teamName && (
            <span className="text-violet-600 font-medium">{task.teamName}：</span>
          )}
          {task.title}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium',
            task.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
            task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
            'bg-gray-100 text-gray-500 border border-gray-200'
          )}>
            {task.priority === 'high' ? '高优先级' : task.priority === 'medium' ? '中优先级' : '低优先级'}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {task.status === 'todo' ? '待办' : task.status === 'in-progress' ? '进行中' : task.status === 'review' ? '审查' : '完成'}
          </span>
          {task.workState !== 'idle' && (
            <span className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5',
              task.workState === 'blocked' || task.workState === 'failed' ? 'bg-red-50 text-red-600 border-red-100' :
              task.workState === 'waiting_approval' ? 'bg-amber-50 text-amber-600 border-amber-100' :
              task.workState === 'done' ? 'bg-green-50 text-green-600 border-green-100' :
              'bg-blue-50 text-blue-600 border-blue-100'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', getWorkStateDotColor(task.workState))} />
              {getWorkStateLabel(task.workState)}
            </span>
          )}
          {Boolean(task.runtimeSessionId || task.runtimeSessionKey) && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600 border border-green-100 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              已关联会话
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">描述</h3>
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-3 rounded-lg text-gray-500 hover:text-gray-700"
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
              rows={5}
              className="rounded-xl border-gray-200 bg-gray-50 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="rounded-full px-4 h-8 text-xs font-medium">
                保存
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="rounded-full px-4 h-8 text-xs">
                取消
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">
            {task.description || <span className="text-gray-300 italic">暂无描述</span>}
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">负责人</span>
          <span className="font-medium text-gray-800">{assignee?.name ?? '未分配'}</span>
        </div>
        {task.deadline && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">截止时间</span>
            <span className="font-medium text-gray-800">{new Date(task.deadline).toLocaleString('zh-CN')}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">创建时间</span>
          <span className="font-medium text-gray-500 text-xs">{new Date(task.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">更新时间</span>
          <span className="font-medium text-gray-500 text-xs">{new Date(task.updatedAt).toLocaleString('zh-CN')}</span>
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
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-2.5">执行记录</h3>
          <div className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-2 mb-2 truncate">
            {task.runtimeSessionId}
          </div>
          {task.runtimeHistory && task.runtimeHistory.length > 0 && (
            <div className="space-y-1.5">
              {task.runtimeHistory.slice(-3).map((msg, idx) => (
                <p key={idx} className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">{msg.role}:</span> {msg.content.slice(0, 80)}
                  {msg.content.length > 80 && '…'}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Related session link */}
      {task.runtimeSessionKey && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-2.5">关联会话</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/chat?session=${task.runtimeSessionKey}`;
            }}
            className="rounded-full px-4 h-8 text-xs font-medium border-gray-200 text-gray-600 hover:text-gray-800"
          >
            查看会话
          </Button>
        </div>
      )}

      {/* Delete button */}
      <div className="mt-auto pt-4 border-t border-gray-100">
        {showDeleteConfirm ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <p className="text-sm text-gray-500">确定要删除这个任务吗？此操作无法撤销。</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="flex-1 rounded-full h-8 text-xs"
              >
                确认删除
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full h-8 text-xs"
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
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100 rounded-full h-9 text-xs font-medium"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            删除任务
          </Button>
        )}
      </div>
    </div>
  );
}
