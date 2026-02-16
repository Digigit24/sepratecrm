// src/hooks/whatsapp/useGroups.ts
import useSWR, { mutate } from 'swr';
import { groupsService } from '@/services/whatsapp/groupsService';
import {
  Group,
  GroupsListQuery,
  CreateGroupPayload,
  UpdateGroupPayload,
} from '@/types/whatsappTypes';

// SWR key generators
const getGroupsKey = (query?: GroupsListQuery) => 
  query ? ['groups', query] : ['groups'];

const getGroupKey = (group_id: string) => ['group', group_id];

/**
 * Hook to fetch all groups
 */
export const useGroups = (query?: GroupsListQuery) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getGroupsKey(query),
    () => groupsService.getGroups(query),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    groups: data?.groups || [],
    total: data?.total || 0,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook to fetch a single group
 */
export const useGroup = (group_id: string | null) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    group_id ? getGroupKey(group_id) : null,
    () => (group_id ? groupsService.getGroup(group_id) : null),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    group: data || null,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for group mutations (create, update, delete)
 */
export const useGroupMutations = () => {
  const createGroup = async (payload: CreateGroupPayload): Promise<Group> => {
    try {
      const newGroup = await groupsService.createGroup(payload);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return newGroup;
    } catch (error: any) {
      throw error;
    }
  };

  const updateGroup = async (group_id: string, payload: UpdateGroupPayload): Promise<Group> => {
    try {
      const updatedGroup = await groupsService.updateGroup(group_id, payload);
      
      // Revalidate specific group
      mutate(getGroupKey(group_id), updatedGroup, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return updatedGroup;
    } catch (error: any) {
      throw error;
    }
  };

  const deleteGroup = async (group_id: string): Promise<void> => {
    try {
      await groupsService.deleteGroup(group_id);
      
      // Remove from cache
      mutate(getGroupKey(group_id), undefined, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
    } catch (error: any) {
      throw error;
    }
  };

  const addParticipants = async (group_id: string, participants: string[]): Promise<Group> => {
    try {
      const updatedGroup = await groupsService.addParticipants(group_id, participants);
      
      // Revalidate specific group
      mutate(getGroupKey(group_id), updatedGroup, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return updatedGroup;
    } catch (error: any) {
      throw error;
    }
  };

  const removeParticipants = async (group_id: string, participants: string[]): Promise<Group> => {
    try {
      const updatedGroup = await groupsService.removeParticipants(group_id, participants);
      
      // Revalidate specific group
      mutate(getGroupKey(group_id), updatedGroup, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return updatedGroup;
    } catch (error: any) {
      throw error;
    }
  };

  const promoteToAdmin = async (group_id: string, participants: string[]): Promise<Group> => {
    try {
      const updatedGroup = await groupsService.promoteToAdmin(group_id, participants);
      
      // Revalidate specific group
      mutate(getGroupKey(group_id), updatedGroup, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return updatedGroup;
    } catch (error: any) {
      throw error;
    }
  };

  const demoteFromAdmin = async (group_id: string, admins: string[]): Promise<Group> => {
    try {
      const updatedGroup = await groupsService.demoteFromAdmin(group_id, admins);
      
      // Revalidate specific group
      mutate(getGroupKey(group_id), updatedGroup, false);
      
      // Revalidate all groups lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'groups',
        undefined,
        { revalidate: true }
      );
      
      return updatedGroup;
    } catch (error: any) {
      throw error;
    }
  };

  return {
    createGroup,
    updateGroup,
    deleteGroup,
    addParticipants,
    removeParticipants,
    promoteToAdmin,
    demoteFromAdmin,
  };
};

/**
 * Hook to search groups
 */
export const useGroupSearch = (searchQuery: string, limit: number = 20) => {
  const { data, error, isLoading } = useSWR(
    searchQuery ? ['groups', 'search', searchQuery, limit] : null,
    () => (searchQuery ? groupsService.searchGroups(searchQuery, limit) : null),
    {
      revalidateOnFocus: false,
      dedupingInterval: 500, // Debounce searches
    }
  );

  return {
    groups: data?.groups || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
};

/**
 * Hook to get active groups only
 */
export const useActiveGroups = (limit: number = 100) => {
  const { data, error, isLoading } = useSWR(
    ['groups', 'active', limit],
    () => groupsService.getActiveGroups(limit),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    groups: data?.groups || [],
    total: data?.total || 0,
    isLoading,
    error,
  };
};