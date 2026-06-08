// src/pages/LeadDetailsPage.tsx
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
import type { Lead, LeadStatus } from '@/types/crmTypes';
import type { Meeting } from '@/types/meeting.types';
import { LeadFormHandle } from '@/components/LeadsFormDrawer';

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

  const { useLead, useLeadStatuses, updateLead, deleteLead, patchLead } = useCRM();
  const { useMeetingsByLead } = useMeeting();

  const leadIdNum = leadId ? parseInt(leadId, 10) : null;

  const { data: lead, error: leadError, isLoading: leadLoading, mutate: mutateLead } = useLead(leadIdNum);
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });
  const { data: meetingsData, isLoading: meetingsLoading, mutate: mutateMeetings } = useMeetingsByLead(leadIdNum);
  const meetings = meetingsData?.results || [];

  const formRef = useRef<LeadFormHandle | null>(null);

  // Sync notes state when lead loads
  useEffect(() => {
    if (lead?.notes !== undefined) setNotes(lead.notes || '');
  }, [lead?.id]);

  const handleBack = useCallback(() => navigate('/crm/leads'), [navigate]);

  // Save all properties
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

  // Auto-save notes with debounce
  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      if (!lead) return;
      try {
        setNotesSaving(true);
        await patchLead(lead.id, { notes: value });
        await mutateLead();
      } catch {
        // silent fail — user can always use the main Save button
      } finally {
        setNotesSaving(false);
      }
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
  const handleEmail = useCallback(() => { if (lead?.email) window.location.href = `mailto:${lead.email}`; }, [lead]);

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

  const getStatusBadge = (status?: LeadStatus | number) => {
    if (!status) return null;
    const statusObj = typeof status === 'number'
      ? statusesData?.results.find(s => s.id === status)
      : status;
    if (!statusObj) return null;
    const c = statusObj.color_hex || '#6B7280';
    return (
      <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5 font-medium"
        style={{ backgroundColor: `${c}20`, borderColor: c, color: c }}>
        {statusObj.name}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-red-50 text-red-700 border-red-200',
      MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      LOW: 'bg-green-50 text-green-700 border-green-200',
    };
    return (
      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-5 font-medium ${colors[priority] || ''}`}>
        {priority.charAt(0) + priority.slice(1).toLowerCase()}
      </Badge>
    );
  };

  const getMeetingStatusBadge = (meeting: Meeting) => {
    const start = new Date(meeting.start_at), end = new Date(meeting.end_at), now = new Date();
    if (isPast(end)) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Completed</Badge>;
    if (now >= start && now <= end) return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700">In Progress</Badge>;
    if (isToday(start)) return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700">Today</Badge>;
    if (isFuture(start)) return <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700">Upcoming</Badge>;
    return null;
  };

  const formatMeetingTime = (startAt: string, endAt: string) => {
    try {
      const s = new Date(startAt), e = new Date(endAt);
      return `${format(s, 'MMM dd')} · ${format(s, 'hh:mm a')} – ${format(e, 'hh:mm a')}`;
    } catch { return 'Invalid date'; }
  };

  if (leadLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center min-h-[200px] space-y-3">
          <p className="text-sm text-destructive">{leadError ? 'Failed to load lead' : 'Lead not found'}</p>
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col min-h-full">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        {/* Row 1: back + name + actions */}
        <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button onClick={handleBack} variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-semibold truncate">{lead.name}</h1>
                {getStatusBadge(lead.status)}
                {getPriorityBadge(lead.priority)}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                {lead.email && <span className="flex items-center gap-1 truncate max-w-[200px]"><Mail className="h-3 w-3" />{lead.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <LeadScoreSlider score={lead.lead_score || 0} onSave={handleUpdateLeadScore} leadName={lead.name} size="sm" />

          {lead.phone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button onClick={handleCall} variant="ghost" size="icon"
                    className="h-7 w-7 text-green-600 hover:bg-green-50"
                    disabled={!telephonyEnabled} aria-label="Call lead">
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">{telephonyEnabled ? 'Call' : 'Telephony not enabled'}</p></TooltipContent>
            </Tooltip>
          )}
          {lead.phone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button onClick={() => setSmsDialogOpen(true)} variant="ghost" size="icon"
                    className="h-7 w-7 text-indigo-600 hover:bg-indigo-50"
                    disabled={!telephonyEnabled} aria-label="Send SMS to lead">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">{telephonyEnabled ? 'Send SMS' : 'Telephony not enabled'}</p></TooltipContent>
            </Tooltip>
          )}
          {lead.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleEmail} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50">
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p className="text-xs">Email</p></TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-4 bg-border/60 mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={handleDelete} variant="ghost" size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">Delete</p></TooltipContent>
          </Tooltip>

          <Button onClick={handleSave} size="sm" className="h-7 text-xs px-3 ml-1" disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          </div>
        </div>

        {/* Row 2: tab triggers flush left */}
        <div className="px-4 pb-0">
          <TabsList className="h-8 bg-transparent p-0 gap-0 rounded-none">
            {(['overview', 'activities', 'tasks', 'meetings', 'attachments', ...(telephonyEnabled ? ['calls'] : [])] as string[]).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="h-8 text-xs px-3 rounded-none capitalize border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-normal data-[state=active]:font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                {tab === 'meetings' && meetings.length > 0 ? (
                  <>Meetings <span className="ml-1 text-[10px] bg-muted rounded-full px-1.5 py-px">{meetings.length}</span></>
                ) : (
                  tab.charAt(0).toUpperCase() + tab.slice(1)
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {/* ── Overview: properties + notes ─────────────────────────── */}
      <TabsContent value="overview" className="mt-0 flex-1">
        <div className="px-4 pt-4 pb-2">
          <LeadDetailsForm
            lead={lead}
            mode="edit"
            showNotes={false}
            ref={r => {
              if (r && 'getFormValues' in r) {
                // @ts-ignore
                formRef.current = r;
              }
            }}
          />
        </div>

        <div className="mt-3 border-t">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</span>
            {notesSaving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
          </div>
          <Textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Write notes here… (auto-saved)"
            className="w-full resize-none border-0 border-t rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[200px] px-4 py-3"
          />
        </div>
      </TabsContent>

      {/* ── Tab content panels ───────────────────────────────────── */}
      <div className="px-4 pb-4">
        <TabsContent value="activities" className="mt-3">
          <div className="border rounded-lg p-4 bg-card">
            <LeadActivities leadId={lead.id} />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-3">
          <LeadTasks leadId={lead.id} />
        </TabsContent>

        <TabsContent value="attachments" className="mt-3">
          <LeadAttachments leadId={lead.id} />
        </TabsContent>

        {telephonyEnabled && (
          <TabsContent value="calls" className="mt-3">
            <LeadTelephonyHistory
              leadId={lead.id}
              leadName={lead.name}
              leadPhone={lead.phone}
              telephonyEnabled={telephonyEnabled}
              onRequireSetup={() => navigate('/admin/settings')}
            />
          </TabsContent>
        )}

        <TabsContent value="meetings" className="mt-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">{meetings.length} meeting{meetings.length !== 1 ? 's' : ''}</p>
            <Button onClick={handleScheduleMeeting} size="sm" className="h-7 text-xs px-2.5">
              <Plus className="h-3.5 w-3.5 mr-1" />Schedule
            </Button>
          </div>

          {meetingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-10 border rounded-lg bg-card">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No meetings scheduled</p>
              <Button onClick={handleScheduleMeeting} variant="outline" size="sm" className="mt-3 h-7 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />Schedule First Meeting
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg bg-card divide-y divide-border/50">
              {meetings.map(meeting => (
                <div key={meeting.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleMeetingClick(meeting.id)}>
                  <div className="h-7 w-7 rounded-md bg-muted/70 flex items-center justify-center shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{meeting.title}</span>
                      {getMeetingStatusBadge(meeting)}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatMeetingTime(meeting.start_at, meeting.end_at)}
                      </span>
                      {meeting.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />{meeting.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </div>

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
    </Tabs>
  );
};

export default LeadDetailsPage;
