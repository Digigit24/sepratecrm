// src/components/lead-drawer/LeadDetailsForm.tsx
import { forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';

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
  showNotes?: boolean;
  /** If false, the Score field is hidden (use when score is shown in header) */
  showScore?: boolean;
}

const STANDARD_FIELD_ORDER: Record<string, number> = {
  name: 1, phone: 2, email: 3, company: 4, title: 5,
  status: 6, priority: 7, lead_score: 8, value_amount: 9,
  value_currency: 10, source: 11, owner_user_id: 12, assigned_to: 13,
  next_follow_up_at: 14, last_contacted_at: 15,
  address_line1: 16, address_line2: 17, city: 18, state: 19,
  country: 20, postal_code: 21, notes: 99,
};

// ── Notion-style property row ────────────────────────────────────────
function PropRow({
  label, required, error, children, className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'flex items-start gap-2 rounded-md px-2 -mx-2 py-0.5',
      'hover:bg-muted/30 transition-colors group/row',
      className,
    )}>
      {/* Label column */}
      <div className="w-[130px] flex-shrink-0 flex items-center h-9">
        <span className="text-[12px] text-muted-foreground/70 font-medium select-none leading-none">
          {label}
          {required && <span className="text-destructive/70 ml-0.5">*</span>}
        </span>
      </div>
      {/* Value column */}
      <div className="flex-1 min-w-0">
        {children}
        {error && (
          <p className="text-[11px] text-destructive mt-0.5 pl-1">{error}</p>
        )}
      </div>
    </div>
  );
}

// Ghost input class — borderless, blends into the row background
const ghostInput = cn(
  'h-9 bg-transparent border-0 shadow-none px-1',
  'text-sm text-foreground placeholder:text-muted-foreground/30',
  'focus-visible:ring-0 focus-visible:bg-muted/20',
  'disabled:opacity-50 disabled:cursor-default w-full rounded-md',
);

// Ghost select trigger
const ghostSelect = cn(
  'h-9 bg-transparent border-0 shadow-none px-1',
  'text-sm text-foreground',
  'focus:ring-0 hover:bg-transparent',
  'disabled:opacity-50 w-full',
);

// Section divider
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-0.5">
      <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

