// src/components/role-drawer/RoleBasicInfo.tsx
import { useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PermissionsEditor } from '@/components/PermissionsEditor';
import { useRoles } from '@/hooks/useRoles';
import type { Role, RoleCreateData, RoleUpdateData } from '@/types/user.types';
import { Loader2 } from 'lucide-react';

export interface RoleBasicInfoHandle {
  getFormValues: () => Promise<RoleCreateData | RoleUpdateData | null>;
}

interface RoleBasicInfoProps {
  role?: Role;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const RoleBasicInfo = forwardRef<RoleBasicInfoHandle, RoleBasicInfoProps>(
  ({ role, mode, onSuccess }, ref) => {
    const { usePermissionsSchema } = useRoles();
    const { data: permissionsSchema, isLoading: schemaLoading } = usePermissionsSchema();

    // Form state
    const [formData, setFormData] = useState({
      name: role?.name || '',
      description: role?.description || '',
      is_active: role?.is_active ?? true,
      permissions: role?.permissions || {},
    });

    // Update form when role changes
    useEffect(() => {
      if (role) {
        setFormData({
          name: role.name || '',
          description: role.description || '',
          is_active: role.is_active ?? true,
          permissions: role.permissions || {},
        });
      }
    }, [role]);

    useImperativeHandle(ref, () => ({
      getFormValues: async () => {
        // Validation
        if (!formData.name.trim()) {
          throw new Error('Role name is required');
        }

        if (mode === 'create') {
          return {
            name: formData.name.trim(),
            description: formData.description.trim(),
            is_active: formData.is_active,
            permissions: formData.permissions,
          } as RoleCreateData;
        } else {
          return {
            name: formData.name.trim(),
            description: formData.description.trim(),
            is_active: formData.is_active,
            permissions: formData.permissions,
          } as RoleUpdateData;
        }
      },
    }));

    const handleInputChange = (field: string, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const isViewMode = mode === 'view';
    const isEditMode = mode === 'edit' || mode === 'create';

    return (
      <div className="space-y-5">
        {/* Basic Information */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Basic Information
          </h3>
          <div className="divide-y divide-border/40">
            {/* Role Name */}
            <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
              <Label htmlFor="name" className="text-[13px] text-muted-foreground font-normal">
                Name <span className="text-destructive">*</span>
              </Label>
              {isViewMode ? (
                <span className="text-sm font-medium">{role?.name}</span>
              ) : (
                <Input id="name" placeholder="e.g., Sales Manager" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="h-9" />
              )}
            </div>

            {/* Description */}
            <div className="py-2.5 space-y-1.5">
              <Label htmlFor="description" className="text-[13px] text-muted-foreground font-normal">Description</Label>
              {isViewMode ? (
                <p className="text-sm text-muted-foreground">{role?.description || 'No description provided'}</p>
              ) : (
                <Textarea id="description" placeholder="Describe the purpose and responsibilities" value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} rows={3} />
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between py-2.5">
              <div>
                <Label className="text-[13px]">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inactive roles cannot be assigned</p>
              </div>
              {isViewMode ? (
                <Badge variant={role?.is_active ? 'default' : 'secondary'}>{role?.is_active ? 'Active' : 'Inactive'}</Badge>
              ) : (
                <Switch checked={formData.is_active} onCheckedChange={(checked) => handleInputChange('is_active', checked)} />
              )}
            </div>
          </div>
        </div>

        {/* View Mode Only: Metadata */}
        {isViewMode && role && (
          <>
            <div className="border-t border-border/50" />
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Metadata
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Created By</span>
                  <span className="text-sm">{role.created_by_email || role.created_by}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Members</span>
                  <span className="text-sm font-medium">{role.member_count || 0} users</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Created</span>
                  <span className="text-sm">{new Date(role.created_at).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Updated</span>
                  <span className="text-sm">{new Date(role.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-border/50" />

        {/* Permissions */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Permissions
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Configure what this role can access and do</p>

          {schemaLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : permissionsSchema ? (
            <PermissionsEditor schema={permissionsSchema} value={formData.permissions} onChange={(permissions) => handleInputChange('permissions', permissions)} disabled={isViewMode} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">Failed to load permissions schema</div>
          )}
        </div>
      </div>
    );
  }
);

RoleBasicInfo.displayName = 'RoleBasicInfo';

export default RoleBasicInfo;
