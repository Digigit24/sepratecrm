// src/hooks/useRoles.ts
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { roleService } from '@/services/roleService';
import {
  Role,
  RoleListParams,
  RoleCreateData,
  RoleUpdateData,
  PaginatedResponse,
  User
} from '@/types/user.types';

export const useRoles = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ==================== ROLES HOOKS ====================

  // Get roles with SWR caching
  const useRolesList = (params?: RoleListParams) => {
    const key = ['roles', params];

    return useSWR<PaginatedResponse<Role>>(
      key,
      () => roleService.getRoles(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch roles:', err);
          setError(err.message || 'Failed to fetch roles');
        }
      }
    );
  };

  // Get single role with SWR caching
  const useRoleById = (id: string | null) => {
    const key = id ? ['role', id] : null;

    return useSWR<Role>(
      key,
      () => roleService.getRole(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch role:', err);
          setError(err.message || 'Failed to fetch role');
        }
      }
    );
  };

  // Create role
  const createRole = useCallback(async (roleData: RoleCreateData) => {
    setIsLoading(true);
    setError(null);

    try {
      const newRole = await roleService.createRole(roleData);
      return newRole;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update role
  const updateRole = useCallback(async (id: string, roleData: RoleUpdateData) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedRole = await roleService.updateRole(id, roleData);
      return updatedRole;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Patch role
  const patchRole = useCallback(async (id: string, roleData: Partial<RoleUpdateData>) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedRole = await roleService.patchRole(id, roleData);
      return updatedRole;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete role
  const deleteRole = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await roleService.deleteRole(id);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete role';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ==================== ROLE MEMBERS HOOKS ====================

  // Get role members with SWR caching
  const useRoleMembers = (id: string | null) => {
    const key = id ? ['role-members', id] : null;

    return useSWR<User[]>(
      key,
      () => roleService.getRoleMembers(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch role members:', err);
          setError(err.message || 'Failed to fetch role members');
        }
      }
    );
  };

  // ==================== PERMISSIONS SCHEMA HOOKS ====================

  // Get permissions schema with SWR caching
  const usePermissionsSchema = () => {
    const key = ['permissions-schema'];

    return useSWR<Record<string, any>>(
      key,
      () => roleService.getPermissionsSchema(),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch permissions schema:', err);
          setError(err.message || 'Failed to fetch permissions schema');
        }
      }
    );
  };

  return {
    isLoading,
    error,

    // Roles
    useRolesList,
    useRoleById,
    createRole,
    updateRole,
    patchRole,
    deleteRole,

    // Role Members
    useRoleMembers,

    // Permissions Schema
    usePermissionsSchema,
  };
};
