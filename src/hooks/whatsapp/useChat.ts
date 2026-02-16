// src/hooks/whatsapp/useChat.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  chatService,
  ChatContact,
  ChatMessage,
  ChatContactsResponse,
  ChatMessagesResponse,
  UnreadCount,
  TeamMember,
  ChatLabel,
  ChatContext,
  ReplyWindowStatus,
} from '@/services/whatsapp/chatService';

// ==================== POLLING CONFIGURATION ====================
// DISABLED: Using Pusher/Laravel Echo for real-time updates instead of polling
// Set this to true to re-enable polling as a fallback
export const ENABLE_POLLING = false;

// ==================== QUERY KEYS ====================

export const chatKeys = {
  all: ['chat'] as const,
  // Base key for contacts - use this for invalidation
  contacts: () => [...chatKeys.all, 'contacts'] as const,
  // Full key with params - use this for actual queries
  contactsWithParams: (params?: { page?: number; limit?: number; search?: string }) =>
    [...chatKeys.contacts(), params] as const,
  unreadCount: () => [...chatKeys.all, 'unread-count'] as const,
  teamMembers: () => [...chatKeys.all, 'team-members'] as const,
  // Base key for messages - use this for invalidation
  messages: (contactUid: string, params?: { page?: number; limit?: number }) =>
    [...chatKeys.all, 'messages', contactUid, params] as const,
  messageLog: (params?: { page?: number; limit?: number; contact_uid?: string; direction?: string }) =>
    [...chatKeys.all, 'message-log', params] as const,
  message: (messageUid: string) => [...chatKeys.all, 'message', messageUid] as const,
  chatContext: (contactUid: string) => [...chatKeys.all, 'context', contactUid] as const,
};

// ==================== CHAT CONTACTS HOOK ====================

export interface UseChatContactsOptions {
  page?: number;
  limit?: number;
  search?: string;
  enabled?: boolean;
}

export function useChatContacts(options: UseChatContactsOptions = {}) {
  const { page = 1, limit = 50, search, enabled = true } = options;

  const query = useQuery({
    // Use contactsWithParams for the full query key with params
    queryKey: chatKeys.contactsWithParams({ page, limit, search }),
    queryFn: () => chatService.getChatContacts({ page, limit, search }),
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    contacts: query.data?.contacts || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ==================== UNREAD COUNT HOOK (WITH OPTIONAL POLLING) ====================

export interface UseUnreadCountOptions {
  enabled?: boolean;
  pollInterval?: number | false; // Default 30 seconds, false to disable
}

export function useUnreadCount(options: UseUnreadCountOptions = {}) {
  const { enabled = true, pollInterval = 30000 } = options;

  // Determine actual polling interval based on global flag
  // If ENABLE_POLLING is false, always disable polling regardless of pollInterval param
  const actualPollInterval = ENABLE_POLLING ? pollInterval : false;

  const query = useQuery({
    queryKey: chatKeys.unreadCount(),
    queryFn: () => chatService.getUnreadCount(),
    enabled,
    refetchInterval: actualPollInterval,
    staleTime: 10000, // 10 seconds
    retry: false, // Don't retry on failure - endpoint may not be implemented
    throwOnError: false, // Don't throw errors to prevent app crash
  });

  return {
    total: query.data?.total || 0,
    contacts: query.data?.contacts || {},
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// ==================== TEAM MEMBERS HOOK ====================

export function useTeamMembers(enabled = true) {
  const query = useQuery({
    queryKey: chatKeys.teamMembers(),
    queryFn: () => chatService.getTeamMembers(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    teamMembers: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// ==================== CHAT MESSAGES HOOK ====================

export interface UseChatMessagesOptions {
  contactUid: string | null;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useChatMessages(options: UseChatMessagesOptions) {
  const { contactUid, page = 1, limit = 100, enabled = true } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: chatKeys.messages(contactUid || '', { page, limit }),
    queryFn: async () => {
      if (!contactUid) throw new Error('Contact UID required');
      const result = await chatService.getContactMessages(contactUid, { page, limit });

      // Mark as read when messages are fetched
      try {
        await chatService.markAsRead(contactUid);
        // Invalidate unread count
        queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
      } catch (e) {
        // Silent fail for mark as read
      }

      return result;
    },
    enabled: enabled && !!contactUid,
    staleTime: 10000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    messages: query.data?.messages || [],
    total: query.data?.total || 0,
    contact: query.data?.contact || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ==================== SEND MESSAGE MUTATION ====================

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactUid, text }: { contactUid: string; text: string }) => {
      return chatService.sendMessage(contactUid, text);
    },
    onSuccess: (_, variables) => {
      // Invalidate messages for this contact
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.contactUid, {}),
        exact: false,
      });
      // Invalidate contacts list to update last message
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to send message');
    },
  });
}

// ==================== SEND MEDIA MESSAGE MUTATION ====================

export function useSendMediaMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactUid,
      mediaType,
      mediaUrl,
      caption,
      fileName,
    }: {
      contactUid: string;
      mediaType: 'image' | 'video' | 'audio' | 'document';
      mediaUrl: string;
      caption?: string;
      fileName?: string;
    }) => {
      return chatService.sendMediaMessage(contactUid, mediaType, mediaUrl, caption, fileName);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.contactUid, {}),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to send media');
    },
  });
}

