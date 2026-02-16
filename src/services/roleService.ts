// src/services/roleService.ts
import { authClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import {
  Role,
  RoleListParams,
  RoleCreateData,
  RoleUpdateData,
  PaginatedResponse,
  User
} from '@/types/user.types';

/**
 * Role Service
 *
 * This service uses authClient which automatically includes tenant headers (x-tenant-id)
 * in all requests. The backend will filter roles based on these headers:
 *
 * - Regular users: Can only see roles from their own tenant
 * - Super admins: Can see all roles across all tenants
 *
 * The tenant filtering is handled automatically by the backend based on the
 * authenticated user's role and tenant association.
 */
class RoleService {
  // ==================== ROLES ====================

  // Get roles with optional query parameters
  // Note: Returns only current tenant's roles for regular users
  async getRoles(params?: RoleListParams): Promise<PaginatedResponse<Role>> {
    try {
      const queryString = buildQueryString(params);
      const response = await authClient.get<PaginatedResponse<Role>>(
        `${API_CONFIG.AUTH.ROLES.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch roles';
      throw new Error(message);
    }
  }

  // Get single role by ID
  async getRole(id: string): Promise<Role> {
    try {
      const response = await authClient.get<Role>(
        API_CONFIG.AUTH.ROLES.DETAIL.replace(':id', id)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch role';
      throw new Error(message);
    }
  }

  // Create new role
  // Note: Tenant ID is automatically included in request headers
  // created_by is automatically set by backend to current user
  async createRole(roleData: RoleCreateData): Promise<Role> {
    try {
      const response = await authClient.post<Role>(
        API_CONFIG.AUTH.ROLES.CREATE,
        roleData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to create role';
      throw new Error(message);
    }
  }

  // Update role (full update)
  async updateRole(id: string, roleData: RoleUpdateData): Promise<Role> {
    try {
      const response = await authClient.put<Role>(
        API_CONFIG.AUTH.ROLES.UPDATE.replace(':id', id),
        roleData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update role';
      throw new Error(message);
    }
  }

  // Partially update role
  async patchRole(id: string, roleData: Partial<RoleUpdateData>): Promise<Role> {
    try {
      const response = await authClient.patch<Role>(
        API_CONFIG.AUTH.ROLES.UPDATE.replace(':id', id),
        roleData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update role';
      throw new Error(message);
    }
  }

  // Delete role
  async deleteRole(id: string): Promise<void> {
    try {
      await authClient.delete(
        API_CONFIG.AUTH.ROLES.DELETE.replace(':id', id)
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete role';
      throw new Error(message);
    }
  }

  // ==================== ROLE MEMBERS ====================

  // Get members (users) of a role
  async getRoleMembers(id: string): Promise<User[]> {
    try {
      const response = await authClient.get<User[]>(
        API_CONFIG.AUTH.ROLES.MEMBERS.replace(':id', id)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch role members';
      throw new Error(message);
    }
  }

  // ==================== PERMISSIONS SCHEMA ====================

  // Get permissions schema
  async getPermissionsSchema(): Promise<Record<string, any>> {
    try {
      const response = await authClient.get<Record<string, any>>(
        API_CONFIG.AUTH.ROLES.PERMISSIONS_SCHEMA
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch permissions schema';
      throw new Error(message);
    }
  }
}

export const roleService = new RoleService();
