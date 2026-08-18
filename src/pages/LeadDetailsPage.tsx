// src/pages/LeadDetailsPage.tsx
// Premium Lead Detail Page — ElevenLabs-inspired clean modern UI
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Phone, Mail, Loader2, Calendar, Clock,
  MapPin, Plus, Check, Trash2, MessageSquare,
  MoreHorizontal, ChevronRight, Building2, User2, Star,
  Activity, Paperclip, PhoneCall, Zap, ExternalLink, Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isFuture, isToday } from 'date-fns';

import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { placeCall } from '@/lib/telephonyController';
import { hexBadgeStyle } from '@/lib/hexBadge';
import { UserAvatar } from '@/components/user';
import { SendSMSDialog } from '@/components/telephony/SendSMSDialog';
import { LeadTelephonyHistory } from '@/components/telephony/LeadTelephonyHistory';
import { useRealEstate } from '@/hooks/useRealEstate';
import { useMeeting } from '@/hooks/useMeeting';
import LeadDetailsForm from '@/components/lead-drawer/LeadDetailsForm';
import LeadActivities from '@/components/lead-drawer/LeadActivities';
import LeadTasks from '@/components/lead-drawer/LeadTasks';
import LeadNotesSurface from '@/components/lead-drawer/LeadNotesSurface';
import LeadTasksBlock from '@/components/lead-drawer/LeadTasksBlock';
import MeetingsFormDrawer from '@/components/MeetingsFormDrawer';
import { SideDrawer, type DrawerActionButton } from '@/components/SideDrawer';
import { LeadScoreSlider } from '@/components/crm/LeadScoreSlider';
import { LeadAttachments } from '@/components/crm/LeadAttachments';
import { LeadGroupPicker } from '@/components/crm/LeadGroupPicker';
import { CopyPhoneButton } from '@/components/crm/CopyPhoneButton';
import type { Lead, LeadStatus } from '@/types/crmTypes';
import type { Meeting } from '@/types/meeting.types';
import {
  LeadUnitRelation,
  UnitType,
  type Project,
  type ProjectInterest,
  type ProjectInterestCreateData,
  type Unit,
  type UnitLead,
  type UnitLeadCreateData,
} from '@/types/realEstate.types';
import { LeadFormHandle } from '@/components/LeadsFormDrawer';
import { LeadWhatsAppDrawer, WhatsAppIcon, useLeadWhatsAppWindow } from '@/components/crm/LeadWhatsAppDrawer';
import { cn } from '@/lib/utils';
import { useCrmDataChanged } from '@/lib/crmEvents';

// ── Shared micro-components ─────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
      {children}
    </span>
  );
}

