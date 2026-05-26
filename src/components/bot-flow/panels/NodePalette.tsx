// src/components/bot-flow/panels/NodePalette.tsx
// Left panel with draggable node types

import { NODE_TYPES_LIST } from '../nodes/nodeUtils';

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-52 flex-shrink-0 border-r bg-muted/20 flex flex-col">
      <div className="px-3 py-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node Types</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Drag onto canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {NODE_TYPES_LIST.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border bg-card cursor-grab hover:shadow-sm hover:border-border transition-all active:cursor-grabbing group"
            >
              <div
                className="flex-shrink-0 p-1.5 rounded-md"
                style={{ background: `${item.color}20` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium leading-tight truncate">{item.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
