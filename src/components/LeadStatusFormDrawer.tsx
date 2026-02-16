// src/components/LeadStatusFormDrawer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { SideDrawer, type DrawerHeaderAction } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Save, X, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { LeadStatus, CreateLeadStatusPayload, UpdateLeadStatusPayload } from '@/types/crmTypes';

type DrawerMode = 'view' | 'edit' | 'create';

interface LeadStatusFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusId: number | null;
  mode: DrawerMode;
  onSuccess: () => void;
  onDelete?: (id: number) => void;
  onModeChange: (mode: DrawerMode) => void;
}

// Predefined color options
const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export function LeadStatusFormDrawer({
  open,
  onOpenChange,
  statusId,
  mode,
  onSuccess,
  onDelete,
  onModeChange,
}: LeadStatusFormDrawerProps) {
  const { useLeadStatus, createLeadStatus, updateLeadStatus, deleteLeadStatus, isLoading } = useCRM();

  // Form state
  const [formData, setFormData] = useState<CreateLeadStatusPayload>({
    name: '',
    order_index: 0,
    color_hex: COLOR_OPTIONS[0],
    is_won: false,
    is_lost: false,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch status data when editing/viewing
  const { data: statusData, error: fetchError } = useLeadStatus(statusId);

  // Update form data when status data changes
  useEffect(() => {
    if (statusData && (mode === 'edit' || mode === 'view')) {
      setFormData({
        name: statusData.name,
        order_index: statusData.order_index,
        color_hex: statusData.color_hex || COLOR_OPTIONS[0],
        is_won: statusData.is_won,
        is_lost: statusData.is_lost,
        is_active: statusData.is_active,
      });
    } else if (mode === 'create') {
      setFormData({
        name: '',
        order_index: 0,
        color_hex: COLOR_OPTIONS[0],
        is_won: false,
        is_lost: false,
        is_active: true,
      });
    }
  }, [statusData, mode]);

  // Clear errors when form data changes
  useEffect(() => {
    setErrors({});
  }, [formData]);

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Status name is required';
    }

    if (formData.order_index < 0) {
      newErrors.order_index = 'Order index must be non-negative';
    }

    if (formData.is_won && formData.is_lost) {
      newErrors.is_won = 'Status cannot be both won and lost';
      newErrors.is_lost = 'Status cannot be both won and lost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'create') {
        await createLeadStatus(formData);
        toast.success('Lead status created successfully');
      } else if (mode === 'edit' && statusId) {
        await updateLeadStatus(statusId, formData);
        toast.success('Lead status updated successfully');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save lead status');
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, formData, statusId, createLeadStatus, updateLeadStatus, onSuccess, onOpenChange]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!statusId) return;

    setIsSubmitting(true);
    try {
      await deleteLeadStatus(statusId);
      toast.success('Lead status deleted successfully');
      onSuccess();
      onOpenChange(false);
      if (onDelete) {
        onDelete(statusId);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete lead status');
    } finally {
      setIsSubmitting(false);
    }
  }, [statusId, deleteLeadStatus, onSuccess, onOpenChange, onDelete]);

  // Header actions
  const headerActions: DrawerHeaderAction[] = [];

  if (mode === 'view' && statusId) {
    headerActions.push({
      icon: Edit,
      onClick: () => onModeChange('edit'),
      label: 'Edit Status',
      variant: 'outline',
    });
    headerActions.push({
      icon: Trash2,
      onClick: handleDelete,
      label: 'Delete Status',
      variant: 'outline',
      disabled: isSubmitting,
    });
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
      label: mode === 'create' ? 'Create Status' : 'Save Changes',
      onClick: handleSubmit,
      disabled: isSubmitting,
      loading: isSubmitting,
      icon: Save,
    });
  }

  // Get drawer title
  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create Lead Status';
      case 'edit':
        return 'Edit Lead Status';
      case 'view':
        return statusData?.name || 'Lead Status Details';
      default:
        return 'Lead Status';
    }
  };

  // Color preview component
  const ColorPreview = ({ color }: { color: string }) => (
    <div
      className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
      style={{ backgroundColor: color }}
    />
  );

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={getTitle()}
      mode={mode}
      headerActions={headerActions}
      footerButtons={footerButtons}
      isLoading={isLoading && !statusData}
      loadingText="Loading status details..."
      size="md"
    >
      {fetchError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-6">
          <p className="text-sm text-destructive">
            Failed to load status details: {fetchError.message}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Basic Information */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Basic Information
          </h3>
          <div className="divide-y divide-border/40">
            {/* Status Name */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="name" className="text-[13px] text-muted-foreground font-normal">Name *</Label>
              {mode === 'view' ? (
                <div className="flex items-center gap-2">
                  <ColorPreview color={formData.color_hex || COLOR_OPTIONS[0]} />
                  <span className="text-sm font-medium">{statusData?.name}</span>
                </div>
              ) : (
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter status name" className={`h-9 ${errors.name ? 'border-destructive' : ''}`} />
              )}
            </div>
            {errors.name && <p className="text-xs text-destructive px-0.5 pb-1">{errors.name}</p>}

            {/* Order Index */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="order_index" className="text-[13px] text-muted-foreground font-normal">Order *</Label>
              {mode === 'view' ? (
                <span className="text-sm font-medium">{statusData?.order_index}</span>
              ) : (
                <Input id="order_index" type="number" min="0" value={formData.order_index} onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })} placeholder="Enter order index" className={`h-9 ${errors.order_index ? 'border-destructive' : ''}`} />
              )}
            </div>
            {errors.order_index && <p className="text-xs text-destructive px-0.5 pb-1">{errors.order_index}</p>}
            <p className="text-xs text-muted-foreground px-0.5 pb-1">Lower numbers appear first in the pipeline</p>

            {/* Color Selection */}
            <div className="py-2.5">
              <Label className="text-[13px] text-muted-foreground font-normal">Color</Label>
              {mode === 'view' ? (
                <div className="flex items-center gap-2 mt-2">
                  <ColorPreview color={statusData?.color_hex || COLOR_OPTIONS[0]} />
                  <span className="text-sm font-mono">{statusData?.color_hex || 'No color set'}</span>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map((color) => (
                      <button key={color} type="button" onClick={() => setFormData({ ...formData, color_hex: color })} className={`w-7 h-7 rounded-full border-2 transition-all ${formData.color_hex === color ? 'border-foreground scale-110' : 'border-muted hover:border-muted-foreground'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <Input type="text" value={formData.color_hex || ''} onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })} placeholder="#000000" className="w-24 font-mono text-sm h-8" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50" />

        {/* Status Properties */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Status Properties
          </h3>
          <div className="divide-y divide-border/40">
            {/* Is Won */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-[13px]">Won Status</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Mark as a winning outcome</p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_won ? 'default' : 'secondary'}>{statusData?.is_won ? 'Won' : 'Not Won'}</Badge>
              ) : (
                <Switch checked={formData.is_won} onCheckedChange={(checked) => setFormData({ ...formData, is_won: checked })} />
              )}
            </div>
            {errors.is_won && <p className="text-xs text-destructive px-0.5 pb-1">{errors.is_won}</p>}

            {/* Is Lost */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-[13px]">Lost Status</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Mark as a losing outcome</p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_lost ? 'destructive' : 'secondary'}>{statusData?.is_lost ? 'Lost' : 'Not Lost'}</Badge>
              ) : (
                <Switch checked={formData.is_lost} onCheckedChange={(checked) => setFormData({ ...formData, is_lost: checked })} />
              )}
            </div>
            {errors.is_lost && <p className="text-xs text-destructive px-0.5 pb-1">{errors.is_lost}</p>}

            {/* Is Active */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-[13px]">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inactive statuses are hidden</p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_active ? 'default' : 'secondary'}>{statusData?.is_active ? 'Active' : 'Inactive'}</Badge>
              ) : (
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              )}
            </div>
          </div>
        </div>

        {/* Metadata (View mode only) */}
        {mode === 'view' && statusData && (
          <>
            <div className="border-t border-border/50" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Metadata
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Status ID</span>
                  <span className="text-sm font-mono">{statusData.id}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Tenant ID</span>
                  <span className="text-sm font-mono text-xs">{statusData.tenant_id}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Created</span>
                  <span className="text-sm">{formatDistanceToNow(new Date(statusData.created_at), { addSuffix: true })}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Updated</span>
                  <span className="text-sm">{formatDistanceToNow(new Date(statusData.updated_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SideDrawer>
  );
}
