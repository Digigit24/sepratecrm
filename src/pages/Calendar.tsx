// src/pages/Calendar.tsx
import { useEffect, useMemo } from 'react';
import { useCalendar } from '@/hooks/useCalendar';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useCalendarStore } from '@/store/calendarStore';
import { useCrmDataChanged } from '@/lib/crmEvents';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { buildRangeForView } from '@/utils/calendarTime';
import type { CalendarRangeParams } from '@/types/calendar.types';

/**
 * The calendar page. Deliberately thin: it resolves the visible range from the
 * store, runs one query, and hands everything to `CalendarShell`.
 *
 * The page body follows the house convention (`p-4 space-y-3`) but with
 * `h-full min-h-0 flex flex-col`, because the grid must fill the viewport and
 * scroll internally rather than growing the page.
 *
 * `/crm/meetings` (the list) is intentionally kept alongside this route: the
 * list is where bulk operations and search live, the calendar is where time
 * lives.
 */
export function Calendar() {
  const {
    view,
    anchorDate,
    timezone,
    weekStartsOn,
    visibleLayers,
    visibleUserIds,
    teamMode,
    includeCancelled,
    includeDeclined,
    applyPreferences,
  } = useCalendarStore();

  const { useCalendarEvents, useCalendarPreferences } = useCalendar();

  // Server preferences (timezone, working hours, week start) override the
  // browser-seeded defaults as soon as they arrive.
  const { data: preferences } = useCalendarPreferences();
  useEffect(() => {
    if (preferences) applyPreferences(preferences);
  }, [preferences, applyPreferences]);

  const range = useMemo(
    () => buildRangeForView(view, anchorDate, timezone, weekStartsOn),
    [view, anchorDate, timezone, weekStartsOn]
  );

  const {
    members,
    colorIndexByUser,
    canViewTeam,
    unavailable: membersUnavailable,
  } = useTeamMembers({ start: range.start, end: range.end });

  /**
   * `user_ids` is only sent in team mode. With the toggle off the server
   * returns just the caller's events, which is the correct default and the
   * cheapest query.
   */
  const params: CalendarRangeParams = useMemo(
    () => ({
      start: range.start,
      end: range.end,
      tz: timezone,
      layers: visibleLayers,
      include_cancelled: includeCancelled,
      include_declined: includeDeclined,
      user_ids: teamMode !== 'off' && visibleUserIds.length ? visibleUserIds : undefined,
    }),
    [
      range.start,
      range.end,
      timezone,
      visibleLayers,
      includeCancelled,
      includeDeclined,
      teamMode,
      visibleUserIds,
    ]
  );

  const { data, error, isLoading, mutate } = useCalendarEvents(params);

  // Copilot-created meetings (and any other out-of-band write) refresh the grid.
  useCrmDataChanged((change) => {
    if (['meetings', 'tasks', 'leads'].includes(change.resource)) void mutate();
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <CalendarShell
        events={data?.events ?? []}
        isLoading={isLoading}
        unavailable={!!data?.unavailable}
        loadError={(error as Error) ?? null}
        members={members}
        colorIndexByUser={colorIndexByUser}
        canViewTeam={canViewTeam}
        membersUnavailable={membersUnavailable}
        onRefresh={() => void mutate()}
      />
      {data?.truncated ? (
        <p className="flex-shrink-0 text-xs text-muted-foreground">
          Showing the first 5,000 events in this range. Narrow the range or hide a layer to see
          everything.
        </p>
      ) : null}
    </div>
  );
}

export default Calendar;
