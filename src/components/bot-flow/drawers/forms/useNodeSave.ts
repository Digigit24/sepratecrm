// src/components/bot-flow/drawers/forms/useNodeSave.ts
// Shared hook for saving node data from the form drawer

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { botFlowService } from '@/services/whatsapp/botFlowService';
import { useBotFlowStore } from '@/store/botFlowStore';
import type { BotNode, CreateNodePayload } from '@/types/botFlowTypes';

export function useNodeSave(flowUid: string, nodeId: string) {
  const { updateNodeData, closeDrawer } = useBotFlowStore();
  const [isSaving, setIsSaving] = useState(false);

  const saveNode = useCallback(
    async (payload: CreateNodePayload): Promise<boolean> => {
      setIsSaving(true);
      try {
        // If nodeId starts with 'temp-', this is a new unsaved node — create it
        if (nodeId.startsWith('temp-')) {
          const created = await botFlowService.createNode(flowUid, payload);
          updateNodeData(nodeId, created as Partial<BotNode>);
          // Update the node id to the real uid
          // (handled by FlowCanvas via node data _uid field)
          toast.success('Node created');
        } else {
          const updated = await botFlowService.updateNode(flowUid, nodeId, payload);
          updateNodeData(nodeId, updated as Partial<BotNode>);
          toast.success('Node saved');
        }
        closeDrawer();
        return true;
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save node');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [flowUid, nodeId, updateNodeData, closeDrawer]
  );

  return { saveNode, isSaving };
}
