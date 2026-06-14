// src/components/crm/EditableFollowupCell.tsx
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Check } from 'lucide-react';
import { format, parseISO, isValid, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditableFollowupCellProps {
  dateValue: string | null;
  onSave: (date: string | null) => Promise<void>;
  leadName: string;
}

const TIME_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
];

export const EditableFollowupCell: React.FC<EditableFollowupCellProps> = ({
  dateValue,
  onSave,
  leadName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic local display value — updates immediately on save
  const [localDateValue, setLocalDateValue] = useState<string | null>(dateValue);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    dateValue ? parseISO(dateValue) : undefined
  );
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (!dateValue) return '';
    const date = parseISO(dateValue);
    if (!isValid(date)) return '';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  });

  // Sync from prop when not saving
  useEffect(() => {
    if (!isSaving) {
      setLocalDateValue(dateValue);
      setSelectedDate(dateValue ? parseISO(dateValue) : undefined);
      setSelectedTime(() => {
        if (!dateValue) return '';
        const date = parseISO(dateValue);
        if (!isValid(date)) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      });
    }
  }, [dateValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    if (date && !selectedTime) setSelectedTime('10:00');
  }, [selectedTime]);

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time);
    if (time && !selectedDate) setSelectedDate(new Date());
  }, [selectedDate]);

  const handleSave = useCallback(async () => {
    const previousDateValue = localDateValue;

    if (!selectedDate) {
      // Optimistic clear
      setLocalDateValue(null);
      setIsOpen(false);
      setIsSaving(true);
      try {
        await onSave(null);
        toast.success(`Follow-up cleared for ${leadName}`);
      } catch (error) {
        setLocalDateValue(previousDateValue);
        toast.error('Failed to clear follow-up');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateWithTime = setHours(setMinutes(selectedDate, minutes || 0), hours || 10);
    const isoString = dateWithTime.toISOString();

    // Optimistic: update display immediately
    setLocalDateValue(isoString);
    setIsOpen(false);
    setIsSaving(true);
    try {
      await onSave(isoString);
      toast.success(`Follow-up updated for ${leadName}`);
    } catch (error) {
      setLocalDateValue(previousDateValue);
      toast.error('Failed to update follow-up');
    } finally {
      setIsSaving(false);
    }
  }, [selectedDate, selectedTime, onSave, leadName, localDateValue]);

  const handleClear = useCallback(() => {
    setSelectedDate(undefined);
    setSelectedTime('');
  }, []);

  const isSameDay = (date1: Date, date2: Date) =>
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();

  const getDisplayText = () => {
    if (!localDateValue) return 'Set date';
    const date = parseISO(localDateValue);
    if (!isValid(date)) return 'Set date';
    return format(date, 'MMM dd, yyyy');
  };

  const getTextColor = () => {
    if (!localDateValue) return 'text-muted-foreground';
    const date = parseISO(localDateValue);
    if (!isValid(date)) return 'text-muted-foreground';
    const now = new Date();
    if (date < now && !isSameDay(date, now)) return 'text-red-600';
    if (isSameDay(date, now)) return 'text-orange-600';
    return 'text-foreground';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'text-sm hover:underline cursor-pointer bg-transparent border-none p-0',
            getTextColor()
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          {getDisplayText()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Schedule Follow-up</h4>
            {localDateValue && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                onClick={handleClear}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>

          {selectedDate && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Time (Optional)</label>
              <Select value={selectedTime} onValueChange={handleTimeSelect}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <span className="animate-pulse mr-1 text-xs">…</span>
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
