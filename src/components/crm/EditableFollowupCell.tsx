// src/components/crm/EditableFollowupCell.tsx
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, X, Check } from 'lucide-react';
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

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    // If date is selected and no time is set, default to 10:00 AM
    if (date && !selectedTime) {
      setSelectedTime('10:00');
    }
  }, [selectedTime]);

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time);
    // If time is selected and no date is set, default to today
    if (time && !selectedDate) {
      setSelectedDate(new Date());
    }
  }, [selectedDate]);

  const handleSave = useCallback(async () => {
    if (!selectedDate) {
      // Clear the follow-up
      try {
        setIsSaving(true);
        await onSave(null);
        toast.success(`Follow-up cleared for ${leadName}`);
        setIsOpen(false);
      } catch (error) {
        toast.error('Failed to clear follow-up');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Combine date and time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateWithTime = setHours(setMinutes(selectedDate, minutes || 0), hours || 10);

    try {
      setIsSaving(true);
      await onSave(dateWithTime.toISOString());
      toast.success(`Follow-up updated for ${leadName}`);
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to update follow-up');
    } finally {
      setIsSaving(false);
    }
  }, [selectedDate, selectedTime, onSave, leadName]);

  const handleClear = useCallback(() => {
    setSelectedDate(undefined);
    setSelectedTime('');
  }, []);

  const getDisplayValue = () => {
    if (!dateValue) {
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          Set follow-up
        </span>
      );
    }

    const date = parseISO(dateValue);
    if (!isValid(date)) {
      return (
        <span className="text-muted-foreground text-sm flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          Set follow-up
        </span>
      );
    }

    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{format(date, 'MMM dd, yyyy')}</span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(date, 'hh:mm a')}
        </span>
      </div>
    );
  };

  const getBadgeColor = () => {
    if (!dateValue) return '';
    const date = parseISO(dateValue);
    if (!isValid(date)) return '';

    const now = new Date();
    if (isValid(date) && date < now && !isSameDay(date, now)) {
      return 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200';
    }
    if (isValid(date) && isSameDay(date, now)) {
      return 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200';
    }
    return 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200';
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-start text-left font-normal h-auto py-2 px-3',
            getBadgeColor(),
            !dateValue && 'border-dashed'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          {getDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Schedule Follow-up</h4>
            {dateValue && (
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

          {/* Date Picker */}
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

          {/* Time Picker */}
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="animate-spin mr-1">⏳</span>
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
