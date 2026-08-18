/**
 * Meeting Service - API calls for Meeting management
 * Matches Django backend endpoints in crm/meetings/
 */

import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import {
  Meeting,
  MeetingListParams,
  MeetingCreateData,
  MeetingUpdateData,
  MeetingAttendee,
  MeetingEditOptions,
  MeetingSplitResponse,
  PaginatedMeetingResponse,
} from '@/types/meeting.types';

/**
 * Recurrence edit semantics (§B.3): every mutating call on a recurring meeting
 * carries `edit_scope` and, unless the scope is `all`, the UTC
 * `occurrence_start` of the occurrence the user actually clicked.
 */
const editScopeQuery = (options?: MeetingEditOptions): string => {
  if (!options?.editScope) return '';
  const params: Record<string, string> = { edit_scope: options.editScope };
  if (options.editScope !== 'all' && options.occurrenceStart) {
    params.occurrence_start = options.occurrenceStart;
  }
  return buildQueryString(params);
};

/**
 * Pull a message off an axios error without widening to `any`. The older
 * methods in this file predate this helper and still use `catch (error: any)`;
 * new code uses this instead.
 */
const errorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { detail?: string; message?: string } } })
    ?.response;
  return response?.data?.detail || response?.data?.message || (error as Error)?.message || fallback;
};

const editScopeBody = (options?: MeetingEditOptions): Record<string, unknown> => {
  if (!options?.editScope) return {};
  const body: Record<string, unknown> = { edit_scope: options.editScope };
  if (options.editScope !== 'all' && options.occurrenceStart) {
    body.occurrence_start = options.occurrenceStart;
  }
  return body;
};

