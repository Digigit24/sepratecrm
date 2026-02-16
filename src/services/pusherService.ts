// src/services/pusherService.ts
// Real-time messaging service using Pusher/Laravel Echo

import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { API_CONFIG } from '@/lib/apiConfig';
import { tokenManager } from '@/lib/client';

// Make Pusher available globally for Laravel Echo
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<any> | null;
  }
}

window.Pusher = Pusher;

// Pusher Configuration
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

// Get vendor API key for X-Api-Key header
const getVendorApiKey = (): string | null => {
  try {
    const userJson = localStorage.getItem('celiyo_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      const apiKey = user?.tenant?.whatsapp_api_token;
      if (apiKey) {
        console.log('Pusher: Using vendor API key (length:', apiKey.length, ')');
        return apiKey;
      }
    }
  } catch (error) {
    console.error('Failed to get vendor API key:', error);
  }
  return null;
};

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

// Initialize Laravel Echo with Pusher using custom authorizer
export const initEcho = (): Echo<any> | null => {
  const vendorApiKey = getVendorApiKey();

  if (!vendorApiKey) {
    console.warn('Pusher: No vendor API key available for authentication');
    return null;
  }

  // Return existing instance if already initialized
  if (echoInstance) {
    return echoInstance;
  }

  // Broadcasting auth endpoint - using /api/broadcasting/auth
  const authUrl = `${API_CONFIG.WHATSAPP_EXTERNAL_BASE_URL}/broadcasting/auth`;

  console.log('Pusher: Initializing with config:', {
    key: PUSHER_CONFIG.key,
    cluster: PUSHER_CONFIG.cluster,
    authUrl,
    hasApiKey: !!vendorApiKey,
  });

  try {
    // Enable Pusher debug logging in development
    if (PUSHER_CONFIG.enableLogging) {
      Pusher.logToConsole = true;
    }

    echoInstance = new Echo({
      broadcaster: 'pusher',
      key: PUSHER_CONFIG.key,
      cluster: PUSHER_CONFIG.cluster,
      forceTLS: PUSHER_CONFIG.forceTLS,
      // Use custom authorizer with X-Api-Key header
      authorizer: (channel: any, options: any) => {
        return {
          authorize: (socketId: string, callback: (error: any, data: any) => void) => {
            console.log('Pusher: Authorizing channel:', channel.name, 'socket_id:', socketId);

            fetch(authUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${vendorApiKey}`,
              },
              body: JSON.stringify({
                socket_id: socketId,
                channel_name: channel.name,
              }),
            })
              .then(response => {
                console.log('Pusher: Auth response status:', response.status);
                if (!response.ok) {
                  throw new Error(`Auth failed with status ${response.status}`);
                }
                return response.json();
              })
              .then(data => {
                console.log('Pusher: Auth response data:', data);
                if (data.auth) {
                  console.log('Pusher: Auth successful for channel:', channel.name);
                  callback(null, data);
                } else {
                  console.error('Pusher: Auth failed - no auth key in response:', data);
                  callback(new Error(data.error || data.message || 'Auth failed - no auth key'), null);
                }
              })
              .catch(error => {
                console.error('Pusher: Auth error for channel:', channel.name, error);
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

  const echo = initEcho();

  if (!echo) {
    console.error('Pusher: Echo not initialized - cannot subscribe to channel');
    callbacks.onError?.({ message: 'Echo not initialized' });
    callbackRegistry.delete(callbackId);
    return () => {};
  }

  // Channel name format: vendor-channel.{vendorUid} (with hyphen, not dot)
  const channelName = `vendor-channel.${vendorUid}`;
  console.log(`Pusher: Subscribing to private channel: ${channelName}`);

  try {
    currentChannel = echo.private(channelName);
    subscribedVendorUid = vendorUid;

    // Get the underlying Pusher channel for direct event binding
    const pusherChannel = currentChannel.subscription;

    // Bind to pusher:subscription_succeeded for reliable connection detection
    if (pusherChannel) {
      pusherChannel.bind('pusher:subscription_succeeded', () => {
        console.log(`Pusher: subscription_succeeded for ${channelName}`);
        isChannelSubscribed = true;
        notifyCallbacks('onConnected', undefined as any);
      });

      pusherChannel.bind('pusher:subscription_error', (error: any) => {
        console.error(`Pusher: subscription_error for ${channelName}:`, error);
        isChannelSubscribed = false;
        notifyCallbacks('onError', error);
      });
    }

    // Listen to the main VendorChannelBroadcast event
    // NOTE: Dot prefix (.VendorChannelBroadcast) is required for raw event name matching
    // Without dot, Laravel Echo expects namespaced event (App\Events\VendorChannelBroadcast)
    currentChannel
      .listen('.VendorChannelBroadcast', (data: any) => {
        console.log('Pusher: VendorChannelBroadcast event received:', data);

        // Handle new simplified API format (contactUid, isNewIncomingMessage, etc.)
        if (data.contactUid !== undefined) {
          console.log('Pusher: VendorChannelBroadcast (simplified format)', {
            contactUid: data.contactUid,
            isNewIncoming: data.isNewIncomingMessage,
            messageStatus: data.message_status,
            lastMessageUid: data.lastMessageUid,
          });
          notifyCallbacks('onVendorBroadcast', data as VendorChannelBroadcastEvent);

          // Also trigger status update if message_status is present
          if (data.message_status && data.lastMessageUid) {
            notifyCallbacks('onMessageStatus', {
              message: {
                uid: data.lastMessageUid,
                status: data.message_status,
                updated_at: new Date().toISOString(),
              }
            });
          }
          return;
        }

        // Handle legacy event types based on data structure
        if (data.message && data.contact) {
          // New message event
          console.log('Pusher: New message received', {
            contact: data.contact?.uid,
            messageType: data.message?.message_type,
            isIncoming: data.message?.is_incoming_message,
            body: data.message?.body?.substring(0, 50),
          });
          notifyCallbacks('onNewMessage', data as ContactMessageEvent);
        } else if (data.contact && !data.message) {
          // Contact updated event
          console.log('Pusher: Contact updated', {
            contact: data.contact?.uid,
            unread: data.contact?.unread_messages_count,
          });
          notifyCallbacks('onContactUpdated', data as ContactUpdatedEvent);
        } else if (data.message && data.message.status) {
          // Message status update event
          console.log('Pusher: Message status changed', {
            message: data.message?.uid,
            status: data.message?.status,
          });
          notifyCallbacks('onMessageStatus', data as MessageStatusEvent);
        }
      })
      .subscribed(() => {
        console.log(`Pusher: Echo subscribed callback for ${channelName}`);
        isChannelSubscribed = true;
        // onConnected already called by pusher:subscription_succeeded
      })
      .error((error: any) => {
        console.error(`Pusher: Error subscribing to ${channelName}:`, error);
        isChannelSubscribed = false;
        // Provide more details about the error
        if (error?.status === 403) {
          console.error('Pusher: 403 Forbidden - Check broadcasting auth endpoint and token');
        } else if (error?.status === 401) {
          console.error('Pusher: 401 Unauthorized - Token may be invalid or expired');
        }
        notifyCallbacks('onError', error);
      });

    // Return cleanup function that removes callbacks but keeps subscription active
    return () => {
      console.log(`Pusher: Removing callbacks ${callbackId}, remaining listeners: ${callbackRegistry.size - 1}`);
      callbackRegistry.delete(callbackId);

      // Only unsubscribe if no more listeners
      if (callbackRegistry.size === 0) {
        console.log(`Pusher: No more listeners, unsubscribing from ${channelName}`);
        echo.leave(channelName);
        currentChannel = null;
        isChannelSubscribed = false;
        subscribedVendorUid = null;
      }
    };
  } catch (error) {
    console.error('Pusher: Failed to subscribe to vendor channel:', error);
    callbackRegistry.delete(callbackId);
    notifyCallbacks('onError', error);
    return () => {};
  }
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