const LeadDetailsForm = forwardRef<LeadFormHandle, LeadDetailsFormProps>(
  ({ lead, mode, showNotes = true, showScore = true }, ref) => {
    const { user } = useAuth();
    const { useLeadStatuses, useFieldConfigurations } = useCRM();
    const { getCurrencyCode } = useCurrency();
    const { useUsersList } = useUsers();

    const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
      is_active: true, ordering: 'order_index',
    });
    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1, page_size: 1000, is_active: true,
    });
    const { data: configurationsData } = useFieldConfigurations({
      is_active: true, ordering: 'display_order', page_size: 200,
    });

    const isReadOnly = mode === 'view';
    const allFields = configurationsData?.results || [];

    const standardFieldsConfig = useMemo(() => {
      const map = new Map<string, { visible: boolean; order: number }>();
      allFields.filter(f => f.is_standard).forEach(f => {
        map.set(f.field_name, { visible: f.is_visible, order: f.display_order });
      });
      return map;
    }, [allFields]);

    const customFields = useMemo(() => {
      return allFields.filter(f => !f.is_standard && f.is_visible)
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

    const formSchema = useMemo(() => {
      const base: Record<string, z.ZodTypeAny> = {
        ...(isFieldVisible('name') && { name: z.string().min(1, 'Name is required').max(255) }),
        ...(isFieldVisible('phone') && { phone: z.string().min(10).max(10).regex(/^\d{10}$/, 'Phone must be 10 digits') }),
        ...(isFieldVisible('email') && { email: z.string().email('Invalid email').optional().or(z.literal('')) }),
        ...(isFieldVisible('company') && { company: z.string().max(255).optional() }),
        ...(isFieldVisible('title') && { title: z.string().max(255).optional() }),
        ...(isFieldVisible('status') && { status: z.number().optional() }),
        ...(isFieldVisible('priority') && { priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM') }),
        ...(isFieldVisible('lead_score') && showScore && { lead_score: z.number().min(0).max(100).default(0) }),
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
    }, [customFields, standardFieldsConfig, showNotes, showScore]);

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
            () => resolve(null),
          )();
        });
      },
    }));

    // ── Build ordered field list ───────────────────────────────────────
    type FieldEntry = {
      order: number;
      key: string;
      section?: string;
      render: () => React.ReactNode;
    };
    const fieldEntries: FieldEntry[] = [];

    const add = (key: string, section: string, render: () => React.ReactNode) => {
      fieldEntries.push({ order: getFieldOrder(key), key, section, render });
    };

    // ── Contact section ──────────────────────────────────────────────
    if (isFieldVisible('name')) add('name', 'contact', () => (
      <PropRow label="Name" required error={errors.name?.message}>
        <Controller name="name" control={control} render={({ field }) => (
          <Input {...field} placeholder="Full name" disabled={isReadOnly}
            className={cn(ghostInput, errors.name && 'text-destructive')} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('phone')) add('phone', 'contact', () => (
      <PropRow label="Phone" required error={errors.phone?.message}>
        <Controller name="phone" control={control} render={({ field: { onChange, onBlur, value, name, ref } }) => (
          <Input name={name} ref={ref} value={value || ''} onChange={onChange} onBlur={onBlur}
            type="text" inputMode="numeric" placeholder="9876543210"
            minLength={10} maxLength={10} disabled={isReadOnly}
            className={cn(ghostInput, errors.phone && 'text-destructive')} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('email')) add('email', 'contact', () => (
      <PropRow label="Email">
        <Controller name="email" control={control} render={({ field: { onChange, onBlur, value, name, ref } }) => (
          <Input name={name} ref={ref} value={value || ''} onChange={onChange} onBlur={onBlur}
            type="email" placeholder="email@example.com" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('company')) add('company', 'contact', () => (
      <PropRow label="Company">
        <Controller name="company" control={control} render={({ field }) => (
          <Input {...field} placeholder="Acme Inc." disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('title')) add('title', 'contact', () => (
      <PropRow label="Title">
        <Controller name="title" control={control} render={({ field }) => (
          <Input {...field} placeholder="CEO, Manager…" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    // ── Deal section ─────────────────────────────────────────────────
    if (isFieldVisible('status')) add('status', 'deal', () => (
      <PropRow label="Status">
        <Controller name="status" control={control} render={({ field }) => (
          <Select value={field.value?.toString()} onValueChange={v => field.onChange(parseInt(v, 10))}
            disabled={isReadOnly || statusesLoading}>
            <SelectTrigger className={ghostSelect}>
              <SelectValue placeholder="No status" />
            </SelectTrigger>
            <SelectContent>
              {statusesData?.results.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color_hex || '#6b7280' }} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </PropRow>
    ));

    if (isFieldVisible('priority')) add('priority', 'deal', () => (
      <PropRow label="Priority">
        <Controller name="priority" control={control} render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange} disabled={isReadOnly}>
            <SelectTrigger className={ghostSelect}>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </PropRow>
    ));

    // Score — only if showScore=true (hidden on detail page where it's in the header)
    if (showScore && isFieldVisible('lead_score')) add('lead_score', 'deal', () => (
      <PropRow label="Score">
        <Controller name="lead_score" control={control} render={({ field }) => (
          <div className="flex items-center h-9 pl-1">
            <LeadScoreSlider score={field.value || 0} onSave={async score => field.onChange(score)} leadName="" size="sm" />
          </div>
        )} />
      </PropRow>
    ));

    if (isFieldVisible('value_amount')) add('value_amount', 'deal', () => (
      <PropRow label="Deal Value">
        <Controller name="value_amount" control={control} render={({ field }) => (
          <Input {...field} type="number" step="0.01" placeholder="0.00"
            disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('value_currency')) add('value_currency', 'deal', () => (
      <PropRow label="Currency">
        <Controller name="value_currency" control={control} render={({ field }) => (
          <Input {...field} placeholder="USD" maxLength={3} disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('source')) add('source', 'deal', () => (
      <PropRow label="Source">
        <Controller name="source" control={control} render={({ field }) => (
          <Input {...field} placeholder="Website, Referral…" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    // ── Ownership section ────────────────────────────────────────────
    if (isFieldVisible('assigned_to')) add('assigned_to', 'ownership', () => (
      <PropRow label="Assigned To">
        <Controller name="assigned_to" control={control} render={({ field }) => (
          <Select value={field.value || 'unassigned'}
            onValueChange={v => field.onChange(v === 'unassigned' ? '' : v)}
            disabled={isReadOnly || usersLoading}>
            <SelectTrigger className={ghostSelect}>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {usersData?.results?.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
      </PropRow>
    ));

    // ── Follow-up section ────────────────────────────────────────────
    if (isFieldVisible('next_follow_up_at')) add('next_follow_up_at', 'followup', () => (
      <PropRow label="Follow-up">
        <Controller name="next_follow_up_at" control={control} render={({ field }) => {
          const selectedDate = field.value ? new Date(field.value) : undefined;
          const selectedTime = selectedDate
            ? `${selectedDate.getHours().toString().padStart(2, '0')}:${selectedDate.getMinutes().toString().padStart(2, '0')}`
            : '';
          const handleDateSelect = (date: Date | undefined) => {
            if (!date) { field.onChange(''); return; }
            const h = selectedDate?.getHours() || 10, m = selectedDate?.getMinutes() || 0;
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
            <div className="flex items-center gap-2 h-9 pl-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" disabled={isReadOnly}
                    className={cn(
                      'text-sm flex items-center gap-1.5 px-0 h-9 transition-colors',
                      field.value ? 'text-foreground' : 'text-muted-foreground/40',
                      !isReadOnly && 'hover:text-foreground',
                      isReadOnly && 'cursor-default opacity-60',
                    )}>
                    <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                    {field.value ? format(new Date(field.value), 'MMM d, yyyy') : 'Pick a date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
                </PopoverContent>
              </Popover>
              {field.value && (
                <Select value={selectedTime} onValueChange={handleTimeSelect} disabled={isReadOnly}>
                  <SelectTrigger className="w-[90px] h-7 text-xs border-border/40 bg-muted/30">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
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
                <button type="button" onClick={() => field.onChange('')}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        }} />
      </PropRow>
    ));

    // ── Address section ──────────────────────────────────────────────
    if (isFieldVisible('address_line1')) add('address_line1', 'address', () => (
      <PropRow label="Address">
        <Controller name="address_line1" control={control} render={({ field }) => (
          <Input {...field} placeholder="123 Main St" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('address_line2')) add('address_line2', 'address', () => (
      <PropRow label="Address 2">
        <Controller name="address_line2" control={control} render={({ field }) => (
          <Input {...field} placeholder="Apt 4B" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('city')) add('city', 'address', () => (
      <PropRow label="City">
        <Controller name="city" control={control} render={({ field }) => (
          <Input {...field} placeholder="Mumbai" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('state')) add('state', 'address', () => (
      <PropRow label="State">
        <Controller name="state" control={control} render={({ field }) => (
          <Input {...field} placeholder="Maharashtra" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('country')) add('country', 'address', () => (
      <PropRow label="Country">
        <Controller name="country" control={control} render={({ field }) => (
          <Input {...field} placeholder="India" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    if (isFieldVisible('postal_code')) add('postal_code', 'address', () => (
      <PropRow label="Postal Code">
        <Controller name="postal_code" control={control} render={({ field }) => (
          <Input {...field} placeholder="400001" disabled={isReadOnly} className={ghostInput} />
        )} />
      </PropRow>
    ));

    // Custom fields — interleaved by display_order
    customFields.forEach(field => {
      fieldEntries.push({
        order: field.display_order,
        key: `custom_${field.field_name}`,
        section: 'custom',
        render: () => (
          <PropRow label={field.field_label} required={field.is_required}
            error={errors[`custom_${field.field_name}` as keyof typeof errors]?.message as string}>
            <DynamicFieldRenderer
              field={field}
              control={control}
              fieldName={`custom_${field.field_name}` as any}
              disabled={isReadOnly}
              error={errors[`custom_${field.field_name}` as keyof typeof errors]?.message as string}
            />
          </PropRow>
        ),
      });
    });

    // Notes
    const notesEntry = showNotes && isFieldVisible('notes') ? {
      order: 99, key: 'notes', section: 'notes',
      render: () => (
        <div className="space-y-1 pt-1">
          <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Notes</span>
          <Controller name="notes" control={control} render={({ field }) => (
            <Textarea {...field} placeholder="Add notes…" rows={3} disabled={isReadOnly}
              className="text-sm resize-none bg-muted/20 border-border/30 hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-border/60 placeholder:text-muted-foreground/30 transition-colors" />
          )} />
        </div>
      ),
    } : null;

    // Sort entries
    const sortedEntries = [...fieldEntries].sort((a, b) => a.order - b.order);
    if (notesEntry) sortedEntries.push(notesEntry);

    // Group into sections for dividers
    const SECTION_LABELS: Record<string, string> = {
      contact: 'Contact Info',
      deal: 'Deal Info',
      ownership: 'Ownership',
      followup: 'Follow-up',
      address: 'Address',
      custom: 'Custom Fields',
    };

    const rendered: React.ReactNode[] = [];
    let lastSection = '';
    sortedEntries.forEach(entry => {
      const sec = entry.section || '';
      if (sec && sec !== 'notes' && sec !== lastSection) {
        if (lastSection) {
          rendered.push(<div key={`div-${sec}`} className="pt-1"><SectionDivider label={SECTION_LABELS[sec] || sec} /></div>);
        }
        lastSection = sec;
      }
      rendered.push(<div key={entry.key}>{entry.render()}</div>);
    });

    return (
      <div className="space-y-0.5">
        {rendered}
      </div>
    );
  }
);

LeadDetailsForm.displayName = 'LeadDetailsForm';
export default LeadDetailsForm;
