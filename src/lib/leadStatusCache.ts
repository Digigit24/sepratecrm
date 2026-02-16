// src/lib/leadStatusCache.ts
import type { LeadStatus } from '@/types/crmTypes';

const STORAGE_KEY = 'crm_lead_statuses';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour in milliseconds

interface CachedLeadStatuses {
  data: LeadStatus[];
  timestamp: number;
}

export const leadStatusCache = {
  /**
   * Get lead statuses from localStorage
   */
  get(): LeadStatus[] | null {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return null;

      const parsed: CachedLeadStatuses = JSON.parse(cached);

      // Check if cache is expired
      const now = Date.now();
      if (now - parsed.timestamp > CACHE_DURATION) {
        this.clear();
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('Error reading lead statuses from cache:', error);
      return null;
    }
  },

  /**
   * Set lead statuses in localStorage
   */
  set(statuses: LeadStatus[]): void {
    try {
      const cached: CachedLeadStatuses = {
        data: statuses,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error saving lead statuses to cache:', error);
    }
  },

  /**
   * Clear lead statuses from localStorage
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing lead statuses cache:', error);
    }
  },

  /**
   * Get a single lead status by ID
   */
  getById(id: number): LeadStatus | null {
    const statuses = this.get();
    if (!statuses) return null;
    return statuses.find(s => s.id === id) || null;
  },

  /**
   * Get lead status name by ID
   */
  getNameById(id: number): string | null {
    const status = this.getById(id);
    return status?.name || null;
  },

  /**
   * Update cache from API response
   */
  updateFromApi(statuses: LeadStatus[]): void {
    const activeStatuses = statuses.filter(s => s.is_active);
    this.set(activeStatuses);
  },
};
