// src/services/whatsapp/chatService.ts
import { externalWhatsappService } from '@/services/externalWhatsappService';

// ==================== HELPER FUNCTIONS ====================

// Check if a string looks like a phone number (all digits, possibly with + prefix)
function isPhoneNumber(str: string): boolean {
  if (!str) return false;
  const normalized = str.replace(/^\+/, '');
  return /^\d{7,15}$/.test(normalized);
}

// Cache for phone number to UID mapping
const phoneToUidCache = new Map<string, string>();

// ==================== TYPE DEFINITIONS ====================

export interface ChatLabel {
  _uid: string;
  title: string;
  text_color?: string;
  bg_color?: string;
}

export interface ChatContact {
  _uid: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  is_online?: boolean;
  is_blocked?: boolean;
  bot_enabled?: boolean;
  assigned_user_uid?: string;
  assigned_user_name?: string;
  labels?: ChatLabel[];
  notes?: string;
  reply_window_open?: boolean;
  reply_window_expires_at?: string | null;
  requires_template?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Template component types for rendering
export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface TemplateProforma {
  name: string;
  language: string;
  components: TemplateComponent[];
}

export interface MediaValue {
  type: 'image' | 'video' | 'document';
  link: string;
  caption?: string;
  filename?: string;
}

export interface InteractionMessageData {
  type: 'button' | 'list';
  body?: { text: string };
  action?: {
    buttons?: Array<{ type: string; reply: { id: string; title: string } }>;
    sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  };
}

export interface ChatMessage {
  _uid: string;
  contact_uid: string;
  direction: 'incoming' | 'outgoing';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'interactive';
  message_body?: string;
  media_url?: string;
  media_type?: string;
  template_name?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  // Template message fields (when message_body is null/empty)
  template_proforma?: TemplateProforma;
  template_component_values?: Array<{
    type: string;
    parameters: Record<string, { type: string; text?: string }>;
  }>;
  template_components?: TemplateComponent[];
  template_message?: string;
  media_values?: MediaValue;
  interaction_message_data?: InteractionMessageData;
  whatsapp_message_error?: string;
}

export interface UnreadCount {
  total: number;
  contacts: Record<string, number>;
}

export interface TeamMember {
  _uid: string;
  name: string;
  email: string;
  avatar_url?: string;
  role?: string;
}

export interface ChatContactsResponse {
  contacts: ChatContact[];
  total: number;
  page: number;
  limit: number;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
  contact: ChatContact;
}

export interface SendMessageResponse {
  message_uid: string;
  status: string;
}

export interface ReplyWindowStatus {
  is_open: boolean;
  expires_at: string | null;
  requires_template: boolean;
}

export interface ChatContext {
  contact: ChatContact;
  labels: ChatLabel[];
  teamMembers: TeamMember[];
  replyWindowStatus: ReplyWindowStatus;
}

// ==================== CHAT SERVICE ====================

class ChatService {
  // Resolve a contact UID - if it's a phone number, look up the actual UID
  private async resolveContactUid(contactIdOrPhone: string): Promise<string> {
    // If it doesn't look like a phone number, assume it's already a UID
    if (!isPhoneNumber(contactIdOrPhone)) {
      return contactIdOrPhone;
    }

    const normalizedPhone = contactIdOrPhone.replace(/^\+/, '');

    // Check cache first
    if (phoneToUidCache.has(normalizedPhone)) {
      const cachedUid = phoneToUidCache.get(normalizedPhone)!;
      console.log('📱 Using cached UID for phone:', normalizedPhone, '->', cachedUid);
      return cachedUid;
    }

    // Look up the contact by phone number
    console.log('🔍 Looking up contact UID for phone:', normalizedPhone);
    const contact = await externalWhatsappService.getContactByPhone(normalizedPhone);

    if (contact && contact._uid) {
      console.log('✅ Found contact UID:', contact._uid, 'for phone:', normalizedPhone);
      phoneToUidCache.set(normalizedPhone, contact._uid);
      return contact._uid;
    }

    // If we couldn't find a UID, log a warning and return the phone number
    // The API call might fail, but at least we tried
    console.warn('⚠️ Could not find contact UID for phone:', normalizedPhone, '- using phone number as fallback');
    return contactIdOrPhone;
  }

