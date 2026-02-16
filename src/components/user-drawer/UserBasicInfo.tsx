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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <div className="space-y-6">
        {/* View Mode - Display User Info */}
        {isReadOnly && user && (
          <>
            {/* User Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">First Name</p>
                    <p className="text-sm">{user.first_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                    <p className="text-sm">{user.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm">{user.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Timezone</p>
                    <p className="text-sm">{user.timezone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-green-600' : ''}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Roles Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Roles & Permissions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Assigned Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {(user.roles || []).map((role) => (
                      <Badge key={role.id} variant="secondary">
                        {role.name}
                      </Badge>
                    ))}
                    {user.is_super_admin && (
                      <Badge variant="default" className="bg-purple-600">
                        Super Admin
                      </Badge>
                    )}
                    {(!user.roles || user.roles.length === 0) && !user.is_super_admin && (
                      <p className="text-sm text-muted-foreground">No roles assigned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tenant Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tenant Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tenant Name</p>
                    <p className="text-sm">{user.tenant_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Joined Date</p>
                    <p className="text-sm">{new Date(user.date_joined).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Edit/Create Mode - Form Fields */}
        {!isReadOnly && (
          <>
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* First Name */}
                  <div className="space-y-2">
                    <Label htmlFor="first_name">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      {...register('first_name')}
                      placeholder="John"
                    />
                    {errors.first_name && (
                      <p className="text-sm text-destructive">{errors.first_name.message as string}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="space-y-2">
                    <Label htmlFor="last_name">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      {...register('last_name')}
                      placeholder="Doe"
                    />
                    {errors.last_name && (
                      <p className="text-sm text-destructive">{errors.last_name.message as string}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email')}
                      placeholder="john.doe@example.com"
                      disabled={!isCreateMode}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message as string}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...register('phone')}
                      placeholder="+1234567890"
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message as string}</p>
                    )}
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={watchedTimezone || 'Asia/Kolkata'}
                      onValueChange={(value) => setValue('timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.timezone && (
                      <p className="text-sm text-destructive">{errors.timezone.message as string}</p>
                    )}
                  </div>

                  {/* Active Status (Edit mode only) */}
                  {!isCreateMode && (
                    <div className="space-y-2">
                      <Label htmlFor="is_active">Active Status</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="is_active"
                          checked={watchedIsActive}
                          onCheckedChange={(checked) => setValue('is_active', checked)}
                        />
                        <Label htmlFor="is_active" className="font-normal">
                          {watchedIsActive ? 'Active' : 'Inactive'}
                        </Label>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Password Fields (Create mode only) */}
            {isCreateMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account Credentials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        {...register('password')}
                        placeholder="••••••••"
                      />
                      {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message as string}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password_confirm">
                        Confirm Password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="password_confirm"
                        type="password"
                        {...register('password_confirm')}
                        placeholder="••••••••"
                      />
                      {errors.password_confirm && (
                        <p className="text-sm text-destructive">{errors.password_confirm.message as string}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Roles Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Roles & Permissions</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Assign roles to control user access and permissions
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Roles */}
                {selectedRoleIds.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assigned Roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoleIds.map((roleId) => {
                        const role = availableRoles.find((r) => r.id === roleId);
                        if (!role) return null;
                        return (
                          <Badge key={roleId} variant="secondary" className="pr-1">
                            {role.name}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                              onClick={() => removeRole(roleId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label>Available Roles</Label>
                  {rolesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading roles...</p>
                  ) : availableRoles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active roles available</p>
                  ) : (
                    <ScrollArea className="h-48 border rounded-md p-3">
                      <div className="space-y-2">
                        {availableRoles.map((role) => (
                          <div key={role.id} className="flex items-start space-x-3 p-2 hover:bg-muted/50 rounded">
                            <Checkbox
                              id={`role-${role.id}`}
                              checked={selectedRoleIds.includes(role.id)}
                              onCheckedChange={() => toggleRole(role.id)}
                            />
                            <div className="flex-1 space-y-1">
                              <Label
                                htmlFor={`role-${role.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {role.name}
                              </Label>
                              {role.description && (
                                <p className="text-xs text-muted-foreground">
                                  {role.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }
);

UserBasicInfo.displayName = 'UserBasicInfo';

export default UserBasicInfo;
