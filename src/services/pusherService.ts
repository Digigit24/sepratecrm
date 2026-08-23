// src/services/pusherService.ts
// Real-time messaging service using Pusher/Laravel Echo

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_CONFIG } from '@/lib/apiConfig';
import { tokenManager } from '@/lib/client';
import {
  whatsappChatService,
  isWhatsappEndpointUnavailable,
  type RealtimeGrant,
} from '@/services/whatsappChatService';

// Make Pusher available globally for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<any> | null;
  }
}

window.Pusher = Pusher;

// LAST-RESORT connection defaults.
//
// These are not the source of truth: the grant is. They only happen to match
// DigiCRM's settings.py defaults (PUSHER_KEY / PUSHER_CLUSTER) today, so the
// moment that server points at a different Pusher app, a hardcoded key here
// connects to the wrong app and every `auth` the backend signs fails the
// signature check — with no error more helpful than subscription_error.
const PUSHER_CONFIG = {
  key: '649db422ae8f2e9c7a9d',
  cluster: 'ap2',
  forceTLS: true,
  // Enable logging in development
  enableLogging: import.meta.env.DEV,
};

// Get vendor UID from localStorage
const getVendorUid = (): string | null => {
  try {
    const userJson = localStorage.getItem('celiyo_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      return user?.tenant?.whatsapp_vendor_uid || null;
    }
  } catch (error) {
    console.error('Failed to get WhatsApp Vendor UID:', error);
  }
  return null;
};

// Get access token - use the login access_token (long encrypted JWT), NOT whatsapp_api_token
const getAccessToken = (): string | null => {
  // The login access_token is stored in 'celiyo_access_token' via tokenManager
  // This is the long encrypted JWT that the Laravel backend expects for broadcasting auth
  const loginAccessToken = tokenManager.getAccessToken();

  if (loginAccessToken) {
    console.log('Pusher: Using login access_token (length:', loginAccessToken.length, ')');
    return loginAccessToken;
  }

  return null;
};

// NOTE: there is deliberately no `getVendorApiKey()` here any more.
//
// This service used to read `celiyo_user.tenant.whatsapp_api_token` from
// localStorage and send it as a bearer to Laravel's `/api/broadcasting/auth`.
// That endpoint additionally accepted an UNVERIFIED JWT, so the whole path was
// a cross-tenant realtime-read primitive — and the token itself grants full
// control of the WhatsApp Business account.
//
// Channel auth now goes through DigiCRM's short-lived, single-channel grant
// (services/whatsappChatService.getRealtimeGrant), signed against the user's own
// JWT and scoped to one socket and one channel. Nothing long-lived is held.

// Event types from Laravel broadcasting
export interface ContactMessageEvent {
  contact: {
    uid: string;
    phone_number: string;
    full_name: string;
    name_initials: string;
    labels: any[];
    assigned_user: any;
  };
  message: {
    uid: string;
    body: string;
    message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template';
    is_incoming_message: boolean;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    messaged_at: string;
    formatted_message_time: string;
    media?: {
      url: string;
      mime_type: string;
      file_name?: string;
    };
  };
}

export interface ContactUpdatedEvent {
  contact: {
    uid: string;
    phone_number: string;
    full_name: string;
    labels: any[];
    assigned_user: any;
    unread_messages_count: number;
  };
}

export interface MessageStatusEvent {
  message: {
    uid: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    updated_at: string;
  };
}

// VendorChannelBroadcast event payload (new simplified format from API)
export interface VendorChannelBroadcastEvent {
  contactUid: string;
  contactWaId: string;
  isNewIncomingMessage: boolean;
  message_status?: 'sent' | 'delivered' | 'read' | 'failed';
  lastMessageUid: string;
  assignedUserId?: number;
}

export interface RealtimeCallbacks {
  onNewMessage?: (data: ContactMessageEvent) => void;
  onContactUpdated?: (data: ContactUpdatedEvent) => void;
  onMessageStatus?: (data: MessageStatusEvent) => void;
  onVendorBroadcast?: (data: VendorChannelBroadcastEvent) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: any) => void;
}

