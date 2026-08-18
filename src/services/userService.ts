// src/services/userService.ts
import { authClient, crmClient } from '@/lib/client';
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
/**
 * Raw shape of one entry in the tenant user directory.
 *
 * Two backends can answer this call and their payloads differ slightly, so
 * every field beyond `id` is optional and normalised by `useUserDirectory`:
 *
 *  - DigiCRM  GET /crm/users/  (preferred) — { id, email, first_name,
 *    last_name, full_name, is_active, avatar }
 *  - Auth svc GET /users/      (fallback)  — full `UserSerializer`, i.e.
 *    `profile_picture` instead of `avatar` and (on older deploys) no
 *    `full_name` at all.
 */
export interface DirectoryApiUser {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  is_active?: boolean;
  avatar?: string | null;
  profile_picture?: string | null;
  roles?: Array<{ name?: string } | string> | null;
}

interface DirectoryPage {
  count?: number;
  next?: string | null;
  results?: DirectoryApiUser[];
}

/** Thrown when BOTH directory endpoints answer 403. Never toasted. */
export class UserDirectoryForbiddenError extends Error {
  readonly isForbidden = true;
  constructor(message = 'User directory is not accessible for this account') {
    super(message);
    this.name = 'UserDirectoryForbiddenError';
  }
}

// Page through defensively: the auth service historically ignored `page_size`
// and hard-capped responses at 20 rows, which is the single biggest cause of
// "name not found -> shows UUID". Bounded so a misbehaving backend can never
// spin us forever.
const DIRECTORY_PAGE_SIZE = 500;
const DIRECTORY_MAX_PAGES = 20;
const DIRECTORY_MAX_USERS = 2500;

class UserService {
  // ==================== USER DIRECTORY ====================

  /**
   * Fetch the full tenant user directory for display/lookup purposes.
   *
   * Deliberately does NOT filter by `is_active`: a deactivated user still has
   * to be resolvable for DISPLAY (they may own historical leads). Filtering
   * for *assignment* pickers happens client-side.
   *
   * Tries the DigiCRM tenant-scoped proxy first and falls back to the auth
   * service so the app keeps working against a backend that has not shipped
   * `/crm/users/` yet. Toasts are suppressed on both calls.
   */
  async getUserDirectory(): Promise<DirectoryApiUser[]> {
    try {
      return await this.fetchDirectoryPages(
        (page) =>
          crmClient
            .get<DirectoryPage>(API_CONFIG.CRM.TENANT_USERS, {
              params: { page, page_size: DIRECTORY_PAGE_SIZE },
              suppressErrorToast: true,
            })
            .then((r) => r.data)
      );
    } catch (crmError: unknown) {
      const status = (crmError as { response?: { status?: number } })?.response?.status;
      // 401 means the session is dead — the interceptor already handles it;
      // don't double up with a fallback request.
      if (status === 401) throw crmError;

      try {
        return await this.fetchDirectoryPages(
          (page) =>
            authClient
              .get<DirectoryPage>(API_CONFIG.AUTH.USERS.LIST, {
                params: { page, page_size: DIRECTORY_PAGE_SIZE },
                suppressErrorToast: true,
              })
              .then((r) => r.data)
        );
      } catch (authError: unknown) {
        const authStatus = (authError as { response?: { status?: number } })?.response?.status;
        if (status === 403 || authStatus === 403) {
          throw new UserDirectoryForbiddenError();
        }
        throw authError;
      }
    }
  }

  private async fetchDirectoryPages(
    load: (page: number) => Promise<DirectoryPage>
  ): Promise<DirectoryApiUser[]> {
    const all: DirectoryApiUser[] = [];

    for (let page = 1; page <= DIRECTORY_MAX_PAGES; page += 1) {
      const data = await load(page);
      const results = Array.isArray(data?.results)
        ? data.results
        : // Some deployments return a bare array.
          (Array.isArray(data) ? (data as DirectoryApiUser[]) : []);

      all.push(...results);

      if (results.length === 0) break;
      if (!data?.next) break;
      if (typeof data?.count === 'number' && all.length >= data.count) break;
      if (all.length >= DIRECTORY_MAX_USERS) break;
    }

    return all;
  }

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
