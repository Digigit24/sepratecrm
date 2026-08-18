// src/components/calendar/CalendarSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';
import type { CalendarView } from '@/types/calendar.types';

/**
 * Grid-shaped skeletons so the layout does not jump when SWR resolves.
 * Deliberately mirrors the real grid's proportions rather than being a generic
 * spinner block.
 */
export function CalendarSkeleton({ view }: { view: CalendarView }) {
  if (view === 'agenda') {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, dayIndex) => (
          <div key={dayIndex} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            {Array.from({ length: 2 }).map((__, rowIndex) => (
              <Skeleton key={rowIndex} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (view === 'month') {
    return (
      <div className="grid h-full grid-cols-7 grid-rows-6 gap-px bg-border/60">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="bg-background p-1.5 space-y-1.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            {i % 3 === 0 ? <Skeleton className="h-4 w-full rounded" /> : null}
            {i % 5 === 0 ? <Skeleton className="h-4 w-4/5 rounded" /> : null}
          </div>
        ))}
      </div>
    );
  }

  const columns = view === 'day' ? 1 : 7;
  return (
    <div className="flex h-full">
      <div className="w-14 flex-shrink-0 space-y-6 pt-4 pr-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="ml-auto h-3 w-9" />
        ))}
      </div>
      <div
        className="grid flex-1 gap-px bg-border/60"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, col) => (
          <div key={col} className="bg-background p-1.5 space-y-3">
            {Array.from({ length: 3 }).map((__, row) => (
              <Skeleton
                key={row}
                className="w-full rounded-md"
                style={{ height: 40 + ((col + row) % 3) * 28 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarSkeleton;
