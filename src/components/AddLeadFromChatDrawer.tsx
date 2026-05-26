// src/components/AddLeadFromChatDrawer.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SideDrawer } from '@/components/SideDrawer';

import { useChatContext } from '@/hooks/whatsapp/useChat';
import { useCRM } from '@/hooks/useCRM';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { crmService } from '@/services/crmService';
import { PRIORITY_OPTIONS, FieldTypeEnum } from '@/types/crmTypes';
import type {
  CreateLeadPayload,
  PriorityEnum,
  LeadFieldConfiguration,
} from '@/types/crmTypes';

// ── Types ────────────────────────────────────────────────────────────────────

interface AddLeadFromChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactUid: string;
}

interface ContactField {
  key: string;
  label: string;
  getValue: (contact: any) => string | undefined;
}

interface LeadField {
  key: string;
  label: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONTACT_FIELDS: ContactField[] = [
  { key: 'name', label: 'Name', getValue: (c) => c.name },
  { key: 'phone_number', label: 'Phone Number', getValue: (c) => c.phone_number },
  { key: 'email', label: 'Email', getValue: (c) => c.email },
  { key: 'notes', label: 'Notes', getValue: (c) => c.notes },
];

const LEAD_FIELDS_FOR_MAPPING: LeadField[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'notes', label: 'Notes' },
  { key: 'source', label: 'Source' },
  { key: 'value_amount', label: 'Deal Value' },
  { key: 'value_currency', label: 'Currency' },
];

const DEFAULT_MAPPING: Record<string, string> = {
  name: 'name',
  phone_number: 'phone',
  email: 'email',
  notes: 'notes',
};

// Standard fields that are handled by the mapping section or auto-set — skip in Section B
const SKIP_FIELDS = new Set([
  'name', 'phone', 'email', 'notes', // covered by field mapping
  'owner_user_id',                    // auto-set from logged-in user
  'lead_score',                       // not relevant for quick add
]);

// Standard fields that need special rendering (not just a plain text input)
const SPECIAL_STANDARD_FIELDS = new Set([
  'status', 'priority', 'assigned_to', 'next_follow_up_at', 'last_contacted_at',
  'value_amount', 'value_currency',
]);

// ── Component ────────────────────────────────────────────────────────────────