let echoInstance: Echo<any> | null = null;
let currentChannel: any = null;
let isChannelSubscribed = false;
let subscribedVendorUid: string | null = null;

// Callback registry for multiple listeners (singleton pattern)
type CallbackId = string;
const callbackRegistry = new Map<CallbackId, RealtimeCallbacks>();
let callbackIdCounter = 0;

// Generate unique callback ID
const generateCallbackId = (): CallbackId => {
  return `cb_${++callbackIdCounter}_${Date.now()}`;
};

// Notify all registered callbacks
const notifyCallbacks = <K extends keyof RealtimeCallbacks>(
  eventType: K,
  data: Parameters<NonNullable<RealtimeCallbacks[K]>>[0]
) => {
  callbackRegistry.forEach((callbacks, id) => {
    const callback = callbacks[eventType];
    if (callback) {
      try {
        (callback as (data: any) => void)(data);
      } catch (error) {
        console.error(`Pusher: Error in callback ${id} for ${eventType}:`, error);
      }
    }
  });
};

// Initialize Laravel Echo with Pusher using a DigiCRM-granted authorizer.
//
// Pass the grant whenever you have one: it names the app key and cluster the
// backend actually signs against, plus any self-hosted (Reverb/soketi)
// overrides. PUSHER_CONFIG is only the fallback for a caller with no grant.
export const initEcho = (grant?: RealtimeGrant | null): Echo<any> | null => {
  // Return existing instance if already initialized
  if (echoInstance) {
    return echoInstance;
  }

  const key = grant?.key || PUSHER_CONFIG.key;
  const cluster = grant?.cluster || PUSHER_CONFIG.cluster;
  const forceTLS = grant?.force_tls ?? PUSHER_CONFIG.forceTLS;

  console.log('Pusher: Initializing with config:', {
    key,
    cluster,
    auth: 'digicrm realtime grant',
  });

  try {
    // Enable Pusher debug logging in development
    if (PUSHER_CONFIG.enableLogging) {
      Pusher.logToConsole = true;
    }

    echoInstance = new Echo({
      broadcaster: 'pusher',
      key,
      cluster,
      forceTLS,
      ...(grant?.host ? { wsHost: grant.host } : {}),
      ...(grant?.port ? { wsPort: grant.port } : {}),
      // Authorise each private channel with a SHORT-LIVED, SINGLE-CHANNEL grant
      // minted by DigiCRM against the user's own JWT. The tenant-wide vendor
      // token that used to sign this is gone; nothing durable is held by the
      // browser, and a stolen signature is useless on another socket.
      authorizer: (channel: any) => {
        return {
          authorize: (socketId: string, callback: (error: any, data: any) => void) => {
            console.log('Pusher: Authorizing channel:', channel.name, 'socket_id:', socketId);

            whatsappChatService
              .getRealtimeGrant({ socket_id: socketId, channel_name: channel.name })
              .then(signed => {
                if (signed.auth) {
                  console.log('Pusher: Auth successful for channel:', channel.name);
                  callback(null, {
                    auth: signed.auth,
                    ...(signed.channel_data ? { channel_data: signed.channel_data } : {}),
                  });
                } else {
                  console.error('Pusher: Realtime grant returned no auth signature');
                  callback(new Error('Realtime grant returned no auth signature'), null);
                }
              })
              .catch(error => {
                // A 404/501/502/503 means the grant endpoint is not deployed yet.
                // Degrade to "no live updates" — the chat itself still works.
                if (isWhatsappEndpointUnavailable(error)) {
                  console.warn('Pusher: realtime grant endpoint not available yet — live updates disabled');
                } else {
                  console.error('Pusher: Auth error for channel:', channel.name, error);
                }
                callback(error, null);
              });
          },
        };
      },
    });

    window.Echo = echoInstance;

    // Log connection state changes
    const pusher = echoInstance.connector?.pusher;
    if (pusher) {
      pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
        console.log(`Pusher: Connection state changed from ${states.previous} to ${states.current}`);
      });

      pusher.connection.bind('connected', () => {
        console.log('Pusher: Successfully connected, socket_id:', pusher.connection.socket_id);
      });

      pusher.connection.bind('error', (error: any) => {
        console.error('Pusher: Connection error:', error);
      });
    }

    console.log('Pusher: Laravel Echo initialized successfully');
    return echoInstance;
  } catch (error) {
    console.error('Pusher: Failed to initialize Laravel Echo:', error);
    return null;
  }
};

