// src/components/ContactChatDrawer.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import {
  X, Phone, Mail, Tag, Bot, Ban, UserPlus as UserPlusIcon,
  Clock, MessageSquare, AlertCircle, StickyNote, ChevronDown,
  Check, Loader2, CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SideDrawer } from '@/components/SideDrawer';

import {
  useChatContext, useTeamMembers, useAssignUser, useAssignLabels,
  useUpdateNotes, useBlockContact, useUnblockContact, useBotSettings,
} from '@/hooks/whatsapp/useChat';
import { useLabels, useLabelMutations } from '@/hooks/whatsapp/useContacts';
import { useCRM } from '@/hooks/useCRM';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { crmService } from '@/services/crmService';
import { PRIORITY_OPTIONS, FieldTypeEnum } from '@/types/crmTypes';
import type { CreateLeadPayload, PriorityEnum, LeadFieldConfiguration } from '@/types/crmTypes';

// ── Types ────────────────────────────────────────────────────────────────────

export type ContactChatDrawerTab = 'contact' | 'add-lead';

interface ContactChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactUid: string;
  defaultTab?: ContactChatDrawerTab;
}

// ── Add-Lead constants ────────────────────────────────────────────────────────

interface ContactField {
  key: string;
  label: string;
  getValue: (c: any) => string | undefined;
}

const CONTACT_FIELDS: ContactField[] = [
  { key: 'name', label: 'Name', getValue: (c) => c.name },
  { key: 'phone_number', label: 'Phone Number', getValue: (c) => c.phone_number },
  { key: 'email', label: 'Email', getValue: (c) => c.email },
  { key: 'notes', label: 'Notes', getValue: (c) => c.notes },
];

