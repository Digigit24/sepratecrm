// src/components/role-drawer/RoleBasicInfo.tsx
import { useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Role Name <span className="text-destructive">*</span>
              </Label>
              {isViewMode ? (
                <p className="text-sm font-medium">{role?.name}</p>
              ) : (
                <Input
                  id="name"
                  placeholder="e.g., Sales Manager, Team Lead"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {isViewMode ? (
                <p className="text-sm text-muted-foreground">
                  {role?.description || 'No description provided'}
                </p>
              ) : (
                <Textarea
                  id="description"
                  placeholder="Describe the purpose and responsibilities of this role"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                />
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive roles cannot be assigned to users
                </p>
              </div>
              {isViewMode ? (
                <Badge variant={role?.is_active ? 'default' : 'secondary'}>
                  {role?.is_active ? 'Active' : 'Inactive'}
                </Badge>
              ) : (
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                />
              )}
            </div>

            {/* View Mode Only: Metadata */}
            {isViewMode && role && (
              <>
                <div className="pt-4 border-t space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Created By</Label>
                    <p className="text-sm">{role.created_by_email || role.created_by}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Members</Label>
                    <p className="text-sm font-medium">{role.member_count || 0} users</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Created</Label>
                      <p className="text-sm">
                        {new Date(role.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Updated</Label>
                      <p className="text-sm">
                        {new Date(role.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure what this role can access and do in the system
            </p>
          </CardHeader>
          <CardContent>
            {schemaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : permissionsSchema ? (
              <PermissionsEditor
                schema={permissionsSchema}
                value={formData.permissions}
                onChange={(permissions) => handleInputChange('permissions', permissions)}
                disabled={isViewMode}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Failed to load permissions schema
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
);

RoleBasicInfo.displayName = 'RoleBasicInfo';

export default RoleBasicInfo;
