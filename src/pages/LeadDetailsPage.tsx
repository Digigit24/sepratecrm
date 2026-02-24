// src/pages/LeadDetailsPage.tsx
import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, Pencil, Trash2, Phone, Mail, Loader2, MapPin, Calendar, Clock,
  Building2, User, X, Check, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isFuture, isToday } from 'date-fns';

import { useCRM } from '@/hooks/useCRM';
import { useMeeting } from '@/hooks/useMeeting';
import LeadDetailsForm from '@/components/lead-drawer/LeadDetailsForm';
import LeadActivities from '@/components/lead-drawer/LeadActivities';
import LeadTasks from '@/components/lead-drawer/LeadTasks';
import MeetingsFormDrawer from '@/components/MeetingsFormDrawer';
import { LeadScoreSlider } from '@/components/crm/LeadScoreSlider';
import type { Lead, LeadStatus } from '@/types/crmTypes';
import type { Meeting } from '@/types/meeting.types';
import { LeadFormHandle } from '@/components/LeadsFormDrawer';

export const LeadDetailsPage = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Meeting drawer state
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [meetingDrawerMode, setMeetingDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Hooks
  const { useLead, useLeadStatuses, updateLead, deleteLead, patchLead } = useCRM();
  const { useMeetingsByLead } = useMeeting();

  // Parse leadId to number
  const leadIdNum = leadId ? parseInt(leadId, 10) : null;

  // Fetch lead data
  const {
    data: lead,
    error: leadError,
    isLoading: leadLoading,
    mutate: mutateLead
  } = useLead(leadIdNum);

  // Fetch lead statuses
  const { data: statusesData } = useLeadStatuses({
    page_size: 100,
    ordering: 'order_index',
    is_active: true
  });

  // Fetch meetings for this lead
  const {
    data: meetingsData,
    isLoading: meetingsLoading,
    mutate: mutateMeetings
  } = useMeetingsByLead(leadIdNum);
  const meetings = meetingsData?.results || [];

  // Form ref
  const formRef = useRef<LeadFormHandle | null>(null);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/crm/leads');
  }, [navigate]);

  // Handle edit mode toggle
  const handleEditToggle = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!lead || !formRef.current) return;

    try {
      setIsSaving(true);
      const formValues = await formRef.current.getFormValues();

      if (!formValues) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Check if status changed to won
      const oldStatusId = typeof lead.status === 'number' ? lead.status : lead.status?.id;
      const newStatusId = formValues.status;
      const statusChanged = oldStatusId !== newStatusId;

      let isWonStatus = false;
      if (statusChanged && newStatusId) {
        const newStatus = statusesData?.results.find(s => s.id === newStatusId);
        isWonStatus = newStatus?.is_won === true;
      }

      await updateLead(lead.id, formValues);
      await mutateLead();
      toast.success('Lead updated successfully');
      setIsEditing(false);

      if (isWonStatus) {
        toast.success('Lead marked as won!', { duration: 3000 });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update lead');
    } finally {
      setIsSaving(false);
    }
  }, [lead, updateLead, mutateLead, statusesData]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!lead) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${lead.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteLead(lead.id);
      toast.success('Lead deleted successfully');
      navigate('/crm/leads');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete lead');
    } finally {
      setIsDeleting(false);
    }
  }, [lead, deleteLead, navigate]);

  // Handle call
  const handleCall = useCallback(() => {
    if (lead?.phone) window.location.href = `tel:${lead.phone}`;
  }, [lead]);

  // Handle email
  const handleEmail = useCallback(() => {
    if (lead?.email) window.location.href = `mailto:${lead.email}`;
  }, [lead]);

  // Handle schedule meeting
  const handleScheduleMeeting = useCallback(() => {
    setSelectedMeetingId(null);
    setMeetingDrawerMode('create');
    setMeetingDrawerOpen(true);
  }, []);

  // Handle meeting drawer callbacks
  const handleMeetingSuccess = useCallback(() => { mutateMeetings(); }, [mutateMeetings]);
  const handleMeetingDelete = useCallback(() => { mutateMeetings(); }, [mutateMeetings]);
  const handleMeetingClick = useCallback((meetingId: number) => {
    setSelectedMeetingId(meetingId);
    setMeetingDrawerMode('view');
    setMeetingDrawerOpen(true);
  }, []);

  // Handle lead score update
  const handleUpdateLeadScore = useCallback(async (score: number) => {
    if (!lead) return;
    try {
      await patchLead(lead.id, { lead_score: score });
      await mutateLead();
      toast.success('Lead score updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update lead score');
      throw error;
    }
  }, [lead, patchLead, mutateLead]);

  // Get status badge
  const getStatusBadge = (status?: LeadStatus | number) => {
    if (!status) return null;
    let statusObj: LeadStatus | undefined;
    if (typeof status === 'number') {
      statusObj = statusesData?.results.find(s => s.id === status);
    } else {
      statusObj = status;
    }
    if (!statusObj) return null;
    const bgColor = statusObj.color_hex || '#6B7280';
    return (
      <Badge
        variant="outline"
        className="text-[11px] px-1.5 py-0 h-5 font-medium"
        style={{
          backgroundColor: `${bgColor}20`,
          borderColor: bgColor,
          color: bgColor,
        }}
      >
        {statusObj.name}
      </Badge>
    );
  };

  // Priority badge
  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      HIGH: 'bg-red-50 text-red-700 border-red-200',
      MEDIUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      LOW: 'bg-green-50 text-green-700 border-green-200',
    };
    return (
      <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-5 font-medium ${colors[priority] || ''}`}>
        {priority}
      </Badge>
    );
  };

  // Get meeting status badge
  const getMeetingStatusBadge = (meeting: Meeting) => {
    const start = new Date(meeting.start_at);
    const end = new Date(meeting.end_at);
    const now = new Date();

    if (isPast(end)) {
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-600 border-gray-200">Completed</Badge>;
    } else if (now >= start && now <= end) {
      return <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-green-200">In Progress</Badge>;
    } else if (isToday(start)) {
      return <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-blue-200">Today</Badge>;
    } else if (isFuture(start)) {
      return <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-purple-200">Upcoming</Badge>;
    }
    return null;
  };

  // Format meeting time
  const formatMeetingTime = (startAt: string, endAt: string) => {
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      return `${format(start, 'MMM dd')} · ${format(start, 'hh:mm a')} – ${format(end, 'hh:mm a')}`;
    } catch {
      return 'Invalid date';
    }
  };

  // Loading state
  if (leadLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (leadError || !lead) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center min-h-[200px] space-y-3">
          <p className="text-sm text-destructive">
            {leadError ? 'Failed to load lead details' : 'Lead not found'}
          </p>
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 mt-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="min-w-0">
            {/* Name + Status + Priority */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold truncate">{lead.name}</h1>
              {getStatusBadge(lead.status)}
              {getPriorityBadge(lead.priority)}
            </div>

            {/* Contact info chips */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </span>
              )}
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </span>
              )}
              {lead.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {lead.company}
                </span>
              )}
              {lead.title && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {lead.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {!isEditing ? (
            <>
              <LeadScoreSlider
                score={lead.lead_score || 0}
                onSave={handleUpdateLeadScore}
                leadName={lead.name}
                size="sm"
              />

              {lead.phone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleCall} variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Call</p></TooltipContent>
                </Tooltip>
              )}
              {lead.email && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleEmail} variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Email</p></TooltipContent>
                </Tooltip>
              )}

              <div className="w-px h-5 bg-border/60 mx-0.5" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleEditToggle} variant="ghost" size="icon" className="h-7 w-7">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Edit</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleDelete}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Delete</p></TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Button onClick={handleEditToggle} variant="ghost" size="sm" className="h-7 text-xs px-2">
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm" className="h-7 text-xs px-2.5" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-8 bg-muted/50 p-0.5 gap-0.5">
          <TabsTrigger value="details" className="h-7 text-xs px-3 data-[state=active]:shadow-sm">Details</TabsTrigger>
          <TabsTrigger value="activities" className="h-7 text-xs px-3 data-[state=active]:shadow-sm">Activities</TabsTrigger>
          <TabsTrigger value="tasks" className="h-7 text-xs px-3 data-[state=active]:shadow-sm">Tasks</TabsTrigger>
          <TabsTrigger value="meetings" className="h-7 text-xs px-3 data-[state=active]:shadow-sm">
            Meetings
            {meetings.length > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-px">
                {meetings.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Lead Details Tab */}
        <TabsContent value="details" className="mt-3">
          <div className="border rounded-lg p-4 bg-card">
            <LeadDetailsForm
              lead={lead}
              mode={isEditing ? 'edit' : 'view'}
              ref={(ref) => {
                if (ref && 'getFormValues' in ref) {
                  // @ts-ignore
                  formRef.current = ref;
                }
              }}
            />
          </div>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="mt-3">
          <div className="border rounded-lg p-4 bg-card">
            <LeadActivities leadId={lead.id} />
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-3">
          <LeadTasks leadId={lead.id} />
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="mt-3">
          {/* Meetings header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={handleScheduleMeeting} size="sm" className="h-7 text-xs px-2.5">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Schedule
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
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Schedule First Meeting
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg bg-card divide-y divide-border/50">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleMeetingClick(meeting.id)}
                >
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
                          <MapPin className="h-3 w-3 shrink-0" />
                          {meeting.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Meeting Drawer */}
      <MeetingsFormDrawer
        open={meetingDrawerOpen}
        onOpenChange={setMeetingDrawerOpen}
        meetingId={selectedMeetingId}
        mode={meetingDrawerMode}
        onSuccess={handleMeetingSuccess}
        onDelete={handleMeetingDelete}
        onModeChange={setMeetingDrawerMode}
        initialLeadId={leadIdNum}
      />
    </div>
  );
};

export default LeadDetailsPage;
