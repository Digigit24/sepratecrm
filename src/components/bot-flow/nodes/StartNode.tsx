// src/components/bot-flow/nodes/StartNode.tsx

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';

export function StartNode({ data }: NodeProps) {
  const trigger = (data as any).start_trigger || 'Keyword';

  return (
    <div className="relative">
      <div
        className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl border-2 bg-blue-50 dark:bg-blue-950 shadow-md min-w-[160px]"
        style={{ borderColor: '#3b82f6' }}
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
            START
          </span>
        </div>
        <span className="text-xs font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
          {trigger}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="!w-3 !h-3 !rounded-full !border-2 !border-white !bg-blue-500"
      />
    </div>
  );
}