const LEAD_FIELDS_FOR_MAPPING = [
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

const SKIP_FIELDS = new Set([
  'name', 'phone', 'email', 'notes',
  'owner_user_id', 'lead_score',
]);

const CORE_STANDARD_FIELDS: Array<keyof CreateLeadPayload> = [
  'status', 'priority', 'assigned_to', 'company', 'title', 'source',
  'value_amount', 'value_currency', 'next_follow_up_at', 'last_contacted_at',
  'address_line1', 'address_line2', 'city', 'state', 'country', 'postal_code',
];

// ── Component ────────────────────────────────────────────────────────────────

export function ContactChatDrawer({
  open,
  onOpenChange,
  contactUid,
  defaultTab = 'contact',
}: ContactChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<ContactChatDrawerTab>(defaultTab);

  // Sync tab when defaultTab changes (e.g. opened via UserPlus vs panel toggle)
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  // ── Shared: contact data ──────────────────────────────────────────────────

  const { contact, replyWindowStatus, isLoading: contactLoading, isError } =
    useChatContext({ contactUid });
  const { teamMembers: allTeamMembers } = useTeamMembers();

  // ── Contact tab: mutations ────────────────────────────────────────────────

  const assignUserMutation   = useAssignUser();
  const assignLabelsMutation = useAssignLabels();
  const updateNotesMutation  = useUpdateNotes();
  const blockContactMutation  = useBlockContact();
  const unblockContactMutation = useUnblockContact();
  const botSettingsMutation  = useBotSettings();

  const { labels: allVendorLabels } = useLabels();
  const { createLabel } = useLabelMutations();

  // Contact tab: local UI state
  const [notesValue, setNotesValue]         = useState('');
  const [isNotesEditing, setIsNotesEditing] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen]     = useState(true);
  const [isNotesOpen, setIsNotesOpen]       = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [labelInput, setLabelInput]         = useState('');
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  const isBlocked  = contact?.is_blocked  ?? false;
  const botEnabled = contact?.bot_enabled ?? true;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  };

  const assignedLabelUids = (contact?.labels || []).map((l: any) => l._uid);
  const filteredLabelSuggestions = allVendorLabels.filter(
    l => !assignedLabelUids.includes(l._uid) &&
      (!labelInput.trim() || l.title.toLowerCase().includes(labelInput.toLowerCase()))
  );

  const handleAddLabel = (labelUid: string) => {
    const newUids = [...assignedLabelUids, labelUid];
    assignLabelsMutation.mutate({ contactUid, labelUids: newUids });
    setLabelInput('');
    setShowLabelDropdown(false);
  };

  const handleRemoveLabel = (labelUid: string) => {
    const newUids = assignedLabelUids.filter((uid: string) => uid !== labelUid);
    assignLabelsMutation.mutate({ contactUid, labelUids: newUids });
  };

  const handleCreateAndAddLabel = async (title: string) => {
    setShowLabelDropdown(false);
    setLabelInput('');
    const newLabel = await createLabel({ title });
    if (newLabel) {
      assignLabelsMutation.mutate({ contactUid, labelUids: [...assignedLabelUids, newLabel._uid] });
    }
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = labelInput.trim();
      if (!trimmed) return;
      const exactMatch = allVendorLabels.find(l => l.title.toLowerCase() === trimmed.toLowerCase());
      if (exactMatch) {
        handleAddLabel(exactMatch._uid);
      } else {
        handleCreateAndAddLabel(trimmed);
      }
    } else if (e.key === 'Escape') {
      setShowLabelDropdown(false);
      setLabelInput('');
    }
  };

  const handleAssignUser = (userUid: string) => {
    if (userUid === 'unassign') return;
    assignUserMutation.mutate({ contactUid, userUid });
  };
  const handleToggleBot   = (enabled: boolean) => botSettingsMutation.mutate({ contactUid, botEnabled: enabled });
  const handleToggleBlock = () => isBlocked
    ? unblockContactMutation.mutate(contactUid)
    : blockContactMutation.mutate(contactUid);
  const handleSaveNotes = () =>
    updateNotesMutation.mutate({ contactUid, notes: notesValue }, {
      onSuccess: () => setIsNotesEditing(false),
    });
  const handleStartEditNotes = () => {
    setNotesValue(contact?.notes || '');
    setIsNotesEditing(true);
  };

  // ── Add-Lead tab: CRM hooks ───────────────────────────────────────────────

  const { user } = useAuth();
  const { useLeadStatuses, useFieldSchema } = useCRM();
  const { useUsersList } = useUsers();

  const { data: statusesData, isLoading: statusesLoading } = useLeadStatuses({
    is_active: true, ordering: 'order_index',
  });
  const { data: usersData,   isLoading: usersLoading  } = useUsersList({
    page: 1, page_size: 1000, is_active: true,
  });
  const { data: fieldSchema, isLoading: schemaLoading } = useFieldSchema();

  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(DEFAULT_MAPPING);
  const [fieldValues,  setFieldValues]  = useState<Record<string, any>>({ priority: 'MEDIUM' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initializedRef = useRef(false);

  // Sorted visible/active fields (excluding skipped ones)
  const orderedFields = useMemo(() => {
    if (!fieldSchema) return [];
    return [
      ...fieldSchema.standard_fields,
      ...fieldSchema.custom_fields,
    ]
      .filter(f => f.is_active && f.is_visible && !SKIP_FIELDS.has(f.field_name))
      .sort((a, b) => a.display_order - b.display_order);
  }, [fieldSchema]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setFieldMapping(DEFAULT_MAPPING);
      setFieldValues({ priority: 'MEDIUM' });
      setIsSubmitting(false);
      setIsNotesEditing(false);
      setLabelInput('');
      setShowLabelDropdown(false);
    }
  }, [open]);

  // Init field defaults once statusesData + fieldSchema are available
  useEffect(() => {
    if (!open || initializedRef.current || !statusesData) return;
    const defaults: Record<string, any> = { priority: 'MEDIUM' };
    if (statusesData.results.length) {
      defaults.status = statusesData.results[0].id.toString();
    }
    if (fieldSchema) {
      [...fieldSchema.standard_fields, ...fieldSchema.custom_fields].forEach(f => {
        if (f.default_value !== undefined && f.default_value !== '') {
          defaults[f.field_name] = f.default_value;
        }
      });
    }
    initializedRef.current = true;
    setFieldValues(defaults);
  }, [open, statusesData, fieldSchema]);

  const setVal = (key: string, value: any) =>
    setFieldValues(prev => ({ ...prev, [key]: value }));

  const handleCreateLead = async () => {
    if (!contact) return;
    const payload: Partial<CreateLeadPayload> = {};

    // From field mapping
    for (const cf of CONTACT_FIELDS) {
      const mapped = fieldMapping[cf.key];
      if (!mapped) continue;
      const val = cf.getValue(contact);
      if (val) (payload as any)[mapped] = val;
    }

    if (!payload.name)  { toast.error('Name is required.'); return; }
    if (!payload.phone) { toast.error('Phone is required.'); return; }

    // Core standard fields directly from state
    for (const key of CORE_STANDARD_FIELDS) {
      const val = fieldValues[key];
      if (val === undefined || val === '' || val === null) continue;
      if (key === 'status') payload.status = parseInt(val, 10);
      else (payload as any)[key] = val;
    }

    // Custom fields → metadata
    const metadata: Record<string, any> = {};
    for (const field of orderedFields) {
      if (field.is_standard) continue;
      const val = fieldValues[field.field_name];
      if (val !== undefined && val !== '' && val !== null) metadata[field.field_name] = val;
    }
    if (Object.keys(metadata).length) payload.metadata = metadata;

    if (user?.id) payload.owner_user_id = user.id;

    setIsSubmitting(true);
    try {
      await crmService.createLead(payload as CreateLeadPayload);
      toast.success('Lead created successfully!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Field renderer for Add-Lead tab ──────────────────────────────────────

  const renderFieldInput = (field: LeadFieldConfiguration) => {
    const val = fieldValues[field.field_name] ?? '';

    if (field.field_name === 'status') {
      return (
        <Select value={val?.toString() || ''} onValueChange={v => setVal('status', v)} disabled={statusesLoading}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={statusesLoading ? 'Loading...' : 'Select status'} />
          </SelectTrigger>
          <SelectContent>
            {statusesData?.results.map(s => (
              <SelectItem key={s.id} value={s.id.toString()}>
                <div className="flex items-center gap-2">
                  {s.color_hex && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color_hex }} />}
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
        <Select value={val || 'MEDIUM'} onValueChange={v => setVal('priority', v as PriorityEnum)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.field_name === 'assigned_to') {
      return (
        <Select value={val || 'unassigned'} onValueChange={v => setVal('assigned_to', v === 'unassigned' ? '' : v)} disabled={usersLoading}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={usersLoading ? 'Loading...' : 'Select user'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">No assignment</SelectItem>
            {usersData?.results?.map(u => (
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
            <Button variant="outline" className={cn('w-full h-9 justify-start text-left font-normal text-sm', !dateVal && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateVal ? format(dateVal, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateVal} onSelect={d => setVal(field.field_name, d ? d.toISOString() : '')} initialFocus />
          </PopoverContent>
        </Popover>
      );
    }

    if (field.field_name === 'value_amount') {
      return <Input value={val} onChange={e => setVal('value_amount', e.target.value)} type="number" step="0.01" placeholder={field.placeholder || '0.00'} className="h-9" />;
    }
    if (field.field_name === 'value_currency') {
      return <Input value={val} onChange={e => setVal('value_currency', e.target.value)} placeholder={field.placeholder || 'USD'} maxLength={3} className="h-9" />;
    }

    // Custom field types
    const ft = field.field_type;

    if (ft === FieldTypeEnum.TEXTAREA) {
      return <Textarea value={val} onChange={e => setVal(field.field_name, e.target.value)} placeholder={field.placeholder || ''} rows={3} className="resize-none" />;
    }

    if (ft === FieldTypeEnum.DATE) {
      const dv = val ? new Date(val) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full h-9 justify-start text-left font-normal text-sm', !dv && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dv ? format(dv, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dv} onSelect={d => setVal(field.field_name, d ? format(d, 'yyyy-MM-dd') : '')} initialFocus />
          </PopoverContent>
        </Popover>
      );
    }

    if (ft === FieldTypeEnum.DATETIME) {
      const dv = val ? new Date(val) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full h-9 justify-start text-left font-normal text-sm', !dv && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dv ? format(dv, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dv} onSelect={d => setVal(field.field_name, d ? d.toISOString() : '')} initialFocus />
          </PopoverContent>
        </Popover>
      );
    }

    if (ft === FieldTypeEnum.DROPDOWN) {
      const options: string[] = Array.isArray(field.options) ? field.options : [];
      return (
        <Select value={val} onValueChange={v => setVal(field.field_name, v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder={field.placeholder || 'Select option'} /></SelectTrigger>
          <SelectContent>
            {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (ft === FieldTypeEnum.MULTISELECT) {
      const options: string[] = Array.isArray(field.options) ? field.options : [];
      const selected: string[] = Array.isArray(val) ? val : [];
      const toggle = (opt: string) => {
        const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
        setVal(field.field_name, next);
      };
      return (
        <div className="space-y-2">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.map(s => (
                <Badge key={s} variant="secondary" className="text-xs gap-1">
                  {s}
                  <button onClick={() => toggle(s)} className="ml-0.5 hover:opacity-70"><X className="h-2.5 w-2.5" /></button>
                </Badge>
              ))}
            </div>
          )}
          <Select onValueChange={toggle}>
            <SelectTrigger className="h-9"><SelectValue placeholder={field.placeholder || 'Add option...'} /></SelectTrigger>
            <SelectContent>
              {options.filter(o => !selected.includes(o)).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (ft === FieldTypeEnum.CHECKBOX) {
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={field.field_name} checked={!!val} onCheckedChange={c => setVal(field.field_name, c)} />
          <label htmlFor={field.field_name} className="text-sm cursor-pointer">{field.help_text || field.field_label}</label>
        </div>
      );
    }

    if (ft === FieldTypeEnum.NUMBER || ft === FieldTypeEnum.DECIMAL || ft === FieldTypeEnum.CURRENCY) {
      return <Input value={val} onChange={e => setVal(field.field_name, e.target.value)} type="number" step={ft === FieldTypeEnum.NUMBER ? '1' : '0.01'} placeholder={field.placeholder || ''} className="h-9" />;
    }

    return (
      <Input
        value={val}
        onChange={e => setVal(field.field_name, e.target.value)}
        type={ft === FieldTypeEnum.EMAIL ? 'email' : ft === FieldTypeEnum.PHONE ? 'tel' : ft === FieldTypeEnum.URL ? 'url' : 'text'}
        placeholder={field.placeholder || ''}
        className="h-9"
      />
    );
  };

  // ── Footer buttons (only for add-lead tab) ────────────────────────────────

  const footerButtons = activeTab === 'add-lead'
    ? [
        { label: 'Cancel', onClick: () => onOpenChange(false), variant: 'outline' as const, disabled: isSubmitting },
        { label: isSubmitting ? 'Creating...' : 'Create Lead', onClick: handleCreateLead, variant: 'default' as const, disabled: isSubmitting || !contact, loading: isSubmitting },
      ]
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={contact?.name || 'Contact'}
      description={contact?.phone_number}
      size="md"
      isLoading={contactLoading}
      loadingText="Loading contact..."
      footerButtons={footerButtons}
      footerAlignment="right"
      storageKey="contact-chat-drawer-width"
    >
      {/* Show error state */}
      {isError && !contactLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive">Failed to load contact</p>
        </div>
      )}

      {contact && (
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as ContactChatDrawerTab)} className="w-full">
          <TabsList className="w-full mb-5">
            <TabsTrigger value="contact" className="flex-1">Contact Details</TabsTrigger>
            <TabsTrigger value="add-lead" className="flex-1">Add to CRM</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Contact Details ─────────────────────────────────── */}
          <TabsContent value="contact" className="mt-0 space-y-5">
            {/* Avatar + name + phone */}
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 mb-3">
                <AvatarImage src={contact.avatar_url} alt={contact.name} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-semibold">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-base font-semibold">{contact.name || 'Unknown'}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3" />{contact.phone_number}
              </p>
              {contact.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Mail className="h-3 w-3" />{contact.email}
                </p>
              )}
            </div>

            <Separator />

            {/* Reply window */}
            {replyWindowStatus && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" /><span>Reply Window</span>
                  </div>
                  <div className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    replyWindowStatus.is_open
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                  )}>
                    <div className="flex items-center gap-2">
                      {replyWindowStatus.is_open
                        ? <MessageSquare className="h-4 w-4 text-emerald-600" />
                        : <AlertCircle className="h-4 w-4 text-amber-600" />}
                      <span className={cn('text-sm font-medium', replyWindowStatus.is_open ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
                        {replyWindowStatus.is_open ? 'Window Open' : 'Template Required'}
                      </span>
                    </div>
                    {replyWindowStatus.expires_at && (
                      <span className="text-xs text-muted-foreground">{formatTimeRemaining(replyWindowStatus.expires_at)}</span>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Assign team member */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserPlusIcon className="h-4 w-4" /><span>Assigned To</span>
              </div>
              <Select value={contact.assigned_user_uid || 'unassign'} onValueChange={handleAssignUser} disabled={assignUserMutation.isPending}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign"><span className="text-muted-foreground">Unassigned</span></SelectItem>
                  {allTeamMembers.map(member => (
                    <SelectItem key={member._uid} value={member._uid}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <span>{member.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Labels */}
            <Collapsible open={isLabelsOpen} onOpenChange={setIsLabelsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" /><span>Labels</span>
                  {contact?.labels && contact.labels.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{contact.labels.length}</Badge>
                  )}
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isLabelsOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {contact?.labels && contact.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {contact.labels.map((label: any) => (
                      <Badge key={label._uid} variant="outline" className="text-xs flex items-center gap-1 pr-1"
                        style={{ backgroundColor: label.bg_color || undefined, color: label.text_color || undefined, borderColor: label.bg_color || undefined }}>
                        {label.title}
                        <button
                          onClick={() => handleRemoveLabel(label._uid)}
                          disabled={assignLabelsMutation.isPending}
                          className="ml-0.5 hover:opacity-70 disabled:opacity-40"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No labels assigned</p>
                )}

                {/* Add label input */}
                <div className="relative">
                  <Input
                    placeholder="Add or create label..."
                    value={labelInput}
                    onChange={e => { setLabelInput(e.target.value); setShowLabelDropdown(true); }}
                    onFocus={() => setShowLabelDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLabelDropdown(false), 150)}
                    onKeyDown={handleLabelKeyDown}
                    className="h-7 text-xs"
                    disabled={assignLabelsMutation.isPending}
                  />
                  {showLabelDropdown && (filteredLabelSuggestions.length > 0 || labelInput.trim()) && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-36 overflow-y-auto">
                      {filteredLabelSuggestions.map(label => (
                        <div
                          key={label._uid}
                          onMouseDown={() => handleAddLabel(label._uid)}
                          className="px-3 py-1.5 hover:bg-accent cursor-pointer text-sm flex items-center gap-2"
                        >
                          {label.bg_color && (
                            <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.bg_color }} />
                          )}
                          {label.title}
                        </div>
                      ))}
                      {labelInput.trim() && !allVendorLabels.some(l => l.title.toLowerCase() === labelInput.trim().toLowerCase()) && (
                        <div
                          onMouseDown={() => handleCreateAndAddLabel(labelInput.trim())}
                          className="px-3 py-1.5 hover:bg-accent cursor-pointer text-sm text-muted-foreground border-t"
                        >
                          Create "<span className="text-foreground font-medium">{labelInput.trim()}</span>"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Notes */}
            <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <StickyNote className="h-4 w-4" /><span>Notes</span>
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isNotesOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {isNotesEditing ? (
                  <>
                    <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} placeholder="Add notes about this contact..." className="min-h-[80px] text-sm" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes} disabled={updateNotesMutation.isPending} className="flex-1">
                        {updateNotesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Save</>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsNotesEditing(false)} className="flex-1">Cancel</Button>
                    </div>
                  </>
                ) : (
                  <div onClick={(e) => { e.stopPropagation(); handleStartEditNotes(); }} className="p-2 rounded-md border border-dashed border-border hover:bg-accent/50 cursor-pointer min-h-[60px]">
                    {contact.notes
                      ? <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                      : <p className="text-sm text-muted-foreground">Click to add notes...</p>}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Settings */}
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4" /><span>Settings</span>
                </div>
                <ChevronDown className={cn('h-4 w-4 transition-transform', isSettingsOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="bot-toggle" className="text-sm cursor-pointer">Bot Enabled</Label>
                  </div>
                  <Switch id="bot-toggle" checked={botEnabled} onCheckedChange={handleToggleBot} disabled={botSettingsMutation.isPending} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="block-toggle" className="text-sm cursor-pointer">Block Contact</Label>
                  </div>
                  <Switch id="block-toggle" checked={isBlocked} onCheckedChange={handleToggleBlock} disabled={blockContactMutation.isPending || unblockContactMutation.isPending} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* ── TAB 2: Add to CRM ─────────────────────────────────────── */}
          <TabsContent value="add-lead" className="mt-0 space-y-6">
            {/* Field Mapping */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Field Mapping</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Map contact properties to CRM lead fields.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 px-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Property</span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Map to Lead Field</span>
              </div>
              <div className="space-y-2">
                {CONTACT_FIELDS.map(field => {
                  const value = field.getValue(contact);
                  return (
                    <div key={field.key} className="grid grid-cols-2 gap-3 items-center rounded-lg border border-border bg-card/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{field.label}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {value || <span className="italic opacity-60">No value</span>}
                        </p>
                      </div>
                      <Select
                        value={fieldMapping[field.key] || '__none__'}
                        onValueChange={v => setFieldMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Don't map" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs text-muted-foreground">— Don't map —</SelectItem>
                          {LEAD_FIELDS_FOR_MAPPING.map(lf => (
                            <SelectItem key={lf.key} value={lf.key} className="text-xs">{lf.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Lead Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Lead Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in additional details for the new lead.</p>
              </div>

              {orderedFields.length === 0 && !schemaLoading && (
                <p className="text-xs text-muted-foreground italic">No additional fields configured.</p>
              )}

              {orderedFields.map(field => (
                <div key={field.field_name} className="space-y-1.5">
                  <Label className="text-xs">
                    {field.field_label}
                    {field.is_required && <span className="text-destructive ml-0.5">*</span>}
                    {!field.is_standard && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">(custom)</span>}
                  </Label>
                  {renderFieldInput(field)}
                  {field.help_text && field.field_type !== FieldTypeEnum.CHECKBOX && (
                    <p className="text-[11px] text-muted-foreground">{field.help_text}</p>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </SideDrawer>
  );
}
