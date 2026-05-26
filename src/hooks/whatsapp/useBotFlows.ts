// src/hooks/whatsapp/useBotFlows.ts
// Hook for Bot Flows list page — CRUD operations

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { botFlowService } from '@/services/whatsapp/botFlowService';
import type { BotFlow, CreateFlowPayload, UpdateFlowPayload } from '@/types/botFlowTypes';

export function useBotFlows() {
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlows = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await botFlowService.listFlows();
      setFlows(response.flows);
      setTotal(response.total);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch flows';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFlow = useCallback(async (payload: CreateFlowPayload): Promise<BotFlow | null> => {
    try {
      const flow = await botFlowService.createFlow(payload);
      setFlows((prev) => [flow, ...prev]);
      setTotal((prev) => prev + 1);
      toast.success('Bot flow created');
      return flow;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create flow');
      return null;
    }
  }, []);

  const deleteFlow = useCallback(async (flowUid: string): Promise<boolean> => {
    try {
      await botFlowService.deleteFlow(flowUid);
      setFlows((prev) => prev.filter((f) => f._uid !== flowUid));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success('Bot flow deleted');
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete flow');
      return false;
    }
  }, []);

  const toggleStatus = useCallback(async (flowUid: string, active: boolean): Promise<boolean> => {
    try {
      await botFlowService.toggleStatus(flowUid, active);
      setFlows((prev) =>
        prev.map((f) =>
          f._uid === flowUid ? { ...f, is_active: active, status: active ? 1 : 2 } : f
        )
      );
      toast.success(active ? 'Flow activated' : 'Flow deactivated');
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  return {
    flows,
    total,
    isLoading,
    error,
    fetchFlows,
    createFlow,
    deleteFlow,
    toggleStatus,
  };
}
