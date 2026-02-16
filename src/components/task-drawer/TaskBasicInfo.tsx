// src/components/task-drawer/TaskBasicInfo.tsx
import { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { Task, CreateTaskPayload, UpdateTaskPayload, Lead, TaskStatusEnum, PriorityEnum } from '@/types/crmTypes';
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/types/crmTypes';
import { formatDistanceToNow, format } from 'date-fns';
import { useUsers } from '@/hooks/useUsers';

// Validation schemas
const createTaskSchema = z.object({
  lead: z.coerce.number().min(1, 'Lead is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional(),
  assignee_user_id: z.string().optional(),
  reporter_user_id: z.string().optional(),
});

const updateTaskSchema = z.object({
  lead: z.coerce.number().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  due_date: z.string().optional(),
  assignee_user_id: z.string().optional(),
  reporter_user_id: z.string().optional(),
});

type TaskFormData = z.infer<typeof createTaskSchema> | z.infer<typeof updateTaskSchema>;

export interface TaskBasicInfoHandle {
  getFormValues: () => Promise<CreateTaskPayload | UpdateTaskPayload | null>;
}

interface TaskBasicInfoProps {
  task?: Task | null;
  leads: Lead[];
  mode: 'view' | 'edit' | 'create';
  onSuccess?: () => void;
}

const TaskBasicInfo = forwardRef<TaskBasicInfoHandle, TaskBasicInfoProps>(
  ({ task, leads, mode, onSuccess }, ref) => {
    const isReadOnly = mode === 'view';
    const isCreateMode = mode === 'create';

    const schema = isCreateMode ? createTaskSchema : updateTaskSchema;

    // Fetch users for assignee and reporter dropdowns
    const { useUsersList } = useUsers();
    const { data: usersData, isLoading: usersLoading } = useUsersList({
      page: 1,
      page_size: 1000,
      is_active: true,
    });

    const defaultValues = isCreateMode
      ? {
          lead: undefined,
          title: '',
          description: '',
          status: 'TODO',
          priority: 'MEDIUM',
          due_date: '',
          assignee_user_id: '',
          reporter_user_id: '',
        }
      : {
          lead: task?.lead,
          title: task?.title || '',
          description: task?.description || '',
          status: task?.status || 'TODO',
          priority: task?.priority || 'MEDIUM',
          due_date: task?.due_date ? task.due_date.split('T')[0] : '',
          assignee_user_id: task?.assignee_user_id || '',
          reporter_user_id: task?.reporter_user_id || '',
        };

    const {
      register,
      handleSubmit,
      formState: { errors },
      watch,
      setValue,
      reset,
      control,
    } = useForm<any>({
      resolver: zodResolver(schema),
      defaultValues,
    });

    const watchedLead = watch('lead');
    const watchedStatus = watch('status');
    const watchedPriority = watch('priority');

    // Reset form when task data changes (for edit/view modes)
    useEffect(() => {
      if (!isCreateMode && task) {
        const formValues = {
          lead: task.lead,
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          due_date: task.due_date ? task.due_date.split('T')[0] : '',
          assignee_user_id: task.assignee_user_id || '',
          reporter_user_id: task.reporter_user_id || '',
        };
        reset(formValues);
      }
    }, [task, isCreateMode, reset]);

    // Expose form validation and data collection to parent
    useImperativeHandle(ref, () => ({
      getFormValues: async (): Promise<CreateTaskPayload | UpdateTaskPayload | null> => {
        return new Promise((resolve) => {
          handleSubmit(
            (data) => {
              if (isCreateMode) {
                // Create task
                const payload: CreateTaskPayload = {
                  lead: Number(data.lead),
                  title: data.title,
                };

                // Add optional fields only if they have values
                if (data.description) payload.description = data.description;
                if (data.status) payload.status = data.status as TaskStatusEnum;
                if (data.priority) payload.priority = data.priority as PriorityEnum;
                if (data.due_date) payload.due_date = new Date(data.due_date).toISOString();
                if (data.assignee_user_id) payload.assignee_user_id = data.assignee_user_id;
                if (data.reporter_user_id) payload.reporter_user_id = data.reporter_user_id;

                resolve(payload);
              } else {
                // Update task - all fields optional
                const payload: UpdateTaskPayload = {};

                // Add only fields that have values
                if (data.lead !== undefined) payload.lead = Number(data.lead);
                if (data.title) payload.title = data.title;
                if (data.description !== undefined) payload.description = data.description;
                if (data.status) payload.status = data.status as TaskStatusEnum;
                if (data.priority) payload.priority = data.priority as PriorityEnum;
                if (data.due_date) payload.due_date = new Date(data.due_date).toISOString();
                if (data.assignee_user_id !== undefined) payload.assignee_user_id = data.assignee_user_id;
                if (data.reporter_user_id !== undefined) payload.reporter_user_id = data.reporter_user_id;

                resolve(payload);
              }
            },
            () => resolve(null)
          )();
        });
      },
    }));

    // Get status badge
    const getStatusBadge = (status: string) => {
      const statusConfig = {
        TODO: { label: 'To Do', className: 'bg-gray-600' },
        IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-600' },
        DONE: { label: 'Done', className: 'bg-green-600' },
        CANCELLED: { label: 'Cancelled', className: 'bg-red-600' },
      };
      const config = statusConfig[status as keyof typeof statusConfig] || { label: status, className: 'bg-gray-600' };
      return (
        <Badge variant="default" className={config.className}>
          {config.label}
        </Badge>
      );
    };

    // Get priority badge
    const getPriorityBadge = (priority: string) => {
      const priorityConfig = {
        LOW: { label: 'Low', className: 'bg-gray-600' },
        MEDIUM: { label: 'Medium', className: 'bg-orange-600' },
        HIGH: { label: 'High', className: 'bg-red-600' },
      };
      const config = priorityConfig[priority as keyof typeof priorityConfig] || { label: priority, className: 'bg-gray-600' };
      return (
        <Badge variant="default" className={config.className}>
          {config.label}
        </Badge>
      );
    };

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lead */}
            <div className="space-y-2">
              <Label htmlFor="lead">Lead {isCreateMode && '*'}</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="font-medium">{task?.lead_name || 'N/A'}</p>
                </div>
              ) : (
                <Select
                  value={watchedLead?.toString()}
                  onValueChange={(value) => setValue('lead', Number(value))}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className={errors.lead ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select a lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id.toString()}>
                        {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.lead && (
                <p className="text-sm text-destructive">{errors.lead.message as string}</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title {isCreateMode && '*'}</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="font-medium">{task?.title}</p>
                </div>
              ) : (
                <>
                  <Input
                    id="title"
                    {...register('title')}
                    placeholder="Enter task title"
                    disabled={isReadOnly}
                    className={errors.title ? 'border-destructive' : ''}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message as string}</p>
                  )}
                </>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="whitespace-pre-wrap">{task?.description || 'No description'}</p>
                </div>
              ) : (
                <>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter task description"
                    disabled={isReadOnly}
                    rows={4}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message as string}</p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status & Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status & Priority</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {isReadOnly ? (
                  <div className="pt-2">
                    {task && getStatusBadge(task.status)}
                  </div>
                ) : (
                  <Select
                    value={watchedStatus}
                    onValueChange={(value) => setValue('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                {isReadOnly ? (
                  <div className="pt-2">
                    {task && getPriorityBadge(task.priority)}
                  </div>
                ) : (
                  <Select
                    value={watchedPriority}
                    onValueChange={(value) => setValue('priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Due Date */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="font-medium">
                    {task?.due_date ? (
                      <>
                        {format(new Date(task.due_date), 'PPP')}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({formatDistanceToNow(new Date(task.due_date), { addSuffix: true })})
                        </span>
                      </>
                    ) : (
                      'Not set'
                    )}
                  </p>
                </div>
              ) : (
                <Input
                  id="due_date"
                  type="date"
                  {...register('due_date')}
                  disabled={isReadOnly}
                  className={errors.due_date ? 'border-destructive' : ''}
                />
              )}
              {errors.due_date && (
                <p className="text-sm text-destructive">{errors.due_date.message as string}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Assignee */}
            <div className="space-y-2">
              <Label htmlFor="assignee_user_id">Assignee</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="font-medium">
                    {task?.assignee_user_id ? (
                      usersData?.results?.find(u => u.id === task.assignee_user_id)
                        ? `${usersData.results.find(u => u.id === task.assignee_user_id)?.first_name} ${usersData.results.find(u => u.id === task.assignee_user_id)?.last_name}`
                        : task.assignee_user_id
                    ) : (
                      'Not assigned'
                    )}
                  </p>
                </div>
              ) : (
                <Controller
                  name="assignee_user_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || 'unassigned'}
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)}
                      disabled={isReadOnly || usersLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">No assignment</SelectItem>
                        {usersData?.results?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>

            {/* Reporter */}
            <div className="space-y-2">
              <Label htmlFor="reporter_user_id">Reporter</Label>
              {isReadOnly ? (
                <div className="pt-2">
                  <p className="font-medium">
                    {task?.reporter_user_id ? (
                      usersData?.results?.find(u => u.id === task.reporter_user_id)
                        ? `${usersData.results.find(u => u.id === task.reporter_user_id)?.first_name} ${usersData.results.find(u => u.id === task.reporter_user_id)?.last_name}`
                        : task.reporter_user_id
                    ) : (
                      'Not set'
                    )}
                  </p>
                </div>
              ) : (
                <Controller
                  name="reporter_user_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || 'unassigned'}
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)}
                      disabled={isReadOnly || usersLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reporter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Not set</SelectItem>
                        {usersData?.results?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata (View Mode Only) */}
        {mode === 'view' && task && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {format(new Date(task.created_at), 'PPP')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Updated</Label>
                  <p className="font-medium">
                    {format(new Date(task.updated_at), 'PPP')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                  </p>
                </div>
                {task.completed_at && (
                  <div>
                    <Label className="text-muted-foreground">Completed</Label>
                    <p className="font-medium">
                      {format(new Date(task.completed_at), 'PPP')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Attachments</Label>
                  <p className="font-medium">{task.attachments_count || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
);

TaskBasicInfo.displayName = 'TaskBasicInfo';

export default TaskBasicInfo;
