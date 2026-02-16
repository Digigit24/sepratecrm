import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { messagesService } from '@/services/whatsapp/messagesService';
import { uploadMedia } from '@/services/whatsapp';
import type { WhatsAppMessage, Template } from '@/types/whatsappTypes';
import { chatService } from '@/services/whatsapp/chatService';
import { chatKeys } from '@/hooks/whatsapp/useChat';
import { useRealtimeChat } from '@/hooks/whatsapp/useRealtimeChat';
import { templatesService } from '@/services/whatsapp/templatesService';

export interface UseMessagesReturn {
  messages: WhatsAppMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendMediaMessage: (file: File, media_type: "image" | "video" | "audio" | "document", caption?: string) => Promise<void>;
  sendTemplateMessage: (template: Template, variables: Record<string, string>) => Promise<void>;
  refreshMessages: () => Promise<void>;
}

export function useMessages(conversationPhone: string | null): UseMessagesReturn {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactUid, setContactUid] = useState<string | null>(null);

  // Enable real-time updates via Pusher
  useRealtimeChat({
    enabled: true,
    selectedContactUid: contactUid,
  });

  const normalizePhone = (p?: string | null) => (p ? String(p).replace(/^\+/, '') : '');
  const normalizeTimestamp = (ts?: string | null) => {
    if (!ts) return new Date().toISOString();
    const trimmed = String(ts).trim();
    const withT = trimmed.replace(' ', 'T');
    if (/[+-]\d{2}:?\d{2}$/.test(withT) || withT.endsWith('Z')) {
      return withT;
    }
    return `${withT}Z`;
  };

  // Subscribe to React Query cache updates for messages
  useEffect(() => {
    if (!contactUid) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.queryKey[0] === 'chat' && event.query.queryKey[1] === 'messages') {
        const queryContactUid = event.query.queryKey[2];
        if (queryContactUid === contactUid) {
          const data = event.query.state.data as any;
          if (data?.messages) {
            console.log('📬 useMessages: Cache updated, syncing messages');
            const transformed = data.messages.map((m: any) => {
              // API uses is_incoming_message boolean, convert to direction
              const isIncoming = m.is_incoming_message ?? (m.direction === 'incoming');
              const direction = isIncoming ? 'incoming' : 'outgoing';
              return {
                id: m._uid,
                from: isIncoming ? conversationPhone : '',
                to: isIncoming ? '' : conversationPhone,
                text: m.message || m.message_body || m.text || '',
                type: m.message_type || 'text',
                direction,
                timestamp: normalizeTimestamp(m.messaged_at || m.created_at || m.timestamp),
                status: m.status,
                metadata: m.metadata || {},
                template_proforma: m.template_proforma,
                template_component_values: m.template_component_values,
                template_components: m.template_components,
                media_values: m.media_values,
                interaction_message_data: m.interaction_message_data,
                template_message: m.template_message,
                whatsapp_message_error: m.whatsapp_message_error,
              };
            });
            // Merge: purely additive - never lose messages
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));

              // Find NEW messages from cache that don't exist locally (by ID only)
              const newMessages = transformed.filter((m: WhatsAppMessage) => {
                return !existingIds.has(m.id);
              });

              // Keep all prev messages, update temp→real if matched
              const replacedTempIds = new Set<string>();
              const updatedPrev = prev.map(m => {
                // If this is a temp message, check if real version exists in transformed
                if (String(m.id).startsWith('temp_')) {
                  const mTime = new Date(m.timestamp).getTime();
                  const mMediaType = m.type !== 'text' ? m.type : (m.media_values?.type || 'text');

                  // Find matching real message
                  const realMessage = transformed.find((t: WhatsAppMessage) => {
                    // Must be same direction
                    if (t.direction !== m.direction) return false;
                    // Must be within 2 minutes
                    const tTime = new Date(t.timestamp).getTime();
                    if (Math.abs(mTime - tTime) > 120000) return false;
                    // Must not already be used to replace another temp
                    if (replacedTempIds.has(t.id)) return false;

                    const tMediaType = t.type !== 'text' ? t.type : (t.media_values?.type || 'text');

                    // For media messages, match by type
                    if (mMediaType !== 'text' && tMediaType !== 'text') {
                      return mMediaType === tMediaType;
                    }
                    // For template messages - match by type and direction within time window
                    // API may return different text (with header/footer) than what we previewed
                    if (m.type === 'template') {
                      // Real message is also a template or has template fields
                      const isRealTemplate = t.type === 'template' ||
                                             t.template_proforma ||
                                             t.template_components;
                      if (isRealTemplate) return true;
                      // Or real message text contains our body text (header added by API)
                      if (t.text && m.text && t.text.includes(m.text.trim())) return true;
                      return false;
                    }
                    // For text messages, match by content
                    if (mMediaType === 'text' && tMediaType === 'text') {
                      return t.text?.trim() === m.text?.trim();
                    }
                    return false;
                  });

                  if (realMessage) {
                    replacedTempIds.add(realMessage.id);
                    return realMessage;
                  }
                }
                return m;
              });

              // Combine: updated prev + truly new messages (not used for replacement)
              const combined = [
                ...updatedPrev,
                ...newMessages.filter(m => !replacedTempIds.has(m.id))
              ];

              // Remove duplicates by ID (final safety dedup)
              const seenIds = new Set<string>();
              const deduped = combined.filter(m => {
                if (seenIds.has(m.id)) return false;
                seenIds.add(m.id);
                return true;
              });

              // Sort by timestamp
              return deduped.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });
          }
        }
      }
    });

    return () => unsubscribe();
  }, [contactUid, conversationPhone, queryClient]);

  const loadMessages = useCallback(async () => {
    if (!conversationPhone) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First get contact UID from phone
      const contacts = await chatService.getChatContacts({ search: conversationPhone, limit: 1 });
      const contact = contacts.contacts.find(c =>
        normalizePhone(c.phone_number) === normalizePhone(conversationPhone)
      );

      if (contact) {
        setContactUid(contact._uid);

        // Fetch messages using chat service (React Query backed)
        const result = await chatService.getContactMessages(contact._uid, { limit: 100 });

        // Update React Query cache
        queryClient.setQueryData(chatKeys.messages(contact._uid, {}), result);

        // Transform to WhatsAppMessage format
        const transformedMessages = result.messages.map((m: any) => {
          // API uses is_incoming_message boolean, convert to direction
          const isIncoming = m.is_incoming_message ?? (m.direction === 'incoming');
          const direction = isIncoming ? 'incoming' : 'outgoing';
          return {
            id: m._uid,
            from: isIncoming ? conversationPhone : '',
            to: isIncoming ? '' : conversationPhone,
            text: m.message || m.message_body || m.text || '',
            type: m.message_type || 'text',
            direction,
            timestamp: normalizeTimestamp(m.messaged_at || m.created_at || m.timestamp),
            status: m.status,
            metadata: m.metadata || {},
            template_proforma: m.template_proforma,
            template_component_values: m.template_component_values,
            template_components: m.template_components,
            media_values: m.media_values,
            interaction_message_data: m.interaction_message_data,
            template_message: m.template_message,
            whatsapp_message_error: m.whatsapp_message_error,
          };
        });

        console.log('📥 Loaded messages:', {
          count: transformedMessages.length,
          contactUid: contact._uid,
        });

        setMessages(transformedMessages);
      } else {
        // Fallback to legacy messages service
        const conversationDetail = await messagesService.getConversationMessages(conversationPhone);
        const sortedMessages = [...conversationDetail.messages]
          .map((m) => ({
            ...m,
            timestamp: normalizeTimestamp(m.timestamp || (m.metadata as any)?.timestamp),
          }))
          .sort((a, b) => {
            const timeA = Date.parse(a.timestamp) || 0;
            const timeB = Date.parse(b.timestamp) || 0;
            return timeA - timeB;
          });

        setMessages(sortedMessages);
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationPhone, queryClient]);

  const sendMessage = useCallback(async (text: string) => {
    if (!conversationPhone || !text.trim()) return;

    const messageText = text.trim();

    // Create optimistic message with 'sent' status
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: WhatsAppMessage = {
      id: tempId,
      from: '',
      to: conversationPhone,
      text: messageText,
      type: 'text',
      direction: 'outgoing',
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      await messagesService.sendTextMessage({
        to: conversationPhone,
        text: messageText
      });

      // Mark as delivered - real-time (Pusher) will sync the actual message
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'delivered' }
          : m
      ));

      // Only update contacts list for sidebar (last message preview)
      if (contactUid) {
        queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      }
    } catch (err: any) {
      console.error('❌ Failed to send message:', err);
      // Mark message as failed
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'failed', metadata: { ...m.metadata, error: err.message } }
          : m
      ));
      setError(err.message || 'Failed to send message');
      throw err;
    }
  }, [conversationPhone, contactUid, queryClient]);

  const sendMediaMessage = useCallback(async (file: File, media_type: "image" | "video" | "audio" | "document", caption?: string) => {
    const contactIdOrPhone = contactUid || conversationPhone;
    if (!contactIdOrPhone) {
      const err = new Error('Contact not found');
      setError(err.message);
      throw err;
    }

    const tempId = `temp_${Date.now()}`;
    const file_preview_url = URL.createObjectURL(file);

    const optimisticMessage: WhatsAppMessage = {
      id: tempId,
      from: '',
      to: conversationPhone || '',
      text: caption || '',
      type: media_type,
      direction: 'outgoing',
      timestamp: new Date().toISOString(),
      status: 'sent',
      metadata: {
        file_preview_url,
        is_uploading: true,
        file_name: file.name,
      },
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Upload file to get public URL
      const uploadResponse = await uploadMedia(file);
      const media_url = uploadResponse.media_id || uploadResponse.url;

      // Update optimistic message with media URL
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, metadata: { ...m.metadata, media_url } }
          : m
      ));

      // Send via chatService with contactUid or phone
      await chatService.sendMediaMessage(
        contactIdOrPhone,
        media_type,
        media_url,
        caption,
        file.name
      );

      // Mark as delivered - real-time (Pusher) will sync the actual message
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'delivered', metadata: { ...m.metadata, is_uploading: false } }
          : m
      ));

      // Update contacts list for sidebar
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
    } catch (err: any) {
      console.error('❌ Failed to send media message:', err);
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'failed', metadata: { ...m.metadata, is_uploading: false, error: err.message } }
          : m
      ));
      setError(err.message || 'Failed to send media message');
      throw err;
    }
  }, [conversationPhone, contactUid, queryClient]);

  const sendTemplateMessage = useCallback(async (template: Template, variables: Record<string, string>) => {
    if (!conversationPhone) return;

    // Get template body text with variables replaced
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    let messageText = bodyComponent?.text || `[Template: ${template.name}]`;

    // Replace variables in the text for preview
    Object.entries(variables).forEach(([key, value]) => {
      const match = key.match(/\{\{(\d+)\}\}/);
      if (match) {
        messageText = messageText.replace(key, value);
      }
    });

    // Create optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: WhatsAppMessage = {
      id: tempId,
      from: '',
      to: conversationPhone,
      text: messageText,
      type: 'template',
      direction: 'outgoing',
      timestamp: new Date().toISOString(),
      status: 'sent',
      metadata: {
        template_name: template.name,
      },
    };

    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Convert variables to parameters format
      const parameters: Record<string, string> = {};
      Object.entries(variables).forEach(([key, value]) => {
        const match = key.match(/\{\{(\d+)\}\}/);
        if (match) {
          parameters[match[1]] = value;
        }
      });

      await templatesService.sendTemplate({
        to: conversationPhone,
        template_name: template.name,
        language: template.language as any,
        parameters,
      });

      // Mark as delivered
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'delivered' }
          : m
      ));

      // Update contacts list for sidebar
      if (contactUid) {
        queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      }
    } catch (err: any) {
      console.error('❌ Failed to send template message:', err);
      setMessages(prev => prev.map(m =>
        m.id === tempId
          ? { ...m, status: 'failed', metadata: { ...m.metadata, error: err.message } }
          : m
      ));
      setError(err.message || 'Failed to send template message');
      throw err;
    }
  }, [conversationPhone, contactUid, queryClient]);

  const refreshMessages = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    sendMediaMessage,
    sendTemplateMessage,
    refreshMessages,
  };
}