  // Update the cache when we normalize contacts
  private updateUidCache(uid: string, phoneNumber: string): void {
    if (uid && phoneNumber && !isPhoneNumber(uid)) {
      const normalizedPhone = phoneNumber.replace(/^\+/, '');
      phoneToUidCache.set(normalizedPhone, uid);
    }
  }

  // Extract message text from various formats
  private extractLastMessage(lastMessage: any): string {
    if (!lastMessage) return '';
    // If it's already a string, return it
    if (typeof lastMessage === 'string') return lastMessage;
    // If it's an object like {message, is_incoming, messaged_at}
    if (typeof lastMessage === 'object') {
      return lastMessage.message || lastMessage.text || lastMessage.body || lastMessage.message_body || '';
    }
    return String(lastMessage);
  }

  // Extract last message timestamp from various formats
  private extractLastMessageTime(data: any): string | undefined {
    // Check for direct timestamp fields first
    if (data.last_message_at) return data.last_message_at;
    if (data.last_message_time) return data.last_message_time;
    // Check if last_message is an object with messaged_at
    if (data.last_message && typeof data.last_message === 'object') {
      return data.last_message.messaged_at || data.last_message.timestamp || data.last_message.created_at;
    }
    return data.updated_at;
  }

  private normalizeContact(data: any): ChatContact {
    // Extract the actual contact UID - this is critical for API calls
    // The API returns _uid as the primary identifier
    // IMPORTANT: Never fall back to phone number for the UID
    const rawUid = data._uid || data.contact_uid || data.uid || data.id;
    const phoneNumber = data.phone_number || data.phone || data.wa_id || '';

    // Only use the rawUid if it's not a phone number itself
    // If the API returns a phone number as the ID, we need to flag this
    const contactUid = rawUid && !isPhoneNumber(rawUid) ? rawUid : rawUid || '';

    // Log for debugging
    console.log('📇 Normalizing contact:', {
      raw_uid: data._uid,
      raw_contact_uid: data.contact_uid,
      raw_id: data.id,
      resolved_uid: contactUid,
      is_phone_number: isPhoneNumber(contactUid),
      phone: phoneNumber
    });

    // Update the cache so we can resolve this later
    if (contactUid && phoneNumber && !isPhoneNumber(contactUid)) {
      this.updateUidCache(contactUid, phoneNumber);
    }

    // Normalize labels to ChatLabel format
    const normalizedLabels: ChatLabel[] = (data.labels || []).map((label: any) => ({
      _uid: label._uid || label.id || label.uid,
      title: label.title || label.name || label.label,
      text_color: label.text_color,
      bg_color: label.bg_color || label.color,
    }));

    return {
      _uid: contactUid, // This should be a real UID, not a phone number
      phone_number: phoneNumber,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      name: data.name || (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : phoneNumber),
      email: data.email,
      avatar_url: data.avatar_url || data.profile_picture,
      last_message: this.extractLastMessage(data.last_message) || data.last_message_text || '',
      last_message_at: this.extractLastMessageTime(data),
      unread_count: data.unread_count ?? data.unread_messages_count ?? 0,
      is_online: data.is_online || false,
      is_blocked: data.is_blocked ?? false,
      bot_enabled: data.bot_enabled ?? true,
      assigned_user_uid: data.assigned_user_uid || data.assigned_to,
      assigned_user_name: data.assigned_user_name,
      labels: normalizedLabels,
      notes: data.notes,
      reply_window_open: data.reply_window_open ?? data.window_is_open ?? true,
      reply_window_expires_at: data.reply_window_expires_at ?? data.window_expires_at ?? null,
      requires_template: data.requires_template ?? false,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  private normalizeMessage(data: any): ChatMessage {
    // Extract message text from various possible field names
    // According to the API guide, the field is "body" for message text
    // Priority: body > message (string) > message_body > text > nested structures
    let messageText = '';

    // Primary: "body" field (as per API guide)
    if (typeof data.body === 'string' && data.body) {
      messageText = data.body;
    }
    // "message" field as string (some API responses)
    else if (typeof data.message === 'string' && data.message) {
      messageText = data.message;
    }
    // "message_body" field
    else if (data.message_body) {
      messageText = data.message_body;
    }
    // "text" field as string
    else if (typeof data.text === 'string' && data.text) {
      messageText = data.text;
    }
    // Other direct fields
    else if (data.content) {
      messageText = data.content;
    } else if (data.message_text) {
      messageText = data.message_text;
    }
    // Nested structure checks (WhatsApp Cloud API format)
    else if (data.text?.body) {
      messageText = data.text.body;
    } else if (data.message?.body) {
      messageText = data.message.body;
    } else if (data.message?.text?.body) {
      messageText = data.message.text.body;
    } else if (data.message?.text && typeof data.message.text === 'string') {
      messageText = data.message.text;
    }
    // Interactive message formats
    else if (data.interactive?.body?.text) {
      messageText = data.interactive.body.text;
    } else if (data.button?.text) {
      messageText = data.button.text;
    }
    // Template message formats
    else if (data.template?.name) {
      messageText = `[Template: ${data.template.name}]`;
    }

    // Determine direction - check is_incoming_message first (as per API guide)
    let direction: 'incoming' | 'outgoing' = 'incoming';
    if (data.direction === 'outgoing' || data.direction === 'incoming') {
      direction = data.direction;
    } else if (typeof data.is_incoming_message === 'boolean') {
      direction = data.is_incoming_message ? 'incoming' : 'outgoing';
    } else if (typeof data.is_outgoing === 'boolean') {
      direction = data.is_outgoing ? 'outgoing' : 'incoming';
    } else if (typeof data.is_incoming === 'boolean') {
      direction = data.is_incoming ? 'incoming' : 'outgoing';
    }

    // Log for debugging
    console.log('📨 Normalizing message:', {
      id: data._uid || data.id,
      direction,
      type: data.type || data.message_type,
      hasBody: !!data.body,
      hasMessage: !!data.message,
      hasMessageBody: !!data.message_body,
      hasText: !!data.text,
      is_incoming_message: data.is_incoming_message,
      extractedText: messageText?.substring(0, 50) || '(empty)',
      rawKeys: Object.keys(data),
    });

    return {
      _uid: data._uid || data.id || data.message_uid,
      contact_uid: data.contact_uid || data.contact_id,
      direction,
      message_type: data.message_type || data.type || 'text',
      message_body: messageText,
      media_url: data.media_url || data.media?.url || data.media_values?.url,
      media_type: data.media_type || data.media?.type || data.media_values?.mime_type,
      template_name: data.template_name,
      status: data.status || data.delivery_status,
      created_at: data.created_at || data.timestamp || data.messaged_at || new Date().toISOString(),
      updated_at: data.updated_at,
      metadata: data.metadata || data.meta_data,
      // Template message fields - pass through as-is from API
      template_proforma: data.template_proforma,
      template_component_values: data.template_component_values,
      template_components: data.template_components,
      template_message: data.template_message,
      media_values: data.media_values,
      interaction_message_data: data.interaction_message_data,
      whatsapp_message_error: data.whatsapp_message_error,
    };
  }

  // ==================== INBOX METHODS ====================

  async getChatContacts(params?: { page?: number; limit?: number; search?: string }): Promise<ChatContactsResponse> {
    const response = await externalWhatsappService.getChatContacts(params);

    let contacts: any[] = [];
    let total = 0;

    if (Array.isArray(response)) {
      contacts = response;
      total = response.length;
    } else if (response?.data) {
      contacts = Array.isArray(response.data) ? response.data : [];
      total = response.total || contacts.length;
    } else if (response?.contacts) {
      contacts = response.contacts;
      total = response.total || contacts.length;
    }

    return {
      contacts: contacts.map((c: any) => this.normalizeContact(c)),
      total,
      page: params?.page || 1,
      limit: params?.limit || 50,
    };
  }

  async getUnreadCount(): Promise<UnreadCount> {
    try {
      const response = await externalWhatsappService.getUnreadCount();
      return {
        total: response?.total || response?.unread_count || 0,
        contacts: response?.contacts || response?.per_contact || {},
      };
    } catch (error) {
      // Fail gracefully - return zeros if endpoint fails
      console.warn('Failed to fetch unread count:', error);
      return { total: 0, contacts: {} };
    }
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const response = await externalWhatsappService.getTeamMembers();
    const members = Array.isArray(response) ? response : (response?.data || response?.members || []);
    return members.map((m: any) => ({
      _uid: m._uid || m.id || m.user_uid,
      name: m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim(),
      email: m.email || '',
      avatar_url: m.avatar_url || m.profile_picture,
      role: m.role,
    }));
  }

  // ==================== MESSAGE METHODS ====================

  async getContactMessages(contactIdOrPhone: string, params?: { page?: number; limit?: number }): Promise<ChatMessagesResponse> {
    // Resolve the contact UID if a phone number was passed
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('📨 Fetching messages for contact:', { input: contactIdOrPhone, resolved: contactUid });

    const response = await externalWhatsappService.getContactMessages(contactUid, params);

    console.log('📬 chatService received response:', {
      isArray: Array.isArray(response),
      hasData: !!response?.data,
      hasMessages: !!response?.messages,
      topKeys: response ? Object.keys(response) : [],
    });

    let messages: any[] = [];
    let total = 0;
    let contact: any = null;

    if (Array.isArray(response)) {
      messages = response;
      total = response.length;
    } else if (response?.data) {
      messages = Array.isArray(response.data) ? response.data : [];
      total = response.total || messages.length;
      contact = response.contact;
    } else if (response?.messages) {
      messages = response.messages;
      total = response.total || messages.length;
      contact = response.contact;
    }

    console.log('📬 Extracted messages:', {
      count: messages.length,
      firstMessageKeys: messages[0] ? Object.keys(messages[0]) : [],
      firstMessageSample: messages[0] ? {
        message_body: messages[0].message_body,
        message: messages[0].message,
        text: messages[0].text,
        body: messages[0].body,
        content: messages[0].content,
      } : 'none',
    });

    const normalizedMessages = messages.map((m: any) => this.normalizeMessage(m));

    console.log('📬 Normalized messages:', {
      count: normalizedMessages.length,
      firstNormalized: normalizedMessages[0] ? {
        message_body: normalizedMessages[0].message_body,
        direction: normalizedMessages[0].direction,
      } : 'none',
    });

    return {
      messages: normalizedMessages,
      total,
      page: params?.page || 1,
      limit: params?.limit || 50,
      contact: contact ? this.normalizeContact(contact) : { _uid: contactUid, phone_number: '', unread_count: 0 },
    };
  }

  async sendMessage(contactIdOrPhone: string, text: string): Promise<SendMessageResponse> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('📤 Sending message to contact:', { input: contactIdOrPhone, resolved: contactUid });

    const response = await externalWhatsappService.sendChatMessage(contactUid, { message_body: text });
    return {
      message_uid: response?.message_uid || response?._uid || response?.id,
      status: response?.status || 'sent',
    };
  }

  async sendMediaMessage(
    contactIdOrPhone: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaUrl: string,
    caption?: string,
    fileName?: string
  ): Promise<SendMessageResponse> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('📤 Sending media to contact:', { input: contactIdOrPhone, resolved: contactUid });

    const response = await externalWhatsappService.sendChatMediaMessage(contactUid, {
      media_type: mediaType,
      media_url: mediaUrl,
      caption,
      file_name: fileName,
    });
    return {
      message_uid: response?.message_uid || response?._uid || response?.id,
      status: response?.status || 'sent',
    };
  }

