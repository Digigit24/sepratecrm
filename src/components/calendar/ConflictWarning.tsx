// src/components/calendar/ConflictWarning.tsx
import { AlertTriangle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatEventTimeRange } from '@/utils/calendarTime';
import type { CalendarConflict } from '@/types/calendar.types';

interface ConflictWarningProps {
  conflicts: CalendarConflict[];
  timezone: string;
  timeFormat?: '12h' | '24h';
  className?: string;
}

/**
 * Inline amber banner listing overlaps from `POST /api/calendar/conflicts/`.
 * This is a WARNING and never blocks a save — double-booking is legitimate.
 *
 * A conflict the server marked `redacted` renders as "Busy": the caller may
 * know the slot is taken, not what it is taken by.
 */
export function ConflictWarning({
  conflicts,
  timezone,
  timeFormat = '12h',
  className,
}: ConflictWarningProps) {
  if (!conflicts.length) return null;

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2',
        className
      )}
      role="status"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        {conflicts.length} scheduling {conflicts.length === 1 ? 'conflict' : 'conflicts'}
      </div>
      <ul className="space-y-0.5">
        {conflicts.slice(0, 5).map((conflict) => (
          <li
            key={`${conflict.meeting_id}-${conflict.occurrence_start ?? conflict.start_at}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            {conflict.redacted ? <Lock className="h-3 w-3 flex-shrink-0" /> : null}
            <span className="max-w-[45%] truncate font-medium text-foreground">
              {conflict.redacted ? 'Busy' : conflict.title}
            </span>
            <span className="truncate">
              {conflict.user_name ? `${conflict.user_name} · ` : ''}
              {formatEventTimeRange(
                { start_at: conflict.start_at, end_at: conflict.end_at, all_day: false },
                timezone,
                timeFormat
              )}
            </span>
          </li>
        ))}
      </ul>
      {conflicts.length > 5 ? (
        <p className="text-[11px] text-muted-foreground">+{conflicts.length - 5} more</p>
      ) : null}
    </div>
  );
}

export default ConflictWarning;
