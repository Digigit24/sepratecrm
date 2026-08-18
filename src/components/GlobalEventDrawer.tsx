// src/components/GlobalEventDrawer.tsx
//
// A single, globally-mounted `EventDetailDrawer` driven by `calendarStore`, in
// the same shape as `GlobalLeadDrawer` + `leadDrawerStore`. Mounting it once in
// `App.tsx` means a meeting can be opened from the calendar, a lead page, a
// notification click or the copilot without any of them owning drawer state.

import { EventDetailDrawer } from '@/components/calendar/EventDetailDrawer';
import { useCalendarStore } from '@/store/calendarStore';

export function GlobalEventDrawer() {
  const isOpen = useCalendarStore((s) => s.isDrawerOpen);
  const drawerMode = useCalendarStore((s) => s.drawerMode);
  const selectedMeetingId = useCalendarStore((s) => s.selectedMeetingId);
  const selectedOccurrenceStart = useCalendarStore((s) => s.selectedOccurrenceStart);
  const draftEvent = useCalendarStore((s) => s.draftEvent);
  const timezone = useCalendarStore((s) => s.timezone);
  const timeFormat = useCalendarStore((s) => s.timeFormat);
  const defaultDurationMinutes = useCalendarStore((s) => s.defaultDurationMinutes);
  const setDrawerMode = useCalendarStore((s) => s.setDrawerMode);
  const closeEvent = useCalendarStore((s) => s.closeEvent);

  // Nothing is mounted until something asks for it — this component costs
  // nothing on pages that never open an event.
  if (!isOpen) return null;

  return (
    <EventDetailDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeEvent();
      }}
      meetingId={selectedMeetingId}
      occurrenceStart={selectedOccurrenceStart}
      draft={draftEvent}
      mode={drawerMode}
      onModeChange={setDrawerMode}
      timezone={timezone}
      timeFormat={timeFormat}
      defaultDurationMinutes={defaultDurationMinutes}
    />
  );
}

export default GlobalEventDrawer;
