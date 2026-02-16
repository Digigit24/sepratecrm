// src/services/userService.ts
import { authClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import {
  User,
  UserListParams,
  UserCreateData,
  UserUpdateData,
  AssignRolesData,
  RemoveRoleData,
  PaginatedResponse,
  ApiResponse
} from '@/types/user.types';

/**
 * User Service
 *
 * This service uses authClient which automatically includes tenant headers (x-tenant-id)
 * in all requests. The backend will filter users based on these headers:
 *
 * - Regular users: Can only see users from their own tenant
 * - Super admins: Can see all users across all tenants
 *
 * The tenant filtering is handled automatically by the backend based on the
 * authenticated user's role and tenant association.
 */
class UserService {
  // ==================== USERS ====================

  // Get users with optional query parameters
  // Note: Returns only current tenant's users for regular users
  async getUsers(params?: UserListParams): Promise<PaginatedResponse<User>> {
    try {
      const queryString = buildQueryString(params);
      const response = await authClient.get<PaginatedResponse<User>>(
        `${API_CONFIG.AUTH.USERS.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch users';
      throw new Error(message);
    }
  }

  // Get single user by ID
  async getUser(id: string): Promise<User> {
    try {
      const response = await authClient.get<User>(
        API_CONFIG.AUTH.USERS.DETAIL.replace(':id', id)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch user';
      throw new Error(message);
    }
  }

  // Create new user
  // Note: Tenant ID is automatically included in request headers
  // Non-super-admin users can only create users in their own tenant
  async createUser(userData: UserCreateData): Promise<User> {
    try {
      const response = await authClient.post<User>(
        API_CONFIG.AUTH.USERS.CREATE,
        userData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to create user';
      throw new Error(message);
    }
  }

  // Update user (full update)
  async updateUser(id: string, userData: UserUpdateData): Promise<User> {
    try {
      const response = await authClient.put<User>(
        API_CONFIG.AUTH.USERS.UPDATE.replace(':id', id),
        userData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update user';
      throw new Error(message);
    }
  }

  // Partially update user
  async patchUser(id: string, userData: Partial<UserUpdateData>): Promise<User> {
    try {
      const response = await authClient.patch<User>(
        API_CONFIG.AUTH.USERS.UPDATE.replace(':id', id),
        userData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update user';
      throw new Error(message);
    }
  }

  // Delete user
  async deleteUser(id: string): Promise<void> {
    try {
      await authClient.delete(
        API_CONFIG.AUTH.USERS.DELETE.replace(':id', id)
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete user';
      throw new Error(message);
    }
  }

  // ==================== ROLE MANAGEMENT ====================

  // Assign roles to user
  async assignRoles(id: string, rolesData: AssignRolesData): Promise<User> {
    try {
      const response = await authClient.post<User>(
        API_CONFIG.AUTH.USERS.ASSIGN_ROLES.replace(':id', id),
        rolesData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to assign roles';
      throw new Error(message);
    }
  }

  // Remove role from user
  async removeRole(id: string, roleData: RemoveRoleData): Promise<User> {
    try {
      const response = await authClient.delete<User>(
        API_CONFIG.AUTH.USERS.REMOVE_ROLE.replace(':id', id),
        { data: roleData }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to remove role';
      throw new Error(message);
    }
  }

  // ==================== CURRENT USER ====================

  // Get current user profile
  async getCurrentUser(): Promise<User> {
    try {
      const response = await authClient.get<User>(
        API_CONFIG.AUTH.USERS.ME
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch current user';
      throw new Error(message);
    }
  }

  // Update current user (full update)
  async updateCurrentUser(userData: UserUpdateData): Promise<User> {
    try {
      const response = await authClient.put<User>(
        API_CONFIG.AUTH.USERS.UPDATE_ME,
        userData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update current user';
      throw new Error(message);
    }
  }

  // Partially update current user
  async patchCurrentUser(userData: Partial<UserUpdateData>): Promise<User> {
    try {
      const response = await authClient.patch<User>(
        API_CONFIG.AUTH.USERS.UPDATE_ME,
        userData
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update current user';
      throw new Error(message);
    }
  }
}

export const userService = new UserService();
