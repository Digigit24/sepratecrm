// src/components/FollowupScheduleDialog.tsx
import { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addDays, addHours, setHours, setMinutes, startOfDay } from 'date-fns';
import { CalendarIcon, Clock, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead } from '@/types/crmTypes';

interface FollowupScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSuccess?: () => void;
}

export const FollowupScheduleDialog: React.FC<FollowupScheduleDialogProps> = ({
  open,
  onOpenChange,
  lead,
  onSuccess,
}) => {
  const { patchLead } = useCRM();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens with a lead
  useEffect(() => {
    if (open && lead) {
      if (lead.next_follow_up_at) {
        const followupDate = new Date(lead.next_follow_up_at);
        setDate(followupDate);
        setTime(format(followupDate, 'HH:mm'));
      } else {
        // Default to tomorrow at 10:00 AM
        setDate(addDays(new Date(), 1));
        setTime('10:00');
      }
      setNotes('');
    }
  }, [open, lead]);

  const handleQuickSelect = (days: number, hour: number = 10) => {
    const newDate = addDays(startOfDay(new Date()), days);
    setDate(newDate);
    setTime(`${hour.toString().padStart(2, '0')}:00`);
  };

  const handleSubmit = async () => {
    if (!lead || !date) {
      toast.error('Please select a follow-up date');
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(':').map(Number);
      const followupDateTime = setMinutes(setHours(date, hours), minutes);

      // Update lead with new follow-up date
      await patchLead(lead.id, {
        next_follow_up_at: followupDateTime.toISOString(),
      });

      toast.success('Follow-up scheduled successfully');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to schedule follow-up:', error);
      toast.error(error?.message || 'Failed to schedule follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearFollowup = async () => {
    if (!lead) return;

    setIsSubmitting(true);

    try {
      await patchLead(lead.id, {
        next_follow_up_at: null,
      });

      toast.success('Follow-up cleared');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Failed to clear follow-up:', error);
      toast.error(error?.message || 'Failed to clear follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>
            Set a reminder to follow up with {lead?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Select Buttons */}
          <div className="space-y-2">
            <Label>Quick Select</Label>
            <div className="grid grid-cols-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(0, 14)}
                className="text-xs"
              >
                Today 2PM
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(1, 10)}
                className="text-xs"
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(3)}
                className="text-xs"
              >
                3 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect(7)}
                className="text-xs"
              >
                1 Week
              </Button>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Follow-up Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(date) => date < startOfDay(new Date())}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this follow-up..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Current Follow-up Info */}
          {lead?.next_follow_up_at && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                Current follow-up:{' '}
                <span className="font-medium text-foreground">
                  {format(new Date(lead.next_follow_up_at), 'PPP p')}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {lead?.next_follow_up_at && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFollowup}
              disabled={isSubmitting}
            >
              Clear Follow-up
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !date}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {lead?.next_follow_up_at ? 'Update' : 'Schedule'} Follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
