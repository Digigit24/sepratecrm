// src/components/workflow-editor/steps/WorkflowStepCard.tsx
import { useState } from 'react';
import { GripVertical, ChevronDown, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { StepCardProps } from '../types/workflowEditor.types';

interface WorkflowStepCardProps extends StepCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  badgeLabel: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children: React.ReactNode; // Config form content
  executionStatus?: React.ReactNode;
  dragHandleProps?: any; // From @dnd-kit
}

export const WorkflowStepCard = ({
  icon: Icon,
  title,
  subtitle,
  badgeLabel,
  badgeVariant = 'default',
  children,
  executionStatus,
  isDraggable = false,
  dragHandleProps,
  onDelete,
}: WorkflowStepCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      className={cn(
        'group hover:shadow-md transition-all',
        isExpanded && 'shadow-md'
      )}
    >
      <div className="flex items-center gap-4 p-4">
        {/* Drag handle */}
        {isDraggable && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </div>
        )}
        {!isDraggable && (
          <div className="flex-shrink-0 w-5" /> // Spacer for alignment
        )}

        {/* Step icon */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            <h3 className="font-semibold truncate">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {/* Execution status */}
        {executionStatus && (
          <div className="flex-shrink-0">{executionStatus}</div>
        )}

        {/* Delete button */}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this step?')) {
                onDelete();
              }
            }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}

        {/* Expand/collapse button */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      {/* Expanded content */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="border-t p-4 bg-muted/30">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
