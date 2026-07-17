// src/components/copilot/CopilotThread.tsx
//
// The chat surface: message list + streaming assistant messages + composer,
// composed from assistant-ui primitives (shadcn/Tailwind styled to match the
// app). Rendered inside an <AssistantRuntimeProvider> (see CopilotPanel).

import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from '@assistant-ui/react';
import { SendHorizontal, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toolComponentsByName, toolFallbackComponent } from './tools';

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end gap-2 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        <MessagePrimitive.Parts />
      </div>
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <User className="h-3.5 w-3.5 text-primary" />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start gap-2 py-2">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-3.5 w-3.5 text-foreground" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
        <MessagePrimitive.Parts
          components={{
            tools: { by_name: toolComponentsByName, Fallback: toolFallbackComponent },
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

export function CopilotThread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-background">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-3 py-2">
        <ThreadPrimitive.Empty>
          <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Celiyo AI Copilot</p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              Ask about your leads, draft messages, or use a “Create with AI” action to get started.
            </p>
          </div>
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
      </ThreadPrimitive.Viewport>

      <div className="border-t border-border p-2.5">
        <ComposerPrimitive.Root className="flex items-end gap-2 rounded-xl border border-input bg-background px-2.5 py-1.5 focus-within:border-ring">
          <ComposerPrimitive.Input
            autoFocus
            rows={1}
            placeholder="Ask the AI copilot…"
            className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <ComposerPrimitive.Send
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground',
              'transition-opacity hover:opacity-90 disabled:opacity-40'
            )}
          >
            <SendHorizontal className="h-4 w-4" />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </ThreadPrimitive.Root>
  );
}