// ==================== SEND TEMPLATE MESSAGE MUTATION ====================

export function useSendTemplateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactUid,
      templateName,
      templateLanguage,
      components,
    }: {
      contactUid: string;
      templateName: string;
      templateLanguage: string;
      components?: any[];
    }) => {
      return chatService.sendTemplateMessage(contactUid, templateName, templateLanguage, components);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.contactUid, {}),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      toast.success('Template message sent');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to send template');
    },
  });
}

// ==================== MARK AS READ MUTATION ====================

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactUid: string) => chatService.markAsRead(contactUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
    },
  });
}

// ==================== CLEAR CHAT HISTORY MUTATION ====================

export function useClearChatHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactUid: string) => chatService.clearChatHistory(contactUid),
    onSuccess: (_, contactUid) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(contactUid, {}),
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      toast.success('Chat history cleared');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to clear chat history');
    },
  });
}

// ==================== ASSIGN USER MUTATION ====================

export function useAssignUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactUid, userUid }: { contactUid: string; userUid: string }) =>
      chatService.assignUser(contactUid, userUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      toast.success('User assigned');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to assign user');
    },
  });
}

// ==================== ASSIGN LABELS MUTATION ====================

export function useAssignLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactUid, labelUids }: { contactUid: string; labelUids: string[] }) =>
      chatService.assignLabels(contactUid, labelUids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      toast.success('Labels updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update labels');
    },
  });
}

// ==================== UPDATE NOTES MUTATION ====================

export function useUpdateNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactUid, notes }: { contactUid: string; notes: string }) =>
      chatService.updateNotes(contactUid, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      toast.success('Notes updated');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update notes');
    },
  });
}

// ==================== BLOCK CONTACT MUTATION ====================

export function useBlockContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactUid: string) => chatService.blockContact(contactUid),
    onSuccess: (_, contactUid) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: chatKeys.chatContext(contactUid) });
      toast.success('Contact blocked');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to block contact');
    },
  });
}

// ==================== UNBLOCK CONTACT MUTATION ====================

export function useUnblockContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactUid: string) => chatService.unblockContact(contactUid),
    onSuccess: (_, contactUid) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: chatKeys.chatContext(contactUid) });
      toast.success('Contact unblocked');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to unblock contact');
    },
  });
}

// ==================== BOT SETTINGS MUTATION ====================

export function useBotSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactUid, botEnabled }: { contactUid: string; botEnabled: boolean }) =>
      chatService.updateBotSettings(contactUid, botEnabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.contacts() });
      queryClient.invalidateQueries({ queryKey: chatKeys.chatContext(variables.contactUid) });
      toast.success(variables.botEnabled ? 'Bot enabled' : 'Bot disabled');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update bot settings');
    },
  });
}

