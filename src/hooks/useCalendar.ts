/**
 * SWR hooks for the calendar, in the house style of `useMeeting.ts`:
 * array cache keys, gated on `hasCRMAccess`, `revalidateOnFocus: false`,
 * `shouldRetryOnError: false`.
 *
 * Two things here are load-bearing:
 *
 * - `keepPreviousData: true` on the range query. Without it the grid blanks
 *   every time the user pages a month, which reads as a flicker/jump.
 * - PRIVATE redaction is applied HERE, once, at the edge of the data layer
 *   (`redactFeed`). Every downstream component therefore receives an event
 *   whose title is already "Busy" — no component can accidentally read a
 *   private title, because the private title is not in the object any more.
 */

import { useCallback, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { calendarService } from '@/services/calendarService';
import { redactFeed } from '@/lib/calendarColors';
import { MASTER_DATA_DEDUPE_MS } from '@/lib/swrConfig';
import type {
  AvailabilityRequest,
  CalendarLayersResponse,
  CalendarPreference,
  CalendarRangeParams,
  CalendarRangeResponse,
  ConflictRequest,
} from '@/types/calendar.types';

export const CALENDAR_EVENTS_KEY = 'calendar-events';
export const CALENDAR_PREFS_KEY = 'calendar-preferences';
export const CALENDAR_LAYERS_KEY = 'calendar-layers';

/** Revalidate every calendar range currently in the SWR cache. */
export const revalidateCalendar = (): Promise<unknown> =>
  globalMutate(
    (key) => Array.isArray(key) && key[0] === CALENDAR_EVENTS_KEY,
    undefined,
    { revalidate: true }
  );

export const useCalendar = () => {
  const { user, hasModuleAccess } = useAuth();
  const hasCRMAccess = hasModuleAccess('crm');
  const viewerUserId = user?.id ?? null;

  /**
   * The core range query. `params` is used verbatim as part of the cache key,
   * so callers must memoise it (see `Calendar.tsx`).
   */
  const useCalendarEvents = (params: CalendarRangeParams | null) =>
    useSWR<CalendarRangeResponse>(
      hasCRMAccess && params ? [CALENDAR_EVENTS_KEY, params] : null,
      async () => {
        const response = await calendarService.getEvents(params as CalendarRangeParams);
        // Fail-closed redaction — see the note at the top of this file.
        return { ...response, events: redactFeed(response.events, viewerUserId) };
      },
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        keepPreviousData: true,
      }
    );

  const useCalendarPreferences = () =>
    useSWR<CalendarPreference>(
      hasCRMAccess ? [CALENDAR_PREFS_KEY] : null,
      () => calendarService.getPreferences(),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: MASTER_DATA_DEDUPE_MS,
      }
    );

  const useCalendarLayers = () =>
    useSWR<CalendarLayersResponse>(
      hasCRMAccess ? [CALENDAR_LAYERS_KEY] : null,
      () => calendarService.getLayers(),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        dedupingInterval: MASTER_DATA_DEDUPE_MS,
      }
    );

  /**
   * Persist a preference change. Deliberately fire-and-forget: a preference
   * write failing must not interrupt the user's browsing.
   */
  const savePreferences = useCallback(
    async (patch: Partial<CalendarPreference>) => {
      try {
        const next = await calendarService.updatePreferences(patch);
        globalMutate([CALENDAR_PREFS_KEY], next, { revalidate: false });
      } catch (error) {
        console.warn('Calendar preferences not saved:', error);
      }
    },
    []
  );

  const checkConflicts = useCallback(
    (payload: ConflictRequest) => calendarService.checkConflicts(payload),
    []
  );

  const getAvailability = useCallback(
    (payload: AvailabilityRequest) => calendarService.getAvailability(payload),
    []
  );

  return {
    hasCRMAccess,
    viewerUserId,
    useCalendarEvents,
    useCalendarPreferences,
    useCalendarLayers,
    savePreferences,
    checkConflicts,
    getAvailability,
    revalidateCalendar,
  };
};

/**
 * Debounced preference writer. The store updates instantly (so the UI never
 * waits on the network) and the server is told at most once per second.
 */
export const useDebouncedPreferenceSync = (delayMs = 1000) => {
  const { savePreferences } = useCalendar();

  return useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: Partial<CalendarPreference> = {};

    return (patch: Partial<CalendarPreference>) => {
      pending = { ...pending, ...patch };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const payload = pending;
        pending = {};
        timer = null;
        void savePreferences(payload);
      }, delayMs);
    };
  }, [savePreferences, delayMs]);
};
