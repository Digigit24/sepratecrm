// src/lib/swrConfig.ts
import { SWRConfiguration } from 'swr';
import { crmClient } from './client';
import { AxiosError } from 'axios';

// Generic fetcher for SWR using CRM client
export const fetcher = async <T = any>(url: string): Promise<T> => {
  try {
    const response = await crmClient.get<T>(url);

    // Handle Django-style responses with nested data
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    throw axiosError;
  }
};

// POST fetcher for mutations
export const postFetcher = async <T = any>(url: string, { arg }: { arg: any }): Promise<T> => {
  const response = await crmClient.post<T>(url, arg);

  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return (response.data as any).data;
  }

  return response.data;
};

// PUT fetcher for mutations
export const putFetcher = async <T = any>(url: string, { arg }: { arg: any }): Promise<T> => {
  const response = await crmClient.put<T>(url, arg);

  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return (response.data as any).data;
  }

  return response.data;
};

// PATCH fetcher for mutations
export const patchFetcher = async <T = any>(url: string, { arg }: { arg: any }): Promise<T> => {
  const response = await crmClient.patch<T>(url, arg);

  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return (response.data as any).data;
  }

  return response.data;
};

// DELETE fetcher for mutations
export const deleteFetcher = async <T = any>(url: string): Promise<T> => {
  const response = await crmClient.delete<T>(url);

  if (response.data && typeof response.data === 'object' && 'data' in response.data) {
    return (response.data as any).data;
  }

  return response.data;
};

// Deduping interval for master/reference data that rarely changes
// (users list, lead statuses, field configurations, field schema).
// Re-mounting a component within this window reuses the cached response
// instead of re-hitting the API.
export const MASTER_DATA_DEDUPE_MS = 60_000;

// Default SWR configuration
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  // RECONNECT POLICY: no global refetch burst when the network comes back.
  // Every SWR hook keeps its cached data on reconnect; only useLeads (the
  // actively-viewed working list) opts back in with revalidateOnReconnect:
  // true. React Query mirrors this (refetchOnReconnect: false in App.tsx).
  // RETRY POLICY (documented): shouldRetryOnError is false everywhere, so
  // failed requests are NOT retried by SWR (errorRetryCount/-Interval below
  // only apply to hooks that explicitly opt back into retries: max 3
  // attempts, 5s apart — bounded, no infinite loops). React Query: retry: 1.
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
  // 5s (was 2s): identical requests fired by different components within this
  // window collapse into one network call. Mutations still bypass this.
  dedupingInterval: 5000,
  // Throttle focus revalidation in case any hook opts back into it
  focusThrottleInterval: 30_000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  onError: (error: AxiosError) => {
    // Handle specific error codes globally
    if (error.response?.status === 401) {
      console.error('Authentication error - token may be invalid');
    }
    
    if (error.response?.status === 403) {
      console.error('Permission denied');
    }
    
    if (error.response?.status === 500) {
      console.error('Server error');
    }
  },
};