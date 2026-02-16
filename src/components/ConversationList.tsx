import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Home, Search, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatLabel } from "@/services/whatsapp/chatService";

type ConversationItem = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  lastTimestamp?: string;
  channel: string;
  unread: boolean;
  unreadCount?: number;
  labels?: ChatLabel[];
  assignedUserUid?: string;
  windowIsOpen?: boolean;
  windowExpiresAt?: string | null;
  requiresTemplate?: boolean;
};

interface UnreadCounts {
  total?: number;
  assigned?: number;
  unassigned?: number;
}

const channelIcon = (channel: string) => {
  switch (channel) {
    case "whatsapp":
      return <Phone size={16} className="text-green-500" />;
    case "instagram":
      return <MessageCircle size={16} className="text-pink-500" />;
    case "website":
      return <Home size={16} className="text-blue-500" />;
    default:
      return null;
  }
};

// Format time remaining for reply window
const formatTimeRemaining = (expiresAt?: string | null): string | null => {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

type Props = {
  conversations: ConversationItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  isMobile?: boolean;
  currentUserUid?: string;
  unreadCounts?: UnreadCounts;
  onSearchChange?: (search: string) => void;
};

export const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  isMobile,
  currentUserUid,
  unreadCounts,
  onSearchChange,
}: Props) => {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearchChange?.(value);
  };

  // Filter conversations by tab and search
  const filtered = useMemo(() => {
    let result = conversations;

    // Filter by tab
    if (tab === "mine") {
      result = result.filter((c) => c.assignedUserUid === currentUserUid);
    } else if (tab === "unassigned") {
      result = result.filter((c) => !c.assignedUserUid);
    }

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.lastMessage.toLowerCase().includes(searchLower) ||
          c.id.includes(search) // Allow searching by phone number/ID
      );
    }

    return result;
  }, [conversations, tab, search, currentUserUid]);

  // Count for tabs
  const tabCounts = useMemo(() => ({
    all: conversations.length,
    mine: conversations.filter((c) => c.assignedUserUid === currentUserUid).length,
    unassigned: conversations.filter((c) => !c.assignedUserUid).length,
  }), [conversations, currentUserUid]);

  const formatDateLabel = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full w-full bg-card">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 flex items-center justify-between h-14 border-b border-border px-4 bg-card">
        <h1 className="font-semibold text-base">Chats</h1>
        <div className="flex items-center gap-2">
          {unreadCounts?.total !== undefined && unreadCounts.total > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary text-primary-foreground font-medium">
              {unreadCounts.total} unread
            </span>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
            {conversations.length}
          </span>
        </div>
      </div>

      {/* Search and Filters - Fixed */}
      <div className="flex-shrink-0 flex flex-col gap-3 p-3 bg-card border-b border-border">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 h-10 bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9 bg-muted/50">
            <TabsTrigger value="all" className="text-xs gap-1">
              All
              {tabCounts.all > 0 && (
                <span className="text-[10px] text-muted-foreground">({tabCounts.all})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="text-xs gap-1">
              Mine
              {tabCounts.mine > 0 && (
                <span className="text-[10px] text-muted-foreground">({tabCounts.mine})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unassigned" className="text-xs gap-1">
              Unassigned
              {tabCounts.unassigned > 0 && (
                <span className="text-[10px] text-muted-foreground">({tabCounts.unassigned})</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Conversations List - Scrollable with native overflow */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {search ? 'No conversations match your search' : 'No conversations found'}
            </p>
            {search && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => handleSearchChange("")}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          filtered.map((conversation) => {
            const timeRemaining = formatTimeRemaining(conversation.windowExpiresAt);

            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border transition-colors hover:bg-accent/50 text-left w-full",
                  selectedId === conversation.id && "bg-accent"
                )}
              >
                {/* Avatar */}
                <div className="flex-none mt-1 relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                    {conversation.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Unread indicator badge */}
                  {typeof conversation.unreadCount === 'number' && conversation.unreadCount > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-2 border-card rounded-full flex items-center justify-center">
                      <span className="sr-only">Unread messages</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name and Time row */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {channelIcon(conversation.channel)}
                      <h3 className={cn(
                        "text-sm truncate",
                        (conversation.unreadCount ?? 0) > 0 ? "font-semibold" : "font-normal"
                      )}>
                        {conversation.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-none ml-2">
                      <span className={cn(
                        "text-xs whitespace-nowrap",
                        (conversation.unreadCount ?? 0) > 0 ? "text-primary font-medium" : "text-muted-foreground"
                      )}>
                        {conversation.time}
                      </span>
                    </div>
                  </div>

                  {/* Labels row */}
                  {conversation.labels && conversation.labels.length > 0 && (
                    <div className="flex items-center gap-1 mb-1 overflow-hidden">
                      {conversation.labels.slice(0, 3).map((label) => (
                        <Badge
                          key={label._uid}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 truncate max-w-[80px]"
                          style={{
                            backgroundColor: label.bg_color || undefined,
                            color: label.text_color || undefined,
                            borderColor: label.bg_color || 'transparent',
                          }}
                        >
                          {label.title}
                        </Badge>
                      ))}
                      {conversation.labels.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{conversation.labels.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Reply window status and date row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateLabel(conversation.lastTimestamp)}
                    </span>
                    {conversation.windowIsOpen && timeRemaining ? (
                      <span className="text-[10px] text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {timeRemaining}
                      </span>
                    ) : conversation.requiresTemplate ? (
                      <span className="text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Template required
                      </span>
                    ) : null}
                  </div>

                  {/* Last message and unread count row */}
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                      "text-xs truncate",
                      (conversation.unreadCount ?? 0) > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {conversation.lastMessage || 'No messages yet'}
                    </p>
                    {typeof conversation.unreadCount === 'number' && conversation.unreadCount > 0 && (
                      <span className="flex-none inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
