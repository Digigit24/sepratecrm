// src/components/copilot/HeaderCopilotButton.tsx
//
// The bot button that lives on the RIGHT side of the app header and toggles
// the copilot panel open/closed.

import { Bot } from 'lucide-react';
import { useChat } from '@/context/ChatProvider';
import { cn } from '@/lib/utils';

export function HeaderCopilotButton() {
  const { isOpen, toggle, botName } = useChat();

  return (
    <button
      onClick={toggle}
      aria-label={`Toggle ${botName}`}
      aria-pressed={isOpen}
      title={botName}
      className={cn(
        'relative p-2 rounded-lg transition-colors',
        isOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
      )}
    >
      <Bot className="w-4 h-4" />
    </button>
  );
}
