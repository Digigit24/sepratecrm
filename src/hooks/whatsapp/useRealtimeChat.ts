// src/hooks/whatsapp/useRealtimeChat.ts
// Hook for real-time WhatsApp chat updates using Pusher/Laravel Echo

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  subscribeToVendorChannel,
  disconnectEcho,
  getCurrentVendorUid,
  getConnectionState,
  ContactMessageEvent,
  ContactUpdatedEvent,
  MessageStatusEvent,
  VendorChannelBroadcastEvent,
} from '@/services/pusherService';
import { chatKeys } from '@/hooks/whatsapp/useChat';
import type { ChatContact, ChatMessage, ChatMessagesResponse, ChatContactsResponse } from '@/services/whatsapp/chatService';

export interface RealtimeMessage {
  _uid: string;
  message: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
  is_incoming_message: boolean;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  messaged_at: string;
  formatted_message_time: string;
  media_url?: string;
  media_type?: string;
  file_name?: string;
}

export interface UseRealtimeChatOptions {
  enabled?: boolean;
  selectedContactUid?: string | null;
  onNewMessage?: (message: RealtimeMessage, contactUid: string) => void;
  onMessageStatusUpdate?: (messageUid: string, status: string) => void;
  playNotificationSound?: boolean;
}

export interface UseRealtimeChatReturn {
  isConnected: boolean;
  lastMessage: RealtimeMessage | null;
  connectionError: string | null;
  connectionState: string;
}

