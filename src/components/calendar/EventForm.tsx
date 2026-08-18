// src/components/calendar/EventForm.tsx
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import useSWR from 'swr';
import { addDays, addMinutes, startOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { crmClient } from '@/lib/client';
import { API_CONFIG } from '@/lib/apiConfig';
import { calendarService } from '@/services/calendarService';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Lead } from '@/types/crmTypes';
import type {
  Meeting,
  MeetingAttendee,
  MeetingCreateData,
  MeetingReminderRule,
  MeetingType,
  MeetingUpdateData,
  MeetingVisibility,
} from '@/types/meeting.types';
import type { CalendarConflict, CalendarDraftEvent } from '@/types/calendar.types';
import {
  formatInZone,
  fromZoned,
  safeTimeZone,
  toZoned,
} from '@/utils/calendarTime';
import { AttendeePicker } from './AttendeePicker';
import { AvailabilityFinder } from './AvailabilityFinder';
import { ConflictWarning } from './ConflictWarning';
import { RecurrenceEditor } from './RecurrenceEditor';
import { ReminderEditor } from './ReminderEditor';

export interface EventFormHandle {
  /** Mirrors `MeetingBasicInfoHandle`: returns null when invalid. */
  getFormValues: () => Promise<MeetingCreateData | MeetingUpdateData | null>;
}

interface EventFormProps {
  meeting?: Meeting | null;
  draft?: CalendarDraftEvent | null;
  mode: 'view' | 'edit' | 'create';
  timezone: string;
  timeFormat?: '12h' | '24h';
  defaultDurationMinutes?: number;
}

const MEETING_TYPES: Array<{ value: MeetingType; label: string }> = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'CALL', label: 'Call' },
  { value: 'SITE_VISIT', label: 'Site visit' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'OTHER', label: 'Other' },
];

const VISIBILITIES: Array<{ value: MeetingVisibility; label: string; hint: string }> = [
  { value: 'DEFAULT', label: 'Default', hint: 'Teammates with full access see the details' },
  { value: 'PRIVATE', label: 'Private', hint: 'Others see only that you are busy' },
  { value: 'PUBLIC', label: 'Public', hint: 'Visible to everyone in the tenant' },
];

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
    <Label className="text-[13px] font-normal text-muted-foreground">{label}</Label>
    <div className="min-w-0">{children}</div>
  </div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
    {children}
  </p>
);

/**
 * The drawer body.
 *
 * TIMEZONE. Every picker below operates on a ZONED date (the wall clock in
 * `timezone`), and `getFormValues()` converts back to a real UTC instant with
 * `fromZoned()` before the payload leaves this component. The old
 * `MeetingBasicInfo` used a native `datetime-local` input plus
 * `new Date(...).toISOString()`, which silently used the browser's zone; this
 * form fixes that.
 *
 * ALL-DAY. Toggling all-day does not merely blank the time inputs — it rewrites
 * the payload into a whole-day range whose end is EXCLUSIVE midnight, which is
 * how the backend and `getEventDayKeys()` both model it.
 */
