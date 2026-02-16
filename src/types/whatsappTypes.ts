// WhatsApp Module Types for Celiyo Multi-Tenant Architecture

// ==================== MESSAGE TYPES ====================

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string | null;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'interactive';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    file_preview_url?: string;
    is_uploading?: boolean;
    media_id?: string;
    error?: string;
    [key: string]: any;
  };
  // Template message fields
  template_proforma?: {
    name: string;
    components: Array<{
      type: string;
      format?: string;
      text?: string;
      buttons?: Array<{
        type: string;
        text: string;
        url?: string;
        phone_number?: string;
      }>;
      example?: any;
    }>;
    language?: string;
    status?: string;
    category?: string;
  };
  template_component_values?: Array<{
    type: string;
    parameters: Record<string, { type: string; text?: string }>;
  }>;
  template_components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
    }>;
  }>;
  template_message?: string;
  media_values?: {
    type: string;
    link?: string;
    filename?: string;
  };
  interaction_message_data?: {
    body?: { text: string };
    action?: {
      buttons?: Array<{
        type: string;
        reply?: { id: string; title: string };
      }>;
    };
  };
  whatsapp_message_error?: string;
}

export interface Conversation {
  phone: string;
  name: string;
  last_message: string;
  last_timestamp: string;
  message_count: number;
  unread_count?: number;
  direction: 'incoming' | 'outgoing';
  window_is_open?: boolean;
  window_expires_at?: string | null;
  time_remaining_seconds?: number | null;
  requires_template?: boolean;
}

export interface ConversationDetail {
  phone: string;
  name: string;
  messages: WhatsAppMessage[];
}

export interface MessageStats {
  total_messages: number;
  incoming_messages: number;
  outgoing_messages: number;
  total_conversations: number;
  messages_today: number;
  messages_this_week: number;
  messages_this_month: number;
}

export interface SendTextMessagePayload {
  to: string;
  text: string;
}

export interface SendTextMessageResponse {
  message_id: string;
  status: 'sent' | 'pending';
  to: string;
  text: string;
  timestamp: string;
}

export interface SendMediaMessagePayload {
  to: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
  media_url: string;
  caption?: string;
  filename?: string;
}

export interface SendMediaMessageResponse {
  message_id: string;
  status: 'sent' | 'pending';
  to: string;
  media_type: string;
  media_url: string;
  timestamp: string;
}

