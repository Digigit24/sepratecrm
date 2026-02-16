// src/services/whatsapp/groupsService.ts
import { whatsappClient } from '@/lib/whatsappClient';
import { API_CONFIG, buildUrl, buildQueryString } from '@/lib/apiConfig';
import {
  Group,
  GroupsListQuery,
  GroupsListResponse,
  CreateGroupPayload,
  UpdateGroupPayload,
  DeleteGroupResponse,
} from '@/types/whatsappTypes';

class GroupsService {
  /**
   * Get all groups with optional filters
   */
  async getGroups(query?: GroupsListQuery): Promise<GroupsListResponse> {
    try {
      console.log('📋 Fetching groups:', query);
      
      const queryString = buildQueryString(query as unknown as Record<string, string | number | boolean>);
      const url = `${API_CONFIG.WHATSAPP.GROUPS}${queryString}`;
      
      // Don't force a response type here so we can normalize various shapes safely
      const response = await whatsappClient.get(url);
      const raw = response.data;
      
      // Normalize API response to { total, groups }
      let normalized: GroupsListResponse;
      
      if (Array.isArray(raw)) {
        // Backend returns a plain array of groups
        normalized = {
          total: raw.length,
          groups: raw as Group[],
        };
      } else if (raw && typeof raw === 'object') {
        if (Array.isArray((raw as any).groups)) {
          // Expected shape already
          normalized = {
            total: (raw as any).total ?? (raw as any).groups.length,
            groups: (raw as any).groups as Group[],
          };
        } else if (Array.isArray((raw as any).results)) {
          // Common alternative { count, results }
          normalized = {
            total: (raw as any).count ?? (raw as any).results.length,
            groups: (raw as any).results as Group[],
          };
        } else {
          // Fallback: try to find the first array field
          const firstArray = Object.values(raw).find((v) => Array.isArray(v)) as Group[] | undefined;
          normalized = {
            total: firstArray?.length ?? 0,
            groups: (firstArray as Group[]) ?? [],
          };
        }
      } else {
        // Unknown/empty shape
        normalized = { total: 0, groups: [] };
      }
      
      console.log('✅ Groups fetched:', {
        total: normalized.total,
        count: normalized.groups.length,
      });
      
      return normalized;
    } catch (error: any) {
      console.error('❌ Failed to fetch groups:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch groups';
      throw new Error(message);
    }
  }

  /**
   * Get single group by ID
   */
  async getGroup(id: string): Promise<Group> {
    try {
      console.log('📋 Fetching group:', id);
      
      const url = buildUrl(
        API_CONFIG.WHATSAPP.GROUP_DETAIL,
        { group_id: id },
        'whatsapp'
      );
      
      const response = await whatsappClient.get<Group>(url);
      
      console.log('✅ Group fetched:', response.data.name);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch group:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Group not found');
      }
      
      const message = error.response?.data?.detail || 'Failed to fetch group';
      throw new Error(message);
    }
  }

  /**
   * Create a new group
   */
  async createGroup(payload: CreateGroupPayload): Promise<Group> {
    try {
      console.log('➕ Creating group:', payload.name);
      
      const response = await whatsappClient.post<Group>(
        API_CONFIG.WHATSAPP.GROUP_CREATE,
        payload
      );
      
      console.log('✅ Group created:', response.data.name);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create group:', error);
      
      if (error.response?.status === 409) {
        throw new Error('Group already exists');
      }
      
      const message = error.response?.data?.detail || 'Failed to create group';
      throw new Error(message);
    }
  }

  /**
   * Update an existing group
   */
  async updateGroup(id: string, payload: UpdateGroupPayload): Promise<Group> {
    try {
      console.log('✏️ Updating group:', id);
      
      const url = buildUrl(
        API_CONFIG.WHATSAPP.GROUP_UPDATE,
        { group_id: id },
        'whatsapp'
      );
      
      const response = await whatsappClient.put<Group>(url, payload);
      
      console.log('✅ Group updated:', response.data.name);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to update group:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Group not found');
      }
      
      const message = error.response?.data?.detail || 'Failed to update group';
      throw new Error(message);
    }
  }

  /**
   * Delete a group
   */
  async deleteGroup(id: string): Promise<DeleteGroupResponse> {
    try {
      console.log('🗑️ Deleting group:', id);
      
      const url = buildUrl(
        API_CONFIG.WHATSAPP.GROUP_DELETE,
        { group_id: id },
        'whatsapp'
      );
      
      const response = await whatsappClient.delete<DeleteGroupResponse>(url);
      
      console.log('✅ Group deleted:', response.data.group_id);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to delete group:', error);
      
      if (error.response?.status === 404) {
        throw new Error('Group not found');
      }
      
      const message = error.response?.data?.detail || 'Failed to delete group';
      throw new Error(message);
    }
  }

  /**
   * Get active groups only
   */
  async getActiveGroups(limit: number = 100): Promise<GroupsListResponse> {
    return this.getGroups({
      active_only: true,
      limit,
    });
  }

  /**
   * Search groups by name
   */
  async searchGroups(searchQuery: string, limit: number = 20): Promise<GroupsListResponse> {
    return this.getGroups({
      search: searchQuery,
      limit,
    });
  }

  /**
   * Add participants to a group
   */
  async addParticipants(id: string, participants: string[]): Promise<Group> {
    try {
      // First get the current group
      const currentGroup = await this.getGroup(id);
      
      // Merge with new participants (remove duplicates)
      const updatedParticipants = Array.from(
        new Set([...currentGroup.participants, ...participants])
      );
      
      // Update the group
      return this.updateGroup(id, {
        participants: updatedParticipants,
      });
    } catch (error: any) {
      console.error('❌ Failed to add participants:', error);
      throw error;
    }
  }

  /**
   * Remove participants from a group
   */
  async removeParticipants(id: string, participants: string[]): Promise<Group> {
    try {
      // First get the current group
      const currentGroup = await this.getGroup(id);
      
      // Remove specified participants
      const updatedParticipants = currentGroup.participants.filter(
        (p) => !participants.includes(p)
      );
      
      // Update the group
      return this.updateGroup(id, {
        participants: updatedParticipants,
      });
    } catch (error: any) {
      console.error('❌ Failed to remove participants:', error);
      throw error;
    }
  }

  /**
   * Promote participants to admins
   */
  async promoteToAdmin(id: string, participants: string[]): Promise<Group> {
    try {
      // First get the current group
      const currentGroup = await this.getGroup(id);
      
      // Merge with new admins (remove duplicates)
      const updatedAdmins = Array.from(
        new Set([...currentGroup.admins, ...participants])
      );
      
      // Update the group
      return this.updateGroup(id, {
        admins: updatedAdmins,
      });
    } catch (error: any) {
      console.error('❌ Failed to promote to admin:', error);
      throw error;
    }
  }

  /**
   * Demote admins to regular participants
   */
  async demoteFromAdmin(id: string, admins: string[]): Promise<Group> {
    try {
      // First get the current group
      const currentGroup = await this.getGroup(id);
      
      // Remove specified admins
      const updatedAdmins = currentGroup.admins.filter(
        (a) => !admins.includes(a)
      );
      
      // Update the group
      return this.updateGroup(id, {
        admins: updatedAdmins,
      });
    } catch (error: any) {
      console.error('❌ Failed to demote from admin:', error);
      throw error;
    }
  }
}

export const groupsService = new GroupsService();