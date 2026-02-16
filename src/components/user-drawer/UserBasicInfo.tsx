// src/components/user-drawer/UserBasicInfo.tsx
import { forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

import type { User, UserCreateData, UserUpdateData } from '@/types/user.types';
import { useRoles } from '@/hooks/useRoles';

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirm: z.string().min(8, 'Password confirmation required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  timezone: z.string().optional(),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ["password_confirm"],
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  first_name: z.string().min(1, 'First name is required').optional(),
  last_name: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  timezone: z.string().optional(),
  is_active: z.boolean().optional(),
});

type UserFormData = z.infer<typeof createUserSchema> | z.infer<typeof updateUserSchema>;

export interface UserBasicInfoHandle {
  getFormValues: () => Promise<UserCreateData | UserUpdateData | null>;
}

interface UserBasicInfoProps {
  user?: User | null;
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

// Common timezones
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const UserBasicInfo = forwardRef<UserBasicInfoHandle, UserBasicInfoProps>(
  ({ user, mode, onSuccess }, ref) => {
    const isReadOnly = mode === 'view';
    const isCreateMode = mode === 'create';

    const schema = isCreateMode ? createUserSchema : updateUserSchema;

    // Fetch roles for selection
    const { useRolesList } = useRoles();
    const { data: rolesData, isLoading: rolesLoading } = useRolesList({ is_active: true });
    const availableRoles = rolesData?.results || [];

    // Role selection state
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
      user?.roles?.map((r) => r.id) || []
    );

    const defaultValues = isCreateMode
      ? {
          email: '',
          password: '',
          password_confirm: '',
          first_name: '',
          last_name: '',
          phone: '',
          timezone: 'Asia/Kolkata',
        }
      : {
          email: user?.email || '',
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
          phone: user?.phone || '',
          timezone: user?.timezone || 'Asia/Kolkata',
          is_active: user?.is_active ?? true,
        };

    const {
      register,
      handleSubmit,
      formState: { errors },
      watch,
      setValue,
      reset,
    } = useForm<any>({
      resolver: zodResolver(schema),
      defaultValues,
    });

    const watchedIsActive = watch('is_active');
    const watchedTimezone = watch('timezone');

    // Reset form when user data changes (for edit/view modes)
    useEffect(() => {
      if (!isCreateMode && user) {
        const formValues = {
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          phone: user.phone || '',
          timezone: user.timezone || 'Asia/Kolkata',
          is_active: user.is_active ?? true,
        };
        reset(formValues);
        setSelectedRoleIds(user.roles?.map((r) => r.id) || []);
      }
    }, [user, isCreateMode, reset]);

    // Role selection handlers
    const toggleRole = (roleId: string) => {
      setSelectedRoleIds((prev) =>
        prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
      );
    };

    const removeRole = (roleId: string) => {
      setSelectedRoleIds((prev) => prev.filter((id) => id !== roleId));
    };

    // Expose form validation and data collection to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<UserCreateData | UserUpdateData | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              console.log('Form validation passed:', data);

              if (isCreateMode) {
                const createData: UserCreateData = {
                  email: data.email,
                  password: data.password,
                  password_confirm: data.password_confirm,
                  first_name: data.first_name,
                  last_name: data.last_name,
                  phone: data.phone || undefined,
                  timezone: data.timezone || 'Asia/Kolkata',
                  role_ids: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
                };
                resolve(createData);
              } else {
                const updateData: UserUpdateData = {
                  email: data.email,
                  first_name: data.first_name,
                  last_name: data.last_name,
                  phone: data.phone || undefined,
                  timezone: data.timezone || 'Asia/Kolkata',
                  is_active: data.is_active,
                  role_ids: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
                };
                resolve(updateData);
              }
            },
            (errors) => {
              console.error('Form validation failed:', errors);
              resolve(null);
            }
          )();
        });
      },
    }));

    return (
      <div className="space-y-5">
        {/* View Mode */}
        {isReadOnly && user && (
          <>
            {/* User Details */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                User Details
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">First Name</span>
                  <span className="text-sm font-medium">{user.first_name}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Last Name</span>
                  <span className="text-sm font-medium">{user.last_name}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Email</span>
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Phone</span>
                  <span className="text-sm">{user.phone || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Timezone</span>
                  <span className="text-sm">{user.timezone || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Status</span>
                  <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-green-600' : ''}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Roles & Permissions */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Roles & Permissions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(user.roles || []).map((role) => (
                  <Badge key={role.id} variant="secondary">{role.name}</Badge>
                ))}
                {user.is_super_admin && (
                  <Badge variant="default" className="bg-purple-600">Super Admin</Badge>
                )}
                {(!user.roles || user.roles.length === 0) && !user.is_super_admin && (
                  <p className="text-sm text-muted-foreground">No roles assigned</p>
                )}
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Tenant Information */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Tenant Information
              </h3>
              <div className="divide-y divide-border/40">
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Tenant</span>
                  <span className="text-sm">{user.tenant_name || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2">
                  <span className="text-[13px] text-muted-foreground">Joined</span>
                  <span className="text-sm">{new Date(user.date_joined).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit/Create Mode */}
        {!isReadOnly && (
          <>
            {/* Basic Information */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Basic Information
              </h3>
              <div className="divide-y divide-border/40">
                {/* First Name */}
                <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                  <Label htmlFor="first_name" className="text-[13px] text-muted-foreground font-normal pt-2">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <div>
                    <Input id="first_name" {...register('first_name')} placeholder="John" className="h-9" />
                    {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name.message as string}</p>}
                  </div>
                </div>

                {/* Last Name */}
                <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                  <Label htmlFor="last_name" className="text-[13px] text-muted-foreground font-normal pt-2">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <div>
                    <Input id="last_name" {...register('last_name')} placeholder="Doe" className="h-9" />
                    {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name.message as string}</p>}
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                  <Label htmlFor="email" className="text-[13px] text-muted-foreground font-normal pt-2">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <div>
                    <Input id="email" type="email" {...register('email')} placeholder="john@example.com" disabled={!isCreateMode} className="h-9" />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message as string}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                  <Label htmlFor="phone" className="text-[13px] text-muted-foreground font-normal pt-2">Phone</Label>
                  <div>
                    <Input id="phone" {...register('phone')} placeholder="+1234567890" className="h-9" />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message as string}</p>}
                  </div>
                </div>

                {/* Timezone */}
                <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
                  <Label htmlFor="timezone" className="text-[13px] text-muted-foreground font-normal">Timezone</Label>
                  <Select value={watchedTimezone || 'Asia/Kolkata'} onValueChange={(value) => setValue('timezone', value)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select timezone" /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Status (Edit mode only) */}
                {!isCreateMode && (
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <Label className="text-[13px]">Active</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Deactivate to revoke access</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{watchedIsActive ? 'Active' : 'Inactive'}</span>
                      <Switch id="is_active" checked={watchedIsActive} onCheckedChange={(checked) => setValue('is_active', checked)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Password Fields (Create mode only) */}
            {isCreateMode && (
              <>
                <div className="border-t border-border/50" />
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                    Account Credentials
                  </h3>
                  <div className="divide-y divide-border/40">
                    <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                      <Label htmlFor="password" className="text-[13px] text-muted-foreground font-normal pt-2">
                        Password <span className="text-destructive">*</span>
                      </Label>
                      <div>
                        <Input id="password" type="password" {...register('password')} placeholder="••••••••" className="h-9" />
                        {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message as string}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] items-start gap-3 py-2.5">
                      <Label htmlFor="password_confirm" className="text-[13px] text-muted-foreground font-normal pt-2">
                        Confirm <span className="text-destructive">*</span>
                      </Label>
                      <div>
                        <Input id="password_confirm" type="password" {...register('password_confirm')} placeholder="••••••••" className="h-9" />
                        {errors.password_confirm && <p className="text-xs text-destructive mt-1">{errors.password_confirm.message as string}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-border/50" />

            {/* Roles Assignment */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
                Roles & Permissions
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Assign roles to control user access</p>

              {/* Selected Roles */}
              {selectedRoleIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedRoleIds.map((roleId) => {
                    const role = availableRoles.find((r) => r.id === roleId);
                    if (!role) return null;
                    return (
                      <Badge key={roleId} variant="secondary" className="pr-1">
                        {role.name}
                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-2 hover:bg-transparent" onClick={() => removeRole(roleId)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Role Selection */}
              {rolesLoading ? (
                <p className="text-sm text-muted-foreground">Loading roles...</p>
              ) : availableRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active roles available</p>
              ) : (
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-1">
                    {availableRoles.map((role) => (
                      <div key={role.id} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded">
                        <Checkbox id={`role-${role.id}`} checked={selectedRoleIds.includes(role.id)} onCheckedChange={() => toggleRole(role.id)} />
                        <div className="flex-1 space-y-0.5">
                          <Label htmlFor={`role-${role.id}`} className="text-sm font-medium cursor-pointer">{role.name}</Label>
                          {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}
      </div>
    );
  }
);

UserBasicInfo.displayName = 'UserBasicInfo';

export default UserBasicInfo;
