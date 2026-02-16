// src/components/workflow-editor/WorkflowHeader.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkflowContext } from './WorkflowContext';
import { useIntegrations } from '@/hooks/useIntegrations';

export const WorkflowHeader = () => {
  const navigate = useNavigate();
  const {
    workflow,
    workflowId,
    isEditMode,
    updateWorkflow,
    isSaving,
    isDirty,
    setIsDirty,
  } = useWorkflowContext();

  const { testWorkflow } = useIntegrations();

  // Local state for inline editing
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [isActive, setIsActive] = useState(workflow?.is_active ?? true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Update local state when workflow data changes
  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || '');
      setIsActive(workflow.is_active);
    }
  }, [workflow]);

  // Debounced auto-save for name and description
  useEffect(() => {
    if (!isEditMode || !workflow) return;

    const hasChanged =
      name !== workflow.name || description !== (workflow.description || '');

    if (hasChanged) {
      setIsDirty(true);
      const timer = setTimeout(() => {
        handleSaveMetadata();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [name, description]);

  const handleSaveMetadata = async () => {
    if (!workflowId) return;

    try {
      await updateWorkflow({
        name,
        description,
        is_active: isActive,
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save workflow');
    }
  };

  const handleActiveToggle = async (checked: boolean) => {
    setIsActive(checked);
    if (!workflowId) return;

    try {
      await updateWorkflow({ is_active: checked });
      toast.success(`Workflow ${checked ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
      setIsActive(!checked); // Revert on error
    }
  };

  const handleTest = async () => {
    if (!workflowId) {
      toast.error('Please save the workflow first');
      return;
    }

    setIsTesting(true);
    try {
      await testWorkflow(workflowId);
      toast.success('Workflow test started successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to test workflow');
    } finally {
      setIsTesting(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    navigate('/integrations?tab=workflows');
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* Back button and title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            {isEditingName ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false);
                }}
                placeholder="Workflow name"
                className="text-2xl font-bold border-none shadow-none px-0 h-auto"
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => setIsEditingName(true)}
              >
                {name || 'Untitled Workflow'}
              </h1>
            )}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="secondary">Unsaved changes</Badge>
            )}
            {isSaving && (
              <Badge variant="outline">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description for this workflow..."
          className="resize-none min-h-[60px]"
        />

        {/* Controls */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Switch
              id="workflow-active"
              checked={isActive}
              onCheckedChange={handleActiveToggle}
            />
            <Label htmlFor="workflow-active" className="cursor-pointer">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
            {isActive && (
              <Badge variant="default" className="ml-2">
                Active
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Test Workflow
              </Button>
            )}
            <Button onClick={handleSaveMetadata} disabled={!isDirty && isEditMode}>
              <Save className="h-4 w-4 mr-2" />
              {isEditMode ? 'Save' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
