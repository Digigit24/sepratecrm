// src/components/copilot/CreateWithAIButton.tsx
//
// Reusable "Create with AI" trigger. Drop it anywhere to open the copilot with
// a preselected tool + context payload:
//
//   <CreateWithAIButton tool="crm.lead.create" context={{ source: 'leads-page' }} />
//
// Or use the hook for custom UI:
//
//   const createWithAI = useCreateWithAI();
//   <button onClick={() => createWithAI('crm.lead.create', { leadId })}>…</button>

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat, type CopilotContextPayload } from '@/context/ChatProvider';
import { cn } from '@/lib/utils';

/** Hook: returns a fn that opens the copilot with a tool + context preloaded. */
export function useCreateWithAI() {
  const { openWith } = useChat();
  return (tool: string, context?: CopilotContextPayload) =>
    openWith({ tool, context: context ?? null });
}

interface CreateWithAIButtonProps {
  tool: string;
  context?: CopilotContextPayload;
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}

export function CreateWithAIButton({
  tool,
  context,
  label = 'Create with AI',
  className,
  variant = 'outline',
  size = 'sm',
}: CreateWithAIButtonProps) {
  const createWithAI = useCreateWithAI();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => createWithAI(tool, context)}
      className={cn('gap-1.5', className)}
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </Button>
  );
}
