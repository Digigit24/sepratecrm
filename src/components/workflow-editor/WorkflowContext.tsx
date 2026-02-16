// src/components/workflow-editor/WorkflowContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useIntegrations } from '@/hooks/useIntegrations';
import type { Workflow, ExecutionLog } from '@/types/integration.types';
import type { WorkflowContextValue, StepState } from './types/workflowEditor.types';

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export const useWorkflowContext = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflowContext must be used within WorkflowProvider');
  }
  return context;
};

interface WorkflowProviderProps {
  workflowId?: number;
  children: React.ReactNode;
}

export const WorkflowProvider = ({ workflowId, children }: WorkflowProviderProps) => {
  const isEditMode = !!workflowId;

  const {
    useWorkflow,
    useWorkflowTriggers,
    useWorkflowActions,
    useWorkflowMappings,
    useExecutionLogs,
    updateWorkflow: updateWorkflowAPI,
  } = useIntegrations();

  // Fetch workflow data
  const { data: workflow, mutate: refreshWorkflowData } = useWorkflow(workflowId);
  const { data: triggers, mutate: refreshTriggers } = useWorkflowTriggers(workflowId);
  const { data: actions, mutate: refreshActions } = useWorkflowActions(workflowId);
  const { data: mappings, mutate: refreshMappings } = useWorkflowMappings(workflowId);
  const { data: executionLogs } = useExecutionLogs(workflowId, { limit: 1 });

  // Local state
  const [steps, setSteps] = useState<StepState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Get last execution
  const lastExecution: ExecutionLog | null =
    executionLogs && executionLogs.results?.length > 0 ? executionLogs.results[0] : null;

  // Build unified step list from triggers, actions, and mappings
  useEffect(() => {
    if (!isEditMode) {
      setSteps([]);
      return;
    }

    const newSteps: StepState[] = [];

    // Add trigger step (should only be one)
    if (triggers && triggers.length > 0) {
      const trigger = triggers[0];
      newSteps.push({
        id: `trigger-${trigger.id}`,
        type: 'trigger',
        backendId: trigger.id,
        data: trigger,
        isExpanded: false,
        isDraft: false,
        order: 0,
      });
    }

    // Add action steps with their mappings
    if (actions && actions.length > 0) {
      const sortedActions = [...actions].sort((a, b) => a.order_index - b.order_index);

      sortedActions.forEach((action, index) => {
        // Find mappings for this action
        const actionMappings = mappings?.filter(
          (m: any) => m.workflow_action === action.id
        ) || [];

        newSteps.push({
          id: `action-${action.id}`,
          type: 'action',
          backendId: action.id,
          data: action,
          mappings: actionMappings,
          isExpanded: false,
          isDraft: false,
          order: index + 1, // Trigger is 0, actions start at 1
        });
      });
    }

    setSteps(newSteps);
  }, [triggers, actions, mappings, isEditMode]);

  // Refresh all workflow data
  const refreshWorkflow = useCallback(() => {
    refreshWorkflowData();
    refreshTriggers();
    refreshActions();
    refreshMappings();
  }, [refreshWorkflowData, refreshTriggers, refreshActions, refreshMappings]);

  // Update workflow metadata
  const updateWorkflow = useCallback(
    async (data: Partial<Workflow>) => {
      if (!workflowId) return;

      setIsSaving(true);
      try {
        await updateWorkflowAPI(workflowId, data);
        await refreshWorkflowData();
        setIsDirty(false);
      } catch (error) {
        console.error('Failed to update workflow:', error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [workflowId, updateWorkflowAPI, refreshWorkflowData]
  );

  const value: WorkflowContextValue = {
    workflow: workflow || null,
    workflowId: workflowId || null,
    isEditMode,
    lastExecution,
    steps,
    setSteps,
    refreshWorkflow,
    updateWorkflow,
    isSaving,
    isDirty,
    setIsDirty,
  };

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
};
