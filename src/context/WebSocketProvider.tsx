
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { API_CONFIG } from '@/lib/apiConfig';
import { WhatsAppMessage } from '@/types/whatsappTypes';

type SocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface WebSocketPayload {
  phone: string;
  name: string;
  contact: {
    id: string;
    phone: string;
    name: string;
    last_seen?: string;
    is_new: boolean;
    exists: boolean;
  };
  message: WhatsAppMessage;
}

interface WebSocketContextType {
  socketStatus: SocketStatus;
  messages: WhatsAppMessage[];
  payloads: WebSocketPayload[];
  newMessageCount: number;
  clearNewMessageCount: () => void;
  updateMessageStatus: (messageId: string, status: 'sent' | 'delivered' | 'read') => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const normalizeTimestamp = (ts?: string | null): string => {
  if (!ts) {
    return new Date().toISOString();
  }
  const trimmed = String(ts).trim();
  // Replace single space between date/time with 'T' to be ISO friendly
  const withT = trimmed.replace(' ', 'T');
  // If it already has timezone info or Z, keep as is; otherwise append Z
  if (/[+-]\d{2}:?\d{2}$/.test(withT) || withT.endsWith('Z')) {
    return withT;
  }
  return `${withT}Z`;
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

// DISABLED: Using Pusher/Laravel Echo for real-time instead of custom WebSocket
// Set this to true to re-enable the old WebSocket connection
const ENABLE_LEGACY_WEBSOCKET = false;

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('closed');
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [payloads, setPayloads] = useState<WebSocketPayload[]>([]);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const reconnectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isUnmountingRef = React.useRef(false);

  const hydrateMessageFromPayload = (
    payload: WebSocketPayload,
    eventType: 'message_incoming' | 'message_outgoing'
  ): WhatsAppMessage => {
    const baseMessage = payload.message || ({} as WhatsAppMessage);
    const contactPhone = payload.phone || payload.contact?.phone || baseMessage.from || baseMessage.to || '';
    const direction = baseMessage.direction || (eventType === 'message_incoming' ? 'incoming' : 'outgoing');
    const wsReceivedAt = Date.now();
    const normalizedTimestamp = normalizeTimestamp(
      (baseMessage.metadata as any)?.timestamp || baseMessage.timestamp
    );

    return {
      ...baseMessage,
      direction,
      from: baseMessage.from || (direction === 'incoming' ? contactPhone : baseMessage.from || ''),
      to: baseMessage.to || (direction === 'outgoing' ? contactPhone : baseMessage.to || null),
      timestamp: normalizedTimestamp,
      metadata: {
        ...(baseMessage.metadata || {}),
        phone: baseMessage.metadata?.phone || contactPhone,
        timestamp: normalizedTimestamp,
        ws_received_at: wsReceivedAt,
      },
    };
  };

  const updateMessageStatus = React.useCallback(
    (messageId: string, status: 'sent' | 'delivered' | 'read') => {
      setMessages((prevMessages) => {
        let updated = false;
        const normalizedId = String(messageId);
        const next = prevMessages.map((msg) => {
          if (String(msg.id) === normalizedId) {
            updated = true;
            return { ...msg, status, metadata: { ...(msg.metadata || {}), is_uploading: false } };
          }
          return msg;
        });

        // Fallback: if not found by id, patch the first uploading outgoing media message
        if (!updated) {
          const uploadIdx = next.findIndex(
            (m) => m.direction === 'outgoing' && m.metadata?.is_uploading
          );
          if (uploadIdx > -1) {
            const target = next[uploadIdx];
            next[uploadIdx] = {
              ...target,
              id: normalizedId,
              status,
              metadata: { ...(target.metadata || {}), is_uploading: false },
            };
            updated = true;
          }
        }

        // Secondary fallback: update the latest temp outgoing message
        if (!updated) {
          const tempIdx = [...next]
            .reverse()
            .findIndex(
              (m) =>
                typeof m.id === 'string' &&
                m.direction === 'outgoing' &&
                (m.id as string).startsWith('temp_')
            );
          if (tempIdx > -1) {
            // reverse index needs conversion to original index
            const originalIdx = next.length - 1 - tempIdx;
            const target = next[originalIdx];
            next[originalIdx] = {
              ...target,
              id: normalizedId,
              status,
              metadata: { ...(target.metadata || {}), is_uploading: false },
            };
          }
        }

        return next;
      });
    },
    []
  );

  const readTenantId = (): string => {
    try {
      const userJson = localStorage.getItem('celiyo_user');
      console.log('🔍 Reading tenant from localStorage:', userJson ? 'Found' : 'Not found');

      if (userJson) {
        const u = JSON.parse(userJson);
        console.log('👤 User object:', u);

        const t = u?.tenant;
        console.log('🏢 Tenant object:', t);

        const tid = t?.id || t?.tenant_id;
        console.log('🆔 Tenant ID:', tid);

        if (tid) {
          const tenantIdStr = String(tid);
          console.log('✅ Using tenant ID:', tenantIdStr);
          return tenantIdStr;
        }
      }
    } catch (error) {
      console.error('❌ Failed to read tenant ID:', error);
    }

    const fallbackTenant = 'bc531d42-ac91-41df-817e-26c339af6b3a';
    console.warn('⚠️ Using fallback tenant ID:', fallbackTenant);
    return fallbackTenant;
  };

  const connectWebSocket = React.useCallback(() => {
    // DISABLED: Using Pusher/Laravel Echo for real-time instead
    if (!ENABLE_LEGACY_WEBSOCKET) {
      console.log('🔌 Legacy WebSocket DISABLED - Using Pusher/Laravel Echo for real-time');
      return;
    }

    if (typeof window === 'undefined' || isUnmountingRef.current) {
      console.log('🔌 Skipping WebSocket connection');
      return;
    }

    const tenantId = readTenantId();
    const wsUrl = `${API_CONFIG.WHATSAPP_WS_URL}/ws/${tenantId}`;

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  WebSocket Connection Attempt                         ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('  Tenant ID:', tenantId);
    console.log('  WS URL:', wsUrl);
    console.log('  Base URL:', API_CONFIG.WHATSAPP_WS_URL);
    console.log('╚════════════════════════════════════════════════════════╝');

    try {
      const socket = new WebSocket(wsUrl);
      setWs(socket);
      setSocketStatus('connecting');
      console.log('🔄 WebSocket instance created, waiting for connection...');

      socket.onopen = () => {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ✅ WebSocket CONNECTED SUCCESSFULLY!                 ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log('  Tenant ID:', tenantId);
        console.log('  Ready State:', socket.readyState);
        console.log('╚════════════════════════════════════════════════════════╝');
        setSocketStatus('open');
    };

    socket.onmessage = (event) => {
      try {
        if (event.data === 'ping') {
          setNewMessageCount((prevCount) => prevCount + 1);
          return;
        }

        const payload = JSON.parse(event.data);


        console.log('📨 WebSocket message received:', payload);

        if (payload.event === 'message_incoming' || payload.event === 'message_outgoing') {
          const data = payload.data;
          const hydratedMessage = hydrateMessageFromPayload(
            data,
            payload.event as 'message_incoming' | 'message_outgoing'
          );

          // Store the full payload with contact metadata
          setPayloads((prevPayloads) => [...prevPayloads, { ...data, message: hydratedMessage }]);

          // Also store just the message for backward compatibility
          if (hydratedMessage) {
            setMessages((prevMessages) => [...prevMessages, hydratedMessage]);
          }

          if (hydratedMessage.direction === 'incoming') {
            setNewMessageCount((prevCount) => prevCount + 1);
          }

          console.log('✅ WebSocket message processed:', {
            phone: data.phone,
            name: data.name,
            is_new: data.contact?.is_new,
            exists: data.contact?.exists,
            message: hydratedMessage?.text
          });
        } else if (payload.event === 'message_status') {
          // Handle message status updates (sent, delivered, read)
          const { message_id, status, timestamp } = payload.data;

          console.log('📊 Message status update received:', {
            message_id,
            status,
            timestamp
          });

          updateMessageStatus(message_id, status);

          console.log('✅ Message status updated:', { message_id, status });
        }
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
      }
    };

      socket.onerror = (error) => {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  ❌ WebSocket ERROR                                    ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.error('  Error:', error);
        console.log('  Tenant ID:', tenantId);
        console.log('  WS URL:', wsUrl);
        console.log('  Ready State:', socket.readyState);
        console.log('╚════════════════════════════════════════════════════════╝');
        setSocketStatus('error');
      };

      socket.onclose = (event) => {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║  🔌 WebSocket CLOSED                                   ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log('  Code:', event.code);
        console.log('  Reason:', event.reason || 'No reason provided');
        console.log('  Was Clean:', event.wasClean);
        console.log('  Tenant ID:', tenantId);
        console.log('╚════════════════════════════════════════════════════════╝');
        setSocketStatus('closed');

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

        // Attempt to reconnect after 3 seconds (unless unmounting)
        if (!isUnmountingRef.current) {
          console.log('🔄 Scheduling reconnection in 3 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            connectWebSocket();
          }, 3000);
        }
      };

      return socket;
    } catch (error) {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║  💥 WebSocket Creation FAILED                          ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.error('  Error:', error);
      console.log('  Tenant ID:', tenantId);
      console.log('  WS URL:', wsUrl);
      console.log('╚════════════════════════════════════════════════════════╝');
      setSocketStatus('error');

      // Try to reconnect
      if (!isUnmountingRef.current) {
        console.log('🔄 Scheduling reconnection in 3 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 3000);
      }

      return null;
    }
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    connectWebSocket();

    return () => {
      console.log('🛑 WebSocketProvider unmounting - closing connection');
      isUnmountingRef.current = true;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Close WebSocket
      if (ws) {
        ws.close();
      }
    };
  }, [connectWebSocket]);

  const clearNewMessageCount = () => {
    setNewMessageCount(0);
  };

  const value = {
    socketStatus,
    messages,
    payloads,
    newMessageCount,
    clearNewMessageCount,
    updateMessageStatus,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
