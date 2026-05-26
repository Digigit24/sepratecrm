// src/components/lead-drawer/LeadDetailsForm.tsx
import { forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

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
  /** If false, the Notes field is not rendered (handle it externally). Default: true */
  showNotes?: boolean;
}

// Maps standard field_name → display order fallback (used to sort within the merged list)
const STANDARD_FIELD_ORDER: Record<string, number> = {
  name: 1,
  phone: 2,
  email: 3,
  company: 4,
  title: 5,
  status: 6,
  priority: 7,
  lead_score: 8,
  value_amount: 9,
  value_currency: 10,
  source: 11,
  owner_user_id: 12,
  assigned_to: 13,
  next_follow_up_at: 14,
  last_contacted_at: 15,
  address_line1: 16,
  address_line2: 17,
  city: 18,
  state: 19,
  country: 20,
  postal_code: 21,
  notes: 99,
};

const LeadDetailsForm = forwardRef<LeadFormHandle, LeadDetailsFormProps>(
  ({ lead, mode, showNotes = true }, ref) => {
    const { user } = useAuth();
    const { useLeadStatuses, useFieldConfigurations } = useCRM();
    const { getCurrencyCode } = useCurrency();
    const { useUsersList } = useUsers();

    const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
      is_active: true,
      ordering: 'order_index',
    });

    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1,
      page_size: 1000,
      is_active: true,
    });

    const { data: configurationsData } = useFieldConfigurations({
      is_active: true,
      ordering: 'display_order',
      page_size: 200,
    });

    const isReadOnly = mode === 'view';

    // Build unified ordered field list from configuration
    const allFields = configurationsData?.results || [];

    // Standard field visibility & order from config
    const standardFieldsConfig = useMemo(() => {
      const map = new Map<string, { visible: boolean; order: number }>();
      allFields.filter(f => f.is_standard).forEach(f => {
        map.set(f.field_name, { visible: f.is_visible, order: f.display_order });
      });
      return map;
    }, [allFields]);

    // Custom fields (active, visible, with their display_order)
    const customFields = useMemo(() => {
      return allFields
        .filter(f => !f.is_standard && f.is_visible)
        .sort((a, b) => a.display_order - b.display_order);
    }, [allFields]);

    const isFieldVisible = (fieldName: string): boolean => {
      const cfg = standardFieldsConfig.get(fieldName);
      return cfg ? cfg.visible : true;
    };

    const getFieldOrder = (fieldName: string): number => {
      const cfg = standardFieldsConfig.get(fieldName);
      return cfg?.order ?? STANDARD_FIELD_ORDER[fieldName] ?? 50;
    };

    // Build schema
    const formSchema = useMemo(() => {
      const base: Record<string, z.ZodTypeAny> = {
        ...(isFieldVisible('name') && { name: z.string().min(1, 'Name is required').max(255) }),
        ...(isFieldVisible('phone') && {
          phone: z.string().min(10).max(10).regex(/^\d{10}$/, 'Phone must be 10 digits'),
        }),
        ...(isFieldVisible('email') && { email: z.string().email('Invalid email').optional().or(z.literal('')) }),
        ...(isFieldVisible('company') && { company: z.string().max(255).optional() }),
        ...(isFieldVisible('title') && { title: z.string().max(255).optional() }),
        ...(isFieldVisible('status') && { status: z.number().optional() }),
        ...(isFieldVisible('priority') && { priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM') }),
        ...(isFieldVisible('lead_score') && { lead_score: z.number().min(0).max(100).default(0) }),
        ...(isFieldVisible('value_amount') && { value_amount: z.string().optional() }),
        ...(isFieldVisible('value_currency') && { value_currency: z.string().max(3).optional() }),
        ...(isFieldVisible('source') && { source: z.string().max(100).optional() }),
        owner_user_id: z.string().optional(),
        ...(isFieldVisible('assigned_to') && { assigned_to: z.string().optional() }),
        last_contacted_at: z.string().optional(),
        ...(isFieldVisible('next_follow_up_at') && { next_follow_up_at: z.string().optional() }),
        ...(showNotes && isFieldVisible('notes') && { notes: z.string().optional() }),
        ...(isFieldVisible('address_line1') && { address_line1: z.string().optional() }),
        ...(isFieldVisible('address_line2') && { address_line2: z.string().optional() }),
        ...(isFieldVisible('city') && { city: z.string().optional() }),
        ...(isFieldVisible('state') && { state: z.string().optional() }),
        ...(isFieldVisible('country') && { country: z.string().optional() }),
        ...(isFieldVisible('postal_code') && { postal_code: z.string().optional() }),
      };

      const customSchemas: Record<string, z.ZodTypeAny> = {};
      customFields.forEach(field => {
        let s: z.ZodTypeAny;
        if (field.is_required) {
          if (field.field_type === 'CHECKBOX') s = z.boolean().refine(v => v === true, `${field.field_label} must be checked`);
          else if (field.field_type === 'MULTISELECT') s = z.array(z.string()).min(1, `${field.field_label} is required`);
          else if (field.field_type === 'EMAIL') s = z.string().min(1).email();
          else if (field.field_type === 'URL') s = z.string().min(1).url();
          else s = z.string().min(1, `${field.field_label} is required`);
        } else {
          if (field.field_type === 'CHECKBOX') s = z.boolean().optional();
          else if (field.field_type === 'MULTISELECT') s = z.array(z.string()).optional();
          else s = z.string().optional();
        }
        customSchemas[`custom_${field.field_name}`] = s;
      });

      return z.object({ ...base, ...customSchemas });
    }, [customFields, standardFieldsConfig, showNotes]);

    type FormData = z.infer<typeof formSchema>;

    const { control, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
      resolver: zodResolver(formSchema),
      defaultValues: {},
    });

    useEffect(() => {
      const defaults: any = {
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

      customFields.forEach(field => {
        let value: any = field.default_value || '';
        if (lead?.metadata?.[field.field_name] !== undefined) value = lead.metadata[field.field_name];
        if (field.field_type === 'CHECKBOX') defaults[`custom_${field.field_name}`] = value === true || value === 'true';
        else if (field.field_type === 'MULTISELECT') defaults[`custom_${field.field_name}`] = Array.isArray(value) ? value : [];
        else defaults[`custom_${field.field_name}`] = value || '';
      });

      reset(defaults);
    }, [lead, customFields, user?.id, reset]);

    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateLeadPayload | null> => {
        return new Promise(resolve => {
          handleSubmit(
            data => {
              const metadata: Record<string, any> = {};
              const cleanData: any = {};
              Object.entries(data).forEach(([key, value]) => {
                if (key.startsWith('custom_')) {
                  const fieldName = key.replace('custom_', '');
                  if (value !== '' && value !== null && value !== undefined) metadata[fieldName] = value;
                } else {
                  cleanData[key] = value || undefined;
                }
              });
              resolve({ ...cleanData, metadata: Object.keys(metadata).length > 0 ? metadata : undefined });
            },
            () => resolve(null)
          )();
        });
      },
    }));

    // ─── Build unified ordered field renderers ──────────────────────────────────
    // We collect each renderable field as { order, key, render }
    type FieldEntry = { order: number; key: string; wide?: boolean; render: () => React.ReactNode };
    const fieldEntries: FieldEntry[] = [];

    const addField = (key: string, wide: boolean, render: () => React.ReactNode) => {
      fieldEntries.push({ order: getFieldOrder(key), key, wide, render });
    };

    if (isFieldVisible('name')) addField('name', false, () => (
      <div className="space-y-1">
        <Label className={`text-xs text-muted-foreground font-normal ${errors.name ? 'text-destructive' : ''}`}>
          Name <span className="text-destructive">*</span>
        </Label>
        <Controller name="name" control={control} render={({ field }) => (
          <Input {...field} placeholder="John Doe" disabled={isReadOnly} className={`h-8 text-sm ${errors.name ? 'border-destructive' : ''}`} />
        )} />
        {errors.name && <p className="text-[11px] text-destructive">{errors.name.message}</p>}
      </div>
    ));

    if (isFieldVisible('phone')) addField('phone', false, () => (
      <div className="space-y-1">
        <Label className={`text-xs text-muted-foreground font-normal ${errors.phone ? 'text-destructive' : ''}`}>
          Phone <span className="text-destructive">*</span>
        </Label>
        <Controller name="phone" control={control} render={({ field: { onChange, onBlur, value, name, ref } }) => (
          <Input name={name} ref={ref} value={value || ''} onChange={onChange} onBlur={onBlur}
            type="text" inputMode="numeric" placeholder="9876543210" minLength={10} maxLength={10}
            disabled={isReadOnly} className={`h-8 text-sm ${errors.phone ? 'border-destructive' : ''}`} />
        )} />
        {errors.phone && <p className="text-[11px] text-destructive">{errors.phone.message}</p>}
      </div>
    ));

    if (isFieldVisible('email')) addField('email', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Email</Label>
        <Controller name="email" control={control} render={({ field: { onChange, onBlur, value, name, ref } }) => (
          <Input name={name} ref={ref} value={value || ''} onChange={onChange} onBlur={onBlur}
            type="email" placeholder="john@example.com" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('company')) addField('company', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Company</Label>
        <Controller name="company" control={control} render={({ field }) => (
          <Input {...field} placeholder="Acme Inc." disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('title')) addField('title', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Title</Label>
        <Controller name="title" control={control} render={({ field }) => (
          <Input {...field} placeholder="CEO" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('status')) addField('status', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Status</Label>
        <Controller name="status" control={control} render={({ field }) => (
          <Select value={field.value?.toString()} onValueChange={v => field.onChange(parseInt(v, 10))} disabled={isReadOnly || statusesLoading}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {statusesData?.results.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </div>
    ));

    if (isFieldVisible('priority')) addField('priority', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Priority</Label>
        <Controller name="priority" control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select priority" /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )} />
      </div>
    ));

    if (isFieldVisible('lead_score')) addField('lead_score', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Score</Label>
        <Controller name="lead_score" control={control} render={({ field }) => (
          <LeadScoreSlider score={field.value || 0} onSave={async score => { field.onChange(score); }} leadName="" size="sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('value_amount')) addField('value_amount', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Deal Value</Label>
        <Controller name="value_amount" control={control} render={({ field }) => (
          <Input {...field} type="number" step="0.01" placeholder="10000.00" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('value_currency')) addField('value_currency', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Currency</Label>
        <Controller name="value_currency" control={control} render={({ field }) => (
          <Input {...field} placeholder="USD" maxLength={3} disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('source')) addField('source', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Source</Label>
        <Controller name="source" control={control} render={({ field }) => (
          <Input {...field} placeholder="Website, Referral…" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('assigned_to')) addField('assigned_to', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Assigned To</Label>
        <Controller name="assigned_to" control={control} render={({ field }) => (
          <Select value={field.value || 'unassigned'} onValueChange={v => field.onChange(v === 'unassigned' ? '' : v)} disabled={isReadOnly || usersLoading}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">No assignment</SelectItem>
              {usersData?.results?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </div>
    ));

    if (isFieldVisible('next_follow_up_at')) addField('next_follow_up_at', true, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Follow-up</Label>
        <Controller name="next_follow_up_at" control={control} render={({ field }) => {
          const selectedDate = field.value ? new Date(field.value) : undefined;
          const selectedTime = selectedDate
            ? `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`
            : '';
          const handleDateSelect = (date: Date | undefined) => {
            if (!date) { field.onChange(''); return; }
            const h = selectedDate?.getHours() || 10;
            const m = selectedDate?.getMinutes() || 0;
            const d = new Date(date); d.setHours(h, m, 0, 0);
            field.onChange(d.toISOString());
          };
          const handleTimeSelect = (time: string) => {
            const base = selectedDate ? new Date(selectedDate) : new Date();
            const [h, m] = time.split(':').map(Number);
            base.setHours(h, m, 0, 0);
            field.onChange(base.toISOString());
          };
          return (
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('flex-1 justify-start text-left font-normal h-8 text-sm', !field.value && 'text-muted-foreground')} disabled={isReadOnly}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {field.value ? format(new Date(field.value), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
              {field.value && (
                <Select value={selectedTime} onValueChange={handleTimeSelect} disabled={isReadOnly}>
                  <SelectTrigger className="w-[110px] h-8 text-sm"><SelectValue placeholder="Time" /></SelectTrigger>
                  <SelectContent>
                    {[
                      ['09:00','9:00 AM'],['09:30','9:30 AM'],['10:00','10:00 AM'],['10:30','10:30 AM'],
                      ['11:00','11:00 AM'],['11:30','11:30 AM'],['12:00','12:00 PM'],['12:30','12:30 PM'],
                      ['13:00','1:00 PM'],['13:30','1:30 PM'],['14:00','2:00 PM'],['14:30','2:30 PM'],
                      ['15:00','3:00 PM'],['15:30','3:30 PM'],['16:00','4:00 PM'],['16:30','4:30 PM'],
                      ['17:00','5:00 PM'],['17:30','5:30 PM'],['18:00','6:00 PM'],['18:30','6:30 PM'],
                      ['19:00','7:00 PM'],
                    ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {field.value && !isReadOnly && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => field.onChange('')} type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </Button>
              )}
            </div>
          );
        }} />
      </div>
    ));

    // Address fields
    if (isFieldVisible('address_line1')) addField('address_line1', true, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Address Line 1</Label>
        <Controller name="address_line1" control={control} render={({ field }) => (
          <Input {...field} placeholder="123 Main St" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('address_line2')) addField('address_line2', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Address Line 2</Label>
        <Controller name="address_line2" control={control} render={({ field }) => (
          <Input {...field} placeholder="Apt 4B" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('city')) addField('city', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">City</Label>
        <Controller name="city" control={control} render={({ field }) => (
          <Input {...field} placeholder="New York" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('state')) addField('state', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">State</Label>
        <Controller name="state" control={control} render={({ field }) => (
          <Input {...field} placeholder="NY" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('country')) addField('country', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Country</Label>
        <Controller name="country" control={control} render={({ field }) => (
          <Input {...field} placeholder="USA" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    if (isFieldVisible('postal_code')) addField('postal_code', false, () => (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground font-normal">Postal Code</Label>
        <Controller name="postal_code" control={control} render={({ field }) => (
          <Input {...field} placeholder="10001" disabled={isReadOnly} className="h-8 text-sm" />
        )} />
      </div>
    ));

    // Custom fields — interleaved by display_order
    customFields.forEach(field => {
      fieldEntries.push({
        order: field.display_order,
        key: `custom_${field.field_name}`,
        wide: field.field_type === 'TEXTAREA',
        render: () => (
          <DynamicFieldRenderer
            field={field}
            control={control}
            fieldName={`custom_${field.field_name}` as any}
            disabled={isReadOnly}
            error={errors[`custom_${field.field_name}` as keyof typeof errors]?.message as string}
          />
        ),
      });
    });

    // Notes at the end (only if showNotes = true)
    const notesEntry = showNotes && isFieldVisible('notes') ? {
      order: 99,
      key: 'notes',
      wide: true,
      render: () => (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground font-normal">Notes</Label>
          <Controller name="notes" control={control} render={({ field }) => (
            <Textarea {...field} placeholder="Add notes…" rows={3} disabled={isReadOnly} className="text-sm" />
          )} />
        </div>
      ),
    } : null;

    // Sort all entries by order
    const sortedEntries = [...fieldEntries].sort((a, b) => a.order - b.order);
    if (notesEntry) sortedEntries.push(notesEntry);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
        {sortedEntries.map(entry => (
          <div key={entry.key} className={entry.wide ? 'lg:col-span-2' : ''}>
            {entry.render()}
          </div>
        ))}
      </div>
    );
  }
);

LeadDetailsForm.displayName = 'LeadDetailsForm';
export default LeadDetailsForm;