// ==================== CHAT CONTEXT HOOK ====================

export interface UseChatContextOptions {
  contactUid: string | null;
  enabled?: boolean;
}

export function useChatContext(options: UseChatContextOptions) {
  const { contactUid, enabled = true } = options;

  const query = useQuery({
    queryKey: chatKeys.chatContext(contactUid || ''),
    queryFn: async () => {
      if (!contactUid) throw new Error('Contact UID required');
      return chatService.getChatContext(contactUid);
    },
    enabled: enabled && !!contactUid,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    contact: query.data?.contact || null,
    labels: query.data?.labels || [],
    teamMembers: query.data?.teamMembers || [],
    replyWindowStatus: query.data?.replyWindowStatus || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ==================== MESSAGE LOG HOOK ====================

export function useMessageLog(params?: {
  page?: number;
  limit?: number;
  contact_uid?: string;
  direction?: string;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params || {};

  const query = useQuery({
    queryKey: chatKeys.messageLog(queryParams),
    queryFn: () => chatService.getMessageLog(queryParams),
    enabled,
    staleTime: 30000,
  });

  return {
    messages: query.data?.messages || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// ==================== COMBINED CHAT HOOK ====================

export interface UseChatOptions {
  selectedContactUid?: string | null;
  searchQuery?: string;
  enablePolling?: boolean;
  pollInterval?: number;
}

export function useChat(options: UseChatOptions = {}) {
  const {
    selectedContactUid = null,
    searchQuery = '',
    enablePolling = true,
    pollInterval = 30000,
  } = options;

  const queryClient = useQueryClient();

  // Fetch contacts
  const contactsQuery = useChatContacts({
    search: searchQuery || undefined,
    enabled: true,
  });

  // Fetch unread count with polling
  const unreadQuery = useUnreadCount({
    enabled: enablePolling,
    pollInterval,
  });

  // Fetch messages for selected contact
  const messagesQuery = useChatMessages({
    contactUid: selectedContactUid,
    enabled: !!selectedContactUid,
  });

  // Send message mutation
  const sendMessageMutation = useSendMessage();

  // Send media mutation
  const sendMediaMutation = useSendMediaMessage();

  // Mark as read mutation
  const markAsReadMutation = useMarkAsRead();

  // Select contact handler
  const selectContact = async (contactUid: string) => {
    if (contactUid) {
      // Mark as read when selecting
      try {
        await markAsReadMutation.mutateAsync(contactUid);
      } catch (e) {
        // Silent fail
      }
    }
  };

  // Refresh all data
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: chatKeys.all });
  };

  return {
    // Contacts
    contacts: contactsQuery.contacts,
    contactsTotal: contactsQuery.total,
    contactsLoading: contactsQuery.isLoading,
    contactsError: contactsQuery.error,
    refetchContacts: contactsQuery.refetch,

    // Unread
    unreadTotal: unreadQuery.total,
    unreadByContact: unreadQuery.contacts,

    // Messages
    messages: messagesQuery.messages,
    messagesTotal: messagesQuery.total,
    currentContact: messagesQuery.contact,
    messagesLoading: messagesQuery.isLoading,
    messagesError: messagesQuery.error,
    refetchMessages: messagesQuery.refetch,

    // Actions
    sendMessage: (text: string) => {
      if (!selectedContactUid) return Promise.reject(new Error('No contact selected'));
      return sendMessageMutation.mutateAsync({ contactUid: selectedContactUid, text });
    },
    sendMedia: (mediaType: 'image' | 'video' | 'audio' | 'document', mediaUrl: string, caption?: string) => {
      if (!selectedContactUid) return Promise.reject(new Error('No contact selected'));
      return sendMediaMutation.mutateAsync({ contactUid: selectedContactUid, mediaType, mediaUrl, caption });
    },
    selectContact,
    refreshAll,

    // Loading states
    isSending: sendMessageMutation.isPending || sendMediaMutation.isPending,
  };
}