export const EventForm = forwardRef<EventFormHandle, EventFormProps>(function EventForm(
  { meeting, draft, mode, timezone, timeFormat = '12h', defaultDurationMinutes = 30 },
  ref
) {
  const tz = safeTimeZone(timezone);
  const isReadOnly = mode === 'view';

  const initialStart = meeting?.start_at ?? draft?.start_at ?? new Date().toISOString();
  const initialEnd =
    meeting?.end_at ??
    draft?.end_at ??
    addMinutes(new Date(initialStart), defaultDurationMinutes).toISOString();

  const [title, setTitle] = useState(meeting?.title ?? draft?.title ?? '');
  const [meetingType, setMeetingType] = useState<MeetingType>(meeting?.meeting_type ?? 'MEETING');
  const [allDay, setAllDay] = useState<boolean>(meeting?.all_day ?? draft?.all_day ?? false);
  const [startZoned, setStartZoned] = useState<Date>(() => toZoned(initialStart, tz));
  const [endZoned, setEndZoned] = useState<Date>(() => toZoned(initialEnd, tz));
  const [location, setLocation] = useState(meeting?.location ?? '');
  const [conferenceUrl, setConferenceUrl] = useState(meeting?.conference_url ?? '');
  const [leadId, setLeadId] = useState<number | null>(meeting?.lead ?? draft?.lead ?? null);
  const [description, setDescription] = useState(meeting?.description ?? '');
  const [notes, setNotes] = useState(meeting?.notes ?? '');
  const [visibility, setVisibility] = useState<MeetingVisibility>(
    meeting?.visibility ?? 'DEFAULT'
  );
  const [busyBlocks, setBusyBlocks] = useState<boolean>(
    (meeting?.transparency ?? 'OPAQUE') === 'OPAQUE'
  );
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(
    meeting?.recurrence_rule ?? null
  );
  const [attendees, setAttendees] = useState<MeetingAttendee[]>(meeting?.attendees ?? []);
  const [reminders, setReminders] = useState<MeetingReminderRule[]>(
    meeting?.reminder_rules ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);

  // Re-seed when the drawer switches to a different meeting.
  useEffect(() => {
    if (!meeting) return;
    setTitle(meeting.title ?? '');
    setMeetingType(meeting.meeting_type ?? 'MEETING');
    setAllDay(!!meeting.all_day);
    setStartZoned(toZoned(meeting.start_at, tz));
    setEndZoned(toZoned(meeting.end_at, tz));
    setLocation(meeting.location ?? '');
    setConferenceUrl(meeting.conference_url ?? '');
    setLeadId(meeting.lead ?? null);
    setDescription(meeting.description ?? '');
    setNotes(meeting.notes ?? '');
    setVisibility(meeting.visibility ?? 'DEFAULT');
    setBusyBlocks((meeting.transparency ?? 'OPAQUE') === 'OPAQUE');
    setRecurrenceRule(meeting.recurrence_rule ?? null);
    setAttendees(meeting.attendees ?? []);
    setReminders(meeting.reminder_rules ?? []);
  }, [meeting, tz]);

  const { data: leadsData } = useSWR<{ results: Lead[] }>(
    'leads-for-calendar',
    async () => {
      const response = await crmClient.get(`${API_CONFIG.CRM.LEADS}?page_size=100`);
      return response.data;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const leads = leadsData?.results ?? [];

  /**
   * Convert the current widget state into UTC instants.
   * All-day: [midnight, next midnight) in the event's timezone.
   */
  const toInstants = useCallback((): { start: string; end: string } => {
    if (allDay) {
      const dayStart = startOfDay(startZoned);
      const lastDay = startOfDay(endZoned) < dayStart ? dayStart : startOfDay(endZoned);
      return {
        start: fromZoned(dayStart, tz).toISOString(),
        end: fromZoned(addDays(lastDay, 1), tz).toISOString(),
      };
    }
    return {
      start: fromZoned(startZoned, tz).toISOString(),
      end: fromZoned(endZoned, tz).toISOString(),
    };
  }, [allDay, startZoned, endZoned, tz]);

  const instants = useMemo(() => toInstants(), [toInstants]);
  const debouncedStart = useDebouncedValue(instants.start, 600);
  const debouncedEnd = useDebouncedValue(instants.end, 600);

  // Advisory conflict check while the user edits the time.
  useEffect(() => {
    if (isReadOnly || !debouncedStart || !debouncedEnd) return;
    let cancelled = false;
    calendarService
      .checkConflicts({
        start_at: debouncedStart,
        end_at: debouncedEnd,
        user_ids: attendees.map((a) => a.user_id).filter((id): id is string => !!id),
        exclude_meeting_id: meeting?.id ?? null,
        recurrence_rule: recurrenceRule,
      })
      .then((result) => {
        if (!cancelled) setConflicts(result.conflicts ?? []);
      })
      .catch(() => {
        if (!cancelled) setConflicts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedStart, debouncedEnd, attendees, meeting?.id, recurrenceRule, isReadOnly]);

  useImperativeHandle(ref, () => ({
    getFormValues: async () => {
      const nextErrors: Record<string, string> = {};
      if (!title.trim()) nextErrors.title = 'Title is required';

      const { start, end } = toInstants();
      if (new Date(end) <= new Date(start)) {
        nextErrors.end_at = 'End time must be after start time';
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return null;

      const payload: MeetingCreateData = {
        title: title.trim(),
        start_at: start,
        end_at: end,
        all_day: allDay,
        timezone: tz,
        meeting_type: meetingType,
        visibility,
        transparency: busyBlocks ? 'OPAQUE' : 'TRANSPARENT',
        lead: leadId,
        location: location || undefined,
        conference_url: conferenceUrl || undefined,
        description: description || undefined,
        notes: notes || undefined,
        recurrence_rule: recurrenceRule,
        attendees,
        reminder_rules: reminders,
      };
      return payload;
    },
  }));

  return (
    <div className="space-y-5">
      <section>
        <div className="divide-y divide-border/40">
          <Row label="Title">
            <Input
              value={title}
              disabled={isReadOnly}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product demo"
              className="h-9"
            />
            {errors.title ? <p className="mt-1 text-xs text-red-500">{errors.title}</p> : null}
          </Row>

          <Row label="Type">
            <Select
              value={meetingType}
              disabled={isReadOnly}
              onValueChange={(v) => setMeetingType(v as MeetingType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          <Row label="All day">
            <div className="flex items-center gap-2">
              <Switch
                checked={allDay}
                disabled={isReadOnly}
                onCheckedChange={setAllDay}
                aria-label="All day event"
              />
              <span className="text-xs text-muted-foreground">
                {allDay ? 'Spans whole days' : 'Has a start and end time'}
              </span>
            </div>
          </Row>

          <Row label={allDay ? 'From' : 'Starts'}>
            <DateTimePicker
              date={startZoned}
              disabled={isReadOnly}
              onDateTimeChange={(date) => {
                if (!date) return;
                setStartZoned(date);
                // Keep the duration when the start moves.
                const delta = endZoned.getTime() - startZoned.getTime();
                setEndZoned(new Date(date.getTime() + Math.max(delta, 15 * 60000)));
              }}
              className="h-9 w-full"
            />
          </Row>

          <Row label={allDay ? 'To' : 'Ends'}>
            <DateTimePicker
              date={endZoned}
              disabled={isReadOnly}
              onDateTimeChange={(date) => date && setEndZoned(date)}
              className="h-9 w-full"
            />
            {errors.end_at ? <p className="mt-1 text-xs text-red-500">{errors.end_at}</p> : null}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tz} · {formatInZone(instants.start, tz, 'EEE d MMM, h:mm a')}
            </p>
          </Row>
        </div>
      </section>

      {conflicts.length ? (
        <ConflictWarning conflicts={conflicts} timezone={tz} timeFormat={timeFormat} />
      ) : null}

      <section>
        <SectionHeading>Where</SectionHeading>
        <div className="divide-y divide-border/40">
          <Row label="Location">
            <Input
              value={location}
              disabled={isReadOnly}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Office, Zoom, client site…"
              className="h-9"
            />
          </Row>
          <Row label="Meeting link">
            <Input
              value={conferenceUrl}
              disabled={isReadOnly}
              onChange={(e) => setConferenceUrl(e.target.value)}
              placeholder="https://…"
              className="h-9"
            />
          </Row>
          <Row label="Lead">
            <Select
              value={leadId ? String(leadId) : 'none'}
              disabled={isReadOnly}
              onValueChange={(v) => setLeadId(v === 'none' ? null : Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="No lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lead</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={String(lead.id)}>
                    {lead.name || `Lead #${lead.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>
      </section>

      <section>
        <SectionHeading>People</SectionHeading>
        <AttendeePicker value={attendees} onChange={setAttendees} disabled={isReadOnly} />
        {!isReadOnly && attendees.length ? (
          <div className="mt-2">
            <AvailabilityFinder
              userIds={attendees.map((a) => a.user_id).filter((id): id is string => !!id)}
              start={instants.start}
              end={addDays(new Date(instants.start), 7).toISOString()}
              timezone={tz}
              timeFormat={timeFormat}
              durationMinutes={Math.max(
                15,
                Math.round(
                  (new Date(instants.end).getTime() - new Date(instants.start).getTime()) / 60000
                )
              )}
              onPickSlot={(start, end) => {
                setStartZoned(toZoned(start, tz));
                setEndZoned(toZoned(end, tz));
              }}
            />
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading>Repeats</SectionHeading>
        <RecurrenceEditor
          value={recurrenceRule}
          onChange={setRecurrenceRule}
          startZoned={startZoned}
          timezone={tz}
          disabled={isReadOnly}
        />
      </section>

      <section>
        <SectionHeading>Reminders</SectionHeading>
        <ReminderEditor value={reminders} onChange={setReminders} disabled={isReadOnly} />
      </section>

      <section>
        <SectionHeading>Visibility</SectionHeading>
        <div className="divide-y divide-border/40">
          <Row label="Who can see">
            <Select
              value={visibility}
              disabled={isReadOnly}
              onValueChange={(v) => setVisibility(v as MeetingVisibility)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITIES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {VISIBILITIES.find((v) => v.value === visibility)?.hint}
            </p>
          </Row>
          <Row label="Show me as">
            <div className="flex items-center gap-2">
              <Switch
                checked={busyBlocks}
                disabled={isReadOnly}
                onCheckedChange={setBusyBlocks}
                aria-label="Show as busy"
              />
              <span className="text-xs text-muted-foreground">
                {busyBlocks ? 'Busy' : 'Free'}
              </span>
            </div>
          </Row>
        </div>
      </section>

      <section>
        <SectionHeading>Notes</SectionHeading>
        <div className="space-y-2">
          <Textarea
            value={description}
            disabled={isReadOnly}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agenda / description"
            className="min-h-[72px] text-[13px]"
          />
          <Textarea
            value={notes}
            disabled={isReadOnly}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes"
            className="min-h-[56px] text-[13px]"
          />
        </div>
      </section>
    </div>
  );
});

export default EventForm;
