// src/pages/Work.tsx
//
// Full-page AI workspace at /work. Hosts its own assistant-ui runtime via the
// shared useCopilotRuntime() hook — deliberately independent of
// ChatProvider.isOpen, which only governs the slide-out <CopilotPanel />.
//
// Navigating away unmounts <AssistantRuntimeProvider>, which aborts any
// in-flight SSE request so pending confirmation promises do not leak.

import { useEffect, useState } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { Bot, Check, Loader2, Pencil } from 'lucide-react';

import { useChat } from '@/context/ChatProvider';
import { useCopilotRuntime } from '@/hooks/useCopilotRuntime';
import { WorkThread } from '@/components/copilot/WorkThread';
import { resolveToolSpec } from '@/components/copilot/toolRegistry';

function WorkHeader() {
  const { botName, saveBotName, botNameSaveState, selectedTool } = useChat();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(botName);
  const toolSpec = resolveToolSpec(selectedTool);

  useEffect(() => {
    if (!isRenaming) setDraftName(botName);
  }, [botName, isRenaming]);

  const commitRename = async () => {
    await saveBotName(draftName);
    setIsRenaming(false);
  };

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 leading-tight">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void commitRename();
                  if (event.key === 'Escape') {
                    setDraftName(botName);
                    setIsRenaming(false);
                  }
                }}
                onBlur={() => void commitRename()}
                aria-label="Bot name"
                autoFocus
                className="h-7 w-48 rounded-md border border-input bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-ring"
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void commitRename()}
                aria-label="Save bot name"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {botNameSaveState === 'saving' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <p className="truncate text-sm font-semibold text-foreground">{botName}</p>
              <button
                type="button"
                onClick={() => setIsRenaming(true)}
                aria-label="Rename bot"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="truncate text-[11px] text-muted-foreground">
            {toolSpec ? toolSpec.title : 'AI workspace'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Work() {
  const runtime = useCopilotRuntime();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <WorkHeader />
      <div className="min-h-0 flex-1">
        <AssistantRuntimeProvider runtime={runtime}>
          <WorkThread />
        </AssistantRuntimeProvider>
      </div>
    </div>
  );
}
