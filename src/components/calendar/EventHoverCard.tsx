// src/components/calendar/EventHoverCard.tsx
import type { ReactNode } from 'react';
import { Building2, Clock, Link2, MapPin, Repeat, User } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { CALENDAR_COLORS, resolveColorKey } from '@/lib/calendarColors';
import { formatEventTimeRange } from '@/utils/calendarTime';
import type { CalendarEvent } from '@/types/calendar.types';
import { AttendeeResponseBadge } from './AttendeeResponseBadge';

interface EventHoverCardProps {
  event: CalendarEvent;
  timezone: string;
  timeFormat?: '12h' | '24h';
  children: ReactNode;
}

/**
 * Hover preview for a chip or block.
 *
 * This component is NEVER rendered for a redacted event — `EventChip` and
 * `EventBlock` return the bare element in that case. The extra guard below is
 * belt-and-braces: a private event must not leak its title/description/location
 * through a tooltip, which is the easiest place for such a leak to hide.
 */
export function EventHoverCard({
  event,
  timezone,
  timeFormat = '12h',
  children,
}: EventHoverCardProps) {
  if (event.redacted) return <>{children}</>;

  const color = CALENDAR_COLORS[resolveColorKey(event)];
  const summary = event.attendee_summary;

  return (
    <HoverCard openDelay={280} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" side="right" className="w-72 p-3">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className={cn('mt-1 h-2 w-2 flex-shrink-0 rounded-full', color.bar)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatEventTimeRange(event, timezone, timeFormat)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            {event.owner_name ? (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{event.owner_name}</span>
              </div>
            ) : null}
            {event.location ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            ) : null}
            {event.conference_url ? (
              <div className="flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{event.conference_url}</span>
              </div>
            ) : null}
            {event.lead ? (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{event.lead.name}</span>
              </div>
            ) : null}
            {event.is_recurring ? (
              <div className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  Repeats{event.is_override ? ' · edited occurrence' : ''}
                </span>
              </div>
            ) : null}
            {event.all_day ? (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                <span>All day</span>
              </div>
            ) : null}
          </div>

          {event.description ? (
            <p className="line-clamp-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              {event.description}
            </p>
          ) : null}

          {summary ? (
            <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
              {summary.accepted ? (
                <span className="text-[11px] text-muted-foreground">{summary.accepted} yes</span>
              ) : null}
              {summary.declined ? (
                <span className="text-[11px] text-muted-foreground">{summary.declined} no</span>
              ) : null}
              {summary.needs_action ? (
                <span className="text-[11px] text-muted-foreground">
                  {summary.needs_action} awaiting
                </span>
              ) : null}
            </div>
          ) : null}

          {event.my_response ? (
            <AttendeeResponseBadge response={event.my_response} className="mt-1" />
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default EventHoverCard;
