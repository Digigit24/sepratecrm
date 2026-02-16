// src/components/TaskKanbanBoard.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TaskKanbanCard } from './TaskKanbanCard';
import { toast } from 'sonner';
import type { Task, TaskStatusEnum } from '@/types/crmTypes';

interface TaskStatusConfig {
  key: TaskStatusEnum;
  label: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
}

const TASK_STATUS_COLUMNS: TaskStatusConfig[] = [
  {
    key: 'TODO' as TaskStatusEnum,
    label: 'To Do',
    color: '#6B7280',
    bgLight: 'rgba(107, 114, 128, 0.1)',
    borderColor: '#6B7280',
    textColor: '#6B7280',
  },
  {
    key: 'IN_PROGRESS' as TaskStatusEnum,
    label: 'In Progress',
    color: '#3B82F6',
    bgLight: 'rgba(59, 130, 246, 0.1)',
    borderColor: '#3B82F6',
    textColor: '#3B82F6',
  },
  {
    key: 'DONE' as TaskStatusEnum,
    label: 'Done',
    color: '#22C55E',
    bgLight: 'rgba(34, 197, 94, 0.1)',
    borderColor: '#22C55E',
    textColor: '#22C55E',
  },
  {
    key: 'CANCELLED' as TaskStatusEnum,
    label: 'Cancelled',
    color: '#EF4444',
    bgLight: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    textColor: '#EF4444',
  },
];

interface TaskKanbanBoardProps {
  tasks: Task[];
  onViewTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onCreateTask: (status?: TaskStatusEnum) => void;
  onUpdateTaskStatus: (taskId: number, newStatus: TaskStatusEnum) => Promise<void>;
  isLoading?: boolean;
}

export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({
  tasks,
  onViewTask,
  onEditTask,
  onCreateTask,
  onUpdateTaskStatus,
  isLoading = false,
}) => {
  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    TASK_STATUS_COLUMNS.forEach((col) => {
      grouped[col.key] = [];
    });

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        // Fallback: put unknown statuses in TODO
        grouped['TODO']?.push(task);
      }
    });

    return grouped;
  }, [tasks]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const taskId = parseInt(draggableId.replace('task-', ''));
      const newStatus = destination.droppableId.replace('task-status-', '') as TaskStatusEnum;

      try {
        await onUpdateTaskStatus(taskId, newStatus);
        toast.success('Task status updated');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update task status');
      }
    },
    [onUpdateTaskStatus]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Task Board</h2>
            <p className="text-sm text-muted-foreground">
              {tasks.length} tasks across {TASK_STATUS_COLUMNS.length} columns
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 md:gap-5 h-full overflow-x-auto pb-4">
            {TASK_STATUS_COLUMNS.map((statusConfig) => {
              const statusTasks = tasksByStatus[statusConfig.key] || [];

              return (
                <Droppable key={statusConfig.key} droppableId={`task-status-${statusConfig.key}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="h-full"
                    >
                      <div
                        className={`
                          flex flex-col h-full min-w-[280px] max-w-[280px] md:min-w-[300px] md:max-w-[300px]
                          rounded-xl transition-colors
                          ${snapshot.isDraggingOver ? 'bg-muted/40' : ''}
                        `}
                      >
                        {/* Column Header */}
                        <div className="flex-shrink-0 mb-3">
                          <div
                            className="rounded-lg px-3 py-2.5 border"
                            style={{
                              backgroundColor: statusConfig.bgLight,
                              borderColor: statusConfig.borderColor,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: statusConfig.color }}
                                />
                                <h3
                                  className="font-semibold text-sm"
                                  style={{ color: statusConfig.textColor }}
                                >
                                  {statusConfig.label}
                                </h3>
                              </div>
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: statusConfig.color,
                                  color: '#ffffff',
                                }}
                              >
                                {statusTasks.length}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Column Content */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                          {statusTasks.length === 0 ? (
                            <div className="border-dashed border-2 border-muted rounded-lg p-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No tasks
                              </p>
                              <button
                                className="mt-2 text-sm text-primary hover:underline"
                                onClick={() => onCreateTask(statusConfig.key)}
                              >
                                Add Task
                              </button>
                            </div>
                          ) : (
                            statusTasks.map((task, index) => (
                              <Draggable
                                key={task.id}
                                draggableId={`task-${task.id}`}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`
                                      transition-all duration-200
                                      ${snapshot.isDragging ? 'opacity-70 rotate-1 shadow-xl scale-105' : ''}
                                    `}
                                  >
                                    <TaskKanbanCard
                                      task={task}
                                      onClick={onViewTask}
                                      isDragging={snapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))
                          )}
                          {provided.placeholder}
                        </div>

                        {/* Add Task Button */}
                        <div className="flex-shrink-0 mt-3">
                          <button
                            className="w-full border border-dashed border-muted-foreground/30 rounded-lg p-2.5 text-sm text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 transition-colors flex items-center justify-center gap-1.5"
                            onClick={() => onCreateTask(statusConfig.key)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Task
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};