// src/context/RealtimeChatProvider.tsx
// Global provider for real-time chat updates (unread counts, etc.)
// Uses singleton Pusher subscription - safe to use alongside useRealtimeChat hook

import { useEffect } from 'react';
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

export function RealtimeChatProvider({ children }: RealtimeChatProviderProps) {
  const queryClient = useQueryClient();

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
          console.log('RealtimeChatProvider: New incoming message, invalidating unread count');

          // Invalidate unread count to trigger refetch
          queryClient.invalidateQueries({
            queryKey: chatKeys.unreadCount(),
            exact: true,
          });

          // Also invalidate contacts list to update last_message
          queryClient.invalidateQueries({
            queryKey: chatKeys.contacts(),
            exact: false,
          });
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
      unsubscribe();
    };
  }, [queryClient]);

  return <>{children}</>;
}
