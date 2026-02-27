// src/components/TaskKanbanCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  AlertCircle,
  GripVertical,
  User,
  Paperclip,
} from 'lucide-react';
import { formatDistanceToNow, format, isPast, isToday, isTomorrow, parseISO, isValid } from 'date-fns';
import type { Task, PriorityEnum, TaskStatusEnum } from '@/types/crmTypes';

interface TaskKanbanCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isDragging?: boolean;
}

export const TaskKanbanCard: React.FC<TaskKanbanCardProps> = ({
  task,
  onClick,
  isDragging = false,
}) => {
  const getPriorityBadge = (priority: PriorityEnum) => {
    const variants: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-700 border-gray-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${variants[priority] || ''}`}>
        {priority}
      </Badge>
    );
  };

  const getDueDateBadge = (dueDate: string) => {
    const date = parseISO(dueDate);
    if (!isValid(date)) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Invalid date</span>
        </div>
      );
    }
    const isOverdue = isPast(date) && !isToday(date);

    if (isOverdue) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
          <AlertCircle className="h-3 w-3" />
          <span>Overdue - {format(date, 'MMM dd')}</span>
        </div>
      );
    }

    if (isToday(date)) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-orange-600 font-medium">
          <Clock className="h-3 w-3" />
          <span>Due today</span>
        </div>
      );
    }

    if (isTomorrow(date)) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
          <Calendar className="h-3 w-3" />
          <span>Due tomorrow</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>{format(date, 'MMM dd')}</span>
      </div>
    );
  };

  return (
    <Card
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
        group
      `}
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary flex-1">
            {task.title}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {getPriorityBadge(task.priority)}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded">
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Lead name */}
        {task.lead_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{task.lead_name}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-muted/50">
          <div className="flex items-center gap-2">
            {task.due_date && getDueDateBadge(task.due_date)}
            {!task.due_date && (
              <span className="text-[11px] text-muted-foreground">No due date</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {task.attachments_count > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{task.attachments_count}</span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">
              {task.updated_at && isValid(new Date(task.updated_at))
                ? formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })
                : 'recently'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};