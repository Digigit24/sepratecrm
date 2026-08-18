/**
 * Calendar Service — the client for the unified `/api/calendar/` surface
 * (`_plans/06-calendar-meetings.md` §B.2, endpoints 13-19).
 *
 * DEGRADATION CONTRACT
 * --------------------
 * The `scheduling` Django app that serves these routes is being built in
 * parallel with this UI. Until it ships, every call here answers 404 (route not
 * mounted) or 502 (upstream user directory down). Rather than let SWR surface a
 * hard error — which would blank the grid — a "route is not there yet" response
 * is normalised into an EMPTY payload carrying `unavailable: true`. The
 * calendar then renders its real chrome with an inline notice, and the moment
 * the backend lands the same code path starts returning data with no change.
 *
 * Genuine failures (400 bad range, 403 permission, 500) are still thrown so the
 * user sees a real error instead of a silently empty calendar.
 */

import type { AxiosError } from 'axios';
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  AvailabilityRequest,
  AvailabilityResponse,
  CalendarLayersResponse,
  CalendarMembersResponse,
  CalendarPreference,
  CalendarRangeParams,
  CalendarRangeResponse,
  ConflictRequest,
  ConflictResponse,
} from '@/types/calendar.types';
import { getBrowserTimeZone } from '@/utils/calendarTime';

/** Status codes that mean "this endpoint does not exist / cannot answer yet". */
const NOT_READY_STATUSES = new Set([404, 405, 501, 502, 503, 504]);

const isNotReady = (error: unknown): boolean => {
  const axiosError = error as AxiosError | undefined;
  if (!axiosError) return false;
  // No response at all → network failure / CORS / server not running.
  if (!axiosError.response) return axiosError.isAxiosError === true;
  return NOT_READY_STATUSES.has(axiosError.response.status);
};

const describe = (error: unknown, fallback: string): string => {
  const data = (error as AxiosError<{ detail?: string; error?: string }>)?.response?.data;
  return data?.detail || data?.error || (error as Error)?.message || fallback;
};

/** Comma-join list params; `undefined` when empty so they are dropped. */
const csv = (values?: string[] | null): string | undefined =>
  values && values.length ? values.join(',') : undefined;

class CalendarService {
  /**
   * `GET /api/calendar/events/` — the one range query the whole grid runs.
   * Meetings + tasks + follow-ups merged server-side, because each source has
   * its own permission scope.
   */
  async getEvents(params: CalendarRangeParams): Promise<CalendarRangeResponse> {
    const query = buildQueryString({
      start: params.start,
      end: params.end,
      tz: params.tz || getBrowserTimeZone(),
      user_ids: csv(params.user_ids),
      layers: csv(params.layers),
      meeting_types: csv(params.meeting_types),
      include_cancelled: params.include_cancelled,
      include_declined: params.include_declined,
      expand_recurring: params.expand_recurring,
    });

    try {
      const response = await crmClient.get<CalendarRangeResponse>(
        `${API_CONFIG.CRM.CALENDAR_EVENTS}${query}`
      );
      const data = response.data;
      return {
        ...data,
        events: Array.isArray(data?.events) ? data.events : [],
      };
    } catch (error) {
      if (isNotReady(error)) {
        return {
          range: { start: params.start, end: params.end, timezone: params.tz || getBrowserTimeZone() },
          events: [],
          requested_user_ids: params.user_ids ?? [],
          denied_user_ids: [],
          truncated: false,
          unavailable: true,
        };
      }
      console.error('Error fetching calendar events:', error);
      throw new Error(describe(error, 'Failed to fetch calendar events'));
    }
  }

  /**
   * `GET /api/calendar/members/` — team directory + stable per-person colour.
   * `can_view_team` is the SERVER's answer and is authoritative; the client
   * permission check only avoids a flash of the team toggle.
   */
  async getMembers(params?: {
    start?: string;
    end?: string;
    search?: string;
  }): Promise<CalendarMembersResponse> {
    try {
      const response = await crmClient.get<CalendarMembersResponse>(
        `${API_CONFIG.CRM.CALENDAR_MEMBERS}${buildQueryString(params)}`
      );
      const data = response.data;
      return {
        can_view_team: !!data?.can_view_team,
        self_user_id: data?.self_user_id ?? null,
        members: Array.isArray(data?.members) ? data.members : [],
      };
    } catch (error) {
      if (isNotReady(error)) {
        // Fail closed: no team list means no team mode.
        return { can_view_team: false, self_user_id: null, members: [], unavailable: true };
      }
      console.error('Error fetching calendar members:', error);
      throw new Error(describe(error, 'Failed to fetch team members'));
    }
  }

