// src/pages/Meetings.tsx
import React, { useState } from 'react';
import { useMeeting } from '@/hooks/useMeeting';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import MeetingsFormDrawer from '@/components/MeetingsFormDrawer';
import {
  Loader2,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  CalendarCheck,
  CalendarClock,
} from 'lucide-react';
import { Meeting, MeetingListParams } from '@/types/meeting.types';
import { format, isPast, isFuture, isToday } from 'date-fns';

export const Meetings: React.FC = () => {
  const { user, hasModuleAccess } = useAuth();
  const {
    hasCRMAccess,
    useMeetings,
    deleteMeeting,
  } = useMeeting();

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past' | 'today'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Build query params based on filters
  const buildQueryParams = (): MeetingListParams => {
    const params: MeetingListParams = {
      page: currentPage,
      search: searchTerm || undefined,
      ordering: 'start_at', // Default ordering by start time
    };

    // Add time-based filters
    const now = new Date().toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString();

    if (timeFilter === 'upcoming') {
      params.start_at__gte = now;
    } else if (timeFilter === 'past') {
      params.end_at__lte = now;
      params.ordering = '-start_at'; // Most recent first
    } else if (timeFilter === 'today') {
      params.start_at__gte = todayStart;
      params.start_at__lte = todayEnd;
    }

    return params;
  };

  const queryParams = buildQueryParams();

  // Fetch meetings
  const {
    data: meetingsData,
    error: meetingsError,
    isLoading: meetingsLoading,
    mutate: mutateMeetings
  } = useMeetings(queryParams);

  const meetings = meetingsData?.results || [];
  const totalCount = meetingsData?.count || 0;
  const hasNext = !!meetingsData?.next;
  const hasPrevious = !!meetingsData?.previous;

  // Calculate statistics
  const upcomingCount = meetings.filter(m => isFuture(new Date(m.start_at))).length;
  const todayCount = meetings.filter(m => isToday(new Date(m.start_at))).length;
  const pastCount = meetings.filter(m => isPast(new Date(m.end_at))).length;

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page
  };

  const handleTimeFilter = (filter: 'all' | 'upcoming' | 'past' | 'today') => {
    setTimeFilter(filter);
    setCurrentPage(1);
  };

  const handleView = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleEdit = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedMeetingId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleDelete = async (meeting: Meeting) => {
    try {
      await deleteMeeting(meeting.id);
      mutateMeetings();
    } catch (error: any) {
      // Delete failed
    }
  };

  const handleDrawerSuccess = () => {
    mutateMeetings();
  };

  const handleDrawerDelete = () => {
    mutateMeetings();
  };

  // Format date and time for display
  const formatMeetingTime = (startAt: string, endAt: string) => {
    try {
      const start = new Date(startAt);
      const end = new Date(endAt);
      const dateStr = format(start, 'MMM dd, yyyy');
      const timeStr = `${format(start, 'hh:mm a')} - ${format(end, 'hh:mm a')}`;
      return { dateStr, timeStr };
    } catch {
      return { dateStr: 'Invalid date', timeStr: 'Invalid time' };
    }
  };

  // Get meeting status badge
  const getMeetingStatusBadge = (meeting: Meeting) => {
    const now = new Date();
    const start = new Date(meeting.start_at);
    const end = new Date(meeting.end_at);

    if (isPast(end)) {
      return <Badge variant="secondary" className="bg-gray-600">Completed</Badge>;
    } else if (now >= start && now <= end) {
      return <Badge variant="default" className="bg-green-600">In Progress</Badge>;
    } else if (isToday(start)) {
      return <Badge variant="default" className="bg-blue-600">Today</Badge>;
    } else if (isFuture(start)) {
      return <Badge variant="default" className="bg-purple-600">Upcoming</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  // DataTable columns configuration
  const columns: DataTableColumn<Meeting>[] = [
    {
      header: 'Meeting',
      key: 'title',
      cell: (meeting) => {
        const { dateStr, timeStr } = formatMeetingTime(meeting.start_at, meeting.end_at);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{meeting.title}</span>
            <span className="text-xs text-muted-foreground">
              {dateStr} • {timeStr}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Lead',
      key: 'lead',
      cell: (meeting) => (
        <div className="flex flex-col">
          <span className="font-medium">{meeting.lead_name || 'No lead'}</span>
          {meeting.lead && (
            <span className="text-xs text-muted-foreground">ID: {meeting.lead}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Location',
      key: 'location',
      cell: (meeting) => (
        <div className="flex items-center gap-2 text-sm">
          {meeting.location ? (
            <>
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[200px]">{meeting.location}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Not specified</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (meeting) => getMeetingStatusBadge(meeting),
    },
    {
      header: 'Duration',
      key: 'duration',
      cell: (meeting) => {
        try {
          const start = new Date(meeting.start_at);
          const end = new Date(meeting.end_at);
          const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          return (
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{durationMinutes} min</span>
            </div>
          );
        } catch {
          return <span className="text-muted-foreground">-</span>;
        }
      },
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (meeting: Meeting, actions: any) => {
    const { dateStr, timeStr } = formatMeetingTime(meeting.start_at, meeting.end_at);

    return (
      <>
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{meeting.title}</h3>
            <p className="text-xs text-muted-foreground">
              {dateStr} • {timeStr}
            </p>
          </div>
          {getMeetingStatusBadge(meeting)}
        </div>

        {/* Lead & Location */}
        <div className="space-y-1">
          <div className="text-sm">
            <span className="text-muted-foreground">Lead: </span>
            <span className="font-medium">{meeting.lead_name || 'No lead'}</span>
          </div>
          {meeting.location && (
            <div className="text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{meeting.location}</span>
            </div>
          )}
        </div>

        {/* Description preview */}
        {meeting.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meeting.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {actions.view && (
            <Button size="sm" variant="outline" onClick={actions.view} className="flex-1">
              View
            </Button>
          )}
          {actions.edit && (
            <Button size="sm" variant="outline" onClick={actions.edit} className="flex-1">
              Edit
            </Button>
          )}
          {actions.askDelete && (
            <Button size="sm" variant="destructive" onClick={actions.askDelete}>
              Delete
            </Button>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header with inline search and filters */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Meetings</h1>
          <span className="text-xs text-muted-foreground">{totalCount} total</span>
        </div>
        <Button onClick={handleCreate} size="sm" className="h-7 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Meeting
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search meetings..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-8 h-7 text-xs"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={timeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleTimeFilter('all')}
          >
            All
          </Button>
          <Button
            variant={timeFilter === 'upcoming' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleTimeFilter('upcoming')}
          >
            Upcoming
          </Button>
          <Button
            variant={timeFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleTimeFilter('today')}
          >
            Today
          </Button>
          <Button
            variant={timeFilter === 'past' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleTimeFilter('past')}
          >
            Past
          </Button>
        </div>
        {meetingsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Meetings Table */}
      <div className="border rounded-lg overflow-hidden">
        {meetingsError ? (
          <div className="p-8 text-center">
            <p className="text-destructive">{meetingsError.message}</p>
          </div>
        ) : (
          <>
            <DataTable
              rows={meetings}
              isLoading={meetingsLoading}
              columns={columns}
              renderMobileCard={renderMobileCard}
              getRowId={(meeting) => meeting.id}
              getRowLabel={(meeting) => meeting.title}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              emptyTitle="No meetings found"
              emptySubtitle="Try adjusting your search or filters, or create a new meeting"
            />

            {/* Pagination */}
            {!meetingsLoading && meetings.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  {meetings.length} of {totalCount}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    disabled={!hasPrevious}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    disabled={!hasNext}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer */}
      <MeetingsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        meetingId={selectedMeetingId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={handleDrawerDelete}
        onModeChange={setDrawerMode}
      />
    </div>
  );
};

export default Meetings;
