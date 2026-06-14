// src/services/whatsappCrmService.ts
// Service for DigiCRM's WhatsApp integration API (crm.celiyo.com/api/whatsapp/...)
// All routes go through crmClient (JWT auth, tenant headers auto-attached)

import { crmClient } from '@/lib/client';
import { buildQueryString } from '@/lib/apiConfig';
import { externalWhatsappService } from '@/services/externalWhatsappService';

// ==================== TYPES ====================

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type EnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'OPTED_OUT' | 'REPLIED';
export type ActionType = 'SEND_WHATSAPP' | 'ENROLL_SEQUENCE' | 'CREATE_CAMPAIGN' | 'UPDATE_LEAD_STATUS' | 'LOG_ACTIVITY';

export interface WhatsAppVendorConfig {
  id: number;
  tenant_id: string;
  vendor_uid: string;
  api_token: string;
  api_base_url: string;
  webhook_secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  uid: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
  example?: { body_text?: string[][]; header_text?: string[] };
}

export interface WhatsAppCampaign {
  id: number;
  name: string;
  lead_group: number | null;
  lead_group_name?: string;
  template_uid: string;
  template_name?: string;
  template_components: TemplateComponent[];
  status: CampaignStatus;
  scheduled_at: string | null;
  launched_at: string | null;
  laravel_campaign_uid: string | null;
  total_contacts: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignAnalytics {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  delivery_rate: number;
  read_rate: number;
}

export interface CampaignReply {
  phone: string;
  contact_name?: string;
  message_body: string;
  messaged_at: string;
}

export interface WhatsAppSequence {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  stop_on_reply: boolean;
  steps: WhatsAppSequenceStep[];
  enrollment_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSequenceStep {
  id: number;
  sequence: number;
  step_number: number;
  delay_days: number;
  template_uid: string;
  template_name?: string;
  template_variable_mapping: Record<string, string>;
}

export interface LeadSequenceEnrollment {
  id: number;
  lead: number;
  lead_name?: string;
  sequence: number;
  sequence_name?: string;
  current_step: number | null;
  current_step_number?: number;
  status: EnrollmentStatus;
  enrolled_at: string;
  next_step_at: string | null;
  completed_at: string | null;
  stopped_reason?: string;
}

// Shape returned by /api/whatsapp/leads/{id}/chat/ (proxied from Laravel adapter)
export interface ChatMessage {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  status: string;
  message: string | null;
  timestamp: string;
  meta?: {
    template_proforma?: { name?: string; components?: any[] };
    template_components?: any[];
    interaction_message_data?: {
      body_text?: string;
      header_text?: string;
      footer_text?: string;
      buttons?: Record<string, string>;
    };
    options?: {
      interaction_message_data?: {
        body_text?: string;
        header_text?: string;
      };
    };
  };
}

// Wrapper returned by the chat endpoint
export interface ChatHistoryResponse {
  result: string;
  phone: string;
  total: number;
  page: number;
  per_page: number;
  messages: ChatMessage[];
}

export interface AgentActionLog {
  id: number;
  action_type: ActionType;
  payload_in: Record<string, unknown>;
  payload_out: Record<string, unknown> | null;
  triggered_by: string;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ==================== API PATHS ====================

const BASE = '/whatsapp';

const WA = {
  // Vendor config
  CONFIG: `${BASE}/config/`,
  CONFIG_DETAIL: (id: number) => `${BASE}/config/${id}/`,

  // Templates proxy
  TEMPLATES: `${BASE}/templates/`,

  // Campaigns
  CAMPAIGNS: `${BASE}/campaigns/`,
  CAMPAIGN_DETAIL: (id: number) => `${BASE}/campaigns/${id}/`,
  CAMPAIGN_LAUNCH: (id: number) => `${BASE}/campaigns/${id}/launch/`,
  CAMPAIGN_ANALYTICS: (id: number) => `${BASE}/campaigns/${id}/analytics/`,
  CAMPAIGN_REPLIES: (id: number) => `${BASE}/campaigns/${id}/replies/`,

  // Sequences
  SEQUENCES: `${BASE}/sequences/`,
  SEQUENCE_DETAIL: (id: number) => `${BASE}/sequences/${id}/`,
  SEQUENCE_STEPS: (id: number) => `${BASE}/sequences/${id}/steps/`,
  SEQUENCE_ADD_STEP: (id: number) => `${BASE}/sequences/${id}/add_step/`,
  SEQUENCE_UPDATE_STEP: (id: number, stepId: number) => `${BASE}/sequences/${id}/update_step/${stepId}/`,
  SEQUENCE_DELETE_STEP: (id: number, stepId: number) => `${BASE}/sequences/${id}/delete_step/${stepId}/`,

  // Lead WhatsApp (chat, send, enrollments)
  LEAD_CHAT: (leadId: number) => `${BASE}/leads/${leadId}/chat/`,
  LEAD_SEND: (leadId: number) => `${BASE}/leads/${leadId}/send/`,
  LEAD_SEND_TEXT: (leadId: number) => `${BASE}/leads/${leadId}/send_text/`,
  LEAD_ENROLLMENTS: (leadId: number) => `${BASE}/leads/${leadId}/enrollments/`,
  LEAD_ENROLL: (leadId: number) => `${BASE}/leads/${leadId}/enroll/`,
  LEAD_UNENROLL: (leadId: number) => `${BASE}/leads/${leadId}/unenroll/`,
};

// ==================== SERVICE CLASS ====================

class WhatsAppCrmService {
  private async get<T>(url: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const qs = buildQueryString(params);
    const res = await crmClient.get<T>(`${url}${qs}`);
    return res.data;
  }

