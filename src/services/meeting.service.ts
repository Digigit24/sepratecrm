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
  PaginatedMeetingResponse,
  MeetingCalendarData,
  MeetingCalendarParams,
} from '@/types/meeting.types';

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
  async patchMeeting(id: number, meetingData: Partial<MeetingUpdateData>): Promise<Meeting> {
    try {
      const response = await crmClient.patch(
        API_CONFIG.CRM.MEETING_UPDATE.replace(':id', id.toString()),
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
  async deleteMeeting(id: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.MEETING_DELETE.replace(':id', id.toString())
      );
    } catch (error: any) {
      console.error(`Error deleting meeting ${id}:`, error);
      throw new Error(error?.response?.data?.detail || 'Failed to delete meeting');
    }
  }

  /**
   * Get meetings organized by date for calendar view
   * GET /crm/meetings/calendar/
   * Supports filtering by date range or specific month
   */
  async getCalendarData(params?: MeetingCalendarParams): Promise<MeetingCalendarData> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get(
        `${API_CONFIG.CRM.MEETING_CALENDAR}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching calendar data:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to fetch calendar data');
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
