// src/store/calendarStore.ts
//
// All calendar view state in one zustand store, in the same style as
// `leadDrawerStore.ts`. Keeping it out of React state means the toolbar, the
// left rail, the grid and the globally-mounted event drawer all read the same
// values without prop drilling, and a meeting can be opened from a lead page or
// a notification click.
//
// The `timezone` here is the seed described in the plan: it comes from the
// browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and is later
// overwritten by the server's `CalendarPreference` once that endpoint answers.
// The backend always stores UTC + an explicit IANA zone; this value only
// decides how those instants are PROJECTED onto the grid.

import { create } from 'zustand';
import { addDays, addMonths, addWeeks } from 'date-fns';
import type {
  CalendarDraftEvent,
  CalendarLayer,
  CalendarPreference,
  CalendarView,
  TeamMode,
} from '@/types/calendar.types';
import { getBrowserTimeZone, type WeekStartsOn } from '@/utils/calendarTime';

const STORAGE_KEY = 'celiyo-calendar-ui-state';

export const ALL_LAYERS: CalendarLayer[] = ['meetings', 'tasks', 'follow_ups'];

export type EventDrawerMode = 'view' | 'edit' | 'create';

interface PersistedState {
  view: CalendarView;
  visibleLayers: CalendarLayer[];
  visibleUserIds: string[];
  teamMode: TeamMode;
}

/** Read the locally-cached slice. Never throws (private mode / quota). */
const readPersisted = (): Partial<PersistedState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      view: parsed.view,
      visibleLayers: Array.isArray(parsed.visibleLayers) ? parsed.visibleLayers : undefined,
      visibleUserIds: Array.isArray(parsed.visibleUserIds) ? parsed.visibleUserIds : undefined,
      teamMode: parsed.teamMode,
    };
  } catch {
    return {};
  }
};

const writePersisted = (state: PersistedState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — view state is not worth failing over */
  }
};

interface CalendarStore {
  // --- view ---------------------------------------------------------------
  view: CalendarView;
  anchorDate: Date;
  timezone: string;
  weekStartsOn: WeekStartsOn;
  timeFormat: '12h' | '24h';
  pxPerHour: number;

  // --- layers & team ------------------------------------------------------
  visibleLayers: CalendarLayer[];
  visibleUserIds: string[];
  teamMode: TeamMode;
  includeCancelled: boolean;

  // --- working hours (from CalendarPreference) ----------------------------
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  defaultDurationMinutes: number;

  // --- drawer -------------------------------------------------------------
  isDrawerOpen: boolean;
  drawerMode: EventDrawerMode;
  selectedEventId: string | null;
  selectedMeetingId: number | null;
  selectedOccurrenceStart: string | null;
  draftEvent: CalendarDraftEvent | null;

  // --- actions ------------------------------------------------------------
  setView: (view: CalendarView) => void;
  setAnchorDate: (date: Date) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  setTimezone: (tz: string) => void;
  toggleLayer: (layer: CalendarLayer) => void;
  setVisibleUserIds: (ids: string[]) => void;
  toggleUser: (userId: string) => void;
  setTeamMode: (mode: TeamMode) => void;
  setIncludeCancelled: (value: boolean) => void;
  applyPreferences: (prefs: CalendarPreference) => void;

  openEvent: (
    eventId: string,
    meetingId: number | null,
    occurrenceStart?: string | null,
    mode?: EventDrawerMode
  ) => void;
  openMeeting: (meetingId: number, mode?: EventDrawerMode) => void;
  startDraft: (draft: CalendarDraftEvent) => void;
  setDrawerMode: (mode: EventDrawerMode) => void;
  closeEvent: () => void;
}

const persisted = readPersisted();

/** Step the anchor by one unit of the current view. */
const step = (view: CalendarView, date: Date, direction: 1 | -1): Date => {
  switch (view) {
    case 'month':
      return addMonths(date, direction);
    case 'week':
      return addWeeks(date, direction);
    case 'day':
      return addDays(date, direction);
    case 'agenda':
    default:
      return addDays(date, direction * 30);
  }
};