  private async post<T>(url: string, data?: unknown): Promise<T> {
    const res = await crmClient.post<T>(url, data);
    return res.data;
  }

  private async patch<T>(url: string, data?: unknown): Promise<T> {
    const res = await crmClient.patch<T>(url, data);
    return res.data;
  }

  private async delete(url: string): Promise<void> {
    await crmClient.delete(url);
  }

  // ---- Vendor Config ----
  getVendorConfig(): Promise<PaginatedResponse<WhatsAppVendorConfig>> {
    return this.get(WA.CONFIG);
  }

  updateVendorConfig(id: number, data: Partial<WhatsAppVendorConfig>): Promise<WhatsAppVendorConfig> {
    return this.patch(WA.CONFIG_DETAIL(id), data);
  }

  // ---- Templates ----
  // Bypasses Django proxy — reads whatsapp_vendor_uid from celiyo_user (set at login)
  // and calls Laravel directly, exactly like externalWhatsappService does.
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    const raw = await externalWhatsappService.getTemplates({ status: 'APPROVED', limit: 100 });
    return (raw ?? []).map((t: any) => ({
      uid: t._uid || t._id || String(t.id || ''),
      name: t.template_name || t.name || t.template_data?.name || '',
      category: t.category || t.template_data?.category || 'UTILITY',
      language: t.language || t.template_data?.language || 'en',
      status: t.status || t.template_data?.status || 'APPROVED',
      components: t.template_data?.components || t.components || [],
    }));
  }

  // ---- Campaigns ----
  getCampaigns(params?: { page?: number; page_size?: number; status?: string; search?: string }): Promise<PaginatedResponse<WhatsAppCampaign>> {
    return this.get(WA.CAMPAIGNS, params as Record<string, string | number | boolean | undefined>);
  }

  getCampaign(id: number): Promise<WhatsAppCampaign> {
    return this.get(WA.CAMPAIGN_DETAIL(id));
  }

  createCampaign(data: Partial<WhatsAppCampaign>): Promise<WhatsAppCampaign> {
    return this.post(WA.CAMPAIGNS, data);
  }

  updateCampaign(id: number, data: Partial<WhatsAppCampaign>): Promise<WhatsAppCampaign> {
    return this.patch(WA.CAMPAIGN_DETAIL(id), data);
  }

  launchCampaign(id: number): Promise<WhatsAppCampaign> {
    return this.post(WA.CAMPAIGN_LAUNCH(id));
  }

