// src/hooks/useUsers.ts
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { userService } from '@/services/userService';
import { MASTER_DATA_DEDUPE_MS } from '@/lib/swrConfig';
import type { User, UserListParams, PaginatedResponse } from '@/types/user.types';

export const useUsers = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get users with SWR caching
  // Pass { enabled: false } to skip fetching (e.g. drawer not yet opened).
  const useUsersList = (params?: UserListParams, options?: { enabled?: boolean }) => {
    const key = options?.enabled === false ? null : ['users', params];

    return useSWR<PaginatedResponse<User>>(
      key,
      () => userService.getUsers(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        // Users list is master data — collapse repeat fetches within 60s
        dedupingInterval: MASTER_DATA_DEDUPE_MS,
        onError: (err) => {
          console.error('Failed to fetch users:', err);
          setError(err.message || 'Failed to fetch users');
        }
      }
    );
  };

  // Get single user with SWR caching
  const useUser = (id: string | null) => {
    const key = id ? ['user', id] : null;

    return useSWR<User>(
      key,
      () => userService.getUser(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch user:', err);
          setError(err.message || 'Failed to fetch user');
        }
      }
    );
  };

  // Get current user
  const useCurrentUser = () => {
    const key = 'current-user';

    return useSWR<User>(
      key,
      () => userService.getCurrentUser(),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch current user:', err);
          setError(err.message || 'Failed to fetch current user');
        }
      }
    );
  };

  return {
    useUsersList,
    useUser,
    useCurrentUser,
    isLoading,
    error,
  };
};
