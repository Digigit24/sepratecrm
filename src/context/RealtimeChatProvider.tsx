// src/context/RealtimeChatProvider.tsx
// Global provider for real-time chat updates (unread counts, etc.)
// Uses singleton Pusher subscription - safe to use alongside useRealtimeChat hook

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  subscribeToVendorChannel,
  getCurrentVendorUid,
  VendorChannelBroadcastEvent,
} from '@/services/pusherService';
import { chatKeys } from '@/hooks/whatsapp/useChat';

interface RealtimeChatProviderProps {
  children: React.ReactNode;
}

// Minimum gap between refetches triggered by incoming messages.
// A burst of N incoming messages previously fired N unread GETs + N contact
// list GETs app-wide (2×N requests); now at most one refetch pair per window
// (leading edge immediate, burst collapses into one trailing refetch).
// Existing conversations still update instantly — useRealtimeChat applies
// incoming messages to the contacts cache locally without any network call.
const REALTIME_REFETCH_THROTTLE_MS = 10_000;

export function RealtimeChatProvider({ children }: RealtimeChatProviderProps) {
  const queryClient = useQueryClient();
  const lastRefetchRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const vendorUid = getCurrentVendorUid();

    if (!vendorUid) {
      console.log('RealtimeChatProvider: No vendor UID, skipping subscription');
      return;
    }

    console.log('RealtimeChatProvider: Setting up global Pusher listener');

    // Subscribe to vendor channel for global updates
    // This uses the singleton pattern - won't create duplicate subscriptions
    const unsubscribe = subscribeToVendorChannel(vendorUid, {
      onVendorBroadcast: (data: VendorChannelBroadcastEvent) => {
        console.log('RealtimeChatProvider: VendorChannelBroadcast received', {
          contactUid: data.contactUid,
          isNewIncoming: data.isNewIncomingMessage,
        });

        // Only handle incoming messages for unread count updates
        if (data.isNewIncomingMessage) {
          const invalidateNow = () => {
            lastRefetchRef.current = Date.now();
            // Refetch unread count (badge)
            queryClient.invalidateQueries({
              queryKey: chatKeys.unreadCount(),
              exact: true,
            });
            // Refetch contacts list — needed so brand-new conversations
            // appear; existing ones are already updated locally by
            // useRealtimeChat. invalidateQueries only hits the network for
            // ACTIVE queries (i.e. when the Chats page is mounted).
            queryClient.invalidateQueries({
              queryKey: chatKeys.contacts(),
              exact: false,
            });
          };

          const elapsed = Date.now() - lastRefetchRef.current;
          if (elapsed >= REALTIME_REFETCH_THROTTLE_MS) {
            invalidateNow();
          } else if (!pendingTimerRef.current) {
            pendingTimerRef.current = setTimeout(() => {
              pendingTimerRef.current = null;
              invalidateNow();
            }, REALTIME_REFETCH_THROTTLE_MS - elapsed);
          }
        }
      },
      onConnected: () => {
        console.log('RealtimeChatProvider: Connected to Pusher');
      },
      onError: (error) => {
        console.error('RealtimeChatProvider: Pusher error', error);
      },
    });

    return () => {
      console.log('RealtimeChatProvider: Cleaning up');
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [queryClient]);

  return <>{children}</>;
}
