// src/components/copilot/CopilotPanel.tsx
//
// Right-side slide-out AI copilot. Mirrors the app's SideDrawer pattern
// (fixed overlay + right panel + slide transition) and hosts the assistant-ui
// runtime. The runtime uses a useLocalRuntime + custom SSE ChatModelAdapter
// that POSTs to the backend and streams text deltas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { Check, Loader2, Pencil, X, Bot } from 'lucide-react';
import { useChat } from '@/context/ChatProvider';
import { authService } from '@/services/authService';
import { createChatModelAdapter } from '@/lib/aiChatAdapter';
import { CopilotThread } from './CopilotThread';
import { resolveToolSpec } from './toolRegistry';
import { cn } from '@/lib/utils';

function CopilotRuntime() {
  const { selectedTool, context } = useChat();

  // Keep refs current so the adapter (created once) always reads the latest
  // tool/context/token at request time without recreating the runtime.
  const toolRef = useRef<string | null>(selectedTool);
  const contextRef = useRef<Record<string, unknown> | null>(context);
  toolRef.current = selectedTool;
  contextRef.current = context;

  const adapter = useMemo(
    () =>
      createChatModelAdapter({
        getToken: () => authService.getAccessToken(),
        getTool: () => toolRef.current,
        getContext: () => contextRef.current,
      }),
    []
  );

  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CopilotThread />
    </AssistantRuntimeProvider>
  );
}

export function CopilotPanel() {
  const { isOpen, close, selectedTool, botName, saveBotName, botNameSaveState } = useChat();
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
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="AI Copilot"
        aria-hidden={!isOpen}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
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
                    className="h-7 w-40 rounded-md border border-input bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-ring"
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
              {toolSpec && (
                <p className="truncate text-[11px] text-muted-foreground">{toolSpec.title}</p>
              )}
              {selectedTool && !toolSpec && (
                <p className="text-[11px] text-muted-foreground">Tool: {selectedTool}</p>
              )}
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close AI Copilot"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — only mount the runtime while open to avoid background work */}
        <div className="min-h-0 flex-1">{isOpen && <CopilotRuntime />}</div>
      </aside>
    </>
  );
}
