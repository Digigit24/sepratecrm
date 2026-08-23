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
  DigicrmMessageEvent,
  DigicrmStatusEvent,
} from '@/services/pusherService';
import {
  readRichMessage,
  needsSingleMessageRefetch,
  envelopeToCacheRow,
  mergeRowIntoMessages,
  markRichEventSeen,
  scheduleThinRefetch,
  cancelThinRefetch,
} from '@/lib/whatsapp/richRealtime';
import { chatKeys } from '@/hooks/whatsapp/useChat';
import { chatService } from '@/services/whatsapp/chatService';
import type { ChatContact, ChatMessage, ChatMessagesResponse, ChatContactsResponse } from '@/services/whatsapp/chatService';
import type { QueryClient } from '@tanstack/react-query';

// ─── Single-flight refresh of the open conversation ─────────────────────────
// The VendorChannelBroadcast payload carries no message body, so the open
// conversation must be fetched once per event. This module-level guard makes
// that fetch single-flight per contact: even if multiple components mount
// useRealtimeChat simultaneously, one incoming message triggers exactly ONE
// messages GET. The result is written into the shared React Query cache under
// chatKeys.messages(contactUid, {}) — the key useMessages() (ChatWindow)
// subscribes to — so every consumer syncs from the same fetch.
const inFlightMessageRefresh = new Map<string, Promise<void>>();

function refreshOpenConversation(queryClient: QueryClient, contactUid: string): Promise<void> {
  const existing = inFlightMessageRefresh.get(contactUid);
  if (existing) return existing;

  const p = chatService
    .getContactMessages(contactUid, { page: 1, limit: 50 })
    .then((result) => {
      queryClient.setQueryData(chatKeys.messages(contactUid, {}), result);
    })
    .catch((err) => {
      console.error('useRealtimeChat: failed to refresh open conversation', err);
    })
    .finally(() => {
      inFlightMessageRefresh.delete(contactUid);
    });

  inFlightMessageRefresh.set(contactUid, p);
  return p;
}

// ─── Rich events supersede the thin one ─────────────────────────────────────
// Laravel's VendorChannelBroadcast and DigiCRM's DigicrmMessage BOTH fire for
// the same inbound message, and DigiCRM's usually lands slightly later (it goes
// out after n8n relays the webhook). Refetching the moment the thin event
// arrives would therefore still cost one conversation GET per message even
// though the rich event was about to render it for free.
//
// The waiting/cancelling rules live in lib/whatsapp/richRealtime so every
// consumer of the channel shares one view of them; this is just the wiring.

// ─── Narrow refetch of ONE message ──────────────────────────────────────────
// Used only when the rich payload cannot be trusted: the server shrank it past
// Pusher's 10KB limit, or n8n did not forward enough for the envelope to match
// its own declared type.
//
// ONE message, never the conversation - fetching the conversation here would
// reintroduce exactly the cost this whole change removes. `getMessage(uid)` is
// the real single-message endpoint; when the envelope carries no server uid
// (n8n currently pins only `message_wamid`, so `id` can be empty) we fall back
// to the newest-message page, which is still one message.
//
// Single-flight per contact, same as the full refresh above.
const inFlightSingleRefresh = new Map<string, Promise<void>>();

