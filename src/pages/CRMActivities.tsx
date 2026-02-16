// src/pages/CRMActivities.tsx
import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { ActivitiesFormDrawer } from '@/components/ActivitiesFormDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Phone, Mail, Calendar, FileText, Smartphone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import type { LeadActivity, LeadActivitiesQueryParams, ActivityTypeEnum } from '@/types/crmTypes';
import type { RowActions } from '@/components/DataTable';

type DrawerMode = 'view' | 'edit' | 'create';

export const CRMActivities: React.FC = () => {
  const { user } = useAuth();
  const { hasCRMAccess, useLeadActivities, deleteLeadActivity } = useCRM();

  // Query parameters state
  const [queryParams, setQueryParams] = useState<LeadActivitiesQueryParams>({
    page: 1,
    page_size: 20,
    ordering: '-happened_at',
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Fetch activities
  const { data: activitiesData, error, isLoading, mutate } = useLeadActivities(queryParams);

  // Check access
  if (!hasCRMAccess) {
    return (
      <div className="p-6 max-w-8xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
              <p className="text-gray-600">
                CRM module is not enabled for your account. Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handlers
  const handleCreateActivity = useCallback(() => {
    setSelectedActivityId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }, []);

  const handleViewActivity = useCallback((activity: LeadActivity) => {
    setSelectedActivityId(activity.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  }, []);

  const handleEditActivity = useCallback((activity: LeadActivity) => {
    setSelectedActivityId(activity.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  const handleDeleteActivity = useCallback(
    async (activity: LeadActivity) => {
      try {
        await deleteLeadActivity(activity.id);
        toast.success('Activity deleted successfully');
        mutate(); // Refresh the list
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete activity');
        throw error;
      }
    },
    [deleteLeadActivity, mutate]
  );

  const handleDrawerSuccess = useCallback(() => {
    mutate(); // Refresh the list
  }, [mutate]);

  const handleModeChange = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode);
  }, []);

  // Activity type icon helper
  const getActivityIcon = (type: ActivityTypeEnum) => {
    switch (type) {
      case 'CALL':
        return Phone;
      case 'EMAIL':
        return Mail;
      case 'MEETING':
        return Calendar;
      case 'NOTE':
        return FileText;
      case 'SMS':
        return Smartphone;
      default:
        return MessageSquare;
    }
  };

  // Activity type badge helper
  const getActivityBadge = (type: ActivityTypeEnum) => {
    const variants = {
      CALL: 'bg-blue-100 text-blue-800 border-blue-200',
      EMAIL: 'bg-purple-100 text-purple-800 border-purple-200',
      MEETING: 'bg-green-100 text-green-800 border-green-200',
      NOTE: 'bg-gray-100 text-gray-800 border-gray-200',
      SMS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      OTHER: 'bg-orange-100 text-orange-800 border-orange-200',
    };

    const Icon = getActivityIcon(type);

    return (
      <Badge variant="outline" className={variants[type]}>
        <Icon className="h-3 w-3 mr-1" />
        {type}
      </Badge>
    );
  };

  // Desktop table columns
  const columns: DataTableColumn<LeadActivity>[] = [
    {
      header: 'Type',
      key: 'type',
      cell: (activity) => getActivityBadge(activity.type),
      className: 'w-[140px]',
    },
    {
      header: 'Content',
      key: 'content',
      cell: (activity) => (
        <div className="flex flex-col max-w-md">
          <span className="text-sm line-clamp-2">
            {activity.content || <span className="text-muted-foreground italic">No content</span>}
          </span>
        </div>
      ),
    },
    {
      header: 'Lead ID',
      key: 'lead',
      cell: (activity) => (
        <span className="text-sm font-mono text-muted-foreground">
          #{activity.lead}
        </span>
      ),
      className: 'w-[100px]',
    },
    {
      header: 'Date',
      key: 'date',
      cell: (activity) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {format(new Date(activity.happened_at), 'MMM d, yyyy')}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(activity.happened_at), 'h:mm a')}
          </span>
        </div>
      ),
      className: 'w-[140px]',
    },
    {
      header: 'Created',
      key: 'created',
      cell: (activity) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </span>
      ),
      className: 'w-[140px]',
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (activity: LeadActivity, actions: RowActions<LeadActivity>) => (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {getActivityBadge(activity.type)}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Lead #{activity.lead}
        </span>
      </div>

      {/* Content */}
      {activity.content && (
        <div className="text-sm text-foreground line-clamp-3">
          {activity.content}
        </div>
      )}

      {/* Date & Time */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>{format(new Date(activity.happened_at), 'MMM d, yyyy')}</span>
        <span>•</span>
        <span>{format(new Date(activity.happened_at), 'h:mm a')}</span>
      </div>

      {/* File Attachment */}
      {activity.file_url && (
        <div className="text-xs text-primary">
          📎 Has attachment
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </span>
        <div className="flex gap-2">
          {actions.edit && (
            <Button variant="outline" size="sm" onClick={actions.edit}>
              Edit
            </Button>
          )}
          {actions.view && (
            <Button variant="default" size="sm" onClick={actions.view}>
              View
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">CRM Activities</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Track all lead interactions and communications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreateActivity} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {activitiesData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Activities</p>
                  <p className="text-xl sm:text-2xl font-bold">{activitiesData.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">This Page</p>
                  <p className="text-xl sm:text-2xl font-bold">{activitiesData.results.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Pages</p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {Math.ceil(activitiesData.count / (queryParams.page_size || 20))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Current Page</p>
                  <p className="text-xl sm:text-2xl font-bold">{queryParams.page || 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activities Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            rows={activitiesData?.results || []}
            isLoading={isLoading}
            columns={columns}
            renderMobileCard={renderMobileCard}
            getRowId={(activity) => activity.id}
            getRowLabel={(activity) => `${activity.type} activity`}
            onView={handleViewActivity}
            onEdit={handleEditActivity}
            onDelete={handleDeleteActivity}
            emptyTitle="No activities found"
            emptySubtitle="Get started by creating your first activity"
          />

          {/* Pagination */}
          {!isLoading && activitiesData && activitiesData.count > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {activitiesData.results.length} of {activitiesData.count} activit{activitiesData.count === 1 ? 'y' : 'ies'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activitiesData.previous}
                  onClick={() =>
                    setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!activitiesData.next}
                  onClick={() =>
                    setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Drawer */}
      <ActivitiesFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activityId={selectedActivityId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(id) => {
          // Already handled in handleDeleteActivity
        }}
        onModeChange={handleModeChange}
      />
    </div>
  );
};