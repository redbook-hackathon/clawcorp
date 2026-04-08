/**
 * Task Kanban Page - Phase 02 Redesign
 * Modern card-based Kanban layout with Agent swimlanes
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useApprovalsStore } from '@/stores/approvals';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import type { KanbanTask, TaskStatus, TaskPriority, WorkState } from '@/types/task';
import type { AgentSummary } from '@/types/agent';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Calendar, AlertCircle } from 'lucide-react';
import { ManualTaskForm } from './ManualTaskForm';
import { CalendarView } from './CalendarView';

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: '待办' },
  { key: 'in-progress', label: '进行中' },
  { key: 'review', label: '审查' },
  { key: 'done', label: '完成' },
];

function getTaskBorderColor(task: KanbanTask): string {
  if (task.status === 'todo') return 'border-l-purple-500';
  if (task.status === 'in-progress') return 'border-l-cyan-500';
  if (task.status === 'review') return 'border-l-orange-500';
  if (task.status === 'done') return 'border-l-gray-400';
  return 'border-l-gray-300';
}

function getAgentBorderColor(isTeam: boolean): string {
  return isTeam ? 'border-l-purple-500' : 'border-l-cyan-500';
}

function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return labels[priority];
}

function getWorkStateBadge(workState: WorkState) {
  const configs: Record<WorkState, { label: string; color: string; dotColor: string }> = {
    idle: { label: '空闲', color: 'bg-gray-100 text-gray-600', dotColor: 'bg-gray-400' },
    starting: { label: '启动中', color: 'bg-blue-100 text-blue-600', dotColor: 'bg-blue-400' },
    working: { label: '工作中', color: 'bg-blue-100 text-blue-600', dotColor: 'bg-blue-500' },
    blocked: { label: '阻塞', color: 'bg-red-100 text-red-600', dotColor: 'bg-red-500' },
    waiting_approval: { label: '待审批', color: 'bg-yellow-100 text-yellow-600', dotColor: 'bg-yellow-500' },
    scheduled: { label: '已排期', color: 'bg-purple-100 text-purple-600', dotColor: 'bg-purple-500' },
    done: { label: '完成', color: 'bg-green-100 text-green-600', dotColor: 'bg-green-500' },
    failed: { label: '失败', color: 'bg-red-100 text-red-600', dotColor: 'bg-red-600' },
  };
  return configs[workState] || configs.idle;
}

interface TaskCardProps {
  task: KanbanTask;
  onClick: (task: KanbanTask) => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const isDone = task.status === 'done';
  const workStateBadge = getWorkStateBadge(task.workState);

  return (
    <Card
      className={cn(
        'bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer p-3 border-l-4',
        getTaskBorderColor(task),
        isDone && 'opacity-70'
      )}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className={cn(
          "text-sm font-medium text-gray-800 line-clamp-2 flex-1",
          isDone && "line-through text-gray-500"
        )}>
          {task.isTeamTask && task.teamName && `团队${task.teamName}：`}
          {task.title}
        </h3>
        {task.workState !== 'idle' && (
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', workStateBadge.color)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', workStateBadge.dotColor)} />
            <span>{workStateBadge.label}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>{getPriorityLabel(task.priority)}</span>
        </div>
        {task.deadline && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(task.deadline).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

interface AgentCardProps {
  agent: AgentSummary;
  isTeam: boolean;
}

function AgentCard({ agent, isTeam }: AgentCardProps) {
  return (
    <Card
      className={cn(
        'bg-gray-50 rounded-lg p-3 border-l-4 flex flex-col items-center gap-2',
        getAgentBorderColor(isTeam)
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback className={cn(
          'text-sm font-semibold',
          isTeam ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
        )}>
          {agent.name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800">{agent.name}</p>
        <Badge
          variant="outline"
          className={cn(
            'text-xs px-2 py-0 mt-1',
            isTeam ? 'border-purple-400 text-purple-700 bg-purple-50' : 'border-cyan-400 text-cyan-700 bg-cyan-50'
          )}
        >
          {isTeam ? 'Team' : '员工'}
        </Badge>
      </div>
    </Card>
  );
}

interface AgentRowProps {
  agent: AgentSummary;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
}

function AgentRow({ agent, tasks, onTaskClick }: AgentRowProps) {
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, KanbanTask[]>();
    COLUMNS.forEach((col) => map.set(col.key, []));
    tasks.forEach((task) => {
      const list = map.get(task.status);
      if (list) list.push(task);
    });
    return map;
  }, [tasks]);

  const hasAnyTasks = tasks.length > 0;
  const isTeam = agent.teamRole === 'leader';

  return (
    <div className="flex gap-4 border-b border-border hover:bg-muted/20 transition-colors py-4">
      {/* Agent Info Card */}
      <div className="w-[140px] shrink-0">
        <AgentCard agent={agent} isTeam={isTeam} />
      </div>

      {/* Task Columns with Grid Layout */}
      <div className="flex-1 grid grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasksByStatus.get(col.key) || [];
          return (
            <div
              key={col.key}
              className="bg-slate-50/50 rounded-lg p-3 border-r border-border/50 last:border-r-0 min-h-[120px]"
            >
              {columnTasks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={onTaskClick} />
                  ))}
                </div>
              ) : (
                !hasAnyTasks && col.key === 'todo' && (
                  <div className="border-2 border-dashed border-muted bg-transparent rounded-lg flex items-center justify-center min-h-[80px]">
                    <p className="text-sm text-muted-foreground">空闲中</p>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskKanban() {
  const [searchParams, setSearchParams] = useSearchParams();
  const agents = useAgentsStore((s) => s.agents) || [];
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const tasks = useApprovalsStore((s) => s.tasks) || [];
  const fetchTasks = useApprovalsStore((s) => s.fetchTasks);
  const openPanel = useRightPanelStore((s) => s.openPanel);
  const [manualFormOpen, setManualFormOpen] = useState(false);

  const currentView = searchParams.get('view') || 'board';
  const selectedTaskId = searchParams.get('taskId');

  useEffect(() => {
    if (fetchAgents) fetchAgents();
    if (fetchTasks) fetchTasks();
  }, [fetchAgents, fetchTasks]);

  useEffect(() => {
    if (selectedTaskId) {
      openPanel('task', selectedTaskId);
    }
  }, [openPanel, selectedTaskId]);

  const tasksByAgent = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    if (Array.isArray(agents)) {
      agents.forEach((agent) => map.set(agent.id, []));
    }
    if (Array.isArray(tasks)) {
      tasks.forEach((task) => {
        if (task.assigneeId && map.has(task.assigneeId)) {
          map.get(task.assigneeId)!.push(task);
        }
      });
    }
    return map;
  }, [agents, tasks]);

  const inProgressCount = Array.isArray(tasks) ? tasks.filter((t) => t.status === 'in-progress').length : 0;

  const handleTaskClick = (task: KanbanTask) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('taskId', task.id);
    nextParams.set('view', currentView);
    setSearchParams(nextParams);
    openPanel('task', task.id);
  };

  const handleViewChange = (view: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', view);
    setSearchParams(nextParams);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-semibold">任务看板</h1>
          <p className="text-sm text-gray-500">{inProgressCount} 个进行中的任务</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManualFormOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          创建任务
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={currentView} onValueChange={handleViewChange} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-3 bg-white">
          <TabsList>
            <TabsTrigger value="board">看板</TabsTrigger>
            <TabsTrigger value="calendar">日程</TabsTrigger>
          </TabsList>
        </div>

        {/* Board View */}
        <TabsContent value="board" className="flex-1 overflow-auto m-0 p-4">
          {/* Column Headers with Grid */}
          <div className="flex gap-4 mb-3">
            <div className="w-[140px] shrink-0" />
            <div className="flex-1 grid grid-cols-4 gap-4">
              {COLUMNS.map((col) => (
                <div key={col.key} className="px-3">
                  <h2 className="text-sm font-bold text-gray-800">{col.label}</h2>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Rows */}
          <div className="space-y-0">
            {Array.isArray(agents) && agents.length > 0 ? (
              agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  tasks={tasksByAgent.get(agent.id) || []}
                  onTaskClick={handleTaskClick}
                />
              ))
            ) : (
              <div className="text-center py-16 text-gray-400">
                <p className="text-base">暂无 Agent</p>
                <p className="text-sm mt-2">在员工广场创建 Agent 后显示</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="flex-1 overflow-auto m-0">
          <CalendarView onTaskClick={(taskId) => {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('taskId', taskId);
            nextParams.set('view', 'calendar');
            setSearchParams(nextParams);
            openPanel('task', taskId);
          }}
          />
        </TabsContent>
      </Tabs>

      <ManualTaskForm open={manualFormOpen} onOpenChange={setManualFormOpen} />
    </div>
  );
}

export default TaskKanban;