  /** `POST /api/calendar/availability/` — free/busy + suggested slots. */
  async getAvailability(payload: AvailabilityRequest): Promise<AvailabilityResponse> {
    try {
      const response = await crmClient.post<AvailabilityResponse>(
        API_CONFIG.CRM.CALENDAR_AVAILABILITY,
        payload
      );
      return {
        busy: response.data?.busy || {},
        suggested_slots: response.data?.suggested_slots || [],
        denied_user_ids: response.data?.denied_user_ids || [],
      };
    } catch (error) {
      if (isNotReady(error)) {
        return { busy: {}, suggested_slots: [], denied_user_ids: [], unavailable: true };
      }
      console.error('Error fetching availability:', error);
      throw new Error(describe(error, 'Failed to fetch availability'));
    }
  }

  /**
   * `POST /api/calendar/conflicts/` — overlap check for a proposed time.
   * A conflict is a WARNING, never a block: double-booking is legitimate.
   */
  async checkConflicts(payload: ConflictRequest): Promise<ConflictResponse> {
    try {
      const response = await crmClient.post<ConflictResponse>(
        API_CONFIG.CRM.CALENDAR_CONFLICTS,
        payload
      );
      return {
        has_conflicts: !!response.data?.has_conflicts,
        conflicts: response.data?.conflicts || [],
      };
    } catch (error) {
      if (isNotReady(error)) {
        return { has_conflicts: false, conflicts: [], unavailable: true };
      }
      console.error('Error checking conflicts:', error);
      throw new Error(describe(error, 'Failed to check conflicts'));
    }
  }

  /**
   * `GET /api/calendar/preferences/`.
   * Falls back to a browser-seeded preference so the grid always has a
   * timezone, even with no backend at all.
   */
  async getPreferences(): Promise<CalendarPreference> {
    try {
      const response = await crmClient.get<CalendarPreference>(
        API_CONFIG.CRM.CALENDAR_PREFERENCES
      );
      const data = response.data || ({} as CalendarPreference);
      return { ...data, timezone: data.timezone || getBrowserTimeZone() };
    } catch (error) {
      if (isNotReady(error)) return { timezone: getBrowserTimeZone() };
      console.error('Error fetching calendar preferences:', error);
      throw new Error(describe(error, 'Failed to fetch calendar preferences'));
    }
  }

  /**
   * `PATCH /api/calendar/preferences/`.
   * Best-effort: a failed preference write must never interrupt the user, so a
   * "not ready" backend resolves with the payload the caller optimistically
   * applied locally.
   */
  async updatePreferences(patch: Partial<CalendarPreference>): Promise<CalendarPreference> {
    try {
      const response = await crmClient.patch<CalendarPreference>(
        API_CONFIG.CRM.CALENDAR_PREFERENCES,
        patch
      );
      return response.data;
    } catch (error) {
      if (isNotReady(error)) {
        return { timezone: getBrowserTimeZone(), ...patch } as CalendarPreference;
      }
      console.error('Error updating calendar preferences:', error);
      throw new Error(describe(error, 'Failed to update calendar preferences'));
    }
  }

  /** `GET /api/calendar/layers/` — static layer metadata. */
  async getLayers(): Promise<CalendarLayersResponse> {
    try {
      const response = await crmClient.get<CalendarLayersResponse>(
        API_CONFIG.CRM.CALENDAR_LAYERS
      );
      return { layers: response.data?.layers || [] };
    } catch (error) {
      if (isNotReady(error)) return { layers: [], unavailable: true };
      console.error('Error fetching calendar layers:', error);
      throw new Error(describe(error, 'Failed to fetch calendar layers'));
    }
  }
}

export const calendarService = new CalendarService();