export function AddLeadFromChatDrawer({
  open,
  onOpenChange,
  contactUid,
}: AddLeadFromChatDrawerProps) {
  const { user } = useAuth();
  const { useLeadStatuses, useFieldSchema } = useCRM();
  const { useUsersList } = useUsers();

  // Contact data
  const { contact, isLoading: contactLoading } = useChatContext({ contactUid });

  // CRM metadata
  const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
    is_active: true,
    ordering: 'order_index',
  });
  const { data: usersData, isLoading: usersLoading } = useUsersList({
    page: 1,
    page_size: 1000,
    is_active: true,
  });
  const { data: fieldSchema, isLoading: schemaLoading } = useFieldSchema();

  // ── State ──────────────────────────────────────────────────────────────────

  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(DEFAULT_MAPPING);

  // Single flat dict for all Section B field values (standard + custom)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({
    priority: 'MEDIUM',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);

  // ── Sorted & filtered fields ───────────────────────────────────────────────

  const orderedFields = useMemo(() => {
    if (!fieldSchema) return [];
    const all: LeadFieldConfiguration[] = [
      ...fieldSchema.standard_fields,
      ...fieldSchema.custom_fields,
    ];
    return all
      .filter((f) => f.is_active && f.is_visible)
      .filter((f) => !SKIP_FIELDS.has(f.field_name))
      .sort((a, b) => a.display_order - b.display_order);
  }, [fieldSchema]);

  // ── Initialize default values from schema ──────────────────────────────────

  // Reset on close
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setFieldMapping(DEFAULT_MAPPING);
      setFieldValues({ priority: 'MEDIUM' });
      setIsSubmitting(false);
    }
  }, [open]);

  // Initialize defaults once statusesData is available while drawer is open.
  // Runs whenever open/statusesData/fieldSchema change, but only initializes once per open session.
  useEffect(() => {
    if (!open || initializedRef.current || !statusesData) return;

    const defaults: Record<string, any> = { priority: 'MEDIUM' };

    if (statusesData.results.length) {
      defaults.status = statusesData.results[0].id.toString();
    }

    if (fieldSchema) {
      [...fieldSchema.standard_fields, ...fieldSchema.custom_fields].forEach((f) => {
        if (f.default_value !== undefined && f.default_value !== '') {
          defaults[f.field_name] = f.default_value;
        }
      });
    }

    initializedRef.current = true;
    setFieldValues(defaults);
  }, [open, statusesData, fieldSchema]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setVal = (key: string, value: any) =>
    setFieldValues((prev) => ({ ...prev, [key]: value }));

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!contact) return;

    // Build base payload from field mapping
    const payload: Partial<CreateLeadPayload> = {};
    for (const cf of CONTACT_FIELDS) {
      const mappedKey = fieldMapping[cf.key];
      if (!mappedKey) continue;
      const value = cf.getValue(contact);
      if (value) (payload as any)[mappedKey] = value;
    }

    // Validate required fields
    if (!payload.name) {
      toast.error('Name is required. Please map a contact field to "Name".');
      return;
    }
    if (!payload.phone) {
      toast.error('Phone is required. Please map a contact field to "Phone".');
      return;
    }

    // Always apply core standard fields directly from fieldValues,
    // regardless of whether they appear in the field schema / orderedFields.
    const CORE_STANDARD_FIELDS: Array<keyof CreateLeadPayload> = [
      'status', 'priority', 'assigned_to', 'company', 'title', 'source',
      'value_amount', 'value_currency', 'next_follow_up_at', 'last_contacted_at',
      'address_line1', 'address_line2', 'city', 'state', 'country', 'postal_code',
    ];
    for (const key of CORE_STANDARD_FIELDS) {
      const val = fieldValues[key];
      if (val === undefined || val === '' || val === null) continue;
      if (key === 'status') {
        payload.status = parseInt(val, 10);
      } else {
        (payload as any)[key] = val;
      }
    }

    // Then apply any remaining custom fields from orderedFields into metadata
    const metadata: Record<string, any> = {};
    for (const field of orderedFields) {
      if (field.is_standard) continue; // already handled above
      const val = fieldValues[field.field_name];
      if (val === undefined || val === '' || val === null) continue;
      metadata[field.field_name] = val;
    }

    if (Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    // Auto-set owner
    if (user?.id) payload.owner_user_id = user.id;

    setIsSubmitting(true);
    try {
      await crmService.createLead(payload as CreateLeadPayload);
      toast.success('Lead created successfully!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Field renderer for Section B ──────────────────────────────────────────

  const renderFieldInput = (field: LeadFieldConfiguration) => {
    const val = fieldValues[field.field_name] ?? '';

    // ── Special standard field renderers ──────────────────────────────────

    if (field.field_name === 'status') {
      return (
        <Select
          value={val?.toString() || ''}
          onValueChange={(v) => setVal('status', v)}
          disabled={statusesLoading}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={statusesLoading ? 'Loading...' : 'Select status'} />
          </SelectTrigger>
          <SelectContent>
            {statusesData?.results.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                <div className="flex items-center gap-2">
                  {s.color_hex && (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.color_hex }}
                    />
                  )}
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === 'priority') {
      return (
        <Select value={val || 'MEDIUM'} onValueChange={(v) => setVal('priority', v as PriorityEnum)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === 'assigned_to') {
      return (
        <Select
          value={val || 'unassigned'}
          onValueChange={(v) => setVal('assigned_to', v === 'unassigned' ? '' : v)}
          disabled={usersLoading}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={usersLoading ? 'Loading...' : 'Select user'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">No assignment</SelectItem>
            {usersData?.results?.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                <span>{u.first_name} {u.last_name}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">({u.email})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === 'next_follow_up_at' || field.field_name === 'last_contacted_at') {
      const dateVal = val ? new Date(val) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full h-9 justify-start text-left font-normal text-sm',
                !dateVal && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateVal ? format(dateVal, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateVal}
              onSelect={(date) => setVal(field.field_name, date ? date.toISOString() : '')}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );
    }

    if (field.field_name === 'value_amount') {
      return (
        <Input
          value={val}
          onChange={(e) => setVal('value_amount', e.target.value)}
          type="number"
          step="0.01"
          placeholder={field.placeholder || '0.00'}
          className="h-9"
        />
      );
    }

    if (field.field_name === 'value_currency') {
      return (
        <Input
          value={val}
          onChange={(e) => setVal('value_currency', e.target.value)}
          placeholder={field.placeholder || 'USD'}
          maxLength={3}
          className="h-9"
        />
      );
    }

    // ── Custom field renderers by field_type ──────────────────────────────

    const ft = field.field_type;

    if (ft === FieldTypeEnum.TEXTAREA) {
      return (
        <Textarea
          value={val}
          onChange={(e) => setVal(field.field_name, e.target.value)}
          placeholder={field.placeholder || ''}
          rows={3}
          className="resize-none"
        />
      );
    }

    if (ft === FieldTypeEnum.DATE) {
      const dateVal = val ? new Date(val) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full h-9 justify-start text-left font-normal text-sm',
                !dateVal && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateVal ? format(dateVal, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateVal}
              onSelect={(date) =>
                setVal(field.field_name, date ? format(date, 'yyyy-MM-dd') : '')
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );
    }

    if (ft === FieldTypeEnum.DATETIME) {
      const dateVal = val ? new Date(val) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full h-9 justify-start text-left font-normal text-sm',
                !dateVal && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateVal ? format(dateVal, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateVal}
              onSelect={(date) => setVal(field.field_name, date ? date.toISOString() : '')}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      );
    }

    if (ft === FieldTypeEnum.DROPDOWN) {
      const options: string[] = Array.isArray(field.options) ? field.options : [];
      return (
        <Select value={val} onValueChange={(v) => setVal(field.field_name, v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={field.placeholder || 'Select option'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (ft === FieldTypeEnum.MULTISELECT) {
      const options: string[] = Array.isArray(field.options) ? field.options : [];
      const selected: string[] = Array.isArray(val) ? val : [];
      const toggle = (opt: string) => {
        const next = selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt];
        setVal(field.field_name, next);
      };
      return (
        <div className="space-y-2">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  {s}
                  <button onClick={() => toggle(s)} className="ml-0.5 hover:opacity-70">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Select onValueChange={toggle}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={field.placeholder || 'Add option...'} />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter((o) => !selected.includes(o))
                .map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (ft === FieldTypeEnum.CHECKBOX) {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.field_name}
            checked={!!val}
            onCheckedChange={(checked) => setVal(field.field_name, checked)}
          />
          <label htmlFor={field.field_name} className="text-sm cursor-pointer">
            {field.help_text || field.field_label}
          </label>
        </div>
      );
    }

    if (ft === FieldTypeEnum.NUMBER || ft === FieldTypeEnum.DECIMAL || ft === FieldTypeEnum.CURRENCY) {
      return (
        <Input
          value={val}
          onChange={(e) => setVal(field.field_name, e.target.value)}
          type="number"
          step={ft === FieldTypeEnum.NUMBER ? '1' : '0.01'}
          placeholder={field.placeholder || ''}
          className="h-9"
        />
      );
    }

    // Default: text input (TEXT, EMAIL, PHONE, URL, or plain standard field)
    return (
      <Input
        value={val}
        onChange={(e) => setVal(field.field_name, e.target.value)}
        type={
          ft === FieldTypeEnum.EMAIL ? 'email'
          : ft === FieldTypeEnum.PHONE ? 'tel'
          : ft === FieldTypeEnum.URL ? 'url'
          : 'text'
        }
        placeholder={field.placeholder || ''}
        className="h-9"
      />
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add Contact as CRM Lead"
      description="Map WhatsApp contact fields to CRM lead properties"
      size="md"
      isLoading={contactLoading || schemaLoading}
      loadingText="Loading..."
      footerButtons={[
        {
          label: 'Cancel',
          onClick: () => onOpenChange(false),
          variant: 'outline',
          disabled: isSubmitting,
        },
        {
          label: isSubmitting ? 'Creating...' : 'Create Lead',
          onClick: handleSubmit,
          variant: 'default',
          disabled: isSubmitting || !contact,
          loading: isSubmitting,
        },
      ]}
      footerAlignment="right"
    >
      {contact && (
        <div className="space-y-6">
          {/* ── Section A: Field Mapping ─────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Field Mapping</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Map each contact property to a CRM lead field. Select "Don't map" to skip.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Contact Property
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Map to Lead Field
              </span>
            </div>

            <div className="space-y-2">
              {CONTACT_FIELDS.map((field) => {
                const value = field.getValue(contact);
                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-2 gap-3 items-center rounded-lg border border-border bg-card/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{field.label}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {value || <span className="italic opacity-60">No value</span>}
                      </p>
                    </div>
                    <Select
                      value={fieldMapping[field.key] || '__none__'}
                      onValueChange={(val) =>
                        setFieldMapping((prev) => ({
                          ...prev,
                          [field.key]: val === '__none__' ? '' : val,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Don't map" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs text-muted-foreground">
                          — Don't map —
                        </SelectItem>
                        {LEAD_FIELDS_FOR_MAPPING.map((lf) => (
                          <SelectItem key={lf.key} value={lf.key} className="text-xs">
                            {lf.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* ── Section B: Lead Fields (ordered by field config) ─────────── */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Lead Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fill in additional details for the new lead.
              </p>
            </div>

            {orderedFields.length === 0 && !schemaLoading && (
              <p className="text-xs text-muted-foreground italic">No additional fields configured.</p>
            )}

            {orderedFields.map((field) => (
              <div key={field.field_name} className="space-y-1.5">
                <Label className="text-xs">
                  {field.field_label}
                  {field.is_required && <span className="text-destructive ml-0.5">*</span>}
                  {!field.is_standard && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(custom)</span>
                  )}
                </Label>
                {renderFieldInput(field)}
                {field.help_text && field.field_type !== FieldTypeEnum.CHECKBOX && (
                  <p className="text-[11px] text-muted-foreground">{field.help_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </SideDrawer>
  );
}