  getCampaignAnalytics(id: number): Promise<CampaignAnalytics> {
    return this.get(WA.CAMPAIGN_ANALYTICS(id));
  }

  getCampaignReplies(id: number, page = 1): Promise<PaginatedResponse<CampaignReply>> {
    return this.get(WA.CAMPAIGN_REPLIES(id), { page });
  }

  // ---- Sequences ----
  getSequences(params?: { page?: number; search?: string }): Promise<PaginatedResponse<WhatsAppSequence>> {
    return this.get(WA.SEQUENCES, params as Record<string, string | number | boolean | undefined>);
  }

  getSequence(id: number): Promise<WhatsAppSequence> {
    return this.get(WA.SEQUENCE_DETAIL(id));
  }

  createSequence(data: Partial<WhatsAppSequence>): Promise<WhatsAppSequence> {
    return this.post(WA.SEQUENCES, data);
  }

  updateSequence(id: number, data: Partial<WhatsAppSequence>): Promise<WhatsAppSequence> {
    return this.patch(WA.SEQUENCE_DETAIL(id), data);
  }

  addSequenceStep(sequenceId: number, data: Partial<WhatsAppSequenceStep>): Promise<WhatsAppSequenceStep> {
    return this.post(WA.SEQUENCE_ADD_STEP(sequenceId), data);
  }

  updateSequenceStep(sequenceId: number, stepId: number, data: Partial<WhatsAppSequenceStep>): Promise<WhatsAppSequenceStep> {
    return this.patch(WA.SEQUENCE_UPDATE_STEP(sequenceId, stepId), data);
  }

  deleteSequenceStep(sequenceId: number, stepId: number): Promise<void> {
    return this.delete(WA.SEQUENCE_DELETE_STEP(sequenceId, stepId));
  }

  // ---- Lead WhatsApp ----

  /** Read WA vendor credentials from localStorage (set at login). */
  private _waHeaders(): Record<string, string> {
    try {
      const user = JSON.parse(localStorage.getItem('celiyo_user') || '{}');
      const headers: Record<string, string> = {};
      // Credentials live inside tenant.settings (from admin.celiyo.com API)
      const settings = user?.tenant?.settings ?? {};
      if (settings.whatsapp_vendor_uid) headers['X-WA-Vendor-Uid'] = settings.whatsapp_vendor_uid;
      if (settings.whatsapp_api_token)  headers['X-WA-Api-Token']  = settings.whatsapp_api_token;
      return headers;
    } catch {
      return {};
    }
  }

  getLeadChat(leadId: number, page = 1): Promise<ChatHistoryResponse> {
    const qs = buildQueryString({ page });
    return crmClient.get<ChatHistoryResponse>(`${WA.LEAD_CHAT(leadId)}${qs}`, { headers: this._waHeaders() }).then(r => r.data);
  }

  sendLeadMessage(leadId: number, data: { template_uid: string; template_components: TemplateComponent[] }): Promise<{ success: boolean; message: string }> {
    return crmClient.post(WA.LEAD_SEND(leadId), data, { headers: this._waHeaders() }).then(r => r.data);
  }

  sendLeadTextMessage(leadId: number, text: string): Promise<{ detail: string; wa_message_id?: string }> {
    return crmClient.post(WA.LEAD_SEND_TEXT(leadId), { text }, { headers: this._waHeaders() }).then(r => r.data);
  }

  getLeadEnrollments(leadId: number): Promise<PaginatedResponse<LeadSequenceEnrollment>> {
    return this.get(WA.LEAD_ENROLLMENTS(leadId));
  }

  enrollLead(leadId: number, sequenceId: number): Promise<LeadSequenceEnrollment> {
    return this.post(WA.LEAD_ENROLL(leadId), { sequence_id: sequenceId });
  }

  unenrollLead(leadId: number, enrollmentId: number): Promise<{ success: boolean }> {
    return this.post(WA.LEAD_UNENROLL(leadId), { enrollment_id: enrollmentId });
  }
}

export const whatsAppCrmService = new WhatsAppCrmService();
