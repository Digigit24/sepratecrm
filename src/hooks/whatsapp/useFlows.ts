// src/hooks/whatsapp/useFlows.ts
import useSWR, { mutate } from 'swr';
import { flowsService } from '@/services/whatsapp/flowsService';
import {
  Flow,
  FlowsListQuery,
  CreateFlowPayload,
  UpdateFlowPayload,
} from '@/types/whatsappTypes';

// SWR key generators
const getFlowsKey = (query?: FlowsListQuery) =>
  query ? ['flows', query] : ['flows'];

const getFlowKey = (flow_id: string) => ['flow', flow_id];

const getFlowStatsKey = () => ['flow-stats'];

/**
 * Hook to fetch all flows
 */
export const useFlows = (query?: FlowsListQuery) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getFlowsKey(query),
    () => flowsService.getFlows(query),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    flows: data?.flows || [],
    total: data?.total || 0,
    page: data?.page || 1,
    page_size: data?.page_size || 20,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook to fetch a single flow
 */
export const useFlow = (flow_id: string | null) => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    flow_id ? getFlowKey(flow_id) : null,
    () => (flow_id ? flowsService.getFlow(flow_id) : null),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    flow: data || null,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook to fetch flow statistics
 */
export const useFlowStats = () => {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    getFlowStatsKey(),
    () => flowsService.getFlowStats(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    stats: data || null,
    isLoading,
    error,
    revalidate,
  };
};

/**
 * Hook for flow mutations (create, update, delete, publish, etc.)
 */
export const useFlowMutations = () => {
  const createFlow = async (payload: CreateFlowPayload): Promise<Flow> => {
    try {
      const newFlow = await flowsService.createFlow(payload);

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      // Revalidate stats
      mutate(getFlowStatsKey(), undefined, { revalidate: true });

      return newFlow;
    } catch (error: any) {
      throw error;
    }
  };

  const updateFlow = async (flow_id: string, payload: UpdateFlowPayload): Promise<Flow> => {
    try {
      const updatedFlow = await flowsService.updateFlow(flow_id, payload);

      // Revalidate specific flow
      mutate(getFlowKey(flow_id), updatedFlow, false);

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      return updatedFlow;
    } catch (error: any) {
      throw error;
    }
  };

  const deleteFlow = async (flow_id: string, hard_delete: boolean = false): Promise<void> => {
    try {
      await flowsService.deleteFlow(flow_id, hard_delete);

      // Remove from cache
      mutate(getFlowKey(flow_id), undefined, false);

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      // Revalidate stats
      mutate(getFlowStatsKey(), undefined, { revalidate: true });
    } catch (error: any) {
      throw error;
    }
  };

  const publishFlow = async (flow_id: string): Promise<void> => {
    try {
      await flowsService.publishFlow(flow_id);

      // Revalidate specific flow
      mutate(getFlowKey(flow_id), undefined, { revalidate: true });

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      // Revalidate stats
      mutate(getFlowStatsKey(), undefined, { revalidate: true });
    } catch (error: any) {
      throw error;
    }
  };

  const unpublishFlow = async (flow_id: string): Promise<void> => {
    try {
      await flowsService.unpublishFlow(flow_id);

      // Revalidate specific flow
      mutate(getFlowKey(flow_id), undefined, { revalidate: true });

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      // Revalidate stats
      mutate(getFlowStatsKey(), undefined, { revalidate: true });
    } catch (error: any) {
      throw error;
    }
  };

  const duplicateFlow = async (flow_id: string, new_name?: string): Promise<Flow> => {
    try {
      const duplicatedFlow = await flowsService.duplicateFlow(flow_id, new_name);

      // Revalidate all flows lists
      mutate(
        (key) => Array.isArray(key) && key[0] === 'flows',
        undefined,
        { revalidate: true }
      );

      // Revalidate stats
      mutate(getFlowStatsKey(), undefined, { revalidate: true });

      return duplicatedFlow;
    } catch (error: any) {
      throw error;
    }
  };

  const validateFlow = async (flow_id: string) => {
    try {
      return await flowsService.validateFlow(flow_id);
    } catch (error: any) {
      throw error;
    }
  };

  return {
    createFlow,
    updateFlow,
    deleteFlow,
    publishFlow,
    unpublishFlow,
    duplicateFlow,
    validateFlow,
  };
};
