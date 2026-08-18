// src/components/calendar/TeamLaneView.tsx
import { useMemo } from 'react';
import { startOfDay } from 'date-fns';
import { memberColor } from '@/lib/calendarColors';
import {
  dayKeyOfZoned,
  getEventDayKeys,
  toZoned,
} from '@/utils/calendarTime';
import type { CalendarEvent, CalendarMember } from '@/types/calendar.types';
import { EventChip } from './EventChip';
import { CalendarEmptyState } from './CalendarEmptyState';
import { TimeGrid, type TimeGridLane } from './TimeGrid';

interface TeamLaneViewProps {
  anchorDate: Date;
  events: CalendarEvent[];
  members: CalendarMember[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  pxPerHour: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onCreateAt?: (zonedDay: Date, minutesOfDay: number, ownerUserId?: string | null) => void;
}

/** Beyond this many lanes the columns are unreadable; the toolbar forces Overlay. */
export const MAX_LANES = 8;

/**
 * The admin team calendar in "Lanes" mode: one column per selected person for a
 * single day. Colour switches from type to person here; the event's TYPE is
 * still visible as the 2px left stripe on each block.
 *
 * Dropping a block into another person's lane reassigns `owner_user_id` — but
 * only when the SERVER said `can_edit` on that event. The client never
 * re-derives scope for a team row, because it does not know another user's
 * ownership graph.
 */
export function TeamLaneView({
  anchorDate,
  events,
  members,
  timezone,
  timeFormat = '12h',
  pxPerHour,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
  colorIndexByUser,
  onOpenEvent,
  onCreateAt,
}: TeamLaneViewProps) {
  const zonedDay = useMemo(
    () => startOfDay(toZoned(anchorDate, timezone)),
    [anchorDate, timezone]
  );
  const dayKey = dayKeyOfZoned(zonedDay);

  const visibleMembers = members.slice(0, MAX_LANES);

  const dayEvents = useMemo(
    () => events.filter((e) => getEventDayKeys(e, timezone).includes(dayKey)),
    [events, timezone, dayKey]
  );

  const lanes: TimeGridLane[] = useMemo(
    () =>
      visibleMembers.map((member) => ({
        key: member.user_id,
        zonedDay,
        primaryLabel: member.is_self ? `${member.name} (me)` : member.name,
        swatchClassName: memberColor(member.color_index).bar,
        ownerUserId: member.user_id,
        events: dayEvents.filter(
          (e) => !e.all_day && String(e.owner_user_id ?? '') === String(member.user_id)
        ),
      })),
    [visibleMembers, zonedDay, dayEvents]
  );

  if (!lanes.length) {
    return (
      <CalendarEmptyState
        title="No team members selected"
        description="Pick people in the left rail to see their day side by side."
      />
    );
  }

  return (
    <TimeGrid
      lanes={lanes}
      timezone={timezone}
      timeFormat={timeFormat}
      pxPerHour={pxPerHour}
      workingHoursStart={workingHoursStart}
      workingHoursEnd={workingHoursEnd}
      workingDays={workingDays}
      colorMode="person"
      colorIndexByUser={colorIndexByUser}
      onOpenEvent={onOpenEvent}
      onCreateAt={onCreateAt}
      headerExtra={
        /*
         * The all-day lane is per PERSON here, not per date, so
         * `AllDayRow`'s day-key spanning maths does not apply — every column
         * is the same date. A simple per-lane chip stack is the correct
         * rendering for this mode.
         */
        <div className="flex flex-shrink-0 border-b border-border/60 bg-background">
          <div className="flex flex-shrink-0 items-start justify-end pr-2 pt-1" style={{ width: 56 }}>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              All day
            </span>
          </div>
          {visibleMembers.map((member) => (
            <div
              key={member.user_id}
              className="min-w-0 flex-1 space-y-0.5 border-l border-border/60 p-1"
            >
              {dayEvents
                .filter(
                  (e) => e.all_day && String(e.owner_user_id ?? '') === String(member.user_id)
                )
                .map((event) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    timezone={timezone}
                    timeFormat={timeFormat}
                    colorMode="person"
                    colorIndexByUser={colorIndexByUser}
                    variant="allday"
                    onOpen={onOpenEvent}
                  />
                ))}
            </div>
          ))}
        </div>
      }
    />
  );
}

export default TeamLaneView;
