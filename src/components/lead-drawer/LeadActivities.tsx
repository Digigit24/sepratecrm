// src/components/lead-drawer/LeadActivities.tsx
import { useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  FileText,
  Smartphone,
  MoreHorizontal,
  Plus,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { LeadActivity, ActivityTypeEnum } from '@/types/crmTypes';
import ActivityFormDrawer from '@/components/ActivityFormDrawer';

interface LeadActivitiesProps {
  leadId: number;
}

export default function LeadActivities({ leadId }: LeadActivitiesProps) {
  const { useLeadActivities } = useCRM();
  const [showAll, setShowAll] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch activities for this lead
  const { data: activitiesData, isLoading, error, mutate: mutateActivities } = useLeadActivities({
    lead: leadId,
    ordering: '-happened_at',
    page_size: showAll ? 100 : 10,
  });

  // Handle add activity
  const handleAddActivity = () => {
    setDrawerOpen(true);
  };

  // Handle drawer success
  const handleDrawerSuccess = () => {
    mutateActivities();
  };

  // Activity type icon mapping
  const getActivityIcon = (type: ActivityTypeEnum) => {
    switch (type) {
      case 'CALL':
        return <Phone className="h-4 w-4" />;
      case 'EMAIL':
        return <Mail className="h-4 w-4" />;
      case 'MEETING':
        return <Calendar className="h-4 w-4" />;
      case 'NOTE':
        return <FileText className="h-4 w-4" />;
      case 'SMS':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Activity type color mapping
  const getActivityColor = (type: ActivityTypeEnum) => {
    switch (type) {
      case 'CALL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EMAIL':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'MEETING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'NOTE':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'SMS':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-destructive">Failed to load activities</p>
        <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  const activities = activitiesData?.results || [];
  const hasMore = (activitiesData?.count || 0) > activities.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Activity Timeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activitiesData?.count || 0} total activities
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleAddActivity}>
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      <Separator />

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">No activities yet</h3>
          <p className="text-xs text-muted-foreground">
            Start tracking interactions with this lead
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={activity.id}>
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getActivityColor(
                        activity.type
                      )}`}
                    >
                      {getActivityIcon(activity.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={getActivityColor(activity.type)}
                            >
                              {activity.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(activity.happened_at), 'PPp')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Activity Content */}
                      {activity.content && (
                        <p className="text-sm text-foreground whitespace-pre-wrap mt-2">
                          {activity.content}
                        </p>
                      )}

                      {/* File */}
                      {activity.file_url && (
                        <a
                          href={activity.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-2 inline-block"
                        >
                          View attachment
                        </a>
                      )}

                      {/* Meta */}
                      {activity.meta && Object.keys(activity.meta).length > 0 && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(activity.meta, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                        {activity.by_user_id && (
                          <span>by {activity.by_user_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Separator between activities */}
                {index < activities.length - 1 && (
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-dashed" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Load More */}
          {hasMore && !showAll && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(true)}
              >
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Load more activities
              </Button>
            </div>
          )}
        </ScrollArea>
      )}

      {/* Activity Form Drawer */}
      <ActivityFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        leadId={leadId}
        onSuccess={handleDrawerSuccess}
      />
    </div>
  );
}