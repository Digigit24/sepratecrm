// src/services/whatsapp/messagesService.ts
// Uses external Laravel API with fallback to internal API

import { whatsappClient } from '@/lib/whatsappClient';
import { API_CONFIG, buildUrl, buildQueryString } from '@/lib/apiConfig';
import { externalWhatsappService, getWhatsappVendorUid } from '@/services/externalWhatsappService';
import { chatService } from '@/services/whatsapp/chatService';
import {
  SendTextMessagePayload,
  SendTextMessageResponse,
  SendMediaMessagePayload,
  SendMediaMessageResponse,
  SendLocationMessagePayload,
  SendLocationMessageResponse,
  Conversation,
  ConversationDetail,
  RecentMessagesQuery,
  RecentMessagesResponse,
  MessageStats,
  DeleteConversationResponse,
} from '@/types/whatsappTypes';

class MessagesService {
  private normalizeTimestamp(ts?: string | null): string {
    if (!ts) {
      return new Date().toISOString();
    }
    const trimmed = String(ts).trim();
    const withT = trimmed.replace(' ', 'T');
    if (/[+-]\d{2}:?\d{2}$/.test(withT) || withT.endsWith('Z')) {
      return withT;
    }
    return `${withT}Z`;
  }

  private useExternalApi(): boolean {
    return !!getWhatsappVendorUid();
  }

