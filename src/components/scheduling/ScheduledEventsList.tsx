// ==================== SCHEDULED EVENTS LIST ====================
// Component to view and manage scheduled events with auto-reminders

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useScheduling } from '@/hooks/useScheduling';
import { EVENT_STATUS, EVENT_TYPE_OPTIONS } from '@/constants/scheduling';
import {
  formatScheduleDate,
  getRelativeTime,
  getEventStatusLabel,
  getMessageStatusLabel,
  canCancelEvent,
  formatPhoneNumber,
} from '@/utils/scheduleHelpers';
import type { ScheduledEvent, EventStatusFilter } from '@/types/scheduling.types';
import {
  RefreshCw,
  X,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';

// ==================== STATUS BADGE ====================

function EventStatusBadge({ status }: { status: number }) {
  const label = getEventStatusLabel(status);

  const variants: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    [EVENT_STATUS.ACTIVE]: 'default',
    [EVENT_STATUS.COMPLETED]: 'secondary',
    [EVENT_STATUS.CANCELLED]: 'outline',
  };

  return <Badge variant={variants[status] || 'outline'}>{label}</Badge>;
}

// ==================== EVENT TYPE LABEL ====================

function getEventTypeLabel(eventType: string): string {
  const option = EVENT_TYPE_OPTIONS.find((opt) => opt.value === eventType);
  return option?.label || eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// ==================== LOADING SKELETON ====================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== EMPTY STATE ====================

function EmptyState({ status }: { status: EventStatusFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <CalendarClock className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No events found</h3>
      <p className="text-muted-foreground">
        {status === 'active'
          ? 'No events are currently scheduled.'
          : `No ${status} events to display.`}
      </p>
    </div>
  );
}

// ==================== SCHEDULED MESSAGES PREVIEW ====================

interface ScheduledMessagesPreviewProps {
  messages: ScheduledEvent['scheduled_messages'];
}

function ScheduledMessagesPreview({ messages }: ScheduledMessagesPreviewProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No reminders scheduled for this event.
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {messages.map((msg) => (
        <div
          key={msg._uid}
          className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span>{msg.template_name || 'Message'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">{formatScheduleDate(msg.send_at)}</span>
            <Badge variant="outline" className="text-xs">
              {getMessageStatusLabel(msg.status)}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== EVENT ROW ====================

interface EventRowProps {
  event: ScheduledEvent;
  onCancel: (uid: string) => void;
  cancelling: string | null;
}

function EventRow({ event, onCancel, cancelling }: EventRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isCancelling = cancelling === event._uid;
  const canCancel = canCancelEvent(event.status);
  const hasMessages = event.scheduled_messages && event.scheduled_messages.length > 0;

  return (
    <>
      <TableRow>
        <TableCell>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto"
                disabled={!hasMessages}
              >
                {hasMessages ? (
                  isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <span className="w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </TableCell>
        <TableCell>
          <span className="font-medium">{getEventTypeLabel(event.event_type)}</span>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium">{formatPhoneNumber(event.contact_phone)}</div>
            {event.contact_name && (
              <div className="text-sm text-muted-foreground">{event.contact_name}</div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium">{formatScheduleDate(event.event_at)}</div>
            <div className="text-sm text-muted-foreground">{getRelativeTime(event.event_at)}</div>
          </div>
        </TableCell>
        <TableCell>
          {hasMessages && (
            <Badge variant="outline" className="text-xs">
              {event.scheduled_messages!.length} reminder
              {event.scheduled_messages!.length > 1 ? 's' : ''}
            </Badge>
          )}
        </TableCell>
        <TableCell>
          <EventStatusBadge status={event.status} />
        </TableCell>
        <TableCell>
          {canCancel ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isCancelling}
                  className="text-destructive hover:text-destructive"
                >
                  {isCancelling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Scheduled Event</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this event for{' '}
                    {event.contact_name || event.contact_phone}? This will also cancel all
                    associated reminder messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Event</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onCancel(event._uid)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel Event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
      </TableRow>
      {hasMessages && isOpen && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-4">
            <div className="text-sm font-medium mb-2">Scheduled Reminders</div>
            <ScheduledMessagesPreview messages={event.scheduled_messages} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ==================== MAIN COMPONENT ====================

interface ScheduledEventsListProps {
  initialStatus?: EventStatusFilter;
  showHeader?: boolean;
  className?: string;
}

export function ScheduledEventsList({
  initialStatus = 'active',
  showHeader = true,
  className,
}: ScheduledEventsListProps) {
  const {
    getScheduledEvents,
    cancelEvent,
    scheduledEvents,
    loading,
    error,
  } = useScheduling();

  const [statusFilter, setStatusFilter] = useState<EventStatusFilter>(initialStatus);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Fetch events on mount and when status changes
  useEffect(() => {
    getScheduledEvents(statusFilter);
  }, [statusFilter, getScheduledEvents]);

  // Handle cancel event
  const handleCancel = useCallback(async (eventUid: string) => {
    setCancelling(eventUid);
    await cancelEvent(eventUid);
    setCancelling(null);
  }, [cancelEvent]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    getScheduledEvents(statusFilter);
  }, [getScheduledEvents, statusFilter]);

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Events</CardTitle>
              <CardDescription>
                View and manage scheduled events with auto-reminders
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as EventStatusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading && scheduledEvents.length === 0 ? (
          <LoadingSkeleton />
        ) : scheduledEvents.length === 0 ? (
          <EmptyState status={statusFilter} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Event Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Event Time</TableHead>
                <TableHead>Reminders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledEvents.map((event) => (
                <EventRow
                  key={event._uid}
                  event={event}
                  onCancel={handleCancel}
                  cancelling={cancelling}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ScheduledEventsList;
