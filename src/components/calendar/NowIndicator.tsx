// src/components/calendar/NowIndicator.tsx
import { useEffect, useState } from 'react';
import { minutesFromMidnight, minutesToPx, toZoned } from '@/utils/calendarTime';
import { cn } from '@/lib/utils';

interface NowIndicatorProps {
  timezone: string;
  pxPerHour: number;
  /** Show the dot only in the column that represents today. */
  withDot?: boolean;
  className?: string;
}

/**
 * The red "now" hairline, positioned from the CURRENT INSTANT projected into
 * the viewer's timezone — not from `new Date().getHours()`, which would be the
 * browser's zone and would drift from the rest of the grid whenever the user's
 * calendar timezone differs from their machine's.
 */
export function NowIndicator({ timezone, pxPerHour, withDot = true, className }: NowIndicatorProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const top = minutesToPx(minutesFromMidnight(toZoned(now, timezone)), pxPerHour);

  return (
    <div
      className={cn('pointer-events-none absolute left-0 right-0 z-30', className)}
      style={{ top }}
      aria-hidden="true"
      data-testid="now-indicator"
    >
      <div className="relative h-0 border-t border-red-500">
        {withDot ? (
          <span className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-red-500" />
        ) : null}
      </div>
    </div>
  );
}

export default NowIndicator;
