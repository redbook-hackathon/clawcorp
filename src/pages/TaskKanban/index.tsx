/**
 * Task Kanban Page - Command Center + Soft Apple Design
 * 指挥中枢: 实时监控全局效率、协同调度与人机交互闭环
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
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
import {
  Plus, Calendar, AlertCircle, Zap, CheckCircle2, Clock, Ban, TrendingUp,
  Users, MessageSquare, ArrowRight
} from 'lucide-react';
import { ManualTaskForm } from './ManualTaskForm';
import { CalendarView } from './CalendarView';

// ── Design Tokens (Soft Apple) ────────────────────────────────────────────────

const T = {
  // Colors
  bg: '#f5f5f7',
  card: '#ffffff',
  cardHover: '#fafafa',
  muted: '#6b6f76',
  border: 'rgba(17,24,39,0.08)',
  text: '#1d1d1f',
  textSecondary: '#6b6f76',

  // Status colors
  blue: '#0059b4',
  blueSoft: 'rgba(0,89,180,0.08)',
  green: '#1d7435',
  greenSoft: 'rgba(29,116,53,0.08)',
  amber: '#94680e',
  amberSoft: 'rgba(148,104,14,0.08)',
  red: '#b53125',
  redSoft: 'rgba(181,49,37,0.08)',
  gray: '#666a70',
  graySoft: 'rgba(102,106,112,0.08)',

  // Kanban column colors
  todoBorder: '#8b5cf6',      // violet
  inProgressBorder: '#0891b2', // cyan
  reviewBorder: '#ea580c',     // orange
  doneBorder: '#6b7280',       // gray

  // Shadows
  shadowCard: '0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
  shadowCardHover: '0 8px 20px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)',
  shadowStat: '0 1px 3px rgba(15,23,42,0.05)',
};

const COLUMNS: { key: TaskStatus; label: string; sublabel: string }[] = [
  { key: 'todo', label: '待办', sublabel: 'Ready' },
  { key: 'in-progress', label: '进行中', sublabel: 'Active' },
  { key: 'review', label: '审查', sublabel: 'Review' },
  { key: 'done', label: '完成', sublabel: 'Done' },
];

// ── Filter Types ───────────────────────────────────────────────────────────────

type FilterChip = 'all' | 'attention' | 'todo' | 'in-progress' | 'review' | 'done';

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'attention', label: '需关注' },
  { key: 'todo', label: '待办' },
  { key: 'in-progress', label: '进行中' },
  { key: 'review', label: '审查' },
  { key: 'done', label: '完成' },
];

// ── Helper Functions ────────────────────────────────────────────────────────────

function getTaskBorderColor(task: KanbanTask): string {
  if (task.status === 'todo') return 'border-l-violet-500';
  if (task.status === 'in-progress') return 'border-l-cyan-600';
  if (task.status === 'review') return 'border-l-orange-500';
  if (task.status === 'done') return 'border-l-gray-400';
  return 'border-l-gray-300';
}

function getAgentBorderColor(isTeam: boolean): string {
  return isTeam ? 'border-l-violet-500' : 'border-l-cyan-600';
}

function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = { low: '低', medium: '中', high: '高' };
  return labels[priority];
}

function getWorkStateBadge(workState: WorkState) {
  const configs: Record<WorkState, { label: string; color: string; dotColor: string; soft: string }> = {
    idle: { label: '空闲', color: 'text-gray-500', dotColor: 'bg-gray-400', soft: 'bg-gray-50' },
    starting: { label: '启动中', color: 'text-blue-600', dotColor: 'bg-blue-400', soft: 'bg-blue-50' },
    working: { label: '工作中', color: 'text-blue-700', dotColor: 'bg-blue-500', soft: 'bg-blue-50' },
    blocked: { label: '阻塞', color: 'text-red-600', dotColor: 'bg-red-500', soft: 'bg-red-50' },
    waiting_approval: { label: '待审批', color: 'text-amber-600', dotColor: 'bg-amber-500', soft: 'bg-amber-50' },
    scheduled: { label: '已排期', color: 'text-purple-600', dotColor: 'bg-purple-500', soft: 'bg-purple-50' },
    done: { label: '完成', color: 'text-green-600', dotColor: 'bg-green-500', soft: 'bg-green-50' },
    failed: { label: '失败', color: 'text-red-600', dotColor: 'bg-red-600', soft: 'bg-red-50' },
  };
  return configs[workState] || configs.idle;
}

// ── Command Center Stats ────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  sublabel: string;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'gray';
  trend?: string;
}

function StatCard({ icon, value, label, sublabel, tone, trend }: StatCardProps) {
  const colors = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', dot: 'bg-blue-500', label: 'text-blue-800' },
    green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-600', dot: 'bg-green-500', label: 'text-green-800' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', dot: 'bg-amber-500', label: 'text-amber-800' },
    red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', dot: 'bg-red-500', label: 'text-red-800' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'text-gray-600' },
  };
  const c = colors[tone];

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 flex items-start gap-3',
        'bg-white shadow-sm hover:shadow-md transition-all cursor-pointer',
        c.bg, c.border
      )}
    >
      <div className={cn('shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', c.bg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-2xl font-semibold tabular-nums', c.text)}>{value}</span>
          {trend && (
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          )}
        </div>
        <p className={cn('text-sm font-medium mt-0.5', c.label)}>{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

interface CommandCenterProps {
  tasks: KanbanTask[];
  agents: AgentSummary[];
  onFilterChange: (filter: FilterChip) => void;
  activeFilter: FilterChip;
  onRefresh: () => void;
  lastRefresh: number;
}

function CommandCenter({ tasks, agents, onFilterChange, activeFilter, onRefresh, lastRefresh }: CommandCenterProps) {
  // Compute aggregates
  const counts = useMemo(() => {
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const review = tasks.filter((t) => t.status === 'review').length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const blocked = tasks.filter((t) => t.workState === 'blocked').length;
    const waiting = tasks.filter((t) => t.workState === 'waiting_approval').length;
    const working = tasks.filter((t) => t.workState === 'working' || t.workState === 'starting').length;
    const failed = tasks.filter((t) => t.workState === 'failed').length;
    const attention = blocked + waiting + failed;

    // Active sessions: tasks with a runtime session linked
    const activeSessions = tasks.filter((t) => t.runtimeSessionId || t.runtimeSessionKey).length;

    // Efficiency: done / total (%)
    const total = tasks.length;
    const efficiency = total > 0 ? Math.round((done / total) * 100) : 0;

    // Team workload: agents with in-progress tasks
    const activeAgents = new Set(
      tasks.filter((t) => t.status === 'in-progress' && t.assigneeId).map((t) => t.assigneeId)
    ).size;

    return { todo, inProgress, review, done, blocked, waiting, working, failed, attention, activeSessions, efficiency, total, activeAgents };
  }, [tasks]);

  const timeSinceRefresh = useMemo(() => {
    const secs = Math.floor((Date.now() - lastRefresh) / 1000);
    if (secs < 5) return '刚刚';
    if (secs < 60) return `${secs}秒前`;
    return `${Math.floor(secs / 60)}分钟前`;
  }, [lastRefresh]);

  return (
    <div className="space-y-4">
      {/* Title Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">指挥中枢</h1>
            <p className="text-xs text-gray-400">实时监控 · 协同调度 · 人机交互闭环</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {timeSinceRefresh}刷新
        </button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Clock className={cn('h-5 w-5', counts.inProgress > 0 ? 'text-cyan-600' : 'text-gray-400')} />}
          value={counts.inProgress}
          label="进行中"
          sublabel={`${counts.working} 工作中 · ${counts.activeAgents} 个 Agent`}
          tone={counts.inProgress > 0 ? 'blue' : 'gray'}
        />
        <StatCard
          icon={<CheckCircle2 className={cn('h-5 w-5', counts.done > 0 ? 'text-green-600' : 'text-gray-400')} />}
          value={counts.done}
          label="已完成"
          sublabel={`占总任务 ${counts.efficiency}%`}
          tone={counts.done > 0 ? 'green' : 'gray'}
        />
        <StatCard
          icon={<Ban className={cn('h-5 w-5', counts.attention > 0 ? 'text-red-600' : 'text-gray-400')} />}
          value={counts.attention}
          label="需关注"
          sublabel={`阻塞 ${counts.blocked} · 待审批 ${counts.waiting} · 失败 ${counts.failed}`}
          tone={counts.attention > 0 ? 'red' : 'gray'}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
          value={counts.efficiency}
          label="全局效率"
          sublabel={`${counts.done}/${counts.total} 任务完成率`}
          tone="amber"
          trend={`${counts.activeSessions} 个活跃会话`}
        />
      </div>

      {/* Second Row: Quick Filters + Team Overview */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 bg-white rounded-full border border-gray-200 p-1">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => onFilterChange(chip.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                activeFilter === chip.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {chip.label}
              {chip.key !== 'all' && chip.key !== 'attention' && (
                <span className="ml-1 opacity-60">
                  {chip.key === 'todo' ? counts.todo :
                   chip.key === 'in-progress' ? counts.inProgress :
                   chip.key === 'review' ? counts.review :
                   counts.done}
                </span>
              )}
              {chip.key === 'attention' && counts.attention > 0 && (
                <span className="ml-1 text-red-400">{counts.attention}</span>
              )}
            </button>
          ))}
        </div>

        {/* Team Workload Pills */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <Users className="h-3.5 w-3.5" />
              <span>团队负载</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {agents.slice(0, 8).map((agent) => {
                const agentTasks = tasks.filter((t) => t.assigneeId === agent.id);
                const active = agentTasks.filter((t) => t.status === 'in-progress').length;
                const isTeam = agent.teamRole === 'leader';
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                      active > 0 ? (isTeam ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-cyan-50 text-cyan-700 border border-cyan-100')
                        : 'bg-gray-50 text-gray-500 border border-gray-100'
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                    {agent.name}
                    {active > 0 && <span className="text-[10px] opacity-60">{active}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: KanbanTask;
  onClick: (task: KanbanTask) => void;
  compact?: boolean;
}

function TaskCard({ task, onClick, compact = false }: TaskCardProps) {
  const isDone = task.status === 'done';
  const workStateBadge = getWorkStateBadge(task.workState);
  const hasExecution = Boolean(task.runtimeSessionId || task.runtimeSessionKey);

  return (
    <div
      className={cn(
        'group rounded-xl cursor-pointer transition-all',
        'bg-white border border-gray-100 shadow-sm',
        'hover:shadow-md hover:-translate-y-0.5',
        'border-l-4',
        getTaskBorderColor(task),
        isDone && 'opacity-60',
        compact ? 'p-2.5' : 'p-3'
      )}
      onClick={() => onClick(task)}
    >
      {/* Execution indicator dot */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            className={cn(
              'shrink-0 w-1.5 h-1.5 rounded-full mt-1',
              hasExecution ? 'bg-green-400' : 'bg-gray-300'
            )}
            title={hasExecution ? '已关联执行会话' : '尚未关联会话'}
          />
          <h3 className={cn(
            'text-sm font-medium line-clamp-2 flex-1',
            isDone ? 'line-through text-gray-400' : 'text-gray-800'
          )}>
            {task.isTeamTask && task.teamName && (
              <span className="text-violet-600 font-medium">{task.teamName}：</span>
            )}
            {task.title}
          </h3>
        </div>
        {task.workState !== 'idle' && !compact && (
          <div className={cn(
            'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
            workStateBadge.soft, workStateBadge.color
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', workStateBadge.dotColor)} />
            <span>{workStateBadge.label}</span>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex items-center gap-2.5 text-[11px] text-gray-400 mt-1.5 ml-3.5">
          <div className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span className={cn(
              task.priority === 'high' ? 'text-red-500' :
              task.priority === 'medium' ? 'text-amber-500' : 'text-gray-400'
            )}>
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          {task.deadline && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.deadline).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>
            </div>
          )}
          {hasExecution && (
            <div className="flex items-center gap-1 text-green-500">
              <MessageSquare className="h-3 w-3" />
              <span>会话</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentSummary;
  isTeam: boolean;
  taskCount: number;
  activeCount: number;
}

function AgentCard({ agent, isTeam, taskCount, activeCount }: AgentCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-3 flex flex-col items-center gap-2',
        'bg-white border border-gray-100 shadow-sm',
        'border-l-4',
        getAgentBorderColor(isTeam)
      )}
    >
      <Avatar className="h-11 w-11">
        {agent.avatar ? (
          <img src={agent.avatar} alt="" className="object-cover rounded-full" />
        ) : (
          <AvatarFallback className={cn(
            'text-sm font-semibold',
            isTeam ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'
          )}>
            {agent.name.slice(0, 2)}
          </AvatarFallback>
        )}
      </Avatar>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-800 truncate max-w-[100px]">{agent.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0',
              isTeam ? 'border-violet-300 text-violet-700 bg-violet-50' : 'border-cyan-300 text-cyan-700 bg-cyan-50'
            )}
          >
            {isTeam ? 'Team' : '员工'}
          </Badge>
          {taskCount > 0 && (
            <span className={cn(
              'text-[10px] px-1.5 py-0 rounded-full',
              activeCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
            )}>
              {activeCount}/{taskCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Agent Row ──────────────────────────────────────────────────────────────────

interface AgentRowProps {
  agent: AgentSummary;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  visibleColumns: TaskStatus[];
}

function AgentRow({ agent, tasks, onTaskClick, visibleColumns }: AgentRowProps) {
  const tasksByStatus = useMemo(() => {
    const map = new Map<TaskStatus, KanbanTask[]>();
    visibleColumns.forEach((col) => map.set(col, []));
    tasks.forEach((task) => {
      const list = map.get(task.status);
      if (list) list.push(task);
    });
    return map;
  }, [tasks, visibleColumns]);

  const hasAnyTasks = tasks.length > 0;
  const isTeam = agent.teamRole === 'leader';
  const activeCount = tasks.filter((t) => t.status === 'in-progress').length;

  const colWidthClass = visibleColumns.length === 4 ? 'grid-cols-4'
    : visibleColumns.length === 3 ? 'grid-cols-3'
    : visibleColumns.length === 2 ? 'grid-cols-2'
    : 'grid-cols-1';

  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
      {/* Agent Info Card */}
      <div className="w-[120px] shrink-0">
        <AgentCard
          agent={agent}
          isTeam={isTeam}
          taskCount={tasks.length}
          activeCount={activeCount}
        />
      </div>

      {/* Task Columns */}
      <div className={cn('flex-1 grid gap-3', colWidthClass)}>
        {visibleColumns.map((colKey) => {
          const col = COLUMNS.find((c) => c.key === colKey)!;
          const columnTasks = tasksByStatus.get(colKey) || [];
          return (
            <div
              key={colKey}
              className="rounded-xl p-3 bg-gray-50/70 border border-gray-100/50 min-h-[100px]"
            >
              {/* Column header */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  colKey === 'todo' ? 'bg-violet-400' :
                  colKey === 'in-progress' ? 'bg-cyan-500' :
                  colKey === 'review' ? 'bg-orange-400' : 'bg-gray-400'
                )} />
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {col.label}
                </h3>
                {columnTasks.length > 0 && (
                  <span className="text-[10px] text-gray-400 ml-auto">{columnTasks.length}</span>
                )}
              </div>

              {/* Task cards */}
              {columnTasks.length > 0 ? (
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} onClick={onTaskClick} compact />
                  ))}
                </div>
              ) : (
                <div className="h-8 flex items-center justify-center">
                  <span className="text-[11px] text-gray-300">空闲</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mb-4">
        <CheckCircle2 className="h-8 w-8 text-gray-300" />
      </div>
      <p className="text-base font-medium text-gray-400">暂无任务</p>
      <p className="text-sm text-gray-300 mt-1">在左侧创建任务，或在对话中让 Agent 发起</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function TaskKanban() {
  const [searchParams, setSearchParams] = useSearchParams();
  const agents = useAgentsStore((s) => s.agents) || [];
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const tasks = useApprovalsStore((s) => s.tasks) || [];
  const fetchTasks = useApprovalsStore((s) => s.fetchTasks);
  const openPanel = useRightPanelStore((s) => s.openPanel);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const currentView = searchParams.get('view') || 'board';
  const selectedTaskId = searchParams.get('taskId');

  // Initial fetch
  useEffect(() => {
    void fetchAgents();
    void fetchTasks();
    setLastRefresh(Date.now());
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchTasks();
      void fetchAgents();
      setLastRefresh(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks, fetchAgents]);

  // Open detail panel when taskId changes from URL
  useEffect(() => {
    if (selectedTaskId) {
      openPanel('task', selectedTaskId);
    }
  }, [openPanel, selectedTaskId]);

  // Compute visible columns based on filter
  const visibleColumns = useMemo((): TaskStatus[] => {
    if (activeFilter === 'all' || activeFilter === 'attention') return COLUMNS.map((c) => c.key);
    return [activeFilter as TaskStatus];
  }, [activeFilter]);

  // Filter tasks by active filter
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') return tasks;
    if (activeFilter === 'attention') {
      return tasks.filter((t) => ['blocked', 'waiting_approval', 'failed'].includes(t.workState));
    }
    return tasks.filter((t) => t.status === activeFilter);
  }, [tasks, activeFilter]);

  // Group tasks by agent
  const tasksByAgent = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    if (Array.isArray(agents)) {
      agents.forEach((agent) => map.set(agent.id, []));
    }
    if (Array.isArray(filteredTasks)) {
      filteredTasks.forEach((task) => {
        if (task.assigneeId && map.has(task.assigneeId)) {
          map.get(task.assigneeId)!.push(task);
        }
      });
    }
    return map;
  }, [agents, filteredTasks]);

  // Agents with visible tasks
  const visibleAgents = useMemo(() => {
    if (activeFilter === 'all' || activeFilter === 'attention') return agents;
    return agents.filter((agent) => (tasksByAgent.get(agent.id)?.length ?? 0) > 0);
  }, [agents, tasksByAgent, activeFilter]);

  const handleTaskClick = useCallback((task: KanbanTask) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('taskId', task.id);
    nextParams.set('view', currentView);
    setSearchParams(nextParams);
    openPanel('task', task.id);
  }, [searchParams, currentView, setSearchParams, openPanel]);

  const handleViewChange = useCallback((view: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', view);
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const handleRefresh = useCallback(() => {
    void fetchTasks();
    void fetchAgents();
    setLastRefresh(Date.now());
  }, [fetchTasks, fetchAgents]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: T.bg }}>
      {/* Page Header: Command Center */}
      <div className="px-6 pt-5 pb-4 bg-white border-b border-gray-100">
        <CommandCenter
          tasks={tasks}
          agents={agents}
          onFilterChange={setActiveFilter}
          activeFilter={activeFilter}
          onRefresh={handleRefresh}
          lastRefresh={lastRefresh}
        />
      </div>

      {/* View Tabs */}
      <div className="bg-white px-6 pt-3">
        <Tabs value={currentView} onValueChange={handleViewChange} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="board">看板</TabsTrigger>
              <TabsTrigger value="calendar">日程</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManualFormOpen(true)}
              className="gap-2 h-8 rounded-full px-4 text-xs font-medium border-gray-200"
            >
              <Plus className="h-3.5 w-3.5" />
              创建任务
            </Button>
          </div>

          {/* Board View */}
          <TabsContent value="board" className="flex-1 overflow-auto m-0">
            {visibleAgents.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="px-6 py-4 space-y-0">
                {visibleAgents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    tasks={tasksByAgent.get(agent.id) || []}
                    onTaskClick={handleTaskClick}
                    visibleColumns={visibleColumns}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Calendar View */}
          <TabsContent value="calendar" className="flex-1 overflow-auto m-0">
            <CalendarView
              onTaskClick={(taskId) => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('taskId', taskId);
                nextParams.set('view', 'calendar');
                setSearchParams(nextParams);
                openPanel('task', taskId);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ManualTaskForm open={manualFormOpen} onOpenChange={setManualFormOpen} />
    </div>
  );
}

export default TaskKanban;
