// ==================== SCHEDULING DASHBOARD ====================
// Dashboard component for scheduling overview with stats and health status

import React, { useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useScheduling } from '@/hooks/useScheduling';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { ScheduledEventsList } from './ScheduledEventsList';
import { ReminderConfigManager } from './ReminderConfigForm';
import type { QueueStats, HealthStatus } from '@/types/scheduling.types';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  Activity,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Settings,
} from 'lucide-react';

// ==================== STAT CARD ====================

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  loading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

function StatCard({ title, value, icon, description, loading, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 dark:bg-green-950/30',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30',
    error: 'bg-red-50 dark:bg-red-950/30',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={iconStyles[variant]}>{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

// ==================== QUEUE STATS ====================

interface QueueStatsDisplayProps {
  stats: QueueStats | null;
  loading: boolean;
}

function QueueStatsDisplay({ stats, loading }: QueueStatsDisplayProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Scheduled"
        value={stats?.scheduled ?? 0}
        icon={<Clock className="h-4 w-4" />}
        description="Messages pending"
        loading={loading}
      />
      <StatCard
        title="Sent"
        value={stats?.sent ?? 0}
        icon={<CheckCircle className="h-4 w-4" />}
        description="Successfully delivered"
        loading={loading}
        variant="success"
      />
      <StatCard
        title="Failed"
        value={stats?.failed ?? 0}
        icon={<XCircle className="h-4 w-4" />}
        description="Delivery failed"
        loading={loading}
        variant={stats?.failed && stats.failed > 0 ? 'error' : 'default'}
      />
      <StatCard
        title="Cancelled"
        value={stats?.cancelled ?? 0}
        icon={<Ban className="h-4 w-4" />}
        description="Manually cancelled"
        loading={loading}
      />
    </div>
  );
}

// ==================== HEALTH STATUS ====================

interface HealthStatusDisplayProps {
  health: HealthStatus | null;
  loading: boolean;
}

function HealthStatusDisplay({ health, loading }: HealthStatusDisplayProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-24" />
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    healthy: {
      label: 'Healthy',
      variant: 'default' as const,
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      description: 'All systems operational',
    },
    degraded: {
      label: 'Degraded',
      variant: 'secondary' as const,
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
      description: 'Some systems may be slow',
    },
    unhealthy: {
      label: 'Unhealthy',
      variant: 'destructive' as const,
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      description: 'System issues detected',
    },
  };

  const config = statusConfig[health?.status || 'healthy'];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">System Health</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {config.icon}
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {health?.message || config.description}
        </p>
        {health?.queue_size !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            Queue size: {health.queue_size} | Processing rate: {health.processing_rate || 0}/min
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== MAIN COMPONENT ====================

interface SchedulingDashboardProps {
  className?: string;
  defaultTab?: 'messages' | 'events' | 'configs';
}

export function SchedulingDashboard({
  className,
  defaultTab = 'messages',
}: SchedulingDashboardProps) {
  const {
    getQueueStats,
    getHealth,
    queueStats,
    healthStatus,
    loading,
    isVendorConfigured,
  } = useScheduling();

  // Fetch stats and health on mount
  useEffect(() => {
    if (isVendorConfigured) {
      getQueueStats();
      getHealth();
    }
  }, [isVendorConfigured, getQueueStats, getHealth]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    getQueueStats();
    getHealth();
  }, [getQueueStats, getHealth]);

  if (!isVendorConfigured) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">WhatsApp Not Configured</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Please configure your WhatsApp vendor settings in Admin Settings to use the scheduling
            features.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Message Scheduling</h1>
          <p className="text-muted-foreground">
            Schedule and manage WhatsApp messages and reminders
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="space-y-4 mb-6">
        <QueueStatsDisplay stats={queueStats} loading={loading && !queueStats} />
        <div className="grid gap-4 md:grid-cols-2">
          <HealthStatusDisplay health={healthStatus} loading={loading && !healthStatus} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading && !queueStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{queueStats?.total ?? 0}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">All time messages processed</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Calendar className="h-4 w-4" />
            Events
          </TabsTrigger>
          <TabsTrigger value="configs" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <ScheduledMessagesList />
        </TabsContent>

        <TabsContent value="events">
          <ScheduledEventsList />
        </TabsContent>

        <TabsContent value="configs">
          <ReminderConfigManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SchedulingDashboard;