export interface SendLocationMessagePayload {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendLocationMessageResponse {
  message_id: string;
  status: 'sent' | 'pending';
  to: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface RecentMessagesQuery {
  limit?: number;
  offset?: number;
  direction?: 'incoming' | 'outgoing';
  phone?: string;
}

export interface RecentMessagesResponse {
  total: number;
  limit: number;
  offset: number;
  messages: Array<{
    id: string;
    phone: string;
    contact_name: string;
    text: string;
    type: string;
    direction: 'incoming' | 'outgoing';
    timestamp: string;
  }>;
}

export interface DeleteConversationResponse {
  message: string;
  phone: string;
  deleted_count: number;
}

// ==================== CONTACT TYPES ====================

export interface Contact {
  id: number;
  phone: string;
  name: string | null;
  profile_pic_url: string | null;
  status: string | null;
  is_business: boolean;
  business_description: string | null;
  labels: string[];
  groups: string[];
  notes: string | null;
  assigned_to: string | null;
  last_message_from_user: string | null;
  conversation_window_expires_at?: string | null;
  window_is_open?: boolean | null;
  last_seen: string | null;
  created_at: string;
  updated_at?: string;
  tenant_id: string;
}

export interface ContactsListQuery {
  search?: string;
  labels?: string;
  groups?: string;
  limit?: number;
  offset?: number;
}

export interface ContactsListResponse {
  total: number;
  contacts: Contact[];
}

export interface CreateContactPayload {
  phone: string;
  name?: string;
  notes?: string;
  labels?: string[];
  groups?: string[];
  is_business?: boolean;
  business_description?: string;
  assigned_to?: string | null;
  status?: string;
  profile_pic_url?: string;
}

export interface UpdateContactPayload {
  name?: string;
  notes?: string;
  labels?: string[];
  groups?: string[];
  is_business?: boolean;
  business_description?: string;
  assigned_to?: string | null;
  status?: string;
  profile_pic_url?: string;
}

export interface DeleteContactResponse {
  message: string;
  phone: string;
}

// ==================== GROUP TYPES ====================

export interface Group {
  id: number;
  group_id: string;
  name: string;
  description: string | null;
  participants: string[];
  admins: string[];
  created_by: string | null;
  group_invite_link: string | null;
  is_active: boolean;
  participant_count: number;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface GroupsListQuery {
  active_only?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GroupsListResponse {
  total: number;
  groups: Group[];
}

export interface CreateGroupPayload {
  group_id: string; // Required - WhatsApp Group ID from WhatsApp
  name: string;
  description?: string;
  participants?: string[];
  admins?: string[];
  group_invite_link?: string;
  created_by?: string;
}

export interface UpdateGroupPayload {
  name?: string;
  description?: string;
  participants?: string[];
  admins?: string[];
  group_invite_link?: string;
  is_active?: boolean;
}

export interface DeleteGroupResponse {
  message: string;
  group_id: string;
}

// ==================== TEMPLATE TYPES ====================

export enum TemplateStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAUSED = "PAUSED",
  DISABLED = "DISABLED"
}

export enum TemplateCategory {
  MARKETING = "MARKETING",
  UTILITY = "UTILITY",
  AUTHENTICATION = "AUTHENTICATION"
}

export enum TemplateLanguage {
  ENGLISH = "en",
  ENGLISH_US = "en_US",
  ENGLISH_UK = "en_GB",
  HINDI = "hi",
  SPANISH = "es",
  FRENCH = "fr",
  GERMAN = "de",
  PORTUGUESE = "pt_BR",
  ARABIC = "ar"
}

// Component Types
export interface ButtonComponent {
  type: string; // QUICK_REPLY, URL, PHONE_NUMBER
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface TemplateComponent {
  type: string; // HEADER, BODY, FOOTER, BUTTONS
  format?: string;
  text?: string;
  buttons?: ButtonComponent[];
  example?: Record<string, any>;
}

export interface Template {
  id: number | string;
  tenant_id?: string;
  template_id?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[];
  body?: string;
  quality_score?: string;
  rejection_reason?: string;
  usage_count: number;
  last_used_at?: string;
  library_template_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplatesListQuery {
  status?: TemplateStatus;
  category?: TemplateCategory;
  language?: string;
  skip?: number;
  limit?: number;
}

export interface TemplatesListResponse {
  total: number;
  items: Template[];
  page: number;
  page_size: number;
}

export interface CreateTemplatePayload {
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  components: TemplateComponent[];
  library_template_name?: string;
}

export interface UpdateTemplatePayload {
  status?: TemplateStatus;
  usage_count?: number;
}

export interface DeleteTemplateResponse {
  ok: boolean;
  message: string;
}

// Template Send Types
export interface ParameterValue {
  type: string;
  text?: string;
  image?: Record<string, string>;
  document?: Record<string, string>;
  video?: Record<string, string>;
}

export interface ComponentParameter {
  type: string;
  parameters: ParameterValue[];
  sub_type?: string;
  index?: number;
}

export interface TemplateSendRequest {
  to: string;
  template_name: string;
  language: TemplateLanguage;
  components?: ComponentParameter[];
  parameters?: Record<string, string>;
}

export interface TemplateSendResponse {
  ok: boolean;
  message_id?: string;
  phone: string;
  template_name: string;
  status: string;
}

export interface TemplateBulkSendRequest {
  template_name: string;
  language: TemplateLanguage;
  recipients: string[];
  parameters_per_recipient?: Record<string, string>[];
  default_parameters?: Record<string, string>;
  schedule_at?: string; // ISO datetime for scheduled campaigns
  campaign_name?: string;
}

export interface TemplateBulkSendResponse {
  total: number;
  sent: number;
  failed: number;
  results: Record<string, any>[];
}

export interface TemplateAnalytics {
  template_id: number;
  template_name: string;
  status: string;
  usage_count: number;
  total_sends: number;
  successful_sends: number;
  failed_sends: number;
  success_rate: number;
  last_used_at?: string;
}

// ==================== TEMPLATE API TYPES ====================
// These types are for the Laravel API routes:
// GET /api/{vendorUid}/templates - Fetch all templates
// GET /api/{vendorUid}/templates/{templateUid} - Fetch single template

/**
 * Laravel template format from API routes
 * May include additional fields from the database model
 */
export interface LaravelTemplate {
  _id?: number;
  _uid?: string;
  template_id?: string;
  template_name: string;
  language: string;
  category: string;
  status: string;
  components?: TemplateComponent[];
  template_components?: any;
  quality_score?: string;
  rejection_reason?: string;
  usage_count?: number;
  last_used_at?: string;
  vendors__id?: number;
  created_at?: string;
  updated_at?: string;
  // Allow additional fields from Laravel
  [key: string]: any;
}

/**
 * API response for templates list endpoint
 * GET /api/{vendorUid}/templates
 */
export interface TemplatesApiListResponse {
  // Standard Laravel pagination
  data?: LaravelTemplate[];
  current_page?: number;
  per_page?: number;
  total?: number;
  last_page?: number;
  from?: number;
  to?: number;
  // Alternative formats
  templates?: LaravelTemplate[];
  items?: LaravelTemplate[];
  recordsTotal?: number;
  recordsFiltered?: number;
  // Success/error flags
  reaction?: number;
  message?: string;
}

/**
 * API response for single template endpoint
 * GET /api/{vendorUid}/templates/{templateUid}
 */
export interface TemplateApiDetailResponse {
  data?: LaravelTemplate;
  template?: LaravelTemplate;
  reaction?: number;
  message?: string;
}

/**
 * Template send request payload for API route
 * POST /api/{vendorUid}/contact/send-template-message
 */
export interface TemplateApiSendRequest {
  from_phone_number_id?: string;
  phone_number: string;
  template_name: string;
  template_language: string;
  // Header parameters
  header_image?: string;
  header_video?: string;
  header_document?: string;
  header_document_name?: string;
  header_field_1?: string;
  // Location parameters
  location_latitude?: string;
  location_longitude?: string;
  location_name?: string;
  location_address?: string;
  // Body parameters (field_1 through field_N)
  field_1?: string;
  field_2?: string;
  field_3?: string;
  field_4?: string;
  field_5?: string;
  field_6?: string;
  field_7?: string;
  field_8?: string;
  // Button parameters
  button_0?: string;
  button_1?: string;
  button_2?: string;
  // Copy code
  copy_code?: string;
  // Contact info (optional - creates contact if doesn't exist)
  contact?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    country?: string;
    language_code?: string;
    groups?: string;
    custom_fields?: Record<string, any>;
  };
}

/**
 * Template send response from API
 */
export interface TemplateApiSendResponse {
  reaction?: number;
  data?: {
    message_id?: string;
    wamid?: string;
    status?: string;
  };
  message?: string;
}

// ==================== CAMPAIGN TYPES ====================

export interface CampaignResult {
  phone: string;
  status: 'sent' | 'failed';
  message_id?: string;
  error?: string;
}

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  total_recipients: number;
  sent: number;
  failed: number;
  timestamp: string;
  tenant_id: string;
}

export interface CampaignDetail extends Campaign {
  message_text: string;
  results: CampaignResult[];
}

export interface BroadcastCampaignPayload {
  campaign_name?: string;
  message_text: string;
  // Support three ways to specify recipients
  recipients?: string[]; // Direct phone numbers
  contact_ids?: string[]; // Contact IDs from database
  group_ids?: string[]; // Group IDs from database
  template_name?: string;
  template_variables?: Record<string, string>;
}

export interface BroadcastCampaignResponse {
  campaign_id: string;
  campaign_name: string;
  total_recipients: number;
  sent: number;
  failed: number;
  timestamp: string;
  results: CampaignResult[];
}

export interface CampaignsListQuery {
  limit?: number;
  offset?: number;
}

export interface CampaignsListResponse {
  total: number;
  campaigns: Campaign[];
}

// ==================== ERROR TYPES ====================

export interface WhatsAppErrorResponse {
  detail: string;
  field?: string;
}

export interface WhatsAppApiError {
  response?: {
    status: number;
    data: WhatsAppErrorResponse;
  };
  message: string;
}

// ==================== WHATSAPP CAMPAIGNS (Backend-aligned) ====================

/**
 * Backend Campaign item as returned by FastAPI CampaignResponse
 * - list endpoint returns: WACampaign[]
 * - detail endpoint returns: WACampaign
 * - create broadcast endpoint returns: WACampaign
 */
export interface WACampaign {
  id: number;
  tenant_id: string;
  campaign_id: string;
  campaign_name?: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  results?: CampaignResult[] | null;
  created_at: string;
}

/** Backend create payload for broadcast campaigns */
export interface CreateCampaignPayload {
  campaign_name: string;
  message_text: string;
  // Support three ways to specify recipients
  recipients?: string[]; // Direct phone numbers
  contact_ids?: string[]; // Contact IDs from database
  group_ids?: string[]; // Group IDs from database
}

/** Backend create payload for template broadcast campaigns */
export interface CreateTemplateCampaignPayload {
  campaign_name: string;
  template_name: string;
  template_language: string;
  // Support three ways to specify recipients
  recipients?: string[]; // Direct phone numbers
  contact_ids?: number[]; // Contact IDs from database (as numbers)
  group_ids?: string[]; // Group IDs from database
}

/** Backend list query for campaigns */
export interface CampaignListQuery {
  skip?: number;
  limit?: number;
}

/** The backend returns a raw array for list */
export type WACampaignListResponse = WACampaign[];

/** Payload for sending template broadcast using bulk send endpoint (bypasses 24hr window) */
export interface TemplateBroadcastBulkPayload {
  campaign_name: string;
  template_name: string;
  template_language: string;
  // Only phone numbers (contact_ids and group_ids resolved in UI)
  recipients: string[]; // Phone numbers in international format
  // Template parameters
  parameters_per_recipient?: Record<string, string>[];
  default_parameters?: Record<string, string>;
}

/** Response from template broadcast bulk send */
export interface TemplateBroadcastBulkResponse {
  campaign_name: string;
  total: number;
  sent: number;
  failed: number;
  results: any[];
}

// ==================== FLOW TYPES ====================

export type FlowStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';

export type FlowCategory =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'APPOINTMENT_BOOKING'
  | 'LEAD_GENERATION'
  | 'CONTACT_US'
  | 'CUSTOMER_SUPPORT'
  | 'SURVEY'
  | 'OTHER';

export interface FlowScreen {
  id: string;
  title: string;
  terminal?: boolean;
  data?: Array<{
    key: string;
    example: any;
  }>;
  layout: {
    type: string;
    children: any[];
  };
}

export interface FlowJSON {
  version: string;
  screens: FlowScreen[];
}

export interface Flow {
  id: number;
  tenant_id: string;
  flow_id: string;
  name: string;
  description?: string | null;
  flow_json: FlowJSON;
  category: FlowCategory;
  version: string;
  data_api_version?: string | null;
  endpoint_uri?: string | null;
  status: FlowStatus;
  is_active: boolean;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface FlowsListQuery {
  page?: number;
  page_size?: number;
  status?: FlowStatus;
  category?: FlowCategory;
  is_active?: boolean;
  search?: string;
}

export interface FlowsListResponse {
  total: number;
  flows: Flow[];
  page: number;
  page_size: number;
}

export interface CreateFlowPayload {
  name: string;
  description?: string;
  flow_json: FlowJSON;
  category: FlowCategory;
  version?: string;
  data_api_version?: string;
  endpoint_uri?: string;
  tags?: string[];
}

export interface UpdateFlowPayload {
  name?: string;
  description?: string;
  flow_json?: FlowJSON;
  category?: FlowCategory;
  status?: FlowStatus;
  endpoint_uri?: string;
  tags?: string[];
}

export interface FlowValidationResponse {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FlowStats {
  total_flows: number;
  draft_flows: number;
  published_flows: number;
  active_flows: number;
  flows_by_category: Record<FlowCategory, number>;
}

export interface DeleteFlowResponse {
  message: string;
  flow_id: string;
}

export interface PublishFlowResponse {
  success: boolean;
  message: string;
  flow_id: string;
  status: FlowStatus;
}

// ==================== QR CODE TYPES ====================

export enum ImageType {
  PNG = "PNG",
  SVG = "SVG"
}

export interface QRCode {
  id: number;
  tenant_id: string;
  code: string;
  prefilled_message: string;
  image_type: string;
  image_url?: string | null;
  deep_link_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QRCodeCreate {
  prefilled_message: string;
  image_type?: ImageType;
}

export interface QRCodeUpdate {
  prefilled_message: string;
}

export interface QRCodeResponse extends QRCode {}

export interface QRCodeListResponse {
  total: number;
  items: QRCode[];
  page: number;
  page_size: number;
}

export interface QRCodeDeleteResponse {
  ok: boolean;
  message: string;
  code: string;
}
