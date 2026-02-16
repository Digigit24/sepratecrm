/**
 * Meeting type definitions matching Django backend
 */

import { Lead } from './crmTypes';

/**
 * Main Meeting interface - matches Django Meeting model
 */
export interface Meeting {
  id: number;
  tenant_id?: string;
  lead: number | null;
  lead_name?: string; // Read-only field from serializer
  title: string;
  location: string | null;
  description: string | null;
  notes: string | null;
  start_at: string; // ISO datetime string
  end_at: string; // ISO datetime string
  owner_user_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Meeting list parameters for filtering and searching
 */
export interface MeetingListParams {
  page?: number;
  page_size?: number;
  search?: string;
  lead?: number;
  start_at__gte?: string;
  start_at__lte?: string;
  end_at__gte?: string;
  end_at__lte?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Meeting create payload - matches backend serializer requirements
 */
export interface MeetingCreateData {
  title: string; // Required
  start_at: string; // Required - ISO datetime string
  end_at: string; // Required - ISO datetime string
  lead?: number | null; // Optional
  location?: string; // Optional
  description?: string; // Optional
  notes?: string; // Optional
}

/**
 * Meeting update payload - all fields optional
 */
export interface MeetingUpdateData {
  title?: string;
  start_at?: string;
  end_at?: string;
  lead?: number | null;
  location?: string;
  description?: string;
  notes?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedMeetingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Meeting[];
}

/**
 * Calendar data structure for calendar view endpoint
 */
export interface MeetingCalendarData {
  calendar_data: {
    [date: string]: Meeting[]; // ISO date string as key
  };
  total_meetings: number;
  date_range: {
    start_date: string; // ISO date string
    end_date: string; // ISO date string
  };
}

/**
 * Calendar view parameters
 */
export interface MeetingCalendarParams {
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  month?: string; // YYYY-MM
}

/**
 * Form validation errors
 */
export interface MeetingFormErrors {
  title?: string;
  start_at?: string;
  end_at?: string;
  lead?: string;
  location?: string;
  description?: string;
  notes?: string;
}
