// src/components/bot-flow/nodes/BaseNode.tsx
// Base node shell used by all node types

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseNodeProps {
  id: string;
  selected?: boolean;
  color: string;
  icon: React.ElementType;
  typeLabel: string;
  name: string;
  children?: React.ReactNode;
  inputs?: React.ReactNode; // custom input handles
  outputs?: React.ReactNode; // custom output handles (if null, renders default single output)
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  hasInput?: boolean;
}

export function BaseNode({
  id,
  selected,
  color,
  icon: Icon,
  typeLabel,
  name,
  children,
  outputs,
  onEdit,
  onDelete,
  onDuplicate,
  hasInput = true,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border-2 bg-card shadow-md min-w-[220px] max-w-[280px] transition-all',
        selected ? 'shadow-lg ring-2 ring-offset-1' : ''
      )}
      style={{
        borderColor: selected ? color : 'transparent',
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderLeftStyle: 'solid',
        // override border-2 for left
      }}
    >
      {/* Input handle */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          className="!w-3 !h-3 !rounded-full !border-2 !border-white"
          style={{ background: color }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-[9px]"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color }}>
          {typeLabel}
        </span>
      </div>

      {/* Name */}
      <div className="px-3 py-1.5 border-b">
        <p className="text-sm font-medium truncate">{name}</p>
      </div>

      {/* Content */}
      {children && <div className="px-3 py-2 text-xs text-muted-foreground">{children}</div>}

      {/* Outputs */}
      {outputs && <div className="px-3 pb-2">{outputs}</div>}

      {/* Default single output handle (if no custom outputs) */}
      {!outputs && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          className="!w-3 !h-3 !rounded-full !border-2 !border-white"
          style={{ background: color }}
        />
      )}

      {/* Hover actions */}
      {(onEdit || onDelete || onDuplicate) && (
        <div className="absolute -top-8 right-0 hidden group-hover:flex items-center gap-1 bg-background border rounded-md shadow-sm px-1 py-0.5">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 hover:bg-muted rounded"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1 hover:bg-muted rounded"
              title="Duplicate"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 hover:bg-muted rounded text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
