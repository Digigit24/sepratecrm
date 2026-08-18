// src/hooks/useUser.ts
import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { userService } from '@/services/userService';
import { MASTER_DATA_DEDUPE_MS } from '@/lib/swrConfig';
import { USER_DIRECTORY_KEY } from '@/hooks/useUserDirectory';
import {
  User,
  UserListParams,
  UserCreateData,
  UserUpdateData,
  AssignRolesData,
  RemoveRoleData,
  PaginatedResponse
} from '@/types/user.types';

export const useUser = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== USERS HOOKS ====================

  // Get users with SWR caching
  // NOTE: shares the same ['users', params] SWR key namespace as
  // useUsers().useUsersList so identical params dedupe across both hooks.
  const useUsers = (params?: UserListParams) => {
    const key = ['users', params];

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
  const useUserById = (id: string | null) => {
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

  // Create user
  const createUser = useCallback(async (userData: UserCreateData) => {
    setIsLoading(true);
    setError(null);

    try {
      const newUser = await userService.createUser(userData);
      // Names are rendered app-wide from the shared directory — refresh it.
      void globalMutate(USER_DIRECTORY_KEY);
      return newUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update user
  const updateUser = useCallback(async (id: string, userData: UserUpdateData) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.updateUser(id, userData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Patch user
  const patchUser = useCallback(async (id: string, userData: Partial<UserUpdateData>) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.patchUser(id, userData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await userService.deleteUser(id);
      void globalMutate(USER_DIRECTORY_KEY);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ==================== ROLE MANAGEMENT HOOKS ====================

  // Assign roles to user
  const assignRoles = useCallback(async (id: string, rolesData: AssignRolesData) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.assignRoles(id, rolesData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to assign roles';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Remove role from user
  const removeRole = useCallback(async (id: string, roleData: RemoveRoleData) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.removeRole(id, roleData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to remove role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ==================== CURRENT USER HOOKS ====================

  // Get current user with SWR caching
  const useCurrentUser = () => {
    const key = ['current-user'];

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

  // Update current user
  const updateCurrentUser = useCallback(async (userData: UserUpdateData) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.updateCurrentUser(userData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update current user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Patch current user
  const patchCurrentUser = useCallback(async (userData: Partial<UserUpdateData>) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await userService.patchCurrentUser(userData);
      void globalMutate(USER_DIRECTORY_KEY);
      return updatedUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update current user';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,

    // Users
    useUsers,
    useUserById,
    createUser,
    updateUser,
    patchUser,
    deleteUser,

    // Role Management
    assignRoles,
    removeRole,

    // Current User
    useCurrentUser,
    updateCurrentUser,
    patchCurrentUser,
  };
};