function EmptyState({
  icon: Icon, label, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 text-xs text-primary hover:underline underline-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Avatar initials helper ───────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Gradient by name (consistent per lead) ──────────────────────────
const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
];
function getGradient(name: string) {
  const i = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[i];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const formatRealEstateLabel = (value?: string | null) =>
  value ? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Not specified';

const formatMoney = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const projectName = (project: number | Project) =>
  isRecord(project) && typeof project.name === 'string' ? project.name : `Project #${project}`;

const unitNumber = (unit: number | Unit) =>
  isRecord(unit) && typeof unit.unit_number === 'string' ? unit.unit_number : `Unit #${unit}`;

const unitProjectName = (unit: number | Unit) =>
  isRecord(unit) && unit.project ? projectName(unit.project as number | Project) : null;

const relatedId = (value: number | { id: number } | null | undefined) =>
  typeof value === 'number' ? value : value?.id;

// ── Quick action button ──────────────────────────────────────────────
function QuickAction({
  icon: Icon, label, onClick, color = 'default', disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  color?: 'default' | 'green' | 'blue' | 'indigo' | 'red';
  disabled?: boolean;
}) {
  const colors = {
    default: 'hover:bg-muted/80 text-muted-foreground hover:text-foreground',
    green:   'hover:bg-green-50 text-muted-foreground hover:text-green-600',
    blue:    'hover:bg-blue-50 text-muted-foreground hover:text-blue-600',
    indigo:  'hover:bg-indigo-50 text-muted-foreground hover:text-indigo-600',
    red:     'hover:bg-red-50 text-muted-foreground hover:text-red-500',
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            colors[color],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Main component ───────────────────────────────────────────────────
interface LeadDetailsPageProps {
  leadIdOverride?: number | null;
  embedded?: boolean;
  onBack?: () => void;
  onOpenFullPage?: (leadId: number) => void;
  onSaved?: () => void;
  onDeleted?: (leadId: number) => void;
}

export const LeadDetailsPage = ({
  leadIdOverride,
  embedded = false,
  onBack,
  onOpenFullPage,
  onSaved,
  onDeleted,
}: LeadDetailsPageProps = {}) => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meeting drawer state
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetingDrawerMode, setMeetingDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Telephony
  const { hasModuleAccess } = useAuth();
  const telephonyEnabled = hasModuleAccess('telephony');
  const realEstateEnabled = hasModuleAccess('real_estate');
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  // WhatsApp drawer
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);

  const { useLead, useLeadStatuses, updateLead, deleteLead, patchLead } = useCRM();
  const leadIdNum = leadIdOverride ?? (leadId ? parseInt(leadId, 10) : null);
  const { useMeetingsByLead } = useMeeting();
  const {
    useProjects,
    useUnits,
    useProjectInterests,
    useUnitLeads,
    createProjectInterest,
    updateProjectInterest,
    deleteProjectInterest,
    createUnitLead,
    updateUnitLead,
    deleteUnitLead,
  } = useRealEstate();

  const { data: lead, error: leadError, isLoading: leadLoading, mutate: mutateLead } = useLead(leadIdNum);
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });
  const { data: meetingsData, isLoading: meetingsLoading, mutate: mutateMeetings } = useMeetingsByLead(leadIdNum);
  const {
    data: projectInterestsData,
    isLoading: projectInterestsLoading,
    mutate: mutateProjectInterests,
  } = useProjectInterests(realEstateEnabled ? leadIdNum : null);
  const {
    data: unitLeadsData,
    isLoading: unitLeadsLoading,
    mutate: mutateUnitLeads,
  } = useUnitLeads(realEstateEnabled ? leadIdNum : null);
  const { data: realEstateProjectsData } = useProjects();
  const meetings = meetingsData?.results || [];
  const projectInterests = projectInterestsData?.results || [];
  const unitLeads = unitLeadsData?.results || [];
  const realEstateLoading = projectInterestsLoading || unitLeadsLoading;
  const realEstateProjects = realEstateProjectsData?.results || [];

  const [projectInterestOpen, setProjectInterestOpen] = useState(false);
  const [editingProjectInterest, setEditingProjectInterest] = useState<ProjectInterest | null>(null);
  const [projectInterestForm, setProjectInterestForm] = useState<ProjectInterestCreateData | null>(null);
  const [unitLeadOpen, setUnitLeadOpen] = useState(false);
  const [editingUnitLead, setEditingUnitLead] = useState<UnitLead | null>(null);
  const [unitLeadProjectId, setUnitLeadProjectId] = useState<number | null>(null);
  const [unitLeadForm, setUnitLeadForm] = useState<UnitLeadCreateData | null>(null);
  const [realEstateSaving, setRealEstateSaving] = useState(false);
  const { data: realEstateUnitsData } = useUnits(
    unitLeadProjectId ? { project: unitLeadProjectId, page_size: 200 } : { page_size: 200 }
  );
  const realEstateUnits = realEstateUnitsData?.results || [];

  // WhatsApp 24h reply window status (shown in header)
  const { windowOpen: waWindowOpen } = useLeadWhatsAppWindow(leadIdNum, !!lead?.phone);

  const formRef = useRef<LeadFormHandle | null>(null);

  useEffect(() => {
    if (lead?.notes !== undefined) setNotes(lead.notes || '');
  }, [lead?.id, lead?.notes]);

  useCrmDataChanged((e) => {
    if (e.resource !== 'leads') return;
    mutateLead();
  });

  const openCreateProjectInterest = useCallback(() => {
    if (!leadIdNum) return;
    setEditingProjectInterest(null);
    setProjectInterestForm({
      project: realEstateProjects[0]?.id || 0,
      lead: leadIdNum,
      budget_min: null,
      budget_max: null,
      preferred_unit_type: null,
      preferred_configuration: '',
      notes: '',
      assigned_to: null,
    });
    setProjectInterestOpen(true);
  }, [leadIdNum, realEstateProjects]);

  const openEditProjectInterest = useCallback((interest: ProjectInterest) => {
    if (!leadIdNum) return;
    setEditingProjectInterest(interest);
    setProjectInterestForm({
      project: relatedId(interest.project) || 0,
      lead: interest.lead || leadIdNum,
      budget_min: interest.budget_min,
      budget_max: interest.budget_max,
      preferred_unit_type: interest.preferred_unit_type,
      preferred_configuration: interest.preferred_configuration || '',
      notes: interest.notes || '',
      assigned_to: interest.assigned_to,
    });
    setProjectInterestOpen(true);
  }, [leadIdNum]);

  const saveProjectInterest = useCallback(async () => {
    if (!projectInterestForm?.project || !leadIdNum) return;
    setRealEstateSaving(true);
    try {
      const payload: ProjectInterestCreateData = {
        ...projectInterestForm,
        lead: leadIdNum,
        budget_min: projectInterestForm.budget_min || null,
        budget_max: projectInterestForm.budget_max || null,
        preferred_configuration: projectInterestForm.preferred_configuration || null,
        notes: projectInterestForm.notes || null,
        assigned_to: projectInterestForm.assigned_to || null,
      };
      if (editingProjectInterest) {
        await updateProjectInterest(editingProjectInterest.id, payload);
      } else {
        await createProjectInterest(payload);
      }
      await mutateProjectInterests();
      setProjectInterestOpen(false);
    } finally {
      setRealEstateSaving(false);
    }
  }, [
    createProjectInterest,
    editingProjectInterest,
    leadIdNum,
    mutateProjectInterests,
    projectInterestForm,
    updateProjectInterest,
  ]);

  const removeProjectInterest = useCallback(async (interest: ProjectInterest) => {
    if (!window.confirm(`Remove interest in "${projectName(interest.project)}"?`)) return;
    await deleteProjectInterest(interest.id);
    await mutateProjectInterests();
  }, [deleteProjectInterest, mutateProjectInterests]);

  const openCreateUnitLead = useCallback(() => {
    if (!leadIdNum) return;
    const firstUnit = realEstateUnits[0];
    const firstProjectId = relatedId(firstUnit?.project) || realEstateProjects[0]?.id || null;
    setEditingUnitLead(null);
    setUnitLeadProjectId(firstProjectId);
    setUnitLeadForm({
      unit: firstUnit?.id || 0,
      lead: leadIdNum,
      relation_type: LeadUnitRelation.INTERESTED,
      booking_amount: null,
      booking_date: null,
      notes: '',
      assigned_to: null,
    });
    setUnitLeadOpen(true);
  }, [leadIdNum, realEstateProjects, realEstateUnits]);

  const openEditUnitLead = useCallback((unitLead: UnitLead) => {
    if (!leadIdNum) return;
    const unitId = relatedId(unitLead.unit) || 0;
    const projectId = isRecord(unitLead.unit)
      ? relatedId(unitLead.unit.project as number | Project)
      : null;
    setEditingUnitLead(unitLead);
    setUnitLeadProjectId(projectId);
    setUnitLeadForm({
      unit: unitId,
      lead: unitLead.lead || leadIdNum,
      relation_type: unitLead.relation_type,
      booking_amount: unitLead.booking_amount,
      booking_date: unitLead.booking_date,
      notes: unitLead.notes || '',
      assigned_to: unitLead.assigned_to,
    });
    setUnitLeadOpen(true);
  }, [leadIdNum]);

  const saveUnitLead = useCallback(async () => {
    if (!unitLeadForm?.unit || !leadIdNum) return;
    setRealEstateSaving(true);
    try {
      const payload: UnitLeadCreateData = {
        ...unitLeadForm,
        lead: leadIdNum,
        booking_amount: unitLeadForm.booking_amount || null,
        booking_date: unitLeadForm.booking_date || null,
        notes: unitLeadForm.notes || null,
        assigned_to: unitLeadForm.assigned_to || null,
      };
      if (editingUnitLead) {
        await updateUnitLead(editingUnitLead.id, payload);
      } else {
        await createUnitLead(payload);
      }
      await mutateUnitLeads();
      setUnitLeadOpen(false);
    } finally {
      setRealEstateSaving(false);
    }
  }, [
    createUnitLead,
    editingUnitLead,
    leadIdNum,
    mutateUnitLeads,
    unitLeadForm,
    updateUnitLead,
  ]);

  const removeUnitLead = useCallback(async (unitLead: UnitLead) => {
    if (!window.confirm(`Remove relation for "${unitNumber(unitLead.unit)}"?`)) return;
    await deleteUnitLead(unitLead.id);
    await mutateUnitLeads();
  }, [deleteUnitLead, mutateUnitLeads]);

  const handleBack = useCallback(() => {
    if (embedded) {
      onBack?.();
      return;
    }
    navigate('/crm/leads');
  }, [embedded, navigate, onBack]);

  const handleOpenFullPage = useCallback(() => {
    if (!lead) return;
    if (onOpenFullPage) {
      onOpenFullPage(lead.id);
      return;
    }
    window.open(`/crm/leads/${lead.id}`, '_blank', 'noopener,noreferrer');
  }, [lead, onOpenFullPage]);

  const handleSave = useCallback(async () => {
    if (!lead || !formRef.current) return;
    try {
      setIsSaving(true);
      const formValues = await formRef.current.getFormValues();
      if (!formValues) { toast.error('Please fill in all required fields'); return; }
      await updateLead(lead.id, { ...formValues, notes });
      await mutateLead();
      onSaved?.();
      toast.success('Lead saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lead');
    } finally {
      setIsSaving(false);
    }
  }, [lead, updateLead, mutateLead, notes, onSaved]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      if (!lead) return;
      try {
        setNotesSaving(true);
        await patchLead(lead.id, { notes: value });
        await mutateLead();
      } catch { /* silent */ }
      finally { setNotesSaving(false); }
    }, 800);
  }, [lead, patchLead, mutateLead]);

  const handleDelete = useCallback(async () => {
    if (!lead) return;
    if (!window.confirm(`Delete "${lead.name}"? This cannot be undone.`)) return;
    try {
      setIsDeleting(true);
      await deleteLead(lead.id);
      toast.success('Lead deleted');
      onDeleted?.(lead.id);
      if (embedded) {
        onBack?.();
        return;
      }
      navigate('/crm/leads');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  }, [lead, deleteLead, navigate, embedded, onBack, onDeleted]);

  const handleCall = useCallback(() => {
    if (!lead?.phone) return;
    void placeCall(
      { toNumber: lead.phone, leadId: lead.id },
      { onRequireSetup: () => navigate('/admin/settings') },
    );
  }, [lead, navigate]);

  const handleEmail = useCallback(() => {
    if (lead?.email) window.location.href = `mailto:${lead.email}`;
  }, [lead]);

  const handleScheduleMeeting = useCallback(() => {
    setSelectedMeetingId(null); setMeetingDrawerMode('create'); setMeetingDrawerOpen(true);
  }, []);

  const handleMeetingClick = useCallback((id: number) => {
    setSelectedMeetingId(id); setMeetingDrawerMode('view'); setMeetingDrawerOpen(true);
  }, []);

  const handleUpdateLeadScore = useCallback(async (score: number) => {
    if (!lead) return;
    try {
      await patchLead(lead.id, { lead_score: score });
      await mutateLead();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update lead score');
      throw error;
    }
  }, [lead, patchLead, mutateLead]);

  // ── Status badge ────────────────────────────────────────────────────
  const getStatusObj = (status?: LeadStatus | number) => {
    if (!status) return null;
    return typeof status === 'number'
      ? statusesData?.results.find(s => s.id === status)
      : status;
  };

  // ── Priority config ─────────────────────────────────────────────────
  const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    HIGH:   { label: 'High',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    MEDIUM: { label: 'Medium', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    LOW:    { label: 'Low',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  };

  // ── Meeting helpers ─────────────────────────────────────────────────
  const getMeetingBadge = (meeting: Meeting) => {
    const start = new Date(meeting.start_at), end = new Date(meeting.end_at), now = new Date();
    if (isPast(end))            return { label: 'Done',       cls: 'bg-muted text-muted-foreground' };
    if (now >= start && now <= end) return { label: 'Live',   cls: 'bg-green-100 text-green-700' };
    if (isToday(start))         return { label: 'Today',      cls: 'bg-blue-100 text-blue-700' };
    if (isFuture(start))        return { label: 'Upcoming',   cls: 'bg-purple-100 text-purple-700' };
    return null;
  };

  const formatMeetingTime = (s: string, e: string) => {
    try {
      return `${format(new Date(s), 'MMM d')} · ${format(new Date(s), 'h:mm a')} – ${format(new Date(e), 'h:mm a')}`;
    } catch { return ''; }
  };

  // ── Tab config ──────────────────────────────────────────────────────
  const tabs = [
    { value: 'overview',     label: 'Overview',     icon: User2 },
    { value: 'activities',   label: 'Activities',   icon: Activity },
    { value: 'tasks',        label: 'Tasks',        icon: Check },
    { value: 'meetings',     label: 'Meetings',     icon: Calendar, count: meetings.length },
    { value: 'attachments',  label: 'Attachments',  icon: Paperclip },
    ...(telephonyEnabled ? [{ value: 'calls', label: 'Calls', icon: PhoneCall }] : []),
    ...(realEstateEnabled ? [{
      value: 'real-estate',
      label: 'Real Estate',
      icon: Building2,
      count: projectInterests.length + unitLeads.length,
    }] : []),
  ];

  // ── Loading / error states ──────────────────────────────────────────
  if (leadLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 p-8">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <User2 className="h-6 w-6 text-destructive/60" />
        </div>
        <p className="text-sm text-muted-foreground">{leadError ? 'Failed to load lead' : 'Lead not found'}</p>
        <Button onClick={handleBack} variant="outline" size="sm" className="h-8 text-xs rounded-lg">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Leads
        </Button>
      </div>
    );
  }

  const statusObj = getStatusObj(lead.status);
  const priorityCfg = PRIORITY_CONFIG[lead.priority] || null;
  const gradient = getGradient(lead.name);
  const initials = getInitials(lead.name);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn('flex flex-col bg-background', embedded ? 'h-full min-h-0' : 'min-h-full')}
    >

      {/* ══════════════════════════════════════════════════════════════
          STICKY HEADER
      ══════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/60">

        {/* ── Breadcrumb bar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-3 pb-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Leads
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
            <span className="text-foreground font-medium truncate max-w-[160px]">{lead.name}</span>
          </button>

          {/* Action cluster */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 mr-1">
              {lead.phone && (
                <QuickAction icon={Phone} label={telephonyEnabled ? 'Call' : 'Telephony not enabled'} onClick={handleCall} color="green" disabled={!telephonyEnabled} />
              )}
              {lead.phone && (
                <QuickAction icon={MessageSquare} label={telephonyEnabled ? 'Send SMS' : 'Telephony not enabled'} onClick={() => setSmsDialogOpen(true)} color="indigo" disabled={!telephonyEnabled} />
              )}
              {lead.phone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setWhatsappDrawerOpen(true)}
                      className="relative h-8 w-8 rounded-lg flex items-center justify-center transition-all hover:bg-green-50 text-[#25d366]"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                      {/* 24h window dot */}
                      <span className={cn(
                        'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background',
                        waWindowOpen ? 'bg-green-500' : 'bg-amber-400',
                      )} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    WhatsApp · {waWindowOpen ? '24h window open' : 'Window closed'}
                  </TooltipContent>
                </Tooltip>
              )}
              {lead.email && (
                <QuickAction icon={Mail} label="Email" onClick={handleEmail} color="blue" />
              )}
            </div>

            {/* Score pill — in header action bar */}
            <LeadScoreSlider
              score={lead.lead_score || 0}
              onSave={handleUpdateLeadScore}
              leadName={lead.name}
            />

            <div className="w-px h-4 bg-border/60 mx-1" />

            <QuickAction icon={Trash2} label="Delete lead" onClick={handleDelete} color="red" disabled={isDeleting} />

            {embedded && (
              <QuickAction icon={ExternalLink} label="Open page" onClick={handleOpenFullPage} color="default" />
            )}

            <Button
              onClick={handleSave}
              size="sm"
              className="h-8 text-xs px-3.5 ml-1 rounded-lg"
              disabled={isSaving}
            >
              {isSaving
                ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Saving</>
                : <><Check className="h-3 w-3 mr-1.5" />Save</>
              }
            </Button>
          </div>
        </div>

        {/* ── Hero section ───────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm bg-gradient-to-br',
              gradient,
            )}>
              {initials}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              {/* Name row */}
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold text-foreground leading-tight tracking-tight truncate">
                  {lead.name}
                </h1>

                {/* Status badge */}
                {statusObj && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-none"
                    style={hexBadgeStyle(statusObj.color_hex)}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
                      style={{ backgroundColor: statusObj.color_hex || '#6b7280' }}
                    />
                    {statusObj.name}
                  </span>
                )}

                {/* Priority badge */}
                {priorityCfg && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-none"
                    style={{
                      backgroundColor: priorityCfg.bg,
                      color: priorityCfg.color,
                      border: `1px solid ${priorityCfg.border}`,
                    }}
                  >
                    {priorityCfg.label}
                  </span>
                )}
              </div>

              {/* Contact meta row */}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {lead.phone && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{lead.phone}</span>
                    <CopyPhoneButton phone={lead.phone} className="h-5 w-5" />
                  </span>
                )}
                {lead.email && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[220px]">
                    <Mail className="h-3 w-3" />
                    {lead.email}
                  </span>
                )}
                {(lead as any).company && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {(lead as any).company}
                  </span>
                )}
              </div>

              {/* Ownership meta row — owner/assignee were not surfaced in the
                  lead header at all before. */}
              <div className="flex items-center gap-4 mt-1 flex-wrap text-xs">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="text-muted-foreground">Owner</span>
                  <UserAvatar id={lead.owner_user_id} size="xs" showName nameClassName="text-xs" />
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="text-muted-foreground">Assigned</span>
                  <UserAvatar id={lead.assigned_to} size="xs" showName nameClassName="text-xs" />
                </span>
              </div>

              {/* Groups row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <LeadGroupPicker
                  leadId={lead.id}
                  currentGroups={lead.groups || []}
                  onGroupsChanged={() => mutateLead()}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab navigation ─────────────────────────────────────── */}
        <div className="px-5">
          <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none w-full justify-start">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'relative h-9 px-3.5 rounded-none text-xs font-normal',
                    'border-b-2 border-transparent bg-transparent shadow-none',
                    'text-muted-foreground hover:text-foreground',
                    'data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:font-medium',
                    'data-[state=active]:bg-transparent transition-colors',
                    'inline-flex items-center gap-1.5',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-0.5 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-px font-normal leading-none">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB CONTENT
      ══════════════════════════════════════════════════════════════ */}

      {/* ── Shared tab padding ─── all tabs use the same shell ── */}

      {/* Overview — Notion-style surface: properties + notes + inline activity + tasks.
          `@container`-style responsive 2-col properties handled inside LeadDetailsForm. */}
      <TabsContent value="overview" className="mt-0 flex-1 focus-visible:outline-none">
        <div className="px-5 py-4 max-w-3xl space-y-4">
          {/* Properties — Notion-style rows (responsive 2-col when wide) */}
          <LeadDetailsForm
            lead={lead}
            mode="edit"
            showNotes={false}
            showScore={false}
            ref={r => {
              if (r && 'getFormValues' in r) {
                // @ts-ignore
                formRef.current = r;
              }
            }}
          />

          {/* Notion notes body + inline activity feed */}
          <div className="pt-3 border-t border-border/30">
            <LeadNotesSurface
              leadId={lead.id}
              notes={notes}
              onNotesChange={handleNotesChange}
              saving={notesSaving}
            />
          </div>

          {/* Collapsible tasks block (hidden when empty) */}
          <LeadTasksBlock leadId={lead.id} leadAssignedTo={lead.assigned_to} />
        </div>
      </TabsContent>

      {/* Activities */}
      <TabsContent value="activities" className="mt-0 focus-visible:outline-none">
        <div className="px-5 py-5">
          <LeadActivities leadId={lead.id} />
        </div>
      </TabsContent>

      {/* Tasks */}
      <TabsContent value="tasks" className="mt-0 focus-visible:outline-none">
        <div className="px-5 py-5">
          <LeadTasks leadId={lead.id} leadAssignedTo={lead.assigned_to} />
        </div>
      </TabsContent>

      {/* Attachments */}
      <TabsContent value="attachments" className="mt-0 focus-visible:outline-none">
        <div className="px-5 py-5">
          <LeadAttachments leadId={lead.id} />
        </div>
      </TabsContent>

      {/* Calls */}
      {telephonyEnabled && (
        <TabsContent value="calls" className="mt-0 focus-visible:outline-none">
          <div className="px-5 py-5">
            <LeadTelephonyHistory
              leadId={lead.id}
              leadName={lead.name}
              leadPhone={lead.phone}
              telephonyEnabled={telephonyEnabled}
              onRequireSetup={() => navigate('/admin/settings')}
            />
          </div>
        </TabsContent>
      )}

      {/* Real Estate */}
      {realEstateEnabled && (
        <TabsContent value="real-estate" className="mt-0 focus-visible:outline-none">
          <div className="px-5 py-5 max-w-3xl space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <SectionLabel>Real Estate</SectionLabel>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track project interest, unit interest, bookings, budgets, and visit-stage notes for this lead.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs rounded-lg"
                  onClick={openCreateProjectInterest}
                  disabled={realEstateProjects.length === 0}
                >
                  <Plus className="h-3 w-3 mr-1.5" /> Project Interest
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs rounded-lg"
                  onClick={openCreateUnitLead}
                  disabled={realEstateUnits.length === 0}
                >
                  <Plus className="h-3 w-3 mr-1.5" /> Unit Relation
                </Button>
              </div>
            </div>

            {realEstateLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : projectInterests.length === 0 && unitLeads.length === 0 ? (
              <EmptyState
                icon={Building2}
                label="No real estate activity yet"
                action={
                  realEstateProjects.length > 0
                    ? { label: 'Add project interest', onClick: openCreateProjectInterest }
                    : undefined
                }
              />
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>{projectInterests.length} project {projectInterests.length === 1 ? 'interest' : 'interests'}</SectionLabel>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs rounded-md"
                      onClick={openCreateProjectInterest}
                      disabled={realEstateProjects.length === 0}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="mt-3 border border-border/50 rounded-lg overflow-hidden divide-y divide-border/40 shadow-sm">
                    {projectInterests.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground bg-card">No project interests</div>
                    ) : projectInterests.map(interest => {
                      const budgetMin = formatMoney(interest.budget_min);
                      const budgetMax = formatMoney(interest.budget_max);
                      const budget = budgetMin && budgetMax ? `${budgetMin} - ${budgetMax}` : budgetMin || budgetMax || 'Budget not specified';
                      return (
                        <div key={interest.id} className="px-4 py-3 bg-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{projectName(interest.project)}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{formatRealEstateLabel(interest.preferred_unit_type)}</span>
                                <span>{interest.preferred_configuration || 'Configuration not specified'}</span>
                                <span>{budget}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProjectInterest(interest)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProjectInterest(interest)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {interest.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{interest.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <SectionLabel>{unitLeads.length} unit {unitLeads.length === 1 ? 'relation' : 'relations'}</SectionLabel>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs rounded-md"
                      onClick={openCreateUnitLead}
                      disabled={realEstateUnits.length === 0}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="mt-3 border border-border/50 rounded-lg overflow-hidden divide-y divide-border/40 shadow-sm">
                    {unitLeads.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground bg-card">No unit relations</div>
                    ) : unitLeads.map(unitLead => {
                      const project = unitProjectName(unitLead.unit);
                      const bookingAmount = formatMoney(unitLead.booking_amount);
                      return (
                        <div key={unitLead.id} className="px-4 py-3 bg-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{unitNumber(unitLead.unit)}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {project && <span>{project}</span>}
                                <span>{formatRealEstateLabel(unitLead.relation_type)}</span>
                                {bookingAmount && <span>{bookingAmount}</span>}
                                {unitLead.booking_date && <span>{format(new Date(unitLead.booking_date), 'MMM d, yyyy')}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUnitLead(unitLead)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeUnitLead(unitLead)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {unitLead.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{unitLead.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      )}

      {/* Meetings */}
      <TabsContent value="meetings" className="mt-0 focus-visible:outline-none">
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>{meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}</SectionLabel>
            <Button onClick={handleScheduleMeeting} size="sm" className="h-7 text-xs px-3 rounded-md">
              <Plus className="h-3 w-3 mr-1.5" />Schedule
            </Button>
          </div>

          {meetingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <EmptyState icon={Calendar} label="No meetings yet" action={{ label: 'Schedule meeting', onClick: handleScheduleMeeting }} />
          ) : (
            <div className="border border-border/50 rounded-lg overflow-hidden divide-y divide-border/40 shadow-sm">
              {meetings.map(meeting => {
                const badge = getMeetingBadge(meeting);
                return (
                  <div
                    key={meeting.id}
                    onClick={() => handleMeetingClick(meeting.id)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer group bg-card"
                  >
                    <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{meeting.title}</span>
                        {badge && (
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none', badge.cls)}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{formatMeetingTime(meeting.start_at, meeting.end_at)}</span>
                        {meeting.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-2.5 w-2.5 flex-shrink-0" />{meeting.location}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TabsContent>

      {/* ── Overlays / Dialogs ──────────────────────────────────── */}
      <SideDrawer
        open={projectInterestOpen}
        onOpenChange={setProjectInterestOpen}
        title={editingProjectInterest ? 'Edit project interest' : 'Add project interest'}
        description="Capture which project this lead is considering, their budget, preferences, and sales notes."
        mode={editingProjectInterest ? 'edit' : 'create'}
        size="lg"
        footerAlignment="right"
        storageKey="lead-real-estate-project-interest-drawer"
        footerButtons={[
          {
            label: 'Cancel',
            onClick: () => setProjectInterestOpen(false),
            variant: 'outline',
            disabled: realEstateSaving,
          },
          {
            label: editingProjectInterest ? 'Save Interest' : 'Add Interest',
            onClick: saveProjectInterest,
            loading: realEstateSaving,
            disabled: !projectInterestForm?.project,
          },
        ] satisfies DrawerActionButton[]}
      >
        {projectInterestForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Project</Label>
              <Select
                value={projectInterestForm.project ? String(projectInterestForm.project) : ''}
                onValueChange={(value) => setProjectInterestForm(current => current && ({ ...current, project: Number(value) }))}
              >
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {realEstateProjects.map(project => (
                    <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Unit Type</Label>
              <Select
                value={projectInterestForm.preferred_unit_type || 'none'}
                onValueChange={(value) => setProjectInterestForm(current => current && ({
                  ...current,
                  preferred_unit_type: value === 'none' ? null : value as UnitType,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {Object.values(UnitType).map(type => (
                    <SelectItem key={type} value={type}>{formatRealEstateLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Configuration</Label>
              <Input
                placeholder="2 BHK, plot, shop..."
                value={projectInterestForm.preferred_configuration || ''}
                onChange={(event) => setProjectInterestForm(current => current && ({
                  ...current,
                  preferred_configuration: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Min</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={projectInterestForm.budget_min ?? ''}
                onChange={(event) => setProjectInterestForm(current => current && ({
                  ...current,
                  budget_min: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Max</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={projectInterestForm.budget_max ?? ''}
                onChange={(event) => setProjectInterestForm(current => current && ({
                  ...current,
                  budget_max: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                placeholder="Requirement notes, preferred tower/floor, objections, next step..."
                value={projectInterestForm.notes || ''}
                onChange={(event) => setProjectInterestForm(current => current && ({
                  ...current,
                  notes: event.target.value,
                }))}
              />
            </div>
          </div>
        )}
      </SideDrawer>

      <SideDrawer
        open={unitLeadOpen}
        onOpenChange={setUnitLeadOpen}
        title={editingUnitLead ? 'Edit unit relation' : 'Add unit relation'}
        description="Link this lead to a specific unit and track interest, visit, negotiation, booking, or sale status."
        mode={editingUnitLead ? 'edit' : 'create'}
        size="lg"
        footerAlignment="right"
        storageKey="lead-real-estate-unit-relation-drawer"
        footerButtons={[
          {
            label: 'Cancel',
            onClick: () => setUnitLeadOpen(false),
            variant: 'outline',
            disabled: realEstateSaving,
          },
          {
            label: editingUnitLead ? 'Save Relation' : 'Add Relation',
            onClick: saveUnitLead,
            loading: realEstateSaving,
            disabled: !unitLeadForm?.unit,
          },
        ] satisfies DrawerActionButton[]}
      >
        {unitLeadForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Filter</Label>
              <Select
                value={unitLeadProjectId ? String(unitLeadProjectId) : 'all'}
                onValueChange={(value) => {
                  const nextProjectId = value === 'all' ? null : Number(value);
                  setUnitLeadProjectId(nextProjectId);
                  setUnitLeadForm(current => current && ({ ...current, unit: 0 }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {realEstateProjects.map(project => (
                    <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={unitLeadForm.unit ? String(unitLeadForm.unit) : ''}
                onValueChange={(value) => setUnitLeadForm(current => current && ({ ...current, unit: Number(value) }))}
              >
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {realEstateUnits.map(unit => (
                    <SelectItem key={unit.id} value={String(unit.id)}>
                      {unitNumber(unit)} · {unitProjectName(unit) || 'Project'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relation Type</Label>
              <Select
                value={unitLeadForm.relation_type}
                onValueChange={(value) => setUnitLeadForm(current => current && ({
                  ...current,
                  relation_type: value as LeadUnitRelation,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(LeadUnitRelation).map(relation => (
                    <SelectItem key={relation} value={relation}>{formatRealEstateLabel(relation)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Booking Date</Label>
              <Input
                type="date"
                value={unitLeadForm.booking_date || ''}
                onChange={(event) => setUnitLeadForm(current => current && ({
                  ...current,
                  booking_date: event.target.value || null,
                }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Booking Amount</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={unitLeadForm.booking_amount ?? ''}
                onChange={(event) => setUnitLeadForm(current => current && ({
                  ...current,
                  booking_amount: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={4}
                placeholder="Site visit, negotiation, payment, cancellation, or booking notes..."
                value={unitLeadForm.notes || ''}
                onChange={(event) => setUnitLeadForm(current => current && ({
                  ...current,
                  notes: event.target.value,
                }))}
              />
            </div>
          </div>
        )}
      </SideDrawer>

      <MeetingsFormDrawer
        open={meetingDrawerOpen}
        onOpenChange={setMeetingDrawerOpen}
        meetingId={selectedMeetingId}
        mode={meetingDrawerMode}
        onSuccess={() => mutateMeetings()}
        onDelete={() => mutateMeetings()}
        onModeChange={setMeetingDrawerMode}
        initialLeadId={leadIdNum}
      />

      <SendSMSDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        target={lead.phone ? { leadId: lead.id, phone: lead.phone, name: lead.name } : null}
      />

      <LeadWhatsAppDrawer
        open={whatsappDrawerOpen}
        onOpenChange={setWhatsappDrawerOpen}
        onBack={() => setWhatsappDrawerOpen(false)}
        leadId={lead.id}
        leadName={lead.name}
        leadPhone={lead.phone}
      />
    </Tabs>
  );
};

export default LeadDetailsPage;
