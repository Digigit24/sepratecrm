// src/components/FieldConfigurationFormDrawer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { SideDrawer, type DrawerHeaderAction } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type {
  LeadFieldConfiguration,
  CreateLeadFieldConfigurationPayload,
  UpdateLeadFieldConfigurationPayload,
  FieldTypeEnum,
} from '@/types/crmTypes';
import { FIELD_TYPE_OPTIONS } from '@/types/crmTypes';

type DrawerMode = 'view' | 'edit' | 'create';

interface FieldConfigurationFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configId: number | null;
  mode: DrawerMode;
  onSuccess: () => void;
  onDelete?: (id: number) => void;
  onModeChange: (mode: DrawerMode) => void;
}

// Standard Lead fields that can be configured
const STANDARD_FIELD_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'value_amount', label: 'Value Amount' },
  { value: 'value_currency', label: 'Value Currency' },
  { value: 'source', label: 'Source' },
  { value: 'owner_user_id', label: 'Owner User ID' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'last_contacted_at', label: 'Last Contacted At' },
  { value: 'next_follow_up_at', label: 'Next Follow Up At' },
  { value: 'notes', label: 'Notes' },
  { value: 'address_line1', label: 'Address Line 1' },
  { value: 'address_line2', label: 'Address Line 2' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'postal_code', label: 'Postal Code' },
];

