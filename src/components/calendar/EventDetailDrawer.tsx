// src/components/calendar/EventDetailDrawer.tsx
import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, MoreHorizontal, Pencil, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { mutate as globalMutate } from 'swr';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  SideDrawer,
  type DrawerActionButton,
  type DrawerHeaderAction,
} from '@/components/SideDrawer';
import { useMeeting } from '@/hooks/useMeeting';
import { describeDeleteResult, meetingService } from '@/services/meeting.service';
import { CALENDAR_EVENTS_KEY } from '@/hooks/useCalendar';
import { emitCrmDataChanged } from '@/lib/crmEvents';
import { formatEventTimeRange } from '@/utils/calendarTime';
import type {
  MeetingCreateData,
  MeetingEditScope,
  MeetingUpdateData,
} from '@/types/meeting.types';
import type { CalendarDraftEvent } from '@/types/calendar.types';
import { AttendeeResponseBadge } from './AttendeeResponseBadge';
import { EventForm, type EventFormHandle } from './EventForm';
import { RecurrenceScopeDialog } from './RecurrenceScopeDialog';

interface EventDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: number | null;
  /** UTC start of the clicked occurrence (recurring series only). */
  occurrenceStart?: string | null;
  draft?: CalendarDraftEvent | null;
  mode: 'view' | 'edit' | 'create';
  onModeChange?: (mode: 'view' | 'edit' | 'create') => void;
  timezone: string;
  timeFormat?: '12h' | '24h';
  defaultDurationMinutes?: number;
  onSaved?: () => void;
}

type PendingIntent = 'edit' | 'delete' | 'cancel';

/**
 * The event detail / edit panel.
 *
 * Modelled directly on `MeetingsFormDrawer.tsx`: `SideDrawer` with a mode
 * badge, `headerActions` of Pencil / Trash2 / MoreHorizontal, and form values
 * collected through a `useRef<EventFormHandle>` exposing
 * `getFormValues(): Promise<payload | null>`.
 *
 * RECURRENCE. Any save, delete or cancel on a series is routed through
 * `RecurrenceScopeDialog` first; the chosen scope plus the clicked
 * `occurrence_start` are then sent as `edit_scope` / `occurrence_start`.
 */
