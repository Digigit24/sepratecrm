// src/components/LeadStatusFormDrawer.tsx
import { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { SideDrawer, type DrawerHeaderAction } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Status Name *</Label>
              {mode === 'view' ? (
                <div className="flex items-center gap-2">
                  <ColorPreview color={formData.color_hex || COLOR_OPTIONS[0]} />
                  <span className="font-medium">{statusData?.name}</span>
                </div>
              ) : (
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter status name"
                  className={errors.name ? 'border-destructive' : ''}
                />
              )}
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Order Index */}
            <div className="space-y-2">
              <Label htmlFor="order_index">Order Index *</Label>
              {mode === 'view' ? (
                <span className="text-sm">{statusData?.order_index}</span>
              ) : (
                <Input
                  id="order_index"
                  type="number"
                  min="0"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                  placeholder="Enter order index"
                  className={errors.order_index ? 'border-destructive' : ''}
                />
              )}
              {errors.order_index && (
                <p className="text-sm text-destructive">{errors.order_index}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first in the pipeline
              </p>
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
              <Label>Status Color</Label>
              {mode === 'view' ? (
                <div className="flex items-center gap-2">
                  <ColorPreview color={statusData?.color_hex || COLOR_OPTIONS[0]} />
                  <span className="text-sm font-mono">{statusData?.color_hex || 'No color set'}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color_hex: color })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.color_hex === color
                            ? 'border-foreground scale-110'
                            : 'border-muted hover:border-muted-foreground'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={formData.color_hex || ''}
                      onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                      placeholder="#000000"
                      className="w-24 font-mono text-sm"
                    />
                    <span className="text-xs text-muted-foreground">or enter custom hex</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Properties */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Is Won */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Won Status</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this status as a winning/successful outcome
                </p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_won ? 'default' : 'secondary'}>
                  {statusData?.is_won ? 'Won' : 'Not Won'}
                </Badge>
              ) : (
                <Switch
                  checked={formData.is_won}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_won: checked })}
                />
              )}
            </div>
            {errors.is_won && (
              <p className="text-sm text-destructive">{errors.is_won}</p>
            )}

            <Separator />

            {/* Is Lost */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Lost Status</Label>
                <p className="text-xs text-muted-foreground">
                  Mark this status as a losing/unsuccessful outcome
                </p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_lost ? 'destructive' : 'secondary'}>
                  {statusData?.is_lost ? 'Lost' : 'Not Lost'}
                </Badge>
              ) : (
                <Switch
                  checked={formData.is_lost}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_lost: checked })}
                />
              )}
            </div>
            {errors.is_lost && (
              <p className="text-sm text-destructive">{errors.is_lost}</p>
            )}

            <Separator />

            {/* Is Active */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive statuses are hidden from the pipeline
                </p>
              </div>
              {mode === 'view' ? (
                <Badge variant={statusData?.is_active ? 'default' : 'secondary'}>
                  {statusData?.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ) : (
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata (View mode only) */}
        {mode === 'view' && statusData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Status ID</Label>
                  <p className="font-mono">{statusData.id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tenant ID</Label>
                  <p className="font-mono text-xs">{statusData.tenant_id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p>{formatDistanceToNow(new Date(statusData.created_at), { addSuffix: true })}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Last Updated</Label>
                  <p>{formatDistanceToNow(new Date(statusData.updated_at), { addSuffix: true })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SideDrawer>
  );
}