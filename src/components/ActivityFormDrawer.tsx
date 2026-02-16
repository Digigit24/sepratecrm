// src/components/ActivityFormDrawer.tsx
import { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse, addMinutes } from 'date-fns';
import type { ActivityTypeEnum } from '@/types/crmTypes';

interface ActivityFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  onSuccess?: () => void;
  defaultType?: ActivityTypeEnum;
}

export const ActivityFormDrawer: React.FC<ActivityFormDrawerProps> = ({
  open,
  onOpenChange,
  leadId,
  onSuccess,
  defaultType = 'NOTE',
}) => {
  const { user } = useAuth();
  const { createLeadActivity } = useCRM();

  // Form state
  const [type, setType] = useState<ActivityTypeEnum>(defaultType);
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate time slots in 15-minute intervals
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeStr);
      }
    }
    return slots;
  }, []);

  // Duration options in minutes
  const durationOptions = [
    { value: '15', label: '15 mins' },
    { value: '30', label: '30 mins' },
    { value: '45', label: '45 mins' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
  ];

  // Calculate end time
  const endTime = useMemo(() => {
    if (!startTime || !duration) return '';
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      const endDate = addMinutes(startDate, parseInt(duration));
      return format(endDate, 'HH:mm');
    } catch {
      return '';
    }
  }, [startTime, duration]);

  // Format time for display (12-hour format)
  const formatTimeDisplay = (time: string) => {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes);
      return format(date, 'h:mm a');
    } catch {
      return time;
    }
  };

  // Set default values
  useEffect(() => {
    if (open) {
      const now = new Date();
      const localDate = format(now, 'yyyy-MM-dd');

      // Round to next 15-minute interval
      const currentMinutes = now.getMinutes();
      const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
      now.setMinutes(roundedMinutes, 0, 0);

      const localTime = format(now, 'HH:mm');

      setDate(localDate);
      setStartTime(localTime);
      setDuration('30');
      setContent('');
      setType(defaultType);
    }
  }, [open, defaultType]);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error('Activity content is required');
      return;
    }

    if (!date) {
      toast.error('Date is required');
      return;
    }

    try {
      setIsSubmitting(true);

      // Combine date and startTime to create datetime
      const dateTimeString = `${date}T${startTime}:00`;
      const happenedAtDate = new Date(dateTimeString);

      // Create metadata for meetings with duration and end time
      const meta = type === 'MEETING' ? {
        duration_minutes: parseInt(duration),
        end_time: endTime,
      } : undefined;

      const activityData = {
        lead: leadId,
        type,
        content: content.trim(),
        happened_at: happenedAtDate.toISOString(),
        by_user_id: user?.id,
        meta,
      };

      await createLeadActivity(activityData);
      toast.success(type === 'MEETING' ? 'Meeting scheduled successfully' : 'Activity added successfully');
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{type === 'MEETING' ? 'Schedule Meeting' : 'Add New Activity'}</SheetTitle>
          <SheetDescription>
            {type === 'MEETING'
              ? 'Schedule a meeting with this lead'
              : 'Record an interaction or note for this lead'
            }
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Activity Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Activity Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as ActivityTypeEnum)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CALL">Call</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="NOTE">Note</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              {type === 'MEETING' ? 'Meeting Title' : 'Content'} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
              placeholder={type === 'MEETING' ? 'Enter meeting title...' : 'Enter activity details...'}
              rows={4}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="startTime">
              Start Time <span className="text-destructive">*</span>
            </Label>
            <Select
              value={startTime}
              onValueChange={setStartTime}
              disabled={isSubmitting}
            >
              <SelectTrigger id="startTime">
                <SelectValue>
                  {formatTimeDisplay(startTime)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {formatTimeDisplay(slot)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration (only for meetings) */}
          {type === 'MEETING' && (
            <div className="space-y-2">
              <Label htmlFor="duration">
                Duration <span className="text-destructive">*</span>
              </Label>
              <Select
                value={duration}
                onValueChange={setDuration}
                disabled={isSubmitting}
              >
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* End Time Display (only for meetings) */}
          {type === 'MEETING' && endTime && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Meeting ends at:</span>
                <span className="font-medium">{formatTimeDisplay(endTime)}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {type === 'MEETING' ? 'Scheduling...' : 'Adding...'}
                </>
              ) : (
                type === 'MEETING' ? 'Schedule Meeting' : 'Add Activity'
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ActivityFormDrawer;
