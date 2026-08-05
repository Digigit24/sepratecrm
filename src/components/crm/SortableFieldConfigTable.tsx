// src/components/crm/SortableFieldConfigTable.tsx
import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import type { LeadFieldConfiguration } from '@/types/crmTypes';

interface SortableFieldConfigTableProps {
  fields: LeadFieldConfiguration[];
  onReorder: (fields: LeadFieldConfiguration[]) => void;
  onEdit: (field: LeadFieldConfiguration) => void;
  onDelete: (field: LeadFieldConfiguration) => void;
  onView: (field: LeadFieldConfiguration) => void;
  onVisibilityChange: (field: LeadFieldConfiguration, isVisible: boolean) => void;
  disabled?: boolean;
}

function SortableRow({
  field,
  onEdit,
  onDelete,
  onView,
  onVisibilityChange,
  disabled,
}: {
  field: LeadFieldConfiguration;
  onEdit: (field: LeadFieldConfiguration) => void;
  onDelete: (field: LeadFieldConfiguration) => void;
  onView: (field: LeadFieldConfiguration) => void;
  onVisibilityChange: (field: LeadFieldConfiguration, isVisible: boolean) => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 20 : undefined,
  };

  const getFieldTypeBadge = (fieldType?: string) => {
    if (!fieldType) return null;

    const colors: Record<string, string> = {
      TEXT: 'bg-blue-100 text-blue-800 border-blue-200',
      NUMBER: 'bg-green-100 text-green-800 border-green-200',
      EMAIL: 'bg-purple-100 text-purple-800 border-purple-200',
      PHONE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      DATE: 'bg-pink-100 text-pink-800 border-pink-200',
      DATETIME: 'bg-pink-100 text-pink-800 border-pink-200',
      DROPDOWN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      MULTISELECT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      CHECKBOX: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      URL: 'bg-orange-100 text-orange-800 border-orange-200',
      TEXTAREA: 'bg-blue-100 text-blue-800 border-blue-200',
      DECIMAL: 'bg-green-100 text-green-800 border-green-200',
      CURRENCY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };

    return (
      <Badge
        variant="outline"
        className={colors[fieldType] || 'bg-gray-100 text-gray-800 border-gray-200'}
      >
        {fieldType}
      </Badge>
    );
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`group bg-background ${isDragging ? 'shadow-lg ring-1 ring-primary/30' : ''}`}
    >
      <TableCell className="w-12">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex h-8 w-8 touch-none items-center justify-center rounded-md cursor-grab active:cursor-grabbing hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          disabled={disabled}
          aria-label={`Move ${field.field_label}`}
          title="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        #{field.display_order}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="font-medium">{field.field_label}</div>
          <div className="text-sm text-muted-foreground font-mono">
            {field.field_name}
          </div>
        </div>
      </TableCell>
      <TableCell>{getFieldTypeBadge(field.field_type)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {field.is_standard && (
            <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
              Standard
            </Badge>
          )}
          {!field.is_standard && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
              Custom
            </Badge>
          )}
          {field.is_required && (
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              Required
            </Badge>
          )}
          {!field.is_visible && (
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
              <EyeOff className="w-3 h-3 mr-1" />
              Hidden
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(field.updated_at), { addSuffix: true })}
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant={field.is_visible ? 'outline' : 'ghost'}
          size="sm"
          className="h-8 min-w-[92px] justify-start"
          onClick={() => onVisibilityChange(field, !field.is_visible)}
          disabled={disabled}
          aria-pressed={field.is_visible}
          title={field.is_visible ? 'Hide this column from the leads list' : 'Show this column in the leads list'}
        >
          {field.is_visible ? (
            <Eye className="mr-1.5 h-4 w-4 text-emerald-600" />
          ) : (
            <EyeOff className="mr-1.5 h-4 w-4 text-muted-foreground" />
          )}
          {field.is_visible ? 'Visible' : 'Hidden'}
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(field)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(field)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(field)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            disabled={field.is_standard}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SortableFieldConfigTable({
  fields,
  onReorder,
  onEdit,
  onDelete,
  onView,
  onVisibilityChange,
  disabled = false,
}: SortableFieldConfigTableProps) {
  const [localFields, setLocalFields] = useState(fields);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local state when props change
  useEffect(() => {
    setLocalFields(fields);
  }, [fields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localFields.findIndex((f) => f.id === active.id);
      const newIndex = localFields.findIndex((f) => f.id === over.id);

      if (oldIndex < 0 || newIndex < 0) return;

      const reorderedFields = arrayMove(localFields, oldIndex, newIndex);
      setLocalFields(reorderedFields);
      onReorder(reorderedFields);
    }
  };

  if (fields.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No fields to display</p>
      </Card>
    );
  }

  return (
    <div className="rounded-md border">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        autoScroll
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-20">Order</TableHead>
              <TableHead>Field Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-28">List column</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext
              items={localFields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {localFields.map((field) => (
                <SortableRow
                  key={field.id}
                  field={field}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onView={onView}
                  onVisibilityChange={onVisibilityChange}
                  disabled={disabled}
                />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