export function EventDetailDrawer({
  open,
  onOpenChange,
  meetingId,
  occurrenceStart,
  draft,
  mode,
  onModeChange,
  timezone,
  timeFormat = '12h',
  defaultDurationMinutes = 30,
  onSaved,
}: EventDetailDrawerProps) {
  const { useMeeting: useMeetingById, createMeeting, updateMeeting, deleteMeeting } = useMeeting();
  const { data: meeting, isLoading, mutate: revalidateMeeting } = useMeetingById(meetingId);

  const formRef = useRef<EventFormHandle | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null);

  const isRecurring = !!meeting?.recurrence_rule || !!meeting?.recurring_parent;

  const refreshCalendar = useCallback(() => {
    void globalMutate((key) => Array.isArray(key) && key[0] === CALENDAR_EVENTS_KEY, undefined, {
      revalidate: true,
    });
    emitCrmDataChanged({ resource: 'meetings' });
    onSaved?.();
  }, [onSaved]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const performSave = useCallback(
    async (scope?: MeetingEditScope) => {
      const values = await formRef.current?.getFormValues();
      if (!values) {
        toast.error('Please fill in all required fields correctly');
        return;
      }
      setIsSaving(true);
      try {
        if (mode === 'create') {
          await createMeeting(values as MeetingCreateData);
          toast.success('Event created');
          refreshCalendar();
          close();
        } else if (meetingId) {
          if (scope) {
            await meetingService.patchMeeting(meetingId, values as MeetingUpdateData, {
              editScope: scope,
              occurrenceStart: occurrenceStart ?? meeting?.start_at ?? null,
            });
          } else {
            await updateMeeting(meetingId, values as MeetingUpdateData);
          }
          toast.success('Event updated');
          void revalidateMeeting();
          refreshCalendar();
          onModeChange?.('view');
        }
      } catch (error) {
        toast.error((error as Error)?.message || 'Failed to save event');
      } finally {
        setIsSaving(false);
      }
    },
    [
      mode,
      meetingId,
      meeting?.start_at,
      occurrenceStart,
      createMeeting,
      updateMeeting,
      revalidateMeeting,
      refreshCalendar,
      close,
      onModeChange,
    ]
  );

  const performDelete = useCallback(
    async (scope?: MeetingEditScope) => {
      if (!meetingId) return;
      setIsSaving(true);
      try {
        const result = await deleteMeeting(
          meetingId,
          scope ? { editScope: scope, occurrenceStart: occurrenceStart ?? meeting?.start_at } : undefined
        );
        toast.success(describeDeleteResult(result, scope, isRecurring));
        refreshCalendar();
        close();
      } catch (error) {
        toast.error((error as Error)?.message || 'Failed to delete event');
      } finally {
        setIsSaving(false);
      }
    },
    [meetingId, occurrenceStart, meeting?.start_at, isRecurring, deleteMeeting, refreshCalendar, close]
  );

  const performCancel = useCallback(
    async (scope?: MeetingEditScope) => {
      if (!meetingId) return;
      setIsSaving(true);
      try {
        await meetingService.cancelMeeting(
          meetingId,
          undefined,
          scope ? { editScope: scope, occurrenceStart: occurrenceStart ?? meeting?.start_at } : undefined
        );
        toast.success('Event cancelled');
        void revalidateMeeting();
        refreshCalendar();
      } catch (error) {
        toast.error((error as Error)?.message || 'Failed to cancel event');
      } finally {
        setIsSaving(false);
      }
    },
    [meetingId, occurrenceStart, meeting?.start_at, revalidateMeeting, refreshCalendar]
  );

  /** Route an action through the scope dialog when the meeting recurs. */
  const request = useCallback(
    (intent: PendingIntent) => {
      if (isRecurring) {
        setPendingIntent(intent);
        return;
      }
      if (intent === 'edit') void performSave();
      if (intent === 'delete') void performDelete();
      if (intent === 'cancel') void performCancel();
    },
    [isRecurring, performSave, performDelete, performCancel]
  );

  const resolveScope = useCallback(
    (scope: MeetingEditScope) => {
      const intent = pendingIntent;
      setPendingIntent(null);
      if (intent === 'edit') void performSave(scope);
      if (intent === 'delete') void performDelete(scope);
      if (intent === 'cancel') void performCancel(scope);
    },
    [pendingIntent, performSave, performDelete, performCancel]
  );

  const headerActions: DrawerHeaderAction[] =
    mode === 'view' && meeting
      ? [
          { icon: Pencil, onClick: () => onModeChange?.('edit'), label: 'Edit event', variant: 'ghost' },
          { icon: Trash2, onClick: () => request('delete'), label: 'Delete event', variant: 'ghost' },
        ]
      : [];

  const footerButtons: DrawerActionButton[] =
    mode === 'view'
      ? [{ label: 'Close', onClick: close, variant: 'outline' }]
      : mode === 'edit'
        ? [
            {
              label: 'Cancel',
              onClick: () => onModeChange?.('view'),
              variant: 'outline',
              disabled: isSaving,
            },
            { label: 'Save changes', onClick: () => request('edit'), loading: isSaving },
          ]
        : [
            { label: 'Cancel', onClick: close, variant: 'outline', disabled: isSaving },
            { label: 'Create event', onClick: () => void performSave(), loading: isSaving },
          ];

  const subtitle = meeting
    ? `${formatEventTimeRange(
        {
          start_at: meeting.start_at,
          end_at: meeting.end_at,
          all_day: !!meeting.all_day,
          timezone: meeting.timezone,
        },
        timezone,
        timeFormat
      )}${meeting.lead_name ? ` · ${meeting.lead_name}` : ''}`
    : undefined;

  return (
    <>
      <SideDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={mode === 'create' ? 'New event' : meeting?.title || 'Event'}
        description={mode === 'create' ? undefined : subtitle}
        mode={mode}
        headerActions={headerActions}
        isLoading={isLoading && mode !== 'create'}
        loadingText="Loading event…"
        size="lg"
        resizable
        storageKey="calendar-event-drawer-width"
        footerButtons={footerButtons}
        footerAlignment="right"
        onClose={close}
      >
        <div className="space-y-4">
          {mode === 'view' && meeting ? (
            <div className="flex flex-wrap items-center gap-2">
              {meeting.status ? (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-border">
                  {meeting.status}
                </span>
              ) : null}
              {meeting.attendees?.some((a) => a.response_status) ? (
                <AttendeeResponseBadge
                  response={
                    meeting.attendees.find((a) => a.response_status)?.response_status ?? null
                  }
                />
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto h-7 w-7">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-[13px]">
                  <DropdownMenuItem onClick={() => request('cancel')}>
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Cancel event
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!meetingId) return;
                      try {
                        await meetingService.completeMeeting(meetingId, undefined, occurrenceStart);
                        toast.success('Marked complete');
                        void revalidateMeeting();
                        refreshCalendar();
                      } catch (error) {
                        toast.error((error as Error)?.message || 'Failed to update event');
                      }
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    Mark complete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          <EventForm
            key={`${meetingId ?? 'new'}-${mode}`}
            ref={formRef}
            meeting={mode === 'create' ? null : meeting}
            draft={draft}
            mode={mode}
            timezone={timezone}
            timeFormat={timeFormat}
            defaultDurationMinutes={defaultDurationMinutes}
          />
        </div>
      </SideDrawer>

      <RecurrenceScopeDialog
        open={!!pendingIntent}
        intent={pendingIntent ?? 'edit'}
        eventTitle={meeting?.title}
        onConfirm={resolveScope}
        onCancel={() => setPendingIntent(null)}
      />
    </>
  );
}

export default EventDetailDrawer;
