/**
 * Custom hook for Meeting data fetching and mutations
 * Uses SWR for data fetching with caching
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { meetingService } from '@/services/meeting.service';
import {
  Meeting,
  MeetingListParams,
  MeetingCreateData,
  MeetingUpdateData,
  PaginatedMeetingResponse,
  MeetingCalendarData,
  MeetingCalendarParams,
} from '@/types/meeting.types';

export const useMeeting = () => {
  const { hasModuleAccess } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has CRM module access
  const hasCRMAccess = hasModuleAccess('crm');

  /**
   * Hook to fetch paginated list of meetings
   * Returns SWR response with data, loading state, error, and mutate function
   */
  const useMeetings = (params?: MeetingListParams) => {
    return useSWR<PaginatedMeetingResponse>(
      hasCRMAccess ? ['meetings', params] : null,
      () => meetingService.getMeetings(params),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  };

  /**
   * Hook to fetch a single meeting by ID
   * Returns SWR response with data, loading state, error, and mutate function
   */
  const useMeeting = (id: number | null) => {
    return useSWR<Meeting>(
      hasCRMAccess && id ? ['meeting', id] : null,
      () => meetingService.getMeeting(id!),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  };

  /**
   * Hook to fetch calendar data
   * Returns SWR response with calendar data organized by date
   */
  const useMeetingCalendar = (params?: MeetingCalendarParams) => {
    return useSWR<MeetingCalendarData>(
      hasCRMAccess ? ['meetings-calendar', params] : null,
      () => meetingService.getCalendarData(params),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  };

  /**
   * Hook to fetch meetings for a specific lead
   */
  const useMeetingsByLead = (leadId: number | null, params?: MeetingListParams) => {
    return useSWR<PaginatedMeetingResponse>(
      hasCRMAccess && leadId ? ['meetings-by-lead', leadId, params] : null,
      () => meetingService.getMeetingsByLead(leadId!, params),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  };

  /**
   * Hook to fetch upcoming meetings
   */
  const useUpcomingMeetings = (params?: MeetingListParams) => {
    return useSWR<PaginatedMeetingResponse>(
      hasCRMAccess ? ['upcoming-meetings', params] : null,
      () => meetingService.getUpcomingMeetings(params),
      {
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  };

  /**
   * Create a new meeting
   */
  const createMeeting = useCallback(
    async (data: MeetingCreateData): Promise<Meeting> => {
      if (!hasCRMAccess) {
        throw new Error('CRM module is not enabled for your account');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await meetingService.createMeeting(data);
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to create meeting';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [hasCRMAccess]
  );

  /**
   * Update an existing meeting
   */
  const updateMeeting = useCallback(
    async (id: number, data: MeetingUpdateData): Promise<Meeting> => {
      if (!hasCRMAccess) {
        throw new Error('CRM module is not enabled for your account');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await meetingService.updateMeeting(id, data);
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update meeting';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [hasCRMAccess]
  );

  /**
   * Partially update a meeting
   */
  const patchMeeting = useCallback(
    async (id: number, data: Partial<MeetingUpdateData>): Promise<Meeting> => {
      if (!hasCRMAccess) {
        throw new Error('CRM module is not enabled for your account');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await meetingService.patchMeeting(id, data);
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to update meeting';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [hasCRMAccess]
  );

  /**
   * Delete a meeting
   */
  const deleteMeeting = useCallback(
    async (id: number): Promise<void> => {
      if (!hasCRMAccess) {
        throw new Error('CRM module is not enabled for your account');
      }

      setIsLoading(true);
      setError(null);

      try {
        await meetingService.deleteMeeting(id);
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to delete meeting';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [hasCRMAccess]
  );

  return {
    // Access control
    hasCRMAccess,

    // Loading and error states for mutations
    isLoading,
    error,

    // SWR hooks for data fetching
    useMeetings,
    useMeeting,
    useMeetingCalendar,
    useMeetingsByLead,
    useUpcomingMeetings,

    // Mutation functions
    createMeeting,
    updateMeeting,
    patchMeeting,
    deleteMeeting,
  };
};
