/**
 * CalendarView component for Task Kanban
 * Phase 02 - Completely custom header with Shadcn components
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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

type CalendarViewType = 'timeGridWeek' | 'dayGridMonth';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [calendarHeight, setCalendarHeight] = useState(600);
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentView, setCurrentView] = useState<CalendarViewType>('dayGridMonth');
  const [initialized, setInitialized] = useState(false);

  const tasks = useApprovalsStore((s) => s.tasks);
  const agents = useAgentsStore((s) => s.agents);

  // Measure container height dynamically
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const height = Math.max(rect.height - 180, 300); // minus header height
        setCalendarHeight(height);
      }
    };

    measure();
    // Re-measure on resize
    const ro = new ResizeObserver(measure);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
  }, []);

  // Mark initialized after first render
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      // Set initial title
      const api = calendarRef.current?.getApi();
      if (api) setCurrentTitle(api.view.title);
    }
  }, [initialized]);

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

  const handleViewChange = (view: CalendarViewType) => {
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

  // Use dayGridMonth as the "year view" fallback - shows monthly overview
  return (
    <div ref={containerRef} className="flex flex-col h-full p-6 min-h-0">
      {/* Custom Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
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
        <Tabs value={currentView} onValueChange={(v) => handleViewChange(v as CalendarViewType)}>
          <TabsList>
            <TabsTrigger value="timeGridWeek">周视图</TabsTrigger>
            <TabsTrigger value="dayGridMonth">月视图</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0 calendar-container border rounded-xl shadow-sm bg-card overflow-hidden">
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
          height={calendarHeight}
          locale="zh-cn"
          dayMaxEvents={3}
          moreLinkText="更多"
        />
      </div>
    </div>
  );
}
