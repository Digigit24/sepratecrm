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
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CheckSquare className="h-6 w-6 sm:h-8 sm:w-8" />
            CRM Tasks
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage and track your CRM tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9 w-9"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => handleCreate()} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {tasksData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Tasks</p>
                  <p className="text-xl sm:text-2xl font-bold">{tasksData.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <List className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">To Do</p>
                  <p className="text-xl sm:text-2xl font-bold">{todoCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
                  <p className="text-xl sm:text-2xl font-bold">{inProgressCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CircleCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Done</p>
                  <p className="text-xl sm:text-2xl font-bold">{doneCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Mode Toggle */}
      <Card>
        <CardContent className="p-4">
          <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Kanban Board
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <Card>
          <CardContent className="p-4">
            <TaskKanbanBoard
              tasks={tasks}
              onViewTask={handleView}
              onEditTask={handleEdit}
              onCreateTask={handleCreate}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
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
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {tasks.length} of {tasksData.count} task(s)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!tasksData.previous}
                        onClick={() =>
                          setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                        }
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
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
          </CardContent>
        </Card>
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