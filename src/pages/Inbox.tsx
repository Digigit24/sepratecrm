import { useState } from "react";
import { ConversationList } from "@/components/ConversationList";
import { ChatWindow } from "@/components/ChatWindow";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

const Inbox = () => {
  const [selectedId, setSelectedId] = useState("1");
  const [chatMobileOpen, setChatMobileOpen] = useState(false);

  const isMobile = useIsMobile();

  // On mobile, open chat drawer when a conversation is selected
  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (isMobile) setChatMobileOpen(true);
  };

  return (
    <div className="flex-1 flex bg-background text-foreground relative h-full">
      {/* Desktop / Tablet: Resizable panels */}
      {!isMobile ? (
        <ResizablePanelGroup direction="horizontal" className="w-full">
          <ResizablePanel
            defaultSize={28}
            minSize={20}
            maxSize={40}
            className="min-w-[240px]"
          >
            <div className="h-full">
              <ConversationList
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={72} minSize={40}>
            <div className="h-full flex flex-col min-w-0">
              <ChatWindow conversationId={selectedId} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        // Mobile: List view and slide-over chat
        <div className="flex flex-col flex-1 min-w-0">
          {!chatMobileOpen && (
            <ConversationList
              selectedId={selectedId}
              onSelect={handleSelect}
              isMobile
            />
          )}

          <Sheet open={chatMobileOpen} onOpenChange={setChatMobileOpen}>
            <SheetContent side="right" className="p-0 w-full max-w-full">
              <ChatWindow
                conversationId={selectedId}
                isMobile
                onBack={() => setChatMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
};

export default Inbox;