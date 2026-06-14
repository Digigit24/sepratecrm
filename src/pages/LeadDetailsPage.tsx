// src/pages/LeadDetailsPage.tsx
// Premium Lead Detail Page — ElevenLabs-inspired clean modern UI
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Phone, Mail, Loader2, Calendar, Clock,
  MapPin, Plus, Check, Trash2, MessageSquare,
  MoreHorizontal, ChevronRight, Building2, User2, Star,
  Activity, Paperclip, PhoneCall, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isFuture, isToday } from 'date-fns';

import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { placeCall } from '@/lib/telephonyController';
import { SendSMSDialog } from '@/components/telephony/SendSMSDialog';
import { LeadTelephonyHistory } from '@/components/telephony/LeadTelephonyHistory';
import { useMeeting } from '@/hooks/useMeeting';
import LeadDetailsForm from '@/components/lead-drawer/LeadDetailsForm';
import LeadActivities from '@/components/lead-drawer/LeadActivities';
import LeadTasks from '@/components/lead-drawer/LeadTasks';
import MeetingsFormDrawer from '@/components/MeetingsFormDrawer';
import { LeadScoreSlider } from '@/components/crm/LeadScoreSlider';
import { LeadAttachments } from '@/components/crm/LeadAttachments';
import { LeadGroupPicker } from '@/components/crm/LeadGroupPicker';
import type { Lead, LeadStatus } from '@/types/crmTypes';
import type { Meeting } from '@/types/meeting.types';
import { LeadFormHandle } from '@/components/LeadsFormDrawer';
import { LeadWhatsAppDrawer, WhatsAppIcon, useLeadWhatsAppWindow } from '@/components/crm/LeadWhatsAppDrawer';
import { cn } from '@/lib/utils';

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
export const LeadDetailsPage = () => {
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
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  // WhatsApp drawer
  const [whatsappDrawerOpen, setWhatsappDrawerOpen] = useState(false);

  const { useLead, useLeadStatuses, updateLead, deleteLead, patchLead } = useCRM();
  const leadIdNum = leadId ? parseInt(leadId, 10) : null;
  const { useMeetingsByLead } = useMeeting();

  const { data: lead, error: leadError, isLoading: leadLoading, mutate: mutateLead } = useLead(leadIdNum);
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });
  const { data: meetingsData, isLoading: meetingsLoading, mutate: mutateMeetings } = useMeetingsByLead(leadIdNum);
  const meetings = meetingsData?.results || [];

  // WhatsApp 24h reply window status (shown in header)
  const { windowOpen: waWindowOpen } = useLeadWhatsAppWindow(leadIdNum, !!lead?.phone);

  const formRef = useRef<LeadFormHandle | null>(null);

  useEffect(() => {
    if (lead?.notes !== undefined) setNotes(lead.notes || '');
  }, [lead?.id]);

  const handleBack = useCallback(() => navigate('/crm/leads'), [navigate]);

  const handleSave = useCallback(async () => {
    if (!lead || !formRef.current) return;
    try {
      setIsSaving(true);
      const formValues = await formRef.current.getFormValues();
      if (!formValues) { toast.error('Please fill in all required fields'); return; }
      await updateLead(lead.id, { ...formValues, notes });
      await mutateLead();
      toast.success('Lead saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save lead');
    } finally {
      setIsSaving(false);
    }
  }, [lead, updateLead, mutateLead, notes]);

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
      navigate('/crm/leads');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  }, [lead, deleteLead, navigate]);

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
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col min-h-full bg-background">

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
                    style={{
                      backgroundColor: `${statusObj.color_hex || '#6b7280'}18`,
                      color: statusObj.color_hex || '#6b7280',
                      border: `1px solid ${statusObj.color_hex || '#6b7280'}30`,
                    }}
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
                    {lead.phone}
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

      {/* Overview */}
      <TabsContent value="overview" className="mt-0 flex-1 focus-visible:outline-none">
        <div className="px-5 py-4 max-w-2xl">
          {/* Properties — Notion-style rows */}
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

          {/* Notes */}
          <div className="pt-4 mt-2 border-t border-border/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Notes</span>
              {notesSaving
                ? <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-2.5 w-2.5 animate-spin" />Saving…</span>
                : notes ? <span className="text-[10px] text-muted-foreground/40">Auto-saved</span> : null
              }
            </div>
            <Textarea
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Write notes here…"
              className="w-full resize-none text-sm min-h-[120px] rounded-lg border-border/30 focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-muted-foreground/30 bg-transparent hover:bg-muted/20 transition-colors"
            />
          </div>
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
        leadId={lead.id}
        leadName={lead.name}
        leadPhone={lead.phone}
      />
    </Tabs>
  );
};

export default LeadDetailsPage;
