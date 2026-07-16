import { useState, useCallback } from 'react';
import { ConversationList } from '@/components/ConversationList';
import { ChatWindow } from '@/components/ChatWindow';
import { ContactChatDrawer } from '@/components/ContactChatDrawer';
import type { ContactChatDrawerTab } from '@/components/ContactChatDrawer';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle } from 'lucide-react';
import {
  useContactsWithInfiniteScroll,
  useUnreadCount,
  useMarkAsRead,
} from '@/hooks/whatsapp/useChat';
import { useRealtimeChat } from '@/hooks/whatsapp/useRealtimeChat';
import type { ChatContact } from '@/services/whatsapp/chatService';

// NOTE: Polling is now controlled by ENABLE_POLLING flag in useChat.ts
// Set ENABLE_POLLING = true in useChat.ts to re-enable polling as fallback

export default function Chats() {
  const [selectedContactUid, setSelectedContactUid] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [contactDrawerTab, setContactDrawerTab] = useState<ContactChatDrawerTab>('contact');
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Get current user UID for filtering "Mine" conversations
  const currentUserUid = user?._uid || user?.id || '';

  // SINGLE realtime path: this is the only useRealtimeChat instance for the
  // Chats page (ChatWindow/useMessages no longer mounts its own). It handles
  // notification sound, contacts-cache updates, and the single-flight refresh
  // of the open conversation. The legacy WebSocketProvider path was removed
  // from this page entirely (it is disabled via ENABLE_LEGACY_WEBSOCKET and
  // its invalidation effect duplicated the Pusher path if ever re-enabled).
  useRealtimeChat({
    enabled: true,
    selectedContactUid: selectedContactUid || null,
    playNotificationSound: true,
  });

  // Debounced: previously every keystroke in the search box fired a
  // contacts API request; now one request fires 300ms after typing stops.
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const {
    contacts,
    isLoading,
    isError,
    error,
    hasMore: hasMoreContacts,
    isLoadingMore: isLoadingMoreContacts,
    loadMore: loadMoreContacts,
  } = useContactsWithInfiniteScroll({
    search: debouncedSearch || undefined,
  });

  // Unread count - polling controlled by ENABLE_POLLING flag in useChat.ts
  const { total: unreadTotal, contacts: unreadByContact } = useUnreadCount();

  // NOTE: messages are fetched ONLY by ChatWindow via useMessages(). The
  // useChatMessages() call that used to live here issued a second,
  // independent GET (limit=100) for the same conversation on every select.

  // Mark as read mutation — the single, explicit mark-as-read trigger
  // (fires once when the user selects a conversation; see useChat.ts)
  const markAsReadMutation = useMarkAsRead();

  const formatLastTimestamp = (ts?: string | null) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();

    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // NOTE: Auto-select removed - start with empty state, user selects chat manually

  // NOTE: Message polling removed - using Pusher/Laravel Echo for real-time updates
  // Real-time message updates come through useRealtimeChat hook above

  const handleConversationSelect = useCallback(async (contactId: string) => {
    console.log('Selecting contact:', contactId);
    setSelectedContactUid(contactId);

    // Mark as read when selecting
    try {
      await markAsReadMutation.mutateAsync(contactId);
    } catch (e) {
      // Silent fail
    }
  }, [markAsReadMutation]);

  const handleBackToList = useCallback(() => {
    if (isMobile) {
      setSelectedContactUid('');
    }
  }, [isMobile]);

  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
  }, []);

  const toggleContactPanel = useCallback(() => {
    setContactDrawerTab('contact');
    setShowContactDrawer(prev => !prev);
  }, []);

  // Legacy WebSocket payload effect removed: it was a second invalidation
  // path for contacts/unread/messages that duplicated the Pusher realtime
  // path. The legacy socket is disabled (ENABLE_LEGACY_WEBSOCKET=false in
  // WebSocketProvider); if it is ever re-enabled it must NOT be reconnected
  // here while useRealtimeChat is active.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-base font-medium mb-1">Loading Chats</div>
          <div className="text-sm text-muted-foreground">Fetching your conversations...</div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">!</span>
          </div>
          <div className="text-lg font-semibold mb-2 text-destructive">Failed to Load Chats</div>
          <div className="text-sm text-muted-foreground mb-6">
            {(error as any)?.message || 'Unable to load conversations'}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Transform contacts to match ConversationList format with new fields
  const transformedConversations = contacts.map((contact: ChatContact) => {
    const contactId = contact._uid || contact.phone_number;
    // Use contact.unread_count directly from API (confirmed working)
    const unreadCount = contact.unread_count || 0;
    const formattedTime = formatLastTimestamp(contact.last_message_at);

    return {
      id: contactId,
      name: contact.name || contact.first_name || contact.phone_number,
      lastMessage: contact.last_message || '',
      time: formattedTime,
      lastTimestamp: contact.last_message_at,
      channel: 'whatsapp' as const,
      unread: unreadCount > 0,
      unreadCount,
      phone: contact.phone_number,
      labels: contact.labels || [],
      assignedUserUid: contact.assigned_user_uid,
      windowIsOpen: contact.reply_window_open,
      windowExpiresAt: contact.reply_window_expires_at,
      requiresTemplate: contact.requires_template,
    };
  });

  // Find selected conversation for ChatWindow
  const selectedConversation = contacts.find(
    (c: ChatContact) => (c._uid || c.phone_number) === selectedContactUid
  );

  // Convert to format ChatWindow expects
  const chatWindowConversation = selectedConversation
    ? {
        phone: selectedConversation.phone_number,
        name: selectedConversation.name || selectedConversation.first_name || selectedConversation.phone_number,
        last_message: selectedConversation.last_message || '',
        last_timestamp: selectedConversation.last_message_at || '',
        message_count: 0,
        direction: 'incoming' as const,
      }
    : undefined;

  // Unread counts for ConversationList
  const unreadCounts = {
    total: unreadTotal,
  };

  // Mobile view: show either conversation list or chat window
  if (isMobile) {
    if (selectedContactUid) {
      return (
        <div className="h-full w-full bg-background overflow-hidden">
          <ChatWindow
            conversationId={selectedConversation?.phone_number || selectedContactUid}
            selectedConversation={chatWindowConversation}
            isMobile={true}
            onBack={handleBackToList}
          />
        </div>
      );
    }

    return (
      <div className="h-full w-full bg-background overflow-hidden">
        <ConversationList
          conversations={transformedConversations}
          selectedId={selectedContactUid}
          onSelect={handleConversationSelect}
          isMobile={true}
          currentUserUid={currentUserUid}
          unreadCounts={unreadCounts}
          onSearchChange={handleSearchChange}
          onLoadMore={loadMoreContacts}
          hasMore={hasMoreContacts}
          isLoadingMore={isLoadingMoreContacts}
        />
      </div>
    );
  }

  // Desktop view: three-panel layout
  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Conversations Sidebar */}
      <div className="w-80 lg:w-96 h-full flex-shrink-0 border-r border-border">
        <ConversationList
          conversations={transformedConversations}
          selectedId={selectedContactUid}
          onSelect={handleConversationSelect}
          currentUserUid={currentUserUid}
          unreadCounts={unreadCounts}
          onSearchChange={handleSearchChange}
          onLoadMore={loadMoreContacts}
          hasMore={hasMoreContacts}
          isLoadingMore={isLoadingMoreContacts}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        {selectedContactUid ? (
          <ChatWindow
            conversationId={selectedConversation?.phone_number || selectedContactUid}
            selectedConversation={chatWindowConversation}
            onToggleContactPanel={toggleContactPanel}
            showContactPanel={showContactDrawer}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-muted/10">
            <div className="text-center max-w-sm px-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="h-12 w-12 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Select a Conversation</h2>
              <p className="text-sm text-muted-foreground">
                Choose a conversation from the list to start chatting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Combined Contact + Add Lead drawer */}
      {selectedContactUid && (
        <ContactChatDrawer
          open={showContactDrawer}
          onOpenChange={setShowContactDrawer}
          contactUid={selectedConversation?.phone_number || selectedContactUid}
          defaultTab={contactDrawerTab}
        />
      )}
    </div>
  );
}