export function useRealtimeChat(options: UseRealtimeChatOptions = {}): UseRealtimeChatReturn {
  const {
    enabled = true,
    selectedContactUid = null,
    onNewMessage,
    onMessageStatusUpdate,
    playNotificationSound = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Initialize notification sound
  useEffect(() => {
    if (typeof window !== 'undefined' && playNotificationSound) {
      // Create a simple notification sound using Web Audio API
      notificationSoundRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');
    }
  }, [playNotificationSound]);

  // Play notification sound
  const playSound = useCallback(() => {
    if (notificationSoundRef.current && playNotificationSound) {
      notificationSoundRef.current.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }, [playNotificationSound]);

  // Transform Pusher event to our message format
  const transformMessage = useCallback((data: ContactMessageEvent): RealtimeMessage => {
    return {
      _uid: data.message.uid,
      message: data.message.body,
      message_type: data.message.message_type,
      is_incoming_message: data.message.is_incoming_message,
      direction: data.message.is_incoming_message ? 'incoming' : 'outgoing',
      status: data.message.status,
      messaged_at: data.message.messaged_at,
      formatted_message_time: data.message.formatted_message_time,
      media_url: data.message.media?.url,
      media_type: data.message.media?.mime_type,
      file_name: data.message.media?.file_name,
    };
  }, []);

   const handleNewMessage = useCallback((data: ContactMessageEvent) => {
    console.log('🔴 useRealtimeChat: New message received via Pusher', data);
 
    const contactUid = data.contact?.uid;
    const message = transformMessage(data);
 
    setLastMessage(message);
 
    // Play sound for incoming messages
    if (message.is_incoming_message) {
      playSound();
    }
 
    // Call custom handler
    onNewMessage?.(message, contactUid);
 
    // Transform Pusher message to ChatMessage format for cache
    const chatMessage: ChatMessage = {
      _uid: data.message.uid,
      text: data.message.body,
      message_type: data.message.message_type,
      direction: data.message.is_incoming_message ? 'incoming' : 'outgoing',
      status: data.message.status,
      timestamp: data.message.messaged_at,
      formatted_time: data.message.formatted_message_time,
      media_url: data.message.media?.url,
      mime_type: data.message.media?.mime_type,
      file_name: data.message.media?.file_name,
    };
 
    // DIRECTLY UPDATE messages cache - no API call!
    if (contactUid) {
      // Update messages for this contact (all matching query keys)
      queryClient.setQueriesData<ChatMessagesResponse>(
        { queryKey: chatKeys.messages(contactUid, {}) },
        (oldData) => {
          if (!oldData) return oldData;
 
          // Check if message already exists (avoid duplicates)
          const exists = oldData.messages?.some(m => m._uid === chatMessage._uid);
          if (exists) {
            console.log('🔴 Message already in cache, skipping');
            return oldData;
          }
 
          console.log('🔴 Adding message to cache for contact:', contactUid);
          return {
            ...oldData,
            messages: [...(oldData.messages || []), chatMessage],
            total: (oldData.total || 0) + 1,
          };
        }
      );
    }
 
    // DIRECTLY UPDATE contacts cache - update last_message and unread count
    queryClient.setQueriesData<ChatContactsResponse>(
      { queryKey: chatKeys.contacts() },
      (oldData) => {
        if (!oldData) return oldData;
 
        const updatedContacts = oldData.contacts.map((contact: ChatContact) => {
          if (contact._uid === contactUid) {
            console.log('🔴 Updating contact in cache:', contactUid);
            return {
              ...contact,
              last_message: data.message.body,
              last_message_at: data.message.messaged_at,
              // Increment unread only for incoming messages not in selected chat
              unread_count: data.message.is_incoming_message && selectedContactUid !== contactUid
                ? (contact.unread_count || 0) + 1
                : contact.unread_count || 0,
            };
          }
          return contact;
        });
 
        // Sort by last_message_at (most recent first)
        updatedContacts.sort((a: ChatContact, b: ChatContact) => {
          const timeA = new Date(a.last_message_at || 0).getTime();
          const timeB = new Date(b.last_message_at || 0).getTime();
          return timeB - timeA;
        });
 
        return {
          ...oldData,
          contacts: updatedContacts,
        };
      }
    );
 
    // DIRECTLY UPDATE unread count cache
    if (data.message.is_incoming_message && selectedContactUid !== contactUid) {
      queryClient.setQueryData<{ total: number; contacts: Record<string, number> }>(
        chatKeys.unreadCount(),
        (oldData) => {
          if (!oldData) return { total: 1, contacts: { [contactUid]: 1 } };
 
          const newContacts = { ...oldData.contacts };
          newContacts[contactUid] = (newContacts[contactUid] || 0) + 1;
 
          return {
            total: oldData.total + 1,
            contacts: newContacts,
          };
        }
      );
    }
  }, [queryClient, selectedContactUid, onNewMessage, transformMessage, playSound]);

  // Handle contact updated event
const handleContactUpdated = useCallback((data: ContactUpdatedEvent) => {
    console.log('🔵 useRealtimeChat: Contact updated via Pusher', data);
 
    const contactUid = data.contact?.uid;
 
    // DIRECTLY UPDATE contacts cache
    queryClient.setQueriesData<ChatContactsResponse>(
      { queryKey: chatKeys.contacts() },
      (oldData) => {
        if (!oldData) return oldData;
 
        const updatedContacts = oldData.contacts.map((contact: ChatContact) => {
          if (contact._uid === contactUid) {
            console.log('🔵 Updating contact details in cache:', contactUid);
            return {
              ...contact,
              name: data.contact.full_name || contact.name,
              labels: data.contact.labels || contact.labels,
              assigned_user_uid: data.contact.assigned_user?.uid || contact.assigned_user_uid,
              unread_count: data.contact.unread_messages_count ?? contact.unread_count,
            };
          }
          return contact;
        });
 
        return {
          ...oldData,
          contacts: updatedContacts,
        };
      }
    );
 
    // DIRECTLY UPDATE unread count cache
    queryClient.setQueryData<{ total: number; contacts: Record<string, number> }>(
      chatKeys.unreadCount(),
      (oldData) => {
        if (!oldData) return oldData;
 
        const newContacts = { ...oldData.contacts };
        newContacts[contactUid] = data.contact.unread_messages_count || 0;
 
        // Recalculate total
        const newTotal = Object.values(newContacts).reduce((sum, count) => sum + count, 0);
 
        return {
          total: newTotal,
          contacts: newContacts,
        };
      }
    );
 
    // If viewing this contact, update chat context
    if (selectedContactUid && contactUid === selectedContactUid) {
      queryClient.setQueryData(
        chatKeys.chatContext(selectedContactUid),
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            contact: {
              ...oldData.contact,
              name: data.contact.full_name || oldData.contact?.name,
              labels: data.contact.labels || oldData.contact?.labels,
            },
          };
        }
      );
    }
  }, [queryClient, selectedContactUid]);

  // Handle message status event
  const handleMessageStatus = useCallback((data: MessageStatusEvent) => {
    console.log('useRealtimeChat: Message status updated', data);

    const messageUid = data.message?.uid;
    const status = data.message?.status;

    // Call custom handler
    onMessageStatusUpdate?.(messageUid, status);

    // DIRECTLY UPDATE message status in cache
    if (selectedContactUid && messageUid && status) {
      queryClient.setQueriesData<ChatMessagesResponse>(
        { queryKey: chatKeys.messages(selectedContactUid, {}) },
        (oldData) => {
          if (!oldData) return oldData;

          const updatedMessages = oldData.messages?.map(msg => {
            if (msg._uid === messageUid) {
              return { ...msg, status };
            }
            return msg;
          });

          return {
            ...oldData,
            messages: updatedMessages,
          };
        }
      );
    }
  }, [queryClient, selectedContactUid, onMessageStatusUpdate]);

  // Handle VendorChannelBroadcast event (new simplified API format)
  const handleVendorBroadcast = useCallback((data: VendorChannelBroadcastEvent) => {
    console.log('🟢 useRealtimeChat: VendorChannelBroadcast received', data);

    const { contactUid, isNewIncomingMessage, message_status, lastMessageUid } = data;

    // If new incoming message, refetch to get latest messages from API
    if (isNewIncomingMessage && contactUid) {
      console.log('🟢 New incoming message, refetching data for:', contactUid);

      // Force refetch messages for this contact
      queryClient.refetchQueries({
        queryKey: chatKeys.messages(contactUid, {}),
        exact: false,
      });

      // Force refetch contacts to update last_message and unread_count
      queryClient.refetchQueries({
        queryKey: chatKeys.contacts(),
        exact: false,
      });

      // Play notification sound
      playSound();
    }

    // Update message status if provided
    if (message_status && lastMessageUid && selectedContactUid) {
      queryClient.setQueriesData<ChatMessagesResponse>(
        { queryKey: chatKeys.messages(selectedContactUid, {}) },
        (oldData) => {
          if (!oldData) return oldData;

          const updatedMessages = oldData.messages?.map(msg => {
            if (msg._uid === lastMessageUid) {
              return { ...msg, status: message_status };
            }
            return msg;
          });

          return {
            ...oldData,
            messages: updatedMessages,
          };
        }
      );
    }
  }, [queryClient, selectedContactUid, playSound]);

  // Store handlers in refs to avoid re-subscription on every change
  const handlersRef = useRef({
    onNewMessage: handleNewMessage,
    onContactUpdated: handleContactUpdated,
    onMessageStatus: handleMessageStatus,
    onVendorBroadcast: handleVendorBroadcast,
  });

  // Update refs when handlers change (without triggering re-subscription)
  useEffect(() => {
    handlersRef.current = {
      onNewMessage: handleNewMessage,
      onContactUpdated: handleContactUpdated,
      onMessageStatus: handleMessageStatus,
      onVendorBroadcast: handleVendorBroadcast,
    };
  }, [handleNewMessage, handleContactUpdated, handleMessageStatus, handleVendorBroadcast]);

  // Subscribe to real-time channel - only once on mount
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const vendorUid = getCurrentVendorUid();

    if (!vendorUid) {
      console.warn('useRealtimeChat: No vendor UID available');
      setConnectionError('WhatsApp vendor not configured');
      return;
    }

    console.log('useRealtimeChat: Subscribing to vendor channel', vendorUid);

    // Subscribe to the vendor channel with wrapper functions that use refs
    const unsubscribe = subscribeToVendorChannel(vendorUid, {
      onNewMessage: (data) => handlersRef.current.onNewMessage(data),
      onContactUpdated: (data) => handlersRef.current.onContactUpdated(data),
      onMessageStatus: (data) => handlersRef.current.onMessageStatus(data),
      onVendorBroadcast: (data) => handlersRef.current.onVendorBroadcast(data),
      onConnected: () => {
        console.log('useRealtimeChat: Connected to Pusher');
        setIsConnected(true);
        setConnectionError(null);
      },
      onDisconnected: () => {
        console.log('useRealtimeChat: Disconnected from Pusher');
        setIsConnected(false);
      },
      onError: (error) => {
        console.error('useRealtimeChat: Connection error', error);
        setIsConnected(false);
        setConnectionError(error?.message || 'Connection failed');
      },
    });

    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount only
    return () => {
      console.log('useRealtimeChat: Cleaning up subscription');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enabled]); // Only re-subscribe when enabled changes

  // Disconnect when component unmounts completely
  useEffect(() => {
    return () => {
      // Only disconnect if this is the last component using Echo
      // In practice, you might want more sophisticated lifecycle management
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    connectionError,
    connectionState: getConnectionState(),
  };
}

// Export a simpler hook for just connection status
export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const vendorUid = getCurrentVendorUid();
    if (!vendorUid) return;

    const unsubscribe = subscribeToVendorChannel(vendorUid, {
      onConnected: () => setIsConnected(true),
      onDisconnected: () => setIsConnected(false),
    });

    return unsubscribe;
  }, []);

  return isConnected;
}
