// src/components/workflow-editor/types/workflowEditor.types.ts
import type {
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowMapping,
  ExecutionLog,
  TriggerTypeEnum,
  ActionTypeEnum,
} from '@/types/integration.types';

export interface StepState {
  id: string; // Unique identifier for drag-drop (uuid)
  type: 'trigger' | 'action';
  backendId?: number; // ID from backend (undefined for new/draft steps)
  data: WorkflowTrigger | WorkflowAction | null;
  mappings?: WorkflowMapping[]; // For actions only
  isExpanded: boolean;
  isDraft: boolean; // True if not yet saved to backend
  order: number; // Display order
}

export interface WorkflowContextValue {
  workflow: Workflow | null;
  workflowId: number | null;
  isEditMode: boolean;
  lastExecution: ExecutionLog | null;
  steps: StepState[];
  setSteps: React.Dispatch<React.SetStateAction<StepState[]>>;
  refreshWorkflow: () => void;
  updateWorkflow: (data: Partial<Workflow>) => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

export interface StepTemplate {
  id: string;
  category: 'trigger' | 'action';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  integrations: string[]; // Integration types required
  defaultConfig: {
    trigger_type?: TriggerTypeEnum;
    action_type?: ActionTypeEnum;
  };
}

export interface StepCardProps {
  step: StepState;
  index: number;
  isDraggable?: boolean;
  onDelete?: () => void;
  onSave?: (data: any) => Promise<void>;
}
