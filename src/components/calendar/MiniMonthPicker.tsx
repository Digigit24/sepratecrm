// src/components/calendar/MiniMonthPicker.tsx
import { Calendar as DayPicker } from '@/components/ui/calendar';
import { toZoned, fromZoned } from '@/utils/calendarTime';

interface MiniMonthPickerProps {
  anchorDate: Date;
  timezone: string;
  onSelect: (date: Date) => void;
}

/**
 * Wraps the existing `react-day-picker` primitive rather than hand-rolling a
 * second small month grid. Selection is round-tripped through the calendar's
 * timezone so clicking "12" always lands on the 12th as the grid sees it.
 */
export function MiniMonthPicker({ anchorDate, timezone, onSelect }: MiniMonthPickerProps) {
  const zonedAnchor = toZoned(anchorDate, timezone);

  return (
    <DayPicker
      mode="single"
      selected={zonedAnchor}
      month={zonedAnchor}
      onMonthChange={(month) => onSelect(fromZoned(month, timezone))}
      onSelect={(date) => {
        if (date) onSelect(fromZoned(date, timezone));
      }}
      className="p-0 [&_.rdp-caption_label]:text-[13px] [&_.rdp-cell]:p-0 [&_.rdp-head_cell]:text-[10px]"
      classNames={{
        months: 'flex flex-col',
        month: 'space-y-2',
        day: 'h-7 w-7 p-0 font-normal text-xs aria-selected:opacity-100',
        head_cell: 'text-muted-foreground rounded-md w-7 font-normal text-[10px] uppercase',
        cell: 'h-7 w-7 text-center text-xs p-0 relative',
      }}
    />
  );
}

export default MiniMonthPicker;