  async sendTemplateMessage(
    contactIdOrPhone: string,
    templateName: string,
    templateLanguage: string,
    components?: any[]
  ): Promise<SendMessageResponse> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('📤 Sending template to contact:', { input: contactIdOrPhone, resolved: contactUid });

    const response = await externalWhatsappService.sendChatTemplateMessage(contactUid, {
      template_name: templateName,
      template_language: templateLanguage,
      components,
    });
    return {
      message_uid: response?.message_uid || response?._uid || response?.id,
      status: response?.status || 'sent',
    };
  }

  async markAsRead(contactIdOrPhone: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    await externalWhatsappService.markMessagesAsRead(contactUid);
  }

  async clearChatHistory(contactIdOrPhone: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    await externalWhatsappService.clearChatHistory(contactUid);
  }

  // ==================== CONTACT MANAGEMENT ====================

  async assignUser(contactIdOrPhone: string, userUid: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    await externalWhatsappService.assignUserToContact(contactUid, { user_uid: userUid });
  }

  async assignLabels(contactIdOrPhone: string, labelUids: string[]): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    await externalWhatsappService.assignLabelsToContact(contactUid, { label_uids: labelUids });
  }

  async updateNotes(contactIdOrPhone: string, notes: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    await externalWhatsappService.updateContactNotes(contactUid, { notes });
  }

  // ==================== CONTACT ACTIONS ====================

  async blockContact(contactIdOrPhone: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('🚫 Blocking contact:', { input: contactIdOrPhone, resolved: contactUid });
    await externalWhatsappService.blockContact(contactUid);
  }

  async unblockContact(contactIdOrPhone: string): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('✅ Unblocking contact:', { input: contactIdOrPhone, resolved: contactUid });
    await externalWhatsappService.unblockContact(contactUid);
  }

  async updateBotSettings(contactIdOrPhone: string, botEnabled: boolean): Promise<void> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('🤖 Updating bot settings:', { input: contactIdOrPhone, resolved: contactUid, botEnabled });
    await externalWhatsappService.updateBotSettings(contactUid, { bot_enabled: botEnabled });
  }

  async getChatContext(contactIdOrPhone: string): Promise<{
    contact: ChatContact;
    labels: Array<{ _uid: string; title: string; text_color?: string; bg_color?: string }>;
    teamMembers: TeamMember[];
    replyWindowStatus: {
      is_open: boolean;
      expires_at: string | null;
      requires_template: boolean;
    };
  }> {
    const contactUid = await this.resolveContactUid(contactIdOrPhone);
    console.log('📋 Fetching chat context:', { input: contactIdOrPhone, resolved: contactUid });
    const response = await externalWhatsappService.getChatContext(contactUid);

    return {
      contact: this.normalizeContact(response?.contact || response),
      labels: response?.labels || [],
      teamMembers: (response?.team_members || []).map((m: any) => ({
        _uid: m._uid || m.id || m.user_uid,
        name: m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim(),
        email: m.email || '',
        avatar_url: m.avatar_url || m.profile_picture,
        role: m.role,
      })),
      replyWindowStatus: {
        is_open: response?.reply_window?.is_open ?? response?.window_is_open ?? true,
        expires_at: response?.reply_window?.expires_at ?? response?.window_expires_at ?? null,
        requires_template: response?.reply_window?.requires_template ?? response?.requires_template ?? false,
      },
    };
  }

  // ==================== MESSAGE LOG ====================

  async getMessageLog(params?: {
    page?: number;
    limit?: number;
    contact_uid?: string;
    direction?: string;
  }): Promise<{ messages: ChatMessage[]; total: number }> {
    const response = await externalWhatsappService.getMessageLog(params);

    let messages: any[] = [];
    let total = 0;

    if (Array.isArray(response)) {
      messages = response;
      total = response.length;
    } else if (response?.data) {
      messages = Array.isArray(response.data) ? response.data : [];
      total = response.total || messages.length;
    } else if (response?.messages) {
      messages = response.messages;
      total = response.total || messages.length;
    }

    return {
      messages: messages.map((m: any) => this.normalizeMessage(m)),
      total,
    };
  }

  async getMessage(messageUid: string): Promise<ChatMessage> {
    const response = await externalWhatsappService.getMessage(messageUid);
    return this.normalizeMessage(response);
  }
}

export const chatService = new ChatService();