  /**
   * Send a text message
   */
  async sendTextMessage(payload: SendTextMessagePayload): Promise<SendTextMessageResponse> {
    try {
      console.log('📤 Sending text message to:', payload.to);

      // Try external API first if configured
      if (this.useExternalApi()) {
        try {
          const response = await externalWhatsappService.sendMessage({
            phone_number: payload.to,
            message_body: payload.text,
          });

          console.log('✅ Message sent via external API:', {
            message_id: response?.message_uid || response?._uid,
            status: 'sent'
          });

          return {
            message_id: response?.message_uid || response?._uid || response?.id,
            status: 'sent',
            to: payload.to,
            text: payload.text,
          };
        } catch (externalError: any) {
          console.warn('⚠️ External API failed, falling back to internal:', externalError.message);
        }
      }

      // Fallback to internal API
      const response = await whatsappClient.post<SendTextMessageResponse>(
        API_CONFIG.WHATSAPP.SEND_TEXT,
        payload
      );

      console.log('✅ Message sent via internal API:', {
        message_id: response.data.message_id,
        status: response.data.status
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send message:', error);

      if (error.response?.status === 403) {
        throw new Error('WhatsApp module not enabled');
      }

      const message = error.response?.data?.detail || error.message || 'Failed to send message';
      throw new Error(message);
    }
  }

  /**
   * Send a media message (image, video, audio, document)
   */
  async sendMediaMessage(payload: SendMediaMessagePayload): Promise<SendMediaMessageResponse> {
    try {
      console.log('📤 Sending media message to:', payload.to, 'type:', payload.media_type);

      // Try external API first if configured
      if (this.useExternalApi()) {
        try {
          const response = await externalWhatsappService.sendMediaMessage({
            phone_number: payload.to,
            media_type: payload.media_type,
            media_url: payload.media_id, // external API uses media_url
            caption: payload.caption,
          });

          console.log('✅ Media message sent via external API');

          return {
            message_id: response?.message_uid || response?._uid || response?.id,
            status: 'sent',
            to: payload.to,
            media_id: payload.media_id,
            media_type: payload.media_type,
          };
        } catch (externalError: any) {
          console.warn('⚠️ External API failed, falling back to internal:', externalError.message);
        }
      }

      // Fallback to internal API
      const response = await whatsappClient.post<SendMediaMessageResponse>(
        API_CONFIG.WHATSAPP.SEND_MEDIA,
        payload
      );

      console.log('✅ Media message sent via internal API:', {
        message_id: response.data.message_id,
        status: response.data.status,
        media_type: response.data.media_type
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send media message:', error);

      if (error.response?.status === 403) {
        throw new Error('WhatsApp module not enabled');
      }

      const message = error.response?.data?.detail || error.message || 'Failed to send media message';
      throw new Error(message);
    }
  }

  /**
   * Send a location message
   */
  async sendLocationMessage(payload: SendLocationMessagePayload): Promise<SendLocationMessageResponse> {
    try {
      console.log('📤 Sending location message to:', payload.to);

      const response = await whatsappClient.post<SendLocationMessageResponse>(
        API_CONFIG.WHATSAPP.SEND_LOCATION,
        payload
      );

      console.log('✅ Location message sent:', {
        message_id: response.data.message_id,
        status: response.data.status,
        coordinates: `${response.data.latitude}, ${response.data.longitude}`
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to send location message:', error);

      if (error.response?.status === 403) {
        throw new Error('WhatsApp module not enabled');
      }

      const message = error.response?.data?.detail || 'Failed to send location message';
      throw new Error(message);
    }
  }

  /**
   * Get all conversations
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      console.log('📋 Fetching conversations');

      // Try external API first if configured
      if (this.useExternalApi()) {
        try {
          const response = await externalWhatsappService.getChatContacts();

          let contacts: any[] = [];
          if (Array.isArray(response)) {
            contacts = response;
          } else if (response?.data) {
            contacts = Array.isArray(response.data) ? response.data : [];
          } else if (response?.contacts) {
            contacts = response.contacts;
          }

          // Map to Conversation format
          const conversations: Conversation[] = contacts.map((c: any) => ({
            phone: c.phone_number || c.phone || c.wa_id || '',
            name: c.name || (c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : c.phone_number),
            last_message: c.last_message || c.last_message_text || '',
            last_timestamp: this.normalizeTimestamp(c.last_message_at || c.updated_at),
            message_count: c.message_count || 0,
            direction: c.last_direction || 'incoming',
            unread_count: c.unread_count || 0,
          }));

          console.log('✅ Conversations fetched via external API:', conversations.length);
          return conversations;
        } catch (externalError: any) {
          console.warn('⚠️ External API failed, falling back to internal:', externalError.message);
        }
      }

      // Fallback to internal API
      const response = await whatsappClient.get<Conversation[]>(
        API_CONFIG.WHATSAPP.CONVERSATIONS
      );

      const raw = response.data || [];

      // Deduplicate by phone number ignoring leading '+'
      const merged = new Map<string, Conversation>();
      for (const conv of raw) {
        const key = String(conv.phone || '').replace(/^\+/, '');
        const existing = merged.get(key);

        if (!existing) {
          merged.set(key, {
            ...conv,
            last_timestamp: this.normalizeTimestamp(conv.last_timestamp),
          });
          continue;
        }

        // Pick the conversation with the latest timestamp for preview fields
        const existingTs = new Date(existing.last_timestamp || 0).getTime();
        const convTs = new Date(conv.last_timestamp || 0).getTime();
        const latest = convTs >= existingTs ? conv : existing;

        // Prefer display phone with '+' if available
        const phone =
          (conv.phone?.startsWith('+') ? conv.phone : undefined) ??
          (existing.phone?.startsWith('+') ? existing.phone : undefined) ??
          conv.phone ??
          existing.phone;

        // Prefer non-empty name
        const name = conv.name || existing.name || phone;

        // Sum message counts if both exist
        const message_count = (existing.message_count || 0) + (conv.message_count || 0);

        const mergedConv: Conversation = {
          phone,
          name,
          last_message: latest.last_message,
          last_timestamp: this.normalizeTimestamp(latest.last_timestamp),
          message_count,
          direction: latest.direction,
          window_is_open: latest.window_is_open ?? existing.window_is_open,
          window_expires_at: latest.window_expires_at ?? existing.window_expires_at,
          time_remaining_seconds: latest.time_remaining_seconds ?? existing.time_remaining_seconds,
          requires_template: latest.requires_template ?? existing.requires_template,
        };

        merged.set(key, mergedConv);
      }

      const deduped = Array.from(merged.values());
      console.log('✅ Conversations fetched via internal API:', raw.length, '→ deduped to:', deduped.length);

      return deduped;
    } catch (error: any) {
      console.error('❌ Failed to fetch conversations:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch conversations';
      throw new Error(message);
    }
  }

  /**
   * Get conversation messages by phone number
   */
  async getConversationMessages(phone: string): Promise<ConversationDetail> {
    try {
      console.log('📋 Fetching conversation messages for:', phone);

      // Try external API first if configured
      if (this.useExternalApi()) {
        try {
          const cleanPhone = String(phone).trim().replace(/^\+/, '');
          // Use chatService which properly resolves phone number to contact UID
          const response = await chatService.getContactMessages(cleanPhone);

          console.log('📬 Raw messages from chatService:', {
            count: response.messages?.length,
            sampleMessage: response.messages?.[0] ? {
              keys: Object.keys(response.messages[0]),
              message_body: response.messages[0].message_body,
              text: response.messages[0].text,
              body: response.messages[0].body,
              message: response.messages[0].message,
            } : 'no messages'
          });

          // Transform messages from chatService format to messagesService format
          const transformedMessages = response.messages.map((m: any) => {
            // Extract text from various possible field names
            // Priority: message_body (from chatService) > body (API) > message > text
            let text = '';
            // chatService.normalizeMessage extracts to message_body
            if (m.message_body) {
              text = m.message_body;
            }
            // Direct "body" field (as per API guide)
            else if (typeof m.body === 'string' && m.body) {
              text = m.body;
            }
            // "message" field as string
            else if (typeof m.message === 'string' && m.message) {
              text = m.message;
            }
            // "text" field as string
            else if (typeof m.text === 'string' && m.text) {
              text = m.text;
            }
            // Other fields
            else if (m.content) {
              text = m.content;
            } else if (m.message_text) {
              text = m.message_text;
            }
            // Nested structure checks
            else if (m.message?.body) {
              text = m.message.body;
            } else if (m.text?.body) {
              text = m.text.body;
            } else if (m.message?.text?.body) {
              text = m.message.text.body;
            } else if (m.message?.text && typeof m.message.text === 'string') {
              text = m.message.text;
            }

            // Determine direction
            let direction: 'incoming' | 'outgoing' = 'incoming';
            if (m.direction === 'outgoing' || m.direction === 'incoming') {
              direction = m.direction;
            } else if (typeof m.is_incoming_message === 'boolean') {
              direction = m.is_incoming_message ? 'incoming' : 'outgoing';
            } else if (typeof m.is_outgoing === 'boolean') {
              direction = m.is_outgoing ? 'outgoing' : 'incoming';
            }

            return {
              id: String(m._uid || m.id || m.message_uid || `local-${Math.random().toString(36).slice(2)}`),
              from: m.from || (direction === 'incoming' ? phone : ''),
              to: m.to || (direction === 'outgoing' ? phone : null),
              text,
              type: m.message_type || m.type || 'text',
              direction,
              timestamp: this.normalizeTimestamp(m.created_at || m.timestamp || m.messaged_at),
              status: m.status || m.delivery_status || (direction === 'outgoing' ? 'sent' : undefined),
              metadata: m.metadata || m.meta_data || {},
            };
          });

          console.log('📬 Transformed messages:', {
            count: transformedMessages.length,
            sample: transformedMessages[0] ? {
              text: transformedMessages[0].text?.substring(0, 30),
              direction: transformedMessages[0].direction,
            } : 'no messages'
          });

          const conversationDetail: ConversationDetail = {
            phone,
            name: response.contact?.name || response.contact?.first_name || phone,
            messages: transformedMessages,
          };

          console.log('✅ Conversation messages fetched via external API:', transformedMessages.length);
          return conversationDetail;
        } catch (externalError: any) {
          console.warn('⚠️ External API failed, falling back to internal:', externalError.message);
        }
      }

      // Fallback to internal API
      const cleanPhone = String(phone).trim().replace(/^\+/, '');
      const url = buildUrl(
        API_CONFIG.WHATSAPP.CONVERSATION_DETAIL,
        { phone: cleanPhone },
        'whatsapp'
      );

      const response = await whatsappClient.get(url);
      const data = response.data as any;
      const rawMessages: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
          ? data.messages
          : [];

      const contactName =
        (Array.isArray(data) ? undefined : (data?.name || data?.contact_name)) ??
        rawMessages[0]?.contact_name ??
        phone;

      const messages = rawMessages.map((m: any) => {
        const id = String(
          m.message_id ||
          m.id ||
          `local-${Math.random().toString(36).slice(2)}`
        );

        const text = m.text ?? m.message_text ?? '';

        const rawTimestamp =
          m.timestamp ||
          m.meta_data?.timestamp ||
          m.created_at ||
          m.updated_at;
        const timestamp = this.normalizeTimestamp(rawTimestamp);

        const apiPhone = m.phone ?? m.from ?? (Array.isArray(data) ? undefined : data?.phone) ?? phone;

        let direction: 'incoming' | 'outgoing' = 'incoming';
        if (m.direction === 'incoming' || m.direction === 'outgoing') {
          direction = m.direction;
        } else if (typeof m.is_outgoing === 'boolean') {
          direction = m.is_outgoing ? 'outgoing' : 'incoming';
        } else if (m.from) {
          direction = (m.from === phone || m.from === (Array.isArray(data) ? undefined : data?.phone)) ? 'incoming' : 'outgoing';
        } else if (m.phone) {
          direction = (m.phone === phone) ? 'incoming' : 'outgoing';
        }

        const type: 'text' | 'image' | 'video' | 'audio' | 'document' =
          ['text', 'image', 'video', 'audio', 'document'].includes(m.message_type)
            ? m.message_type
            : 'text';

        const status: 'sent' | 'delivered' | 'read' | 'failed' | undefined =
          m.status || m.delivery_status || (direction === 'outgoing' ? 'sent' : undefined);

        return {
          id,
          from: m.from ?? apiPhone,
          to: m.to ?? null,
          text,
          type,
          direction,
          timestamp,
          status,
          metadata: {
            ...(m.meta_data ?? m.metadata),
            created_at: m.created_at,
            updated_at: m.updated_at,
            timestamp: this.normalizeTimestamp(m.meta_data?.timestamp || m.timestamp || m.created_at),
            ws_received_at: Date.parse(m.created_at || m.timestamp || m.meta_data?.timestamp || '') || undefined,
          },
        } as const;
      });

      const conversationDetail: ConversationDetail = {
        phone,
        name: contactName,
        messages,
      };

      console.log('✅ Conversation messages fetched via internal API:', messages.length);

      return conversationDetail;
    } catch (error: any) {
      console.error('❌ Failed to fetch conversation messages:', error);

      if (error.response?.status === 404) {
        throw new Error('Conversation not found');
      }

      const message =
        error.response?.data?.detail || error.message || 'Failed to fetch conversation messages';
      throw new Error(message);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(phone: string): Promise<DeleteConversationResponse> {
    try {
      console.log('🗑️ Deleting conversation:', phone);

      // Try external API first if configured
      if (this.useExternalApi()) {
        try {
          const cleanPhone = String(phone).trim().replace(/^\+/, '');
          // Use chatService which properly resolves phone number to contact UID
          await chatService.clearChatHistory(cleanPhone);

          console.log('✅ Conversation deleted via external API');
          return { phone, deleted_count: 1 };
        } catch (externalError: any) {
          console.warn('⚠️ External API failed, falling back to internal:', externalError.message);
        }
      }

      // Fallback to internal API
      const cleanPhone = String(phone).trim().replace(/^\+/, '');
      const url = buildUrl(
        API_CONFIG.WHATSAPP.DELETE_CONVERSATION,
        { phone: cleanPhone },
        'whatsapp'
      );

      const response = await whatsappClient.delete<DeleteConversationResponse>(url);

      console.log('✅ Conversation deleted via internal API:', {
        phone: response.data.phone,
        deleted_count: response.data.deleted_count
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to delete conversation:', error);

      if (error.response?.status === 404) {
        throw new Error('Conversation not found');
      }

      const message = error.response?.data?.detail || error.message || 'Failed to delete conversation';
      throw new Error(message);
    }
  }

  /**
   * Get recent messages with filters
   */
  async getRecentMessages(query?: RecentMessagesQuery): Promise<RecentMessagesResponse> {
    try {
      console.log('📋 Fetching recent messages:', query);

      const queryString = buildQueryString(query as unknown as Record<string, string | number | boolean>);
      const url = `${API_CONFIG.WHATSAPP.MESSAGES}${queryString}`;

      const response = await whatsappClient.get<RecentMessagesResponse>(url);

      console.log('✅ Recent messages fetched:', {
        total: response.data.total,
        count: response.data.messages.length
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch recent messages:', error);
      const message = error.response?.data?.detail || 'Failed to fetch recent messages';
      throw new Error(message);
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(): Promise<MessageStats> {
    try {
      console.log('📊 Fetching message statistics');

      const response = await whatsappClient.get<MessageStats>(
        API_CONFIG.WHATSAPP.STATS
      );

      console.log('✅ Message stats fetched:', {
        total_messages: response.data.total_messages,
        total_conversations: response.data.total_conversations
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch message stats:', error);
      const message = error.response?.data?.detail || 'Failed to fetch message stats';
      throw new Error(message);
    }
  }

  /**
   * Get incoming messages only
   */
  async getIncomingMessages(limit: number = 100, offset: number = 0): Promise<RecentMessagesResponse> {
    return this.getRecentMessages({
      direction: 'incoming',
      limit,
      offset,
    });
  }

  /**
   * Get outgoing messages only
   */
  async getOutgoingMessages(limit: number = 100, offset: number = 0): Promise<RecentMessagesResponse> {
    return this.getRecentMessages({
      direction: 'outgoing',
      limit,
      offset,
    });
  }

  /**
   * Get messages for a specific phone number
   */
  async getMessagesByPhone(phone: string, limit: number = 100): Promise<RecentMessagesResponse> {
    return this.getRecentMessages({
      phone,
      limit,
    });
  }
}

export const messagesService = new MessagesService();
