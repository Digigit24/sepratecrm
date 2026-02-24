// src/pages/CRMTasks.tsx
import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { TaskKanbanBoard } from '@/components/TaskKanbanBoard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, CheckSquare, LayoutGrid, List, Clock, CircleCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import type {
  Task,
  TasksQueryParams,
  TaskStatusEnum,
  PriorityEnum,
} from '@/types/crmTypes';
import TasksFormDrawer from '@/components/TasksFormDrawer';

type ViewMode = 'list' | 'kanban';

export const CRMTasks: React.FC = () => {
  const { user } = useAuth();
  const { hasCRMAccess, useTasks, patchTask, deleteTask } = useCRM();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Query parameters state
  const [queryParams, setQueryParams] = useState<TasksQueryParams>({
    page: 1,
    page_size: viewMode === 'kanban' ? 1000 : 20,
    ordering: '-created_at',
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Fetch tasks
  const { data: tasksData, error, isLoading, mutate } = useTasks(queryParams);

  const tasks = tasksData?.results || [];

  // Check access
  if (!hasCRMAccess) {
    return (
      <div className="container mx-auto p-6">
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
  const handleView = (task: Task) => {
    setSelectedTaskId(task.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleEdit = (task: Task) => {
    setSelectedTaskId(task.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleCreate = (status?: TaskStatusEnum) => {
    setSelectedTaskId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleDelete = async (task: Task) => {
    try {
      await deleteTask(task.id);
      mutate();
    } catch (error: any) {
      console.error('Delete failed:', error);
    }
  };

  const handleDrawerSuccess = () => {
    mutate();
  };

  const handleDrawerDelete = () => {
    mutate();
  };

  const handleUpdateTaskStatus = useCallback(
    async (taskId: number, newStatus: TaskStatusEnum) => {
      const currentData = tasksData;
      if (!currentData) {
        throw new Error('No tasks data available');
      }

      // Optimistic update
      const optimisticData = {
        ...currentData,
        results: currentData.results.map((t) =>
          t.id === taskId
            ? { ...t, status: newStatus, updated_at: new Date().toISOString() }
            : t
        ),
      };

      try {
        await mutate(optimisticData, false);
        await patchTask(taskId, { status: newStatus });
        await mutate();
      } catch (error: any) {
        await mutate();
        throw new Error(error?.message || 'Failed to update task status');
      }
    },
    [patchTask, mutate, tasksData]
  );

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    setQueryParams((prev) => ({
      ...prev,
      page: 1,
      page_size: newMode === 'kanban' ? 1000 : 20,
    }));
  }, []);

  // Compute stats from all tasks
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  // Get status badge variant
  const getStatusBadge = (status: TaskStatusEnum) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      TODO: { label: 'To Do', className: 'bg-gray-100 text-gray-700 border-gray-200' },
      IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      DONE: { label: 'Done', className: 'bg-green-100 text-green-700 border-green-200' },
      CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border-red-200' },
    };
    const config = statusConfig[status] || { label: status, className: '' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  // Get priority badge variant
  const getPriorityBadge = (priority: PriorityEnum) => {
    const priorityConfig: Record<string, { label: string; className: string }> = {
      LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700 border-gray-200' },
      MEDIUM: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      HIGH: { label: 'High', className: 'bg-red-100 text-red-800 border-red-200' },
    };
    const config = priorityConfig[priority] || { label: priority, className: '' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  // Define table columns
  const columns: DataTableColumn<Task>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (task) => (
        <div className="font-medium">{task.title}</div>
      ),
    },
    {
      key: 'lead_name',
      header: 'Lead',
      cell: (task) => (
        <div className="text-sm">
          {task.lead_name || '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (task) => getStatusBadge(task.status),
    },
    {
      key: 'priority',
      header: 'Priority',
      cell: (task) => getPriorityBadge(task.priority),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      cell: (task) => (
        <div className="text-sm">
          {task.due_date ? (
            <>
              <div>{format(new Date(task.due_date), 'MMM dd, yyyy')}</div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
              </div>
            </>
          ) : (
            '-'
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (task) => (
        <div className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </div>
      ),
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (task: Task, actions: any) => {
    return (
      <>
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{task.title}</h3>
            <p className="text-sm text-muted-foreground truncate">{task.lead_name || 'No lead'}</p>
          </div>
          <div className="flex gap-1">
            {getStatusBadge(task.status)}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </div>
        )}

        {/* Info Row */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Priority</p>
            <div className="font-medium">{getPriorityBadge(task.priority)}</div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Due Date</p>
            <p className="font-medium">
              {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'Not set'}
            </p>
          </div>
        </div>

        {/* Created */}
        <div className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
        </div>

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
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Tasks</h1>
          {tasksData && (
            <span className="text-xs text-muted-foreground">{tasksData.count} total</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => mutate()}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => handleCreate()} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as ViewMode)}>
        <TabsList className="h-8">
          <TabsTrigger value="kanban" className="text-xs h-6 px-2.5 gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs h-6 px-2.5 gap-1.5">
            <List className="h-3.5 w-3.5" />
            List
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <div className="border rounded-lg overflow-hidden p-4">
          <TaskKanbanBoard
            tasks={tasks}
            onViewTask={handleView}
            onEditTask={handleEdit}
            onCreateTask={handleCreate}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {error ? (
            <div className="p-8 text-center">
              <div className="text-destructive">
                <p className="font-semibold">Failed to load tasks</p>
                <p className="text-sm mt-2">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <DataTable
                rows={tasks}
                isLoading={isLoading}
                columns={columns}
                renderMobileCard={renderMobileCard}
                getRowId={(task) => task.id}
                getRowLabel={(task) => task.title}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyTitle="No tasks found"
                emptySubtitle="Create a new task to get started"
              />

              {/* Pagination */}
              {!isLoading && tasksData && tasksData.count > 0 && (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    {tasks.length} of {tasksData.count}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      disabled={!tasksData.previous}
                      onClick={() =>
                        setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      disabled={!tasksData.next}
                      onClick={() =>
                        setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Drawer */}
      <TasksFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        taskId={selectedTaskId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={handleDrawerDelete}
        onModeChange={(newMode) => setDrawerMode(newMode)}
      />
    </div>
  );
};