class MeetingService {
  /**
   * Get paginated list of meetings with optional filtering
   * GET /crm/meetings/
   */
  async getMeetings(params?: MeetingListParams): Promise<PaginatedMeetingResponse> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get(
        `${API_CONFIG.CRM.MEETINGS}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching meetings:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to fetch meetings');
    }
  }

  /**
   * Get a single meeting by ID
   * GET /crm/meetings/:id/
   */
  async getMeeting(id: number): Promise<Meeting> {
    try {
      const response = await crmClient.get(
        API_CONFIG.CRM.MEETING_DETAIL.replace(':id', id.toString())
      );
      // Handle both direct response and nested data response
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`Error fetching meeting ${id}:`, error);
      throw new Error(error?.response?.data?.detail || 'Failed to fetch meeting');
    }
  }

  /**
   * Create a new meeting
   * POST /crm/meetings/
   */
  async createMeeting(meetingData: MeetingCreateData): Promise<Meeting> {
    try {
      // Validate required fields
      if (!meetingData.title) {
        throw new Error('Title is required');
      }
      if (!meetingData.start_at) {
        throw new Error('Start time is required');
      }
      if (!meetingData.end_at) {
        throw new Error('End time is required');
      }

      // Validate end_at is after start_at
      const startDate = new Date(meetingData.start_at);
      const endDate = new Date(meetingData.end_at);
      if (endDate <= startDate) {
        throw new Error('End time must be after start time');
      }

      const response = await crmClient.post(
        API_CONFIG.CRM.MEETING_CREATE,
        meetingData
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      const errorMessage = error?.response?.data?.detail
        || error?.response?.data?.message
        || error?.message
        || 'Failed to create meeting';
      throw new Error(errorMessage);
    }
  }

  /**
   * Update an existing meeting
   * PUT /crm/meetings/:id/
   */
  async updateMeeting(id: number, meetingData: MeetingUpdateData): Promise<Meeting> {
    try {
      // Validate end_at is after start_at if both are provided
      if (meetingData.start_at && meetingData.end_at) {
        const startDate = new Date(meetingData.start_at);
        const endDate = new Date(meetingData.end_at);
        if (endDate <= startDate) {
          throw new Error('End time must be after start time');
        }
      }

      const response = await crmClient.put(
        API_CONFIG.CRM.MEETING_UPDATE.replace(':id', id.toString()),
        meetingData
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`Error updating meeting ${id}:`, error);
      const errorMessage = error?.response?.data?.detail
        || error?.response?.data?.message
        || error?.message
        || 'Failed to update meeting';
      throw new Error(errorMessage);
    }
  }

  /**
   * Partially update a meeting
   * PATCH /crm/meetings/:id/
   */
  async patchMeeting(
    id: number,
    meetingData: Partial<MeetingUpdateData>,
    options?: MeetingEditOptions
  ): Promise<Meeting | MeetingSplitResponse> {
    try {
      const response = await crmClient.patch(
        `${API_CONFIG.CRM.MEETING_UPDATE.replace(':id', id.toString())}${editScopeQuery(options)}`,
        meetingData
      );
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error(`Error patching meeting ${id}:`, error);
      const errorMessage = error?.response?.data?.detail
        || error?.response?.data?.message
        || error?.message
        || 'Failed to update meeting';
      throw new Error(errorMessage);
    }
  }

  /**
   * Delete a meeting
   * DELETE /crm/meetings/:id/
   */
  async deleteMeeting(id: number, options?: MeetingEditOptions): Promise<void> {
    try {
      await crmClient.delete(
        `${API_CONFIG.CRM.MEETING_DELETE.replace(':id', id.toString())}${editScopeQuery(options)}`
      );
    } catch (error: any) {
      console.error(`Error deleting meeting ${id}:`, error);
      throw new Error(error?.response?.data?.detail || 'Failed to delete meeting');
    }
  }

  /**
   * Cancel a meeting (soft, keeps the row) — POST /meetings/:id/cancel/
   */
  async cancelMeeting(
    id: number,
    reason?: string,
    options?: MeetingEditOptions
  ): Promise<Meeting> {
    try {
      const response = await crmClient.post(
        API_CONFIG.CRM.MEETING_CANCEL.replace(':id', id.toString()),
        { reason, ...editScopeBody(options) }
      );
      return response.data?.data || response.data;
    } catch (error: unknown) {
      console.error(`Error cancelling meeting ${id}:`, error);
      throw new Error(errorMessage(error, 'Failed to cancel meeting'));
    }
  }

  /**
   * Mark a meeting complete — POST /meetings/:id/complete/
   */
  async completeMeeting(
    id: number,
    notes?: string,
    occurrenceStart?: string | null
  ): Promise<Meeting> {
    try {
      const response = await crmClient.post(
        API_CONFIG.CRM.MEETING_COMPLETE.replace(':id', id.toString()),
        { notes, occurrence_start: occurrenceStart || undefined }
      );
      return response.data?.data || response.data;
    } catch (error: unknown) {
      console.error(`Error completing meeting ${id}:`, error);
      throw new Error(errorMessage(error, 'Failed to complete meeting'));
    }
  }

  /**
   * Respond to an invitation — POST /meetings/:id/rsvp/
   * Allowed for attendees who do NOT hold meetings.edit on the row.
   */
  async rsvp(
    id: number,
    responseStatus: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
    comment?: string,
    occurrenceStart?: string | null
  ): Promise<MeetingAttendee> {
    try {
      const response = await crmClient.post(
        API_CONFIG.CRM.MEETING_RSVP.replace(':id', id.toString()),
        { response_status: responseStatus, comment, occurrence_start: occurrenceStart || undefined }
      );
      return response.data?.data || response.data;
    } catch (error: unknown) {
      console.error(`Error responding to meeting ${id}:`, error);
      throw new Error(errorMessage(error, 'Failed to send response'));
    }
  }

  /**
   * Add attendees — POST /meetings/:id/attendees/
   */
  async addAttendees(id: number, attendees: MeetingAttendee[]): Promise<MeetingAttendee[]> {
    try {
      const response = await crmClient.post(
        API_CONFIG.CRM.MEETING_ATTENDEES.replace(':id', id.toString()),
        { attendees }
      );
      return response.data?.data || response.data;
    } catch (error: unknown) {
      console.error(`Error adding attendees to meeting ${id}:`, error);
      throw new Error(errorMessage(error, 'Failed to add attendees'));
    }
  }

  /**
   * Remove an attendee — DELETE /meetings/:id/attendees/:attendeeId/
   */
  async removeAttendee(id: number, attendeeId: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.MEETING_ATTENDEE_DETAIL
          .replace(':id', id.toString())
          .replace(':attendeeId', attendeeId.toString())
      );
    } catch (error: unknown) {
      console.error(`Error removing attendee ${attendeeId}:`, error);
      throw new Error(errorMessage(error, 'Failed to remove attendee'));
    }
  }

  /**
   * Expanded occurrences of one series — GET /meetings/:id/occurrences/
   * Drives the recurrence preview in the editor.
   */
  async getOccurrences(
    id: number,
    start: string,
    end: string
  ): Promise<{ occurrences: Array<{ start_at: string; end_at: string; is_override?: boolean }> }> {
    try {
      const response = await crmClient.get(
        `${API_CONFIG.CRM.MEETING_OCCURRENCES.replace(':id', id.toString())}${buildQueryString({ start, end })}`
      );
      return response.data;
    } catch (error: unknown) {
      console.error(`Error fetching occurrences for meeting ${id}:`, error);
      throw new Error(errorMessage(error, 'Failed to fetch occurrences'));
    }
  }

  /**
   * Get meetings for a specific lead
   * Convenience method using lead filter
   */
  async getMeetingsByLead(leadId: number, params?: MeetingListParams): Promise<PaginatedMeetingResponse> {
    return this.getMeetings({
      ...params,
      lead: leadId,
    });
  }

  /**
   * Get upcoming meetings
   * Convenience method to filter by start_at >= now
   */
  async getUpcomingMeetings(params?: MeetingListParams): Promise<PaginatedMeetingResponse> {
    const now = new Date().toISOString();
    return this.getMeetings({
      ...params,
      start_at__gte: now,
      ordering: 'start_at',
    });
  }

  /**
   * Get past meetings
   * Convenience method to filter by end_at < now
   */
  async getPastMeetings(params?: MeetingListParams): Promise<PaginatedMeetingResponse> {
    const now = new Date().toISOString();
    return this.getMeetings({
      ...params,
      end_at__lte: now,
      ordering: '-start_at',
    });
  }
}

// Export singleton instance
export const meetingService = new MeetingService();