export function FieldConfigurationFormDrawer({
  open,
  onOpenChange,
  configId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: FieldConfigurationFormDrawerProps) {
  const {
    useFieldConfiguration,
    createFieldConfiguration,
    updateFieldConfiguration,
    deleteFieldConfiguration,
  } = useCRM();

  // Form state
  const [formData, setFormData] = useState<CreateLeadFieldConfigurationPayload>({
    field_name: '',
    field_label: '',
    is_standard: false,
    field_type: 'TEXT' as FieldTypeEnum,
    is_visible: true,
    is_required: false,
    is_active: true,
    default_value: '',
    options: [],
    placeholder: '',
    help_text: '',
    display_order: 0,
    validation_rules: {},
  });

  const [optionsInput, setOptionsInput] = useState<string>(''); // For dropdown/multiselect options
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch config data when editing/viewing
  const { data: configData, error: fetchError } = useFieldConfiguration(configId);

  // Update form data when config data changes
  useEffect(() => {
    if (configData && (mode === 'edit' || mode === 'view')) {
      setFormData({
        field_name: configData.field_name,
        field_label: configData.field_label,
        is_standard: configData.is_standard,
        field_type: configData.field_type,
        is_visible: configData.is_visible,
        is_required: configData.is_required,
        is_active: configData.is_active,
        default_value: configData.default_value || '',
        options: configData.options || [],
        placeholder: configData.placeholder || '',
        help_text: configData.help_text || '',
        display_order: configData.display_order,
        validation_rules: configData.validation_rules || {},
      });

      // Set options input for dropdown/multiselect
      if (configData.options && Array.isArray(configData.options)) {
        setOptionsInput(configData.options.join('\n'));
      }
    } else if (mode === 'create') {
      setFormData({
        field_name: '',
        field_label: '',
        is_standard: false,
        field_type: 'TEXT' as FieldTypeEnum,
        is_visible: true,
        is_required: false,
        is_active: true,
        default_value: '',
        options: [],
        placeholder: '',
        help_text: '',
        display_order: 0,
        validation_rules: {},
      });
      setOptionsInput('');
    }
    setErrors({});
  }, [configData, mode]);

  // Clear options when field type changes to a type that doesn't need them
  useEffect(() => {
    const fieldTypeNeedsOptions = formData.field_type === 'DROPDOWN' || formData.field_type === 'MULTISELECT';
    if (!fieldTypeNeedsOptions && optionsInput.trim()) {
      setOptionsInput('');
      setFormData(prev => ({ ...prev, options: [] }));
    }
  }, [formData.field_type]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.field_name.trim()) {
      newErrors.field_name = 'Field name is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.field_name)) {
      newErrors.field_name = 'Field name must start with a letter and contain only lowercase letters, numbers, and underscores';
    }

    if (!formData.field_label.trim()) {
      newErrors.field_label = 'Field label is required';
    }

    if (!formData.is_standard && !formData.field_type) {
      newErrors.field_type = 'Field type is required for custom fields';
    }

    // Validate options for dropdown/multiselect
    if (formData.field_type === 'DROPDOWN' || formData.field_type === 'MULTISELECT') {
      if (!optionsInput.trim() || optionsInput.trim().split('\n').filter(o => o.trim()).length === 0) {
        newErrors.options = 'At least one option is required for dropdown/multiselect fields';
      }
    }

    // Ensure options are not set for field types that don't need them
    const fieldTypeNeedsOptions = formData.field_type === 'DROPDOWN' || formData.field_type === 'MULTISELECT';
    if (!fieldTypeNeedsOptions && (optionsInput.trim() || (formData.options && formData.options.length > 0))) {
      newErrors.options = `Options are not applicable for ${formData.field_type} field type`;
    }

    if (formData.display_order < 0) {
      newErrors.display_order = 'Display order must be non-negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Process options based on field type
      const fieldTypeNeedsOptions = formData.field_type === 'DROPDOWN' || formData.field_type === 'MULTISELECT';

      let payload: any = {
        ...formData,
      };

      if (fieldTypeNeedsOptions) {
        // Parse and validate options for dropdown/multiselect
        const parsedOptions = optionsInput
          .split('\n')
          .map(o => o.trim())
          .filter(o => o.length > 0);
        payload.options = parsedOptions;
      } else {
        // For other field types, explicitly set options to null or omit it
        payload.options = null;
      }

      if (mode === 'create') {
        await createFieldConfiguration(payload);
        toast.success('Field configuration created successfully');
      } else if (mode === 'edit' && configId) {
        await updateFieldConfiguration(configId, payload);
        toast.success('Field configuration updated successfully');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save field configuration');
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, formData, configId, optionsInput, createFieldConfiguration, updateFieldConfiguration, onSuccess, onOpenChange]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!configId) return;

    setIsSubmitting(true);
    try {
      await deleteFieldConfiguration(configId);
      toast.success('Field configuration deleted successfully');
      onSuccess();
      onOpenChange(false);
      if (onDelete) {
        onDelete(configId);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete field configuration');
    } finally {
      setIsSubmitting(false);
    }
  }, [configId, deleteFieldConfiguration, onSuccess, onOpenChange, onDelete]);

  // Header actions
  const headerActions: DrawerHeaderAction[] = [];

  if (mode === 'view' && configId) {
    headerActions.push({
      icon: Edit,
      onClick: () => onModeChange('edit'),
      label: 'Edit Configuration',
      variant: 'outline',
    });
    // Only allow deletion of custom fields
    if (!formData.is_standard) {
      headerActions.push({
        icon: Trash2,
        onClick: handleDelete,
        label: 'Delete Configuration',
        variant: 'outline',
        disabled: isSubmitting,
      });
    }
  }

  // Footer buttons
  const footerButtons = [];

  if (mode === 'create' || mode === 'edit') {
    footerButtons.push({
      label: 'Cancel',
      variant: 'outline' as const,
      onClick: () => {
        if (mode === 'edit') {
          onModeChange('view');
        } else {
          onOpenChange(false);
        }
      },
      disabled: isSubmitting,
    });
    footerButtons.push({
      label: mode === 'create' ? 'Create Field' : 'Save Changes',
      onClick: handleSubmit,
      disabled: isSubmitting,
      loading: isSubmitting,
    });
  }

  const isViewMode = mode === 'view';
  const isEditable = mode === 'create' || mode === 'edit';

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        mode === 'create'
          ? 'Create Field Configuration'
          : mode === 'edit'
          ? 'Edit Field Configuration'
          : 'Field Configuration Details'
      }
      subtitle={
        mode === 'create'
          ? 'Configure a new field for leads'
          : configData
          ? `${configData.is_standard ? 'Standard' : 'Custom'} Field`
          : undefined
      }
      headerActions={headerActions}
      footerButtons={footerButtons}
      size="lg"
    >
      <div className="space-y-5">
        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Failed to load field configuration: {fetchError}
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Basic Information
          </h3>
          <div className="divide-y divide-border/40">
            {/* Field Category */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label htmlFor="is_standard" className="text-[13px]">Standard Field</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formData.is_standard ? 'Pre-defined Lead model field' : 'Custom metadata field'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {formData.is_standard && <Badge variant="secondary">Lead Model</Badge>}
                <Switch id="is_standard" checked={formData.is_standard} onCheckedChange={(checked) => setFormData({ ...formData, is_standard: checked })} disabled={isViewMode || (mode === 'edit' && configId !== null)} />
              </div>
            </div>

            {/* Field Name */}
            <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
              <Label htmlFor="field_name" className="text-[13px] text-muted-foreground font-normal pt-2">
                Name <span className="text-red-500">*</span>
              </Label>
              <div>
                {formData.is_standard ? (
                  <Select value={formData.field_name} onValueChange={(value) => setFormData({ ...formData, field_name: value })} disabled={isViewMode || (mode === 'edit' && configId !== null)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select a standard field" /></SelectTrigger>
                    <SelectContent>
                      {STANDARD_FIELD_OPTIONS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="field_name" value={formData.field_name} onChange={(e) => setFormData({ ...formData, field_name: e.target.value.toLowerCase() })} placeholder="e.g., custom_field_1" disabled={isViewMode || (mode === 'edit' && configId !== null)} className="h-9" />
                )}
                {errors.field_name && <p className="text-xs text-red-500 mt-1">{errors.field_name}</p>}
                <p className="text-xs text-muted-foreground mt-1">Unique identifier (lowercase, no spaces)</p>
              </div>
            </div>

            {/* Field Label */}
            <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
              <Label htmlFor="field_label" className="text-[13px] text-muted-foreground font-normal pt-2">
                Label <span className="text-red-500">*</span>
              </Label>
              <div>
                <Input id="field_label" value={formData.field_label} onChange={(e) => {
                  const newLabel = e.target.value;
                  if (mode === 'create') {
                    const generatedName = newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                    setFormData({ ...formData, field_label: newLabel, field_name: generatedName });
                  } else {
                    setFormData({ ...formData, field_label: newLabel });
                  }
                }} placeholder="e.g., Custom Field 1" disabled={isViewMode} className="h-9" />
                {errors.field_label && <p className="text-xs text-red-500 mt-1">{errors.field_label}</p>}
              </div>
            </div>

            {/* Field Type (custom fields only) */}
            {!formData.is_standard && (
              <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                <Label htmlFor="field_type" className="text-[13px] text-muted-foreground font-normal pt-2">
                  Type <span className="text-red-500">*</span>
                </Label>
                <div>
                  <Select value={formData.field_type} onValueChange={(value) => setFormData({ ...formData, field_type: value as FieldTypeEnum })} disabled={isViewMode}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select field type" /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.field_type && <p className="text-xs text-red-500 mt-1">{errors.field_type}</p>}
                </div>
              </div>
            )}

            {/* Display Order */}
            <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
              <Label htmlFor="display_order" className="text-[13px] text-muted-foreground font-normal pt-2">Order</Label>
              <div>
                <Input id="display_order" type="number" min="0" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} disabled={isViewMode} className="h-9" />
                {errors.display_order && <p className="text-xs text-red-500 mt-1">{errors.display_order}</p>}
                <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
              </div>
            </div>
          </div>
        </div>

        {/* Field Options (for dropdown/multiselect) */}
        {!formData.is_standard && (formData.field_type === 'DROPDOWN' || formData.field_type === 'MULTISELECT') && (
          <>
            <div className="border-t border-border/50" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Field Options
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Define options for this {formData.field_type.toLowerCase()} field
              </p>
              <div>
                <Textarea id="options" value={optionsInput} onChange={(e) => setOptionsInput(e.target.value)} placeholder="Enter one option per line&#10;Option 1&#10;Option 2&#10;Option 3" rows={6} disabled={isViewMode} />
                {errors.options && <p className="text-xs text-red-500 mt-1">{errors.options}</p>}
                <p className="text-xs text-muted-foreground mt-1">Enter one option per line</p>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-border/50" />

        {/* Field Configuration */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Field Configuration
          </h3>
          <div className="divide-y divide-border/40">
            {/* Placeholder */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="placeholder" className="text-[13px] text-muted-foreground font-normal">Placeholder</Label>
              <Input id="placeholder" value={formData.placeholder || ''} onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })} placeholder="e.g., Enter value..." disabled={isViewMode} className="h-9" />
            </div>

            {/* Help Text */}
            <div className="py-2.5 space-y-1.5">
              <Label htmlFor="help_text" className="text-[13px] text-muted-foreground font-normal">Help Text</Label>
              <Textarea id="help_text" value={formData.help_text || ''} onChange={(e) => setFormData({ ...formData, help_text: e.target.value })} placeholder="Additional guidance for this field" rows={2} disabled={isViewMode} />
            </div>

            {/* Default Value */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="default_value" className="text-[13px] text-muted-foreground font-normal">Default</Label>
              <Input id="default_value" value={formData.default_value || ''} onChange={(e) => setFormData({ ...formData, default_value: e.target.value })} placeholder="Default value" disabled={isViewMode} className="h-9" />
            </div>

            {/* Visible toggle */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label htmlFor="is_visible" className="text-[13px]">Visible</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Show this field in the UI</p>
              </div>
              <Switch id="is_visible" checked={formData.is_visible} onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })} disabled={isViewMode} />
            </div>

            {/* Required toggle */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label htmlFor="is_required" className="text-[13px]">Required</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Make this field mandatory</p>
              </div>
              <Switch id="is_required" checked={formData.is_required} onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })} disabled={isViewMode} />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label htmlFor="is_active" className="text-[13px]">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Enable this field configuration</p>
              </div>
              <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} disabled={isViewMode} />
            </div>
          </div>
        </div>

        {/* Metadata (view mode) */}
        {mode === 'view' && configData && (
          <>
            <div className="border-t border-border/50" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Metadata
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Created</span>
                  <span className="text-sm">{formatDistanceToNow(new Date(configData.created_at), { addSuffix: true })}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Updated</span>
                  <span className="text-sm">{formatDistanceToNow(new Date(configData.updated_at), { addSuffix: true })}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Category</span>
                  <Badge variant={configData.is_standard ? 'default' : 'secondary'}>{configData.is_standard ? 'Standard' : 'Custom'}</Badge>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SideDrawer>
  );
}
