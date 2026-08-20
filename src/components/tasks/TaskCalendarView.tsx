// src/components/tasks/TaskCalendarView.tsx
//
// The Calendar view, built by REUSING the existing calendar grid rather than
// growing a second one.
//
// `MonthView` (+ DayCell + EventChip) is pure presentation: props in, grid out,
// no store, no fetching, no permission checks. And `CalendarEvent` already
// models `source: 'task'` with a `task` colour key, so conforming to that
// envelope is the intended path, not a workaround. `CalendarShell` is NOT
// reused -- it is bound to useCalendarStore and hard-codes meeting-only open
// semantics (`if (event.source !== 'meeting') return`).
//
// All that is needed is a ~15-line Task -> CalendarEvent adapter and the small
// DndContext wrapper the grid expects.

import { useMemo, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import { addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonthView } from '@/components/calendar/MonthView';
import { toZoned } from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import type { Task } from '@/types/crmTypes';
import { taskToCalendarEvent } from './taskCalendarAdapter';

export interface TaskCalendarViewProps {
  tasks: Task[];
  timeZone: string;
  onOpenTask: (task: Task) => void;
  onCreateOnDay?: (zonedDay: Date) => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  timeZone,
  onOpenTask,
  onCreateOnDay,
}) => {
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const { events, byId } = useMemo(() => {
    const list: CalendarEvent[] = [];
    const map = new Map<string, Task>();
    for (const task of tasks) {
      const event = taskToCalendarEvent(task, timeZone);
      if (!event) continue;
      list.push(event);
      map.set(event.id, task);
    }
    return { events: list, byId: map };
  }, [tasks, timeZone]);

  const undatedCount = tasks.length - events.length;

  const monthLabel = toZoned(anchorDate, timeZone).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex h-full flex-col" data-testid="task-calendar">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Previous month"
          onClick={() => setAnchorDate((d) => subMonths(d, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Next month"
          onClick={() => setAnchorDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setAnchorDate(new Date())}
        >
          Today
        </Button>
        <div className="flex-1" />
        {undatedCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {undatedCount} undated {undatedCount === 1 ? 'task is' : 'tasks are'} not shown here
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* DayCell/EventChip call useDroppable/useDraggable, so the grid has to
            sit inside a DndContext even though tasks are not dragged here. */}
        <DndContext>
          <MonthView
            anchorDate={anchorDate}
            events={events}
            timezone={timeZone}
            onOpenEvent={(event) => {
              const task = byId.get(event.id);
              if (task) onOpenTask(task);
            }}
            onCreateOnDay={onCreateOnDay}
          />
        </DndContext>
      </div>
    </div>
  );
};

export default TaskCalendarView;
