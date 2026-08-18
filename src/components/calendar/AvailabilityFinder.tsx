// src/components/calendar/AvailabilityFinder.tsx
import { useCallback, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { calendarService } from '@/services/calendarService';
import { formatEventTimeRange, formatInZone } from '@/utils/calendarTime';
import type { AvailabilityResponse } from '@/types/calendar.types';

interface AvailabilityFinderProps {
  userIds: string[];
  /** UTC ISO window to search within. */
  start: string;
  end: string;
  timezone: string;
  timeFormat?: '12h' | '24h';
  durationMinutes: number;
  /** Write a chosen slot back into the form. */
  onPickSlot: (start: string, end: string) => void;
}

/**
 * "Find a time" panel over `POST /api/calendar/availability/`.
 *
 * That endpoint returns only `{start, end, reason}` blocks — never titles — so
 * it is safe to call for people whose events the caller may not read in full.
 * Nothing here can therefore leak a private event's contents.
 */
export function AvailabilityFinder({
  userIds,
  start,
  end,
  timezone,
  timeFormat = '12h',
  durationMinutes,
  onPickSlot,
}: AvailabilityFinderProps) {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!userIds.length) return;
    setLoading(true);
    try {
      const result = await calendarService.getAvailability({
        user_ids: userIds,
        start,
        end,
        duration_minutes: durationMinutes,
        granularity_minutes: 15,
        tz: timezone,
        respect_working_hours: true,
      });
      setData(result);
    } catch {
      // The panel is an assist, not a requirement: show "no suggestions".
      setData({ busy: {}, suggested_slots: [], denied_user_ids: [] });
    } finally {
      setLoading(false);
    }
  }, [userIds, start, end, durationMinutes, timezone]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={search}
        disabled={loading || !userIds.length}
      >
        {loading ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Search className="mr-1 h-3.5 w-3.5" />
        )}
        Find a time
      </Button>

      {data?.unavailable ? (
        <p className="text-xs text-muted-foreground">
          Availability lookup is not available yet.
        </p>
      ) : null}

      {data && !data.unavailable ? (
        data.suggested_slots.length ? (
          <div className="flex flex-wrap gap-1.5">
            {data.suggested_slots.slice(0, 8).map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => onPickSlot(slot.start, slot.end)}
                className={cn(
                  'rounded-md border border-border/60 px-2 py-1 text-[11px] transition-colors',
                  'hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                <span className="block font-medium text-foreground">
                  {formatInZone(slot.start, timezone, 'EEE d MMM')}
                </span>
                <span className="block text-muted-foreground">
                  {formatEventTimeRange(
                    { start_at: slot.start, end_at: slot.end, all_day: false },
                    timezone,
                    timeFormat
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No slot fits everyone in this window.
          </p>
        )
      ) : null}

      {data?.denied_user_ids?.length ? (
        <p className="text-[11px] text-muted-foreground">
          {data.denied_user_ids.length} selected {data.denied_user_ids.length === 1 ? 'person is' : 'people are'} outside your visibility.
        </p>
      ) : null}
    </div>
  );
}

export default AvailabilityFinder;