// Dispatch one raw broadcast payload to the registered callbacks.
//
// Extracted from the inline listener so every bound event name shares exactly
// one implementation.
const handleBroadcast = (data: any) => {
  console.log('Pusher: VendorChannelBroadcast event received:', data);

  // Handle new simplified API format (contactUid, isNewIncomingMessage, etc.)
  if (data?.contactUid !== undefined) {
    notifyCallbacks('onVendorBroadcast', data as VendorChannelBroadcastEvent);

    // Also trigger status update if message_status is present
    if (data.message_status && data.lastMessageUid) {
      notifyCallbacks('onMessageStatus', {
        message: {
          uid: data.lastMessageUid,
          status: data.message_status,
          updated_at: new Date().toISOString(),
        },
      });
    }
    return;
  }

  // Handle legacy event types based on data structure
  if (data?.message && data?.contact) {
    notifyCallbacks('onNewMessage', data as ContactMessageEvent);
  } else if (data?.contact && !data?.message) {
    notifyCallbacks('onContactUpdated', data as ContactUpdatedEvent);
  } else if (data?.message && data.message.status) {
    notifyCallbacks('onMessageStatus', data as MessageStatusEvent);
  }
};

// Subscribe to vendor channel for real-time updates
// Uses singleton pattern - multiple callers share one Pusher subscription
export const subscribeToVendorChannel = (
  vendorUid: string,
  callbacks: RealtimeCallbacks
): (() => void) => {
  // Register callbacks first
  const callbackId = generateCallbackId();
  callbackRegistry.set(callbackId, callbacks);
  console.log(`Pusher: Registered callbacks with ID ${callbackId}, total listeners: ${callbackRegistry.size}`);

  // If already subscribed to this vendor's channel, just return cleanup
  if (isChannelSubscribed && subscribedVendorUid === vendorUid && currentChannel) {
    console.log(`Pusher: Already subscribed to vendor ${vendorUid}, reusing existing subscription`);

    // If already connected, call onConnected immediately
    if (isEchoConnected()) {
      callbacks.onConnected?.();
    }

    // Return cleanup function that removes callbacks but keeps subscription
    return () => {
      console.log(`Pusher: Removing callbacks ${callbackId}, remaining listeners: ${callbackRegistry.size - 1}`);
      callbackRegistry.delete(callbackId);
    };
  }

  // The channel name is NEVER constructed here.
  //
  // It used to be `vendor-channel.${vendorUid}` — missing the mandatory
  // `private-` prefix, so Pusher rejected the subscription outright no matter
  // how correct the auth was. The grant returns the exact channel (and the exact
  // event name) to use, which also lets the backend rename either one without a
  // frontend release.
  let cancelled = false;
  let activeChannelName: string | null = null;

  whatsappChatService
    .getRealtimeGrant()
    .then(grant => {
      if (cancelled) return;

      if (!grant.channel) {
        console.warn('Pusher: realtime grant returned no channel — live updates disabled');
        notifyCallbacks('onError', { message: 'No realtime channel granted' });
        return;
      }

      const echo = initEcho(grant);
      const pusher = echo?.connector?.pusher;
      if (!echo || !pusher) {
        console.error('Pusher: Echo not initialized - cannot subscribe to channel');
        notifyCallbacks('onError', { message: 'Echo not initialized' });
        return;
      }

      const channelName = grant.channel;
      activeChannelName = channelName;
      subscribedVendorUid = vendorUid;
      console.log(`Pusher: Subscribing to private channel: ${channelName}`);

      // Subscribe with RAW pusher-js, not echo.private(): Echo prepends its own
      // `private-` and would produce `private-private-…`. The grant name is final.
      const channel = pusher.subscribe(channelName);
      currentChannel = channel;

      channel.bind('pusher:subscription_succeeded', () => {
        console.log(`Pusher: subscription_succeeded for ${channelName}`);
        isChannelSubscribed = true;
        notifyCallbacks('onConnected', undefined as any);
      });

      channel.bind('pusher:subscription_error', (error: any) => {
        console.error(`Pusher: subscription_error for ${channelName}:`, error);
        isChannelSubscribed = false;
        notifyCallbacks('onError', error);
      });

      // Bind the event name the grant gave us, in both raw and dotted form.
      // Duplicate delivery is harmless: consumers dedupe on wamid.
      const eventNames = new Set<string>();
      if (grant.event) { eventNames.add(grant.event); eventNames.add(`.${grant.event}`); }
      if (grant.echo_event) { eventNames.add(grant.echo_event); eventNames.add(grant.echo_event.replace(/^\./, '')); }
      if (eventNames.size === 0) { eventNames.add('VendorChannelBroadcast'); eventNames.add('.VendorChannelBroadcast'); }

      eventNames.forEach(eventName => channel.bind(eventName, handleBroadcast));
    })
    .catch(error => {
      if (isWhatsappEndpointUnavailable(error)) {
        // Grant endpoint not deployed yet — chat still works, just not live.
        console.warn('Pusher: realtime grant not available yet — live updates disabled');
      } else {
        console.error('Pusher: Failed to subscribe to vendor channel:', error);
      }
      notifyCallbacks('onError', error);
    });

  // Cleanup removes this listener; the subscription itself is torn down only
  // when the last listener goes away.
  return () => {
    cancelled = true;
    console.log(`Pusher: Removing callbacks ${callbackId}, remaining listeners: ${callbackRegistry.size - 1}`);
    callbackRegistry.delete(callbackId);

    if (callbackRegistry.size === 0 && activeChannelName) {
      console.log(`Pusher: No more listeners, unsubscribing from ${activeChannelName}`);
      try {
        const pusher = echoInstance?.connector?.pusher;
        currentChannel?.unbind_all?.();
        pusher?.unsubscribe(activeChannelName);
      } catch (error) {
        console.error('Pusher: error while unsubscribing:', error);
      }
      currentChannel = null;
      isChannelSubscribed = false;
      subscribedVendorUid = null;
    }
  };
};

