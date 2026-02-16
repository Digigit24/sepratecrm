// src/components/lead-drawer/LeadMeetings.tsx
import { useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Clock, MapPin, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isToday, isPast, isFuture, startOfDay } from 'date-fns';
import type { LeadActivity, ActivityTypeEnum } from '@/types/crmTypes';
import ActivityFormDrawer from '@/components/ActivityFormDrawer';

interface LeadMeetingsProps {
  leadId: number;
}

type MeetingGroup = {
  title: string;
  meetings: LeadActivity[];
  icon: React.ReactNode;
  color: string;
};

export const LeadMeetings: React.FC<LeadMeetingsProps> = ({ leadId }) => {
  const { useLeadActivities } = useCRM();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch activities for this lead - filter for MEETING type
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    mutate: mutateActivities,
  } = useLeadActivities({ lead: leadId, type: 'MEETING', ordering: '-happened_at' });

  const meetings = activitiesData?.results || [];

  // Group meetings by time
  const groupedMeetings = useMemo<MeetingGroup[]>(() => {
    const now = new Date();
    const groups: MeetingGroup[] = [];

    const upcomingMeetings = meetings.filter(
      (meeting) =>
        meeting.happened_at &&
        isFuture(parseISO(meeting.happened_at))
    );

    const todayMeetings = meetings.filter(
      (meeting) => meeting.happened_at && isToday(parseISO(meeting.happened_at))
    );

    const pastMeetings = meetings.filter(
      (meeting) =>
        meeting.happened_at &&
        isPast(parseISO(meeting.happened_at)) &&
        !isToday(parseISO(meeting.happened_at))
    );

    if (upcomingMeetings.length > 0) {
      groups.push({
        title: 'Upcoming',
        meetings: upcomingMeetings,
        icon: <Calendar className="h-4 w-4" />,
        color: 'text-blue-600',
      });
    }

    if (todayMeetings.length > 0) {
      groups.push({
        title: 'Today',
        meetings: todayMeetings,
        icon: <Clock className="h-4 w-4" />,
        color: 'text-green-600',
      });
    }

    if (pastMeetings.length > 0) {
      groups.push({
        title: 'Past',
        meetings: pastMeetings,
        icon: <Calendar className="h-4 w-4" />,
        color: 'text-gray-600',
      });
    }

    return groups;
  }, [meetings]);

  // Handle create meeting button
  const handleCreateClick = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  // Handle drawer success
  const handleDrawerSuccess = useCallback(() => {
    mutateActivities();
  }, [mutateActivities]);

  // Format meeting time
  const formatMeetingTime = (happenedAt: string) => {
    try {
      const date = parseISO(happenedAt);
      if (isToday(date)) {
        return format(date, 'h:mm a');
      }
      return format(date, 'MMM dd, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Meeting Button */}
      <div className="flex justify-end">
        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Meetings List */}
      {activitiesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No meetings scheduled for this lead</p>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule your first meeting using the button above
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedMeetings.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <span className={group.color}>{group.icon}</span>
                  <CardTitle className={`text-lg ${group.color}`}>
                    {group.title} ({group.meetings.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-start gap-3 p-4 border rounded-lg"
                  >
                    <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium">
                            {meeting.content || 'Meeting'}
                          </h4>

                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatMeetingTime(meeting.happened_at)}</span>
                          </div>

                          {meeting.meta?.location && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{meeting.meta.location}</span>
                            </div>
                          )}

                          {meeting.meta?.attendees && (
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{meeting.meta.attendees} attendees</span>
                            </div>
                          )}
                        </div>

                        <span className={`text-xs px-2 py-1 rounded-full ${
                          isFuture(parseISO(meeting.happened_at))
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {isFuture(parseISO(meeting.happened_at)) ? 'Scheduled' : 'Completed'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Activity Form Drawer */}
      <ActivityFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        leadId={leadId}
        onSuccess={handleDrawerSuccess}
        defaultType="MEETING"
      />
    </div>
  );
};

export default LeadMeetings;
