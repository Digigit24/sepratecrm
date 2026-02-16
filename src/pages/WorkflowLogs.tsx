// src/pages/WorkflowLogs.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Calendar,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import type { ExecutionStatusEnum, ExecutionLog, ExecutionStep } from '@/types/integration.types';

export const WorkflowLogs = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<ExecutionStatusEnum | 'ALL'>('ALL');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const {
    useWorkflow,
    useExecutionLogs,
  } = useIntegrations();

  // Fetch workflow details
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(
    workflowId ? parseInt(workflowId) : undefined
  );

  // Fetch execution logs with filtering
  const { data: logsData, isLoading: logsLoading, mutate: refreshLogs } = useExecutionLogs(
    workflowId ? parseInt(workflowId) : undefined,
    {
      page: currentPage,
      page_size: 20,
      ...(selectedStatus !== 'ALL' && { status: selectedStatus }),
      ordering: '-started_at', // Most recent first
    }
  );

  const logs = logsData?.results || [];
  const totalPages = logsData?.count ? Math.ceil(logsData.count / 20) : 1;

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getStatusIcon = (status: ExecutionStatusEnum) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'SKIPPED':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: ExecutionStatusEnum) => {
    const variants: Record<ExecutionStatusEnum, string> = {
      SUCCESS: 'bg-green-100 text-green-800 border-green-300',
      FAILED: 'bg-red-100 text-red-800 border-red-300',
      RUNNING: 'bg-blue-100 text-blue-800 border-blue-300',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      SKIPPED: 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        <span className="flex items-center gap-1">
          {getStatusIcon(status)}
          {status}
        </span>
      </Badge>
    );
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    if (duration < 1) return `${Math.round(duration * 1000)}ms`;
    if (duration < 60) return `${duration.toFixed(2)}s`;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.round(duration % 60);
    return `${minutes}m ${seconds}s`;
  };

  const renderStepLog = (step: ExecutionStep, index: number) => {
    return (
      <div key={index} className="border-l-2 border-gray-200 pl-4 py-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(step.status)}
            <div>
              <div className="font-medium text-sm">
                Step {step.step_number}: {step.step_name}
              </div>
              <div className="text-xs text-muted-foreground">
                Duration: {formatDuration(step.duration)}
              </div>
            </div>
          </div>
          {getStatusBadge(step.status)}
        </div>

        {step.error_message && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            <div className="font-semibold">Error:</div>
            <div>{step.error_message}</div>
          </div>
        )}

        {step.input_data && Object.keys(step.input_data).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              View Input Data
            </summary>
            <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs overflow-x-auto">
              {JSON.stringify(step.input_data, null, 2)}
            </pre>
          </details>
        )}

        {step.output_data && Object.keys(step.output_data).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              View Output Data
            </summary>
            <pre className="mt-1 p-2 bg-gray-50 border rounded text-xs overflow-x-auto">
              {JSON.stringify(step.output_data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  const renderExecutionLog = (log: ExecutionLog) => {
    const isExpanded = expandedLogs.has(log.id);

    return (
      <Card key={log.id} className="mb-4">
        <CardHeader
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleLogExpansion(log.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="ghost" size="sm" className="p-0 h-auto">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Execution #{log.id}
                  </CardTitle>
                  {getStatusBadge(log.status)}
                </div>
                <CardDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(log.started_at), 'MMM dd, yyyy HH:mm:ss')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Duration: {formatDuration(log.duration)}
                  </span>
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Error Message */}
              {log.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="font-semibold text-sm text-red-900 mb-1">Error Message</div>
                  <div className="text-sm text-red-800">{log.error_message}</div>
                  {log.error_traceback && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-700 cursor-pointer hover:text-red-900">
                        View Traceback
                      </summary>
                      <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto text-red-900">
                        {log.error_traceback}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Execution Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Started At</div>
                  <div className="font-medium">
                    {format(new Date(log.started_at), 'MMM dd, yyyy HH:mm:ss')}
                  </div>
                </div>
                {log.completed_at && (
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Completed At</div>
                    <div className="font-medium">
                      {format(new Date(log.completed_at), 'MMM dd, yyyy HH:mm:ss')}
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Data */}
              {log.trigger_data && Object.keys(log.trigger_data).length > 0 && (
                <div>
                  <div className="font-semibold text-sm mb-2">Trigger Data</div>
                  <pre className="p-3 bg-gray-50 border rounded text-xs overflow-x-auto">
                    {JSON.stringify(log.trigger_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Result Data */}
              {log.result_data && Object.keys(log.result_data).length > 0 && (
                <div>
                  <div className="font-semibold text-sm mb-2">Result Data</div>
                  <pre className="p-3 bg-gray-50 border rounded text-xs overflow-x-auto">
                    {JSON.stringify(log.result_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Step Logs */}
              {log.steps_log && log.steps_log.length > 0 && (
                <div>
                  <div className="font-semibold text-sm mb-3">Execution Steps</div>
                  <div className="space-y-2">
                    {log.steps_log.map((step, index) => renderStepLog(step, index))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (workflowLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/integrations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflow Execution Logs</h1>
            {workflow && (
              <p className="text-muted-foreground mt-1">
                {workflow.name} - {workflow.description || 'No description'}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshLogs()}
            disabled={logsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="status-filter" className="text-sm mb-2 block">
                Status
              </Label>
              <Select
                value={selectedStatus}
                onValueChange={(value) => {
                  setSelectedStatus(value as ExecutionStatusEnum | 'ALL');
                  setCurrentPage(1); // Reset to first page on filter change
                }}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="RUNNING">Running</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SKIPPED">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Logs List */}
      <div className="mb-6">
        {logsLoading && currentPage === 1 ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Execution Logs</h3>
              <p className="text-muted-foreground">
                {selectedStatus !== 'ALL'
                  ? `No executions with status "${selectedStatus}" found.`
                  : 'This workflow has not been executed yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div>
            {logs.map((log) => renderExecutionLog(log))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1 || logsLoading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || logsLoading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
