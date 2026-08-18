// src/components/calendar/CalendarLegend.tsx
import { CALENDAR_COLORS, LEGEND_KEYS } from '@/lib/calendarColors';
import { cn } from '@/lib/utils';

/**
 * Colour key row. Mirrors the Dashboard legend (indigo = follow-ups,
 * amber = tasks) so the two surfaces never disagree about what a colour means.
 */
export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-x-3 gap-y-1.5', className)}>
      {LEGEND_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', CALENDAR_COLORS[key].bar)} />
          <span className="text-[11px] text-muted-foreground">{CALENDAR_COLORS[key].label}</span>
        </div>
      ))}
    </div>
  );
}

export default CalendarLegend;
