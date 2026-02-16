import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationList } from '@/components/ConversationList';
import { ChatWindow } from '@/components/ChatWindow';
import { ContactDetailPanel } from '@/components/ContactDetailPanel';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useWebSocket } from '@/context/WebSocketProvider';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, PanelRightClose, PanelRightOpen, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useChatContacts,
  useUnreadCount,
  useChatMessages,
  useMarkAsRead,
  chatKeys,
} from '@/hooks/whatsapp/useChat';
import { useRealtimeChat } from '@/hooks/whatsapp/useRealtimeChat';
import type { ChatContact } from '@/services/whatsapp/chatService';

// NOTE: Polling is now controlled by ENABLE_POLLING flag in useChat.ts
// Set ENABLE_POLLING = true in useChat.ts to re-enable polling as fallback

export default function Chats() {
  const [selectedContactUid, setSelectedContactUid] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactPanel, setShowContactPanel] = useState(false);
  const isMobile = useIsMobile();
  const { payloads } = useWebSocket();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get current user UID for filtering "Mine" conversations
  const currentUserUid = user?._uid || user?.id || '';

  // React Query hooks
  // Real-time updates via Pusher/Laravel Echo (must be before polling hooks)
  const {
    isConnected: isRealtimeConnected,
    connectionError: realtimeError,
    connectionState: pusherState
  } = useRealtimeChat({
    enabled: true,
    selectedContactUid: selectedContactUid || null,
    playNotificationSound: true,
  });

  // Debug log for Pusher connection status
  useEffect(() => {
    console.log('Chats: Pusher connection status:', {
      isConnected: isRealtimeConnected,
      state: pusherState,
      error: realtimeError,
    });
  }, [isRealtimeConnected, pusherState, realtimeError]);

  const {
    contacts,
    total: contactsTotal,
    isLoading,
    isError,
    error,
    refetch: refetchContacts,
  } = useChatContacts({
    search: searchQuery || undefined,
  });

  // Unread count - polling controlled by ENABLE_POLLING flag in useChat.ts
  const { total: unreadTotal, contacts: unreadByContact } = useUnreadCount();

  // Messages for selected contact - no polling when real-time connected
  const {
    messages,
    contact: currentContact,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useChatMessages({
    contactUid: selectedContactUid || null,
    enabled: !!selectedContactUid,
  });

  // Mark as read mutation
  const markAsReadMutation = useMarkAsRead();

  const normalize = (p?: string) => (p ? String(p).replace(/^\+/, '') : '');

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
    setShowContactPanel(prev => !prev);
  }, []);

  // Live updates via persistent WhatsApp WebSocket
  useEffect(() => {
    if (payloads.length > 0) {
      const latestPayload = payloads[payloads.length - 1];
      const { phone, name, contact, message } = latestPayload;

      console.log('Processing WebSocket payload:', {
        phone,
        name,
        is_new: contact?.is_new,
        message_text: message?.text,
      });

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });

      // If the message is for the currently selected contact, refetch messages
      const phoneKey = normalize(phone);
      const wsContactUid = contact?._uid || contact?.uid;
      const selectedKey = normalize(selectedContactUid);

      // Find the selected contact to get its phone number for comparison
      const selectedContact = contacts.find(
        (c: ChatContact) => (c._uid || c.phone_number) === selectedContactUid
      );
      const selectedPhone = normalize(selectedContact?.phone_number);

      // Check if this message is for the selected contact
      const isMatchingContact =
        (phoneKey && selectedPhone && phoneKey === selectedPhone) ||
        (phoneKey && selectedKey && phoneKey === selectedKey) ||
        (wsContactUid && wsContactUid === selectedContactUid);

      if (isMatchingContact) {
        console.log('WebSocket message for selected contact - refreshing messages');
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(selectedContactUid, {}),
          exact: false,
        });
      }
    }
  }, [payloads, selectedContactUid, contacts, queryClient]);

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
            onClick={() => refetchContacts()}
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
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        {selectedContactUid ? (
          <>
            {/* Header Actions */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              {/* Real-time Connection Indicator */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-help"
                title={isRealtimeConnected
                  ? `Real-time connected (${pusherState})`
                  : (realtimeError || `Connecting... (${pusherState})`)}
              >
                {isRealtimeConnected ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600 hidden sm:inline">Live</span>
                  </>
                ) : pusherState === 'connecting' ? (
                  <>
                    <Wifi className="h-3 w-3 text-amber-500 animate-pulse" />
                    <span className="text-amber-600 hidden sm:inline">Connecting</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 hidden sm:inline">Offline</span>
                  </>
                )}
              </div>
              {/* Contact Panel Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleContactPanel}
                title={showContactPanel ? 'Hide contact details' : 'Show contact details'}
              >
                {showContactPanel ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
              </Button>
            </div>
            <ChatWindow
              conversationId={selectedConversation?.phone_number || selectedContactUid}
              selectedConversation={chatWindowConversation}
            />
          </>
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

      {/* Contact Detail Panel - Right Sidebar */}
      {showContactPanel && selectedContactUid && (
        <div className="w-80 h-full flex-shrink-0">
          <ContactDetailPanel
            contactUid={selectedContactUid}
            onClose={toggleContactPanel}
          />
        </div>
      )}
    </div>
  );
}
