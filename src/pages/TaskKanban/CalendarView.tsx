/**
 * CalendarView component for Task Kanban
 * Phase 02 - Completely custom header with Shadcn components
 */
import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import type { EventInput, EventContentArg } from '@fullcalendar/core';
import type { WorkState, TaskStatus } from '@/types/task';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './calendar-custom.css';

interface CalendarViewProps {
  onTaskClick?: (taskId: string) => void;
}

function getStatusDotColor(status: TaskStatus, workState: WorkState) {
  if (workState === 'working') return 'bg-blue-500';
  if (workState === 'done') return 'bg-green-500';
  if (status === 'review') return 'bg-orange-500';
  if (status === 'in-progress') return 'bg-cyan-500';
  return 'bg-gray-400';
}

function renderEventContent(eventInfo: EventContentArg) {
  const { event } = eventInfo;
  const isTeamTask = event.extendedProps.isTeamTask;
  const status = event.extendedProps.status as TaskStatus;
  const workState = event.extendedProps.workState as WorkState || 'idle';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 w-full overflow-hidden px-1.5 py-0.5 rounded-md text-xs border shadow-sm hover:shadow-md transition-shadow cursor-pointer font-medium',
        isTeamTask
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', getStatusDotColor(status, workState))} />
      <span className="truncate">{event.title}</span>
    </div>
  );
}

export function CalendarView({ onTaskClick }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentView, setCurrentView] = useState<'timeGridWeek' | 'dayGridMonth' | 'dayGridYear'>('dayGridMonth');

  const tasks = useApprovalsStore((s) => s.tasks);
  const agents = useAgentsStore((s) => s.agents);

  // Filter tasks with deadlines and convert to calendar events
  const events = useMemo<EventInput[]>(() => {
    return tasks
      .filter((task) => task.deadline)
      .map((task) => {
        const agent = agents.find((a) => a.id === task.assigneeId);
        return {
          id: task.id,
          title: task.isTeamTask ? `团队${task.teamName}：${task.title}` : task.title,
          start: task.deadline,
          allDay: true,
          extendedProps: {
            taskId: task.id,
            assigneeName: agent?.name ?? '未分配',
            priority: task.priority,
            status: task.status,
            workState: task.workState,
            isTeamTask: task.isTeamTask,
          },
        };
      });
  }, [tasks, agents]);

  const handlePrev = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.prev();
      setCurrentTitle(api.view.title);
    }
  };

  const handleNext = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.next();
      setCurrentTitle(api.view.title);
    }
  };

  const handleToday = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.today();
      setCurrentTitle(api.view.title);
    }
  };

  const handleViewChange = (view: 'timeGridWeek' | 'dayGridMonth' | 'dayGridYear') => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView(view);
      setCurrentView(view);
      setCurrentTitle(api.view.title);
    }
  };

  const handleDatesSet = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      setCurrentTitle(api.view.title);
    }
  };

  // Empty state
  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500">暂无排期任务</p>
          <p className="text-sm text-gray-400 mt-2">
            为任务设置截止日期后,将在日程视图中显示
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Custom Header */}
      <div className="flex items-center justify-between mb-6">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToday} className="ml-2">
            今天
          </Button>
        </div>

        {/* Center: Title */}
        <h2 className="text-lg font-semibold tracking-tight">{currentTitle}</h2>

        {/* Right: View Switcher */}
        <Tabs value={currentView} onValueChange={(v) => handleViewChange(v as any)}>
          <TabsList>
            <TabsTrigger value="timeGridWeek">周视图</TabsTrigger>
            <TabsTrigger value="dayGridMonth">月视图</TabsTrigger>
            <TabsTrigger value="dayGridYear">年视图</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar */}
      <div className="flex-1 calendar-container border rounded-xl shadow-sm bg-card overflow-hidden">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={false}
          events={events}
          eventContent={renderEventContent}
          eventClick={(info) => {
            if (onTaskClick) {
              onTaskClick(info.event.id);
            }
          }}
          datesSet={handleDatesSet}
          height="100%"
          locale="zh-cn"
          dayMaxEvents={3}
          moreLinkText="更多"
        />
      </div>
    </div>
  );
}