function refreshSingleMessage(
  queryClient: QueryClient,
  contactUid: string,
  messageUid: string | null,
): Promise<void> {
  const existing = inFlightSingleRefresh.get(contactUid);
  if (existing) return existing;

  const fetchOne: Promise<ChatMessage | undefined> = messageUid
    ? chatService.getMessage(messageUid)
    : chatService
        .getContactMessages(contactUid, { page: 1, limit: 1 })
        .then((result) => result?.messages?.[0]);

  const p = fetchOne
    .then((fresh) => {
      if (!fresh) return;
      queryClient.setQueriesData<ChatMessagesResponse>(
        { queryKey: chatKeys.messages(contactUid, {}) },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            messages: mergeRowIntoMessages(
              (oldData.messages ?? []) as unknown as Record<string, unknown>[],
              fresh as unknown as Record<string, unknown>,
            ) as unknown as ChatMessage[],
          };
        },
      );
    })
    .catch((err) => {
      console.error('useRealtimeChat: failed to refresh single message', err);
    })
    .finally(() => {
      inFlightSingleRefresh.delete(contactUid);
    });

  inFlightSingleRefresh.set(contactUid, p);
  return p;
}

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

    // Move contact to top of conversation list locally — no API call.
    // This covers both regular incoming/outgoing messages AND campaign messages.
    if (contactUid) {
      const now = new Date().toISOString();

      queryClient.setQueriesData<ChatContactsResponse>(
        { queryKey: chatKeys.contacts() },
        (oldData) => {
          if (!oldData?.contacts?.length) return oldData;

          const contactIndex = oldData.contacts.findIndex((c: ChatContact) => c._uid === contactUid);
          if (contactIndex === -1) return oldData; // Not in loaded pages yet — skip

          const contact = oldData.contacts[contactIndex];
          const isCurrentlyOpen = selectedContactUid === contactUid;

          const updatedContact: ChatContact = {
            ...contact,
            last_message_at: now,
            unread_count: (isNewIncomingMessage && !isCurrentlyOpen)
              ? (contact.unread_count || 0) + 1
              : contact.unread_count || 0,
          };

          // Rebuild array: updated contact first, then everyone else in their original order
          const otherContacts = oldData.contacts.filter((c: ChatContact) => c._uid !== contactUid);
          return {
            ...oldData,
            contacts: [updatedContact, ...otherContacts],
          };
        }
      );

      // Play notification sound for incoming messages
      if (isNewIncomingMessage) {
        playSound();
      }

      // For the currently open contact only: fetch latest messages so new ones
      // appear. Single-flight + direct cache write: exactly one GET per event
      // regardless of how many components are listening, and no dependency on
      // a mounted React Query observer (works after useChatMessages removal).
      //
      // Deferred by RICH_GRACE_MS once DigiCRM's rich events are known to be
      // live, so the rich event for this same message can cancel it and render
      // from the socket instead. Falls straight through to an immediate refetch
      // when no rich event has ever been seen.
      if (isNewIncomingMessage && contactUid === selectedContactUid) {
        scheduleThinRefetch(contactUid, () => refreshOpenConversation(queryClient, contactUid));
      }
    }

    // Update message status in cache if delivery receipt came in
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

  // Handle DigicrmMessage: the FULL envelope, published by DigiCRM's own
  // inbound webhook. This is the path that renders without a network call.
  const handleDigicrmMessage = useCallback((data: DigicrmMessageEvent) => {
    const event = readRichMessage(data);
    if (!event) {
      console.warn('useRealtimeChat: DigicrmMessage carried no renderable message', data);
      return;
    }

    // From here on the thin Laravel event is redundant for this conversation.
    markRichEventSeen();
    const contactUid = event.contactUid;
    if (contactUid) cancelThinRefetch(contactUid);

    const incoming = event.message.direction === 'in';
    if (incoming) playSound();

    const asRealtimeMessage: RealtimeMessage = {
      _uid: event.message.id,
      message: event.message.text ?? '',
      message_type: event.message.type as RealtimeMessage['message_type'],
      is_incoming_message: incoming,
      direction: incoming ? 'incoming' : 'outgoing',
      status: (event.message.status ?? 'delivered') as RealtimeMessage['status'],
      messaged_at: event.message.timestamp,
      formatted_message_time: '',
      media_url: event.message.media?.url ?? undefined,
      media_type: event.message.media?.mime ?? undefined,
      file_name: event.message.media?.filename ?? undefined,
    };
    setLastMessage(asRealtimeMessage);

    if (!contactUid) {
      // Nothing to key the conversation on. The thin event still owns the
      // contacts-list bookkeeping, so this degrades to today's behaviour.
      return;
    }

    onNewMessage?.(asRealtimeMessage, contactUid);

    // Keep the conversation list in step. Deliberately NOT unread_count: that
    // is incremented by the thin Laravel event, which fires for every message
    // whether or not DigiCRM publishes, and double-counting it here would be
    // worse than the refetch this change removes.
    queryClient.setQueriesData<ChatContactsResponse>(
      { queryKey: chatKeys.contacts() },
      (oldData) => {
        if (!oldData?.contacts?.length) return oldData;
        const index = oldData.contacts.findIndex((c: ChatContact) => c._uid === contactUid);
        if (index === -1) return oldData;

        const updated: ChatContact = {
          ...oldData.contacts[index],
          last_message: event.message.text ?? oldData.contacts[index].last_message,
          last_message_at: event.message.timestamp,
        };
        return {
          ...oldData,
          contacts: [updated, ...oldData.contacts.filter((c: ChatContact) => c._uid !== contactUid)],
        };
      },
    );

    // The payload is not always trustworthy. It was shrunk to fit Pusher's 10KB
    // limit, or n8n forwarded less than the envelope's own type promises (an
    // image arriving as a text envelope with no media). Fetch that ONE message
    // rather than render something wrong - and never the whole conversation,
    // which is the cost this change exists to remove.
    if (needsSingleMessageRefetch(event)) {
      console.log('useRealtimeChat: rich event too thin to render, refetching one message');
      void refreshSingleMessage(queryClient, contactUid, event.message.id || null);
      return;
    }

    // The whole point: straight into the cache, no network call.
    queryClient.setQueriesData<ChatMessagesResponse>(
      { queryKey: chatKeys.messages(contactUid, {}) },
      (oldData) => {
        if (!oldData) return oldData;
        const next = mergeRowIntoMessages(
          (oldData.messages ?? []) as unknown as Record<string, unknown>[],
          envelopeToCacheRow(event.message, contactUid),
        ) as unknown as ChatMessage[];
        return {
          ...oldData,
          messages: next,
          total: next.length,
        };
      },
    );
  }, [queryClient, playSound, onNewMessage]);

  // Handle DigicrmMessageStatus: flat delivery receipt, applied in place.
  const handleDigicrmStatus = useCallback((data: DigicrmStatusEvent) => {
    const { wamid, id, status, error } = data;
    if (!status || (!wamid && !id)) return;

    markRichEventSeen();
    onMessageStatusUpdate?.(id ?? wamid ?? '', status);

    const contactUid = data.contact_uid ?? selectedContactUid;
    if (!contactUid) return;

    queryClient.setQueriesData<ChatMessagesResponse>(
      { queryKey: chatKeys.messages(contactUid, {}) },
      (oldData) => {
        if (!oldData?.messages) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((msg) => {
            const row = msg as unknown as Record<string, unknown>;
            const matches =
              (wamid && row.wamid === wamid) ||
              (id && (row._uid === id || row.id === id));
            if (!matches) return msg;
            // Ticks are outbound-only. An inbound row has no delivery state of
            // ours to report, and stamping one would draw a tick on the other
            // party's message.
            const isIncoming =
              row.is_incoming_message === true ||
              row.direction === 'in' ||
              row.direction === 'incoming';
            if (isIncoming) return msg;
            return {
              ...msg,
              status: status as ChatMessage['status'],
              ...(error ? { whatsapp_message_error: error } : {}),
            };
          }),
        };
      },
    );
  }, [queryClient, selectedContactUid, onMessageStatusUpdate]);

  // Store handlers in refs to avoid re-subscription on every change
  const handlersRef = useRef({
    onNewMessage: handleNewMessage,
    onContactUpdated: handleContactUpdated,
    onMessageStatus: handleMessageStatus,
    onVendorBroadcast: handleVendorBroadcast,
    onDigicrmMessage: handleDigicrmMessage,
    onDigicrmMessageStatus: handleDigicrmStatus,
  });

  // Update refs when handlers change (without triggering re-subscription)
  useEffect(() => {
    handlersRef.current = {
      onNewMessage: handleNewMessage,
      onContactUpdated: handleContactUpdated,
      onMessageStatus: handleMessageStatus,
      onVendorBroadcast: handleVendorBroadcast,
      onDigicrmMessage: handleDigicrmMessage,
      onDigicrmMessageStatus: handleDigicrmStatus,
    };
  }, [
    handleNewMessage, handleContactUpdated, handleMessageStatus,
    handleVendorBroadcast, handleDigicrmMessage, handleDigicrmStatus,
  ]);

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
      onDigicrmMessage: (data) => handlersRef.current.onDigicrmMessage(data),
      onDigicrmMessageStatus: (data) => handlersRef.current.onDigicrmMessageStatus(data),
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
