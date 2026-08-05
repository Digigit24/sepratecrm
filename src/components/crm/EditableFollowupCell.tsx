import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BellRing, CalendarDays, Check, Clock3, Loader2, Trash2 } from 'lucide-react';
import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isValid,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { FollowUpReminder, FollowUpSchedulePayload } from '@/types/crmTypes';

export interface EditableDateTimeCellProps {
  value?: string | null;
  onSave: (value: string | null) => Promise<void>;
  mode?: 'date' | 'datetime';
  label?: string;
  entityName?: string;
  allowPast?: boolean;
  disabled?: boolean;
  reminder?: FollowUpReminder | null;
  onSaveSchedule?: (schedule: FollowUpSchedulePayload) => Promise<void>;
}

const parseValue = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

const getTimeValue = (value?: string | null) => {
  const parsed = parseValue(value);
  return parsed ? format(parsed, 'HH:mm') : '10:00';
};

export const EditableDateTimeCell: React.FC<EditableDateTimeCellProps> = ({
  value,
  onSave,
  mode = 'datetime',
  label = mode === 'date' ? 'Date' : 'Date and time',
  entityName,
  allowPast = true,
  disabled = false,
  reminder,
  onSaveSchedule,
}) => {
  const reminderCheckboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localValue, setLocalValue] = useState<string | null>(value || null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => parseValue(value));
  const [selectedTime, setSelectedTime] = useState(() => getTimeValue(value));
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(reminder));
  const [reminderOffset, setReminderOffset] = useState(String(reminder?.offset_minutes ?? 0));

  useEffect(() => {
    if (isSaving) return;
    setLocalValue(value || null);
    setSelectedDate(parseValue(value));
    setSelectedTime(getTimeValue(value));
    setReminderEnabled(Boolean(reminder));
    setReminderOffset(String(reminder?.offset_minutes ?? 0));
  }, [value, reminder, isSaving]);

  const displayDate = useMemo(() => parseValue(localValue), [localValue]);

  const resetDraft = useCallback(() => {
    setSelectedDate(parseValue(localValue));
    setSelectedTime(getTimeValue(localValue));
    setReminderEnabled(Boolean(reminder));
    setReminderOffset(String(reminder?.offset_minutes ?? 0));
  }, [localValue, reminder]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (isSaving) return;
    if (open) resetDraft();
    setIsOpen(open);
  }, [isSaving, resetDraft]);

  const handleSave = useCallback(async () => {
    const previousValue = localValue;
    let nextValue: string | null = null;

    if (selectedDate) {
      if (mode === 'date') {
        nextValue = format(selectedDate, 'yyyy-MM-dd');
      } else {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        nextValue = setHours(
          setMinutes(selectedDate, Number.isFinite(minutes) ? minutes : 0),
          Number.isFinite(hours) ? hours : 10,
        ).toISOString();
      }
    }

    setLocalValue(nextValue);
    setIsOpen(false);
    setIsSaving(true);
    try {
      if (onSaveSchedule) {
        await onSaveSchedule({
          follow_up_at: nextValue,
          reminder: {
            enabled: Boolean(nextValue && reminderEnabled),
            offset_minutes: Number(reminderOffset),
          },
        });
      } else {
        await onSave(nextValue);
      }
      toast.success(nextValue ? `${label} updated${entityName ? ` for ${entityName}` : ''}` : `${label} cleared`);
    } catch (error) {
      setLocalValue(previousValue);
      toast.error(error instanceof Error ? error.message : `Failed to update ${label.toLowerCase()}`);
    } finally {
      setIsSaving(false);
    }
  }, [entityName, label, localValue, mode, onSave, onSaveSchedule, reminderEnabled, reminderOffset, selectedDate, selectedTime]);

  const displayText = displayDate
    ? mode === 'date'
      ? format(displayDate, 'dd MMM yyyy')
      : format(displayDate, 'dd MMM, h:mm a')
    : 'Add date';

  const fullDisplayText = displayDate
    ? mode === 'date'
      ? format(displayDate, 'PPPP')
      : format(displayDate, 'PPPP, p')
    : `Set ${label.toLowerCase()}`;

  const today = startOfDay(new Date());
  const isOverdue = !allowPast && displayDate && isBefore(displayDate, today) && !isSameDay(displayDate, today);
  const isToday = displayDate && isSameDay(displayDate, today);

  return (
    <div onClick={(event) => event.stopPropagation()} className="inline-flex max-w-full">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled || isSaving}
            className={cn(
              'group/date inline-flex h-7 max-w-[170px] items-center gap-1.5 rounded-md border border-transparent px-1.5 text-xs transition-all',
              'hover:border-border/70 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40',
              'data-[state=open]:border-border data-[state=open]:bg-background data-[state=open]:shadow-sm',
              !displayDate && 'text-muted-foreground',
              isOverdue && 'text-red-600',
              isToday && !isOverdue && 'text-amber-600',
              disabled && 'cursor-default opacity-60',
            )}
            title={fullDisplayText}
            aria-label={`${label}: ${fullDisplayText}`}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover/date:opacity-100" />
            )}
            <span className="truncate font-medium">{displayText}</span>
            {reminder && (
              <BellRing className="h-3 w-3 shrink-0 text-primary" aria-label="Reminder active" />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="w-[calc(100vw-1rem)] max-w-[19rem] overflow-hidden rounded-xl border-border/70 bg-popover/95 p-0 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="text-[11px] text-muted-foreground">
                {mode === 'date' ? 'Choose a calendar date' : 'Choose a date and exact time'}
              </p>
            </div>
            {selectedDate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setSelectedDate(undefined)}
                aria-label={`Clear ${label.toLowerCase()}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex gap-1.5 px-3 pt-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 flex-1 rounded-lg px-2 text-xs"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 flex-1 rounded-lg px-2 text-xs"
              onClick={() => setSelectedDate(addDays(new Date(), 1))}
            >
              Tomorrow
            </Button>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            initialFocus
            disabled={!allowPast ? { before: today } : undefined}
            className="p-2.5"
            classNames={{
              month: 'space-y-2.5',
              caption: 'flex justify-center pt-0.5 relative items-center',
              caption_label: 'text-xs font-semibold',
              head_cell: 'w-8 rounded-md text-[10px] font-medium text-muted-foreground',
              row: 'mt-1 flex w-full',
              cell: 'relative h-8 w-8 p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-md',
              day: 'h-8 w-8 rounded-md p-0 text-xs font-normal aria-selected:opacity-100',
              nav_button: 'h-7 w-7 rounded-md border-0 bg-transparent p-0 opacity-60 hover:bg-muted hover:opacity-100',
            }}
          />

          {mode === 'datetime' && selectedDate && (
            <div className="border-t px-3 py-2.5">
              <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground" htmlFor="inline-date-time">
                <Clock3 className="h-3.5 w-3.5" />
                Time
              </label>
              <Input
                id="inline-date-time"
                type="time"
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
                className="h-8 rounded-lg text-sm"
              />
            </div>
          )}

          {onSaveSchedule && (
            <div className="border-t px-3 py-2.5">
              <label
                htmlFor={reminderCheckboxId}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1"
              >
                <Checkbox
                  id={reminderCheckboxId}
                  checked={reminderEnabled}
                  disabled={!selectedDate}
                  onCheckedChange={(checked) => setReminderEnabled(checked === true)}
                />
                <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium">
                  <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                  Remind me
                </span>
              </label>

              {reminderEnabled && selectedDate && (
                <Select value={reminderOffset} onValueChange={setReminderOffset}>
                  <SelectTrigger className="mt-2 h-8 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">At follow-up time</SelectItem>
                    <SelectItem value="10">10 minutes before</SelectItem>
                    <SelectItem value="30">30 minutes before</SelectItem>
                    <SelectItem value="60">1 hour before</SelectItem>
                    <SelectItem value="1440">1 day before</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-3 py-2.5">
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={handleSave} disabled={isSaving}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

interface EditableFollowupCellProps {
  dateValue: string | null;
  reminder?: FollowUpReminder | null;
  onSaveSchedule: (schedule: FollowUpSchedulePayload) => Promise<void>;
  leadName: string;
}

export const EditableFollowupCell: React.FC<EditableFollowupCellProps> = ({
  dateValue,
  reminder,
  onSaveSchedule,
  leadName,
}) => (
  <EditableDateTimeCell
    value={dateValue}
    onSave={async () => undefined}
    reminder={reminder}
    onSaveSchedule={onSaveSchedule}
    mode="datetime"
    label="Follow-up"
    entityName={leadName}
    allowPast={false}
  />
);
