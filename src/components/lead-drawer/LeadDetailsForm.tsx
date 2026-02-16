// src/components/lead-drawer/LeadDetailsForm.tsx
import { forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, MapPin, Sparkles } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { DynamicFieldRenderer } from '@/components/crm/DynamicFieldRenderer';
import { LeadScoreSlider } from '@/components/crm/LeadScoreSlider';
import type { Lead, CreateLeadPayload, PriorityEnum } from '@/types/crmTypes';
import type { LeadFormHandle } from '../LeadsFormDrawer';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useCurrency } from '@/hooks/useCurrency';
import { PRIORITY_OPTIONS } from '@/types/crmTypes';

interface LeadDetailsFormProps {
  lead?: Lead | null;
  mode: 'view' | 'edit' | 'create';
}

const LeadDetailsForm = forwardRef<LeadFormHandle, LeadDetailsFormProps>(
  ({ lead, mode }, ref) => {
    const { user } = useAuth();
    const { useLeadStatuses, useFieldConfigurations } = useCRM();
    const { getCurrencyCode } = useCurrency();
    const { useUsersList } = useUsers();

    // Fetch data
    const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
      is_active: true,
      ordering: 'order_index',
    });

    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1,
      page_size: 1000,
      is_active: true,
    });

    // Fetch all field configurations (standard + custom)
    const { data: configurationsData } = useFieldConfigurations({
      is_active: true,
      ordering: 'display_order',
      page_size: 200,
    });

    // Separate standard and custom fields, respect visibility
    const allFields = configurationsData?.results || [];
    const standardFieldsMap = useMemo(() => {
      const map = new Map<string, { visible: boolean; order: number }>();
      allFields
        .filter((field) => field.is_standard)
        .forEach((field) => {
          map.set(field.field_name, {
            visible: field.is_visible,
            order: field.display_order,
          });
        });
      return map;
    }, [allFields]);

    const customFields = useMemo(() => {
      return allFields
        .filter((field) => !field.is_standard && field.is_visible)
        .sort((a, b) => a.display_order - b.display_order);
    }, [allFields]);

    const isReadOnly = mode === 'view';

    // Helper to check if a standard field should be visible
    const isFieldVisible = (fieldName: string): boolean => {
      const fieldConfig = standardFieldsMap.get(fieldName);
      // If no configuration exists, default to visible (for backwards compatibility)
      return fieldConfig ? fieldConfig.visible : true;
    };

    // Build dynamic schema
    const formSchema = useMemo(() => {
      const baseSchema: Record<string, z.ZodTypeAny> = {
        // Basic Info - only include if visible
        ...(isFieldVisible('name') && {
          name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
        }),
        ...(isFieldVisible('phone') && {
          phone: z.string()
            .min(10, 'Phone must be at least 10 digits')
            .max(10, 'Phone must be at most 10 digits')
            .regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
        }),
        ...(isFieldVisible('email') && {
          email: z.string().email('Invalid email').optional().or(z.literal('')),
        }),
        ...(isFieldVisible('company') && {
          company: z.string().max(255).optional(),
        }),
        ...(isFieldVisible('title') && {
          title: z.string().max(255).optional(),
        }),
        ...(isFieldVisible('status') && {
          status: z.number().optional(),
        }),
        ...(isFieldVisible('priority') && {
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
        }),
        ...(isFieldVisible('lead_score') && {
          lead_score: z.number().min(0).max(100).default(0),
        }),
        ...(isFieldVisible('value_amount') && {
          value_amount: z.string().optional(),
        }),
        ...(isFieldVisible('value_currency') && {
          value_currency: z.string().max(3).optional(),
        }),
        ...(isFieldVisible('source') && {
          source: z.string().max(100).optional(),
        }),
        owner_user_id: z.string().optional(),
        ...(isFieldVisible('assigned_to') && {
          assigned_to: z.string().optional(),
        }),
        last_contacted_at: z.string().optional(),
        ...(isFieldVisible('next_follow_up_at') && {
          next_follow_up_at: z.string().optional(),
        }),
        ...(isFieldVisible('notes') && {
          notes: z.string().optional(),
        }),

        // Address
        ...(isFieldVisible('address_line1') && {
          address_line1: z.string().optional(),
        }),
        ...(isFieldVisible('address_line2') && {
          address_line2: z.string().optional(),
        }),
        ...(isFieldVisible('city') && {
          city: z.string().optional(),
        }),
        ...(isFieldVisible('state') && {
          state: z.string().optional(),
        }),
        ...(isFieldVisible('country') && {
          country: z.string().optional(),
        }),
        ...(isFieldVisible('postal_code') && {
          postal_code: z.string().optional(),
        }),
      };

      // Add custom fields to schema
      const customFieldSchemas: Record<string, z.ZodTypeAny> = {};
      customFields.forEach((field) => {
        let fieldSchema: z.ZodTypeAny = z.any().optional();

        if (field.is_required) {
          if (field.field_type === 'CHECKBOX') {
            fieldSchema = z.boolean().refine((val) => val === true, {
              message: `${field.field_label} must be checked`,
            });
          } else if (field.field_type === 'MULTISELECT') {
            fieldSchema = z.array(z.string()).min(1, `${field.field_label} is required`);
          } else if (field.field_type === 'EMAIL') {
            fieldSchema = z.string().min(1, `${field.field_label} is required`).email();
          } else if (field.field_type === 'URL') {
            fieldSchema = z.string().min(1, `${field.field_label} is required`).url();
          } else {
            fieldSchema = z.string().min(1, `${field.field_label} is required`);
          }
        } else {
          if (field.field_type === 'CHECKBOX') {
            fieldSchema = z.boolean().optional();
          } else if (field.field_type === 'MULTISELECT') {
            fieldSchema = z.array(z.string()).optional();
          } else {
            fieldSchema = z.string().optional();
          }
        }

        customFieldSchemas[`custom_${field.field_name}`] = fieldSchema;
      });

      return z.object({ ...baseSchema, ...customFieldSchemas });
    }, [customFields, standardFieldsMap, isFieldVisible]);

    type FormData = z.infer<typeof formSchema>;

    const {
      control,
      handleSubmit,
      reset,
      formState: { errors },
    } = useForm<FormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {},
    });

    // Initialize form
    useEffect(() => {
      const defaultValues: any = {
        name: lead?.name || '',
        phone: lead?.phone || '',
        email: lead?.email || '',
        company: lead?.company || '',
        title: lead?.title || '',
        status: typeof lead?.status === 'object' ? lead.status?.id : lead?.status,
        priority: lead?.priority || 'MEDIUM',
        lead_score: lead?.lead_score || 0,
        value_amount: lead?.value_amount || '',
        value_currency: lead?.value_currency || getCurrencyCode(),
        source: lead?.source || '',
        owner_user_id: lead?.owner_user_id || user?.id || '',
        assigned_to: lead?.assigned_to || '',
        last_contacted_at: lead?.last_contacted_at || '',
        next_follow_up_at: lead?.next_follow_up_at || '',
        notes: lead?.notes || '',
        address_line1: lead?.address_line1 || '',
        address_line2: lead?.address_line2 || '',
        city: lead?.city || '',
        state: lead?.state || '',
        country: lead?.country || '',
        postal_code: lead?.postal_code || '',
      };

      // Add custom fields
      customFields.forEach((field) => {
        let value = field.default_value || '';
        if (lead?.metadata?.[field.field_name] !== undefined) {
          value = lead.metadata[field.field_name];
        }

        if (field.field_type === 'CHECKBOX') {
          defaultValues[`custom_${field.field_name}`] = value === true || value === 'true';
        } else if (field.field_type === 'MULTISELECT') {
          defaultValues[`custom_${field.field_name}`] = Array.isArray(value) ? value : [];
        } else {
          defaultValues[`custom_${field.field_name}`] = value || '';
        }
      });

      reset(defaultValues);
    }, [lead, customFields, user?.id, reset]);

    // Expose form values
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateLeadPayload | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              // Extract custom fields
              const metadata: Record<string, any> = {};
              const cleanData: any = {};

              Object.entries(data).forEach(([key, value]) => {
                if (key.startsWith('custom_')) {
                  const fieldName = key.replace('custom_', '');
                  if (value !== '' && value !== null && value !== undefined) {
                    metadata[fieldName] = value;
                  }
                } else {
                  cleanData[key] = value || undefined;
                }
              });

              resolve({
                ...cleanData,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
              });
            },
            () => resolve(null)
          )();
        });
      },
    }));

    return (
      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Basic Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            {isFieldVisible('name') && (
              <div className="space-y-2">
                <Label htmlFor="name" className={errors.name ? 'text-destructive' : ''}>
                  Name <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="name"
                      placeholder="John Doe"
                      disabled={isReadOnly}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                  )}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
            )}

            {/* Phone */}
            {isFieldVisible('phone') && (
              <div className="space-y-2">
                <Label htmlFor="phone" className={errors.phone ? 'text-destructive' : ''}>
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field: { onChange, onBlur, value, name, ref } }) => (
                    <Input
                      id="phone"
                      name={name}
                      ref={ref}
                      value={value || ''}
                      onChange={onChange}
                      onBlur={onBlur}
                      type="text"
                      inputMode="numeric"
                      placeholder="9876543210"
                      minLength={10}
                      maxLength={10}
                      disabled={isReadOnly}
                      className={errors.phone ? 'border-destructive' : ''}
                    />
                  )}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
            )}

            {/* Email */}
            {isFieldVisible('email') && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field: { onChange, onBlur, value, name, ref } }) => (
                    <Input
                      id="email"
                      name={name}
                      ref={ref}
                      value={value || ''}
                      onChange={onChange}
                      onBlur={onBlur}
                      type="email"
                      placeholder="john@example.com"
                      disabled={isReadOnly}
                    />
                  )}
                />
              </div>
            )}

            {/* Company */}
            {isFieldVisible('company') && (
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Controller
                  name="company"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} id="company" placeholder="Acme Inc." disabled={isReadOnly} />
                  )}
                />
              </div>
            )}

            {/* Title */}
            {isFieldVisible('title') && (
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} id="title" placeholder="CEO" disabled={isReadOnly} />
                  )}
                />
              </div>
            )}

            {/* Status */}
            {isFieldVisible('status') && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value, 10))}
                      disabled={isReadOnly || statusesLoading}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusesData?.results.map((status) => (
                          <SelectItem key={status.id} value={status.id.toString()}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Priority */}
            {isFieldVisible('priority') && (
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
                      <SelectTrigger id="priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Lead Score */}
            {isFieldVisible('lead_score') && (
              <div className="space-y-2">
                <Label htmlFor="lead_score">Lead Score</Label>
                <Controller
                  name="lead_score"
                  control={control}
                  render={({ field }) => (
                    <LeadScoreSlider
                      score={field.value || 0}
                      onSave={async (score) => {
                        field.onChange(score);
                        // In form context, we just update the field value
                        // The actual save happens when the form is submitted
                        return Promise.resolve();
                      }}
                      leadName=""
                      size="md"
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Drag to adjust lead score (0-100)
                </p>
              </div>
            )}

            {/* Assigned To */}
            {isFieldVisible('assigned_to') && (
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assigned To</Label>
                <Controller
                  name="assigned_to"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || 'unassigned'}
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)}
                      disabled={isReadOnly || usersLoading}
                    >
                      <SelectTrigger id="assigned_to">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">No assignment</SelectItem>
                        {usersData?.results?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* Value Amount */}
            {isFieldVisible('value_amount') && (
              <div className="space-y-2">
                <Label htmlFor="value_amount">Deal Value</Label>
                <Controller
                  name="value_amount"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="value_amount"
                      type="number"
                      step="0.01"
                      placeholder="10000.00"
                      disabled={isReadOnly}
                    />
                  )}
                />
              </div>
            )}

            {/* Currency */}
            {isFieldVisible('value_currency') && (
              <div className="space-y-2">
                <Label htmlFor="value_currency">Currency</Label>
                <Controller
                  name="value_currency"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="value_currency"
                      placeholder="USD"
                      maxLength={3}
                      disabled={isReadOnly}
                    />
                  )}
                />
              </div>
            )}

            {/* Source */}
            {isFieldVisible('source') && (
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Controller
                  name="source"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="source"
                      placeholder="Website, Referral, etc."
                      disabled={isReadOnly}
                    />
                  )}
                />
              </div>
            )}

            {/* Next Follow-up */}
            {isFieldVisible('next_follow_up_at') && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="next_follow_up_at">Next Follow-up</Label>
                <Controller
                  name="next_follow_up_at"
                  control={control}
                  render={({ field }) => {
                    const selectedDate = field.value ? new Date(field.value) : undefined;
                    const selectedTime = selectedDate
                      ? `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`
                      : '';

                    const handleDateSelect = (date: Date | undefined) => {
                      if (!date) {
                        field.onChange('');
                        return;
                      }
                      // Preserve existing time or default to 10:00 AM
                      const hours = selectedDate?.getHours() || 10;
                      const minutes = selectedDate?.getMinutes() || 0;
                      const newDate = new Date(date);
                      newDate.setHours(hours, minutes, 0, 0);
                      field.onChange(newDate.toISOString());
                    };

                    const handleTimeSelect = (time: string) => {
                      if (!selectedDate) {
                        // If no date selected, default to today
                        const today = new Date();
                        const [hours, minutes] = time.split(':').map(Number);
                        today.setHours(hours, minutes, 0, 0);
                        field.onChange(today.toISOString());
                        return;
                      }
                      const [hours, minutes] = time.split(':').map(Number);
                      const newDate = new Date(selectedDate);
                      newDate.setHours(hours, minutes, 0, 0);
                      field.onChange(newDate.toISOString());
                    };

                    return (
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'flex-1 justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={isReadOnly}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(new Date(field.value), 'PPP') : 'Pick a date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleDateSelect}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        
                        {field.value && (
                          <Select value={selectedTime} onValueChange={handleTimeSelect} disabled={isReadOnly}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Time" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { value: '09:00', label: '9:00 AM' },
                                { value: '09:30', label: '9:30 AM' },
                                { value: '10:00', label: '10:00 AM' },
                                { value: '10:30', label: '10:30 AM' },
                                { value: '11:00', label: '11:00 AM' },
                                { value: '11:30', label: '11:30 AM' },
                                { value: '12:00', label: '12:00 PM' },
                                { value: '12:30', label: '12:30 PM' },
                                { value: '13:00', label: '1:00 PM' },
                                { value: '13:30', label: '1:30 PM' },
                                { value: '14:00', label: '2:00 PM' },
                                { value: '14:30', label: '2:30 PM' },
                                { value: '15:00', label: '3:00 PM' },
                                { value: '15:30', label: '3:30 PM' },
                                { value: '16:00', label: '4:00 PM' },
                                { value: '16:30', label: '4:30 PM' },
                                { value: '17:00', label: '5:00 PM' },
                                { value: '17:30', label: '5:30 PM' },
                                { value: '18:00', label: '6:00 PM' },
                                { value: '18:30', label: '6:30 PM' },
                                { value: '19:00', label: '7:00 PM' },
                              ].map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {field.value && !isReadOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => field.onChange('')}
                            type="button"
                          >
                            <span className="sr-only">Clear</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </Button>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          {isFieldVisible('notes') && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="notes"
                    placeholder="Add notes..."
                    rows={3}
                    disabled={isReadOnly}
                  />
                )}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Address Section - Collapsible */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Address Information</h3>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isFieldVisible('address_line1') && (
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Controller
                    name="address_line1"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="address_line1" placeholder="123 Main St" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}

              {isFieldVisible('address_line2') && (
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Controller
                    name="address_line2"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="address_line2" placeholder="Apt 4B" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}

              {isFieldVisible('city') && (
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Controller
                    name="city"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="city" placeholder="New York" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}

              {isFieldVisible('state') && (
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Controller
                    name="state"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="state" placeholder="NY" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}

              {isFieldVisible('country') && (
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Controller
                    name="country"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="country" placeholder="USA" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}

              {isFieldVisible('postal_code') && (
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Controller
                    name="postal_code"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} id="postal_code" placeholder="10001" disabled={isReadOnly} />
                    )}
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Custom Fields Section - Collapsible */}
        {customFields.length > 0 && (
          <>
            <Separator />
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Custom Fields</h3>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className={field.field_type === 'TEXTAREA' ? 'md:col-span-2' : ''}
                    >
                      <DynamicFieldRenderer
                        field={field}
                        control={control}
                        fieldName={`custom_${field.field_name}` as any}
                        disabled={isReadOnly}
                        error={errors[`custom_${field.field_name}` as keyof typeof errors]?.message as string}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
    );
  }
);

LeadDetailsForm.displayName = 'LeadDetailsForm';

export default LeadDetailsForm;
