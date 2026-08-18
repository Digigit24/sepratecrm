// src/components/calendar/AgendaView.tsx
import { useMemo } from 'react';
import { isToday, isTomorrow } from 'date-fns';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEventColor } from '@/lib/calendarColors';
import { sortEventsForDisplay } from '@/utils/calendarLayout';
import {
  formatEventTimeRange,
  formatInZone,
  fromZoned,
  getEventDayKeys,
  toZoned,
} from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { CalendarEmptyState } from './CalendarEmptyState';

interface AgendaViewProps {
  events: CalendarEvent[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  colorMode?: 'type' | 'person';
  colorIndexByUser?: Record<string, number>;
  onOpenEvent?: (event: CalendarEvent) => void;
  onLoadMore?: () => void;
}

/**
 * Flat chronological list grouped by day, with sticky day headers. This is the
 * density that works on mobile, and it is where the optional `activities` layer
 * surfaces (past facts do not belong in a grid of appointments).
 */
export function AgendaView({
  events,
  timezone,
  timeFormat = '12h',
  colorMode = 'type',
  colorIndexByUser,
  onOpenEvent,
  onLoadMore,
}: AgendaViewProps) {
  const groups = useMemo(() => {
    const byDay = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      // An event is listed once per day it covers, like Google Calendar's agenda.
      for (const key of getEventDayKeys(event, timezone)) {
        const list = byDay.get(key) ?? [];
        list.push(event);
        byDay.set(key, list);
      }
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, dayEvents]) => ({ dayKey, events: sortEventsForDisplay(dayEvents) }));
  }, [events, timezone]);

  if (!groups.length) {
    return (
      <CalendarEmptyState
        title="Nothing on the agenda"
        description="No meetings, tasks or follow-ups fall in this range."
      />
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-4 p-4">
        {groups.map((group) => {
          // Reconstruct a zoned date from the key so labels use the right zone.
          const zonedDay = toZoned(new Date(`${group.dayKey}T12:00:00Z`), timezone);
          const heading = isToday(zonedDay)
            ? 'Today'
            : isTomorrow(zonedDay)
              ? 'Tomorrow'
              : formatInZone(fromZoned(zonedDay, timezone), timezone, 'EEEE, d MMM');

          return (
            <section key={group.dayKey} className="space-y-1.5">
              <h3 className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur">
                {heading}
              </h3>

              <ul className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/60">
                {group.events.map((event) => {
                  const color = getEventColor(event, colorMode, colorIndexByUser);
                  const redacted = !!event.redacted;
                  return (
                    <li key={`${group.dayKey}:${event.id}`}>
                      <button
                        type="button"
                        disabled={redacted}
                        onClick={() => !redacted && onOpenEvent?.(event)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                          redacted ? 'cursor-default' : 'hover:bg-muted/50'
                        )}
                      >
                        <span className={cn('h-8 w-1 flex-shrink-0 rounded-full', color.bar)} />
                        <div className="w-28 flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                          {event.all_day
                            ? 'All day'
                            : formatEventTimeRange(event, timezone, timeFormat)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {redacted ? (
                              <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            ) : null}
                            <span className="truncate text-sm font-medium text-foreground">
                              {event.title}
                            </span>
                          </div>
                          {!redacted && (event.lead || event.location || event.owner_name) ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {[event.owner_name, event.lead?.name, event.location]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

        {onLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="w-full rounded-md border border-border/60 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default AgendaView;
