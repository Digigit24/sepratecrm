// src/components/copilot/tools/ToolFallback.tsx
//
// Generic card for ANY tool (registered as the `Fallback` in
// MessagePrimitive.Parts). Shows the tool name, its args, a spinner while
// running, the Approve/Cancel bar while a write awaits confirmation, and the
// result/error when present.

import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { Wrench } from 'lucide-react';
import { ToolCard, ConfirmBar, ArgRows, ResultBlock, useToolPhase } from './shared';

export function ToolFallback({ toolName, toolCallId, args, result, isError }: ToolCallMessagePartProps) {
  const phase = useToolPhase(toolCallId, result, isError);
  return (
    <ToolCard icon={<Wrench className="h-3.5 w-3.5 text-muted-foreground" />} title={prettyToolName(toolName)} phase={phase}>
      <ArgRows args={(args ?? {}) as Record<string, unknown>} />
      {phase === 'awaiting' && <div className="mt-2"><ConfirmBar toolCallId={toolCallId} /></div>}
      <ResultBlock result={result} isError={isError} />
    </ToolCard>
  );
}

export function prettyToolName(name: string): string {
  return (name || 'tool').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