export const useCalendarStore = create<CalendarStore>((set, get) => {
  const persist = () => {
    const { view, visibleLayers, visibleUserIds, teamMode } = get();
    writePersisted({ view, visibleLayers, visibleUserIds, teamMode });
  };

  return {
    view: persisted.view ?? 'month',
    anchorDate: new Date(),
    timezone: getBrowserTimeZone(),
    weekStartsOn: 0,
    timeFormat: '12h',
    pxPerHour: 48,

    visibleLayers: persisted.visibleLayers ?? ALL_LAYERS,
    visibleUserIds: persisted.visibleUserIds ?? [],
    teamMode: persisted.teamMode ?? 'off',
    includeCancelled: false,

    workingHoursStart: '09:00',
    workingHoursEnd: '18:00',
    workingDays: [1, 2, 3, 4, 5],
    defaultDurationMinutes: 30,

    isDrawerOpen: false,
    drawerMode: 'view',
    selectedEventId: null,
    selectedMeetingId: null,
    selectedOccurrenceStart: null,
    draftEvent: null,

    setView: (view) => {
      set({ view });
      persist();
    },
    setAnchorDate: (anchorDate) => set({ anchorDate }),
    goToday: () => set({ anchorDate: new Date() }),
    goPrev: () => set((s) => ({ anchorDate: step(s.view, s.anchorDate, -1) })),
    goNext: () => set((s) => ({ anchorDate: step(s.view, s.anchorDate, 1) })),

    setTimezone: (timezone) => set({ timezone }),

    toggleLayer: (layer) => {
      set((s) => ({
        visibleLayers: s.visibleLayers.includes(layer)
          ? s.visibleLayers.filter((l) => l !== layer)
          : [...s.visibleLayers, layer],
      }));
      persist();
    },

    setVisibleUserIds: (visibleUserIds) => {
      set({ visibleUserIds });
      persist();
    },

    toggleUser: (userId) => {
      set((s) => ({
        visibleUserIds: s.visibleUserIds.includes(userId)
          ? s.visibleUserIds.filter((id) => id !== userId)
          : [...s.visibleUserIds, userId],
      }));
      persist();
    },

    setTeamMode: (teamMode) => {
      set({ teamMode });
      persist();
    },

    setIncludeCancelled: (includeCancelled) => set({ includeCancelled }),

    /** Server preferences win over the browser-seeded defaults. */
    applyPreferences: (prefs) =>
      set((s) => ({
        timezone: prefs.timezone || s.timezone,
        weekStartsOn: (prefs.week_starts_on ?? s.weekStartsOn) as WeekStartsOn,
        timeFormat: prefs.time_format ?? s.timeFormat,
        workingHoursStart: prefs.working_hours_start ?? s.workingHoursStart,
        workingHoursEnd: prefs.working_hours_end ?? s.workingHoursEnd,
        workingDays: prefs.working_days ?? s.workingDays,
        defaultDurationMinutes:
          prefs.default_meeting_duration_minutes ?? s.defaultDurationMinutes,
        // Locally-toggled layers/users win: the user just clicked them.
        visibleLayers: s.visibleLayers.length ? s.visibleLayers : prefs.visible_layers ?? ALL_LAYERS,
        visibleUserIds: s.visibleUserIds.length
          ? s.visibleUserIds
          : prefs.visible_user_ids ?? [],
      })),

    openEvent: (eventId, meetingId, occurrenceStart = null, mode = 'view') =>
      set({
        isDrawerOpen: true,
        drawerMode: mode,
        selectedEventId: eventId,
        selectedMeetingId: meetingId,
        selectedOccurrenceStart: occurrenceStart,
        draftEvent: null,
      }),

    openMeeting: (meetingId, mode = 'view') =>
      set({
        isDrawerOpen: true,
        drawerMode: mode,
        selectedEventId: `meeting:${meetingId}`,
        selectedMeetingId: meetingId,
        selectedOccurrenceStart: null,
        draftEvent: null,
      }),

    startDraft: (draftEvent) =>
      set({
        isDrawerOpen: true,
        drawerMode: 'create',
        selectedEventId: null,
        selectedMeetingId: null,
        selectedOccurrenceStart: null,
        draftEvent,
      }),

    setDrawerMode: (drawerMode) => set({ drawerMode }),

    closeEvent: () =>
      set({
        isDrawerOpen: false,
        selectedEventId: null,
        selectedMeetingId: null,
        selectedOccurrenceStart: null,
        draftEvent: null,
        drawerMode: 'view',
      }),
  };
});