// Disconnect Echo instance
export const disconnectEcho = (): void => {
  if (echoInstance) {
    console.log('Pusher: Disconnecting Laravel Echo');
    echoInstance.disconnect();
    echoInstance = null;
    window.Echo = null;
  }
  // Clear subscription state
  currentChannel = null;
  isChannelSubscribed = false;
  subscribedVendorUid = null;
  callbackRegistry.clear();
};

// Force reconnect with fresh token (useful after login/token refresh)
export const forceReconnect = (): Echo<any> | null => {
  console.log('Pusher: Force reconnecting...');
  disconnectEcho();
  return initEcho();
};

// Check if Echo is connected
export const isEchoConnected = (): boolean => {
  const state = echoInstance?.connector?.pusher?.connection?.state;
  return state === 'connected';
};

// Get connection state for debugging
export const getConnectionState = (): string => {
  return echoInstance?.connector?.pusher?.connection?.state || 'not_initialized';
};

// Get current vendor UID
export const getCurrentVendorUid = getVendorUid;

// Reconnect Echo (useful after token refresh)
export const reconnectEcho = (): Echo<any> | null => {
  console.log('Pusher: Reconnecting...');
  disconnectEcho();
  return initEcho();
};

// Get number of active callback listeners (for debugging)
export const getActiveListenerCount = (): number => {
  return callbackRegistry.size;
};

// Check if channel is subscribed
export const isChannelActive = (): boolean => {
  return isChannelSubscribed;
};
