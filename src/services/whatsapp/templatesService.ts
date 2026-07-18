// src/services/whatsapp/templatesService.ts
//
// DATA LAYER migrated to the digicrm adapter (crmClient → /api/whatsapp/...,
// JWT + tenant headers). UI/return shapes unchanged.
//   GET  /whatsapp/templates/            -> { templates: [...] }
//   POST /whatsapp/templates/
//   GET|PUT|PATCH|DELETE /whatsapp/templates/<template_uid>/
//   POST /whatsapp/templates/sync/
//   POST /whatsapp/templates/send/       (single)
//   POST /whatsapp/templates/send/bulk/  (server-side fan-out)
// Fully migrated — NO references to the old direct-Laravel clients remain.
import { crmClient } from '@/lib/client';
import {
  Template,
  TemplatesListQuery,
  TemplatesListResponse,
  DeleteTemplateResponse,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateSendRequest,
  TemplateSendResponse,
  TemplateBulkSendRequest,
  TemplateBulkSendResponse,
  TemplateStatus,
  TemplateCategory,
  TemplateLanguage,
} from '@/types/whatsappTypes';

// Re-export types
export type { CreateTemplatePayload, UpdateTemplatePayload };

class TemplatesService {
  private mapLaravelTemplate(data: any): Template {
    const components = data.template_data?.components || data.components || [];
    const bodyComponent = components.find((c: any) => c.type === 'BODY');

    return {
      id: data._uid || data._id || data.id,
      name: data.template_name || data.name || data.template_data?.name || '',
      language: data.language || data.template_data?.language || 'en',
      category: data.category || data.template_data?.category || 'UTILITY',
      status: data.status || data.template_data?.status || 'PENDING',
      components: components,
      template_id: data.template_id || data.template_data?.id,
      body: bodyComponent?.text || '',
      usage_count: data.usage_count || 0,
      quality_score: data.quality_score,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    } as Template;
  }

  async getTemplates(query?: TemplatesListQuery): Promise<TemplatesListResponse> {
    const { data } = await crmClient.get('/whatsapp/templates/', {
      params: {
        status: query?.status,
        category: query?.category,
        language: query?.language,
        limit: query?.limit,
        page: query?.page,
      },
    });

    const list: any[] = data?.templates ?? data?.results ?? (Array.isArray(data) ? data : []);
    const mappedTemplates = list.map((t: any) => this.mapLaravelTemplate(t));

    return {
      items: mappedTemplates,
      total: typeof data?.total === 'number' ? data.total : mappedTemplates.length,
      page: query?.page || 1,
      page_size: query?.limit || mappedTemplates.length,
    };
  }

  async getTemplate(id: number | string): Promise<Template> {
    const { data } = await crmClient.get(`/whatsapp/templates/${id}/`);
    return this.mapLaravelTemplate(data);
  }

  async getTemplateByName(name: string, language?: string): Promise<Template> {
    // No by-name endpoint on the adapter — fetch and match client-side.
    const { items } = await this.getTemplates();
    const match = items.find(
      (t) => t.name === name && (!language || t.language === language),
    );
    if (!match) throw new Error(`Template not found: ${name}`);
    return match;
  }

  async createTemplate(payload: CreateTemplatePayload): Promise<Template> {
    // The Laravel adapter expects a flat template shape, while the builder emits
    // a components array. Send BOTH (flat keys + components) so the create works
    // regardless of which the backend consumes. Extra keys are ignored.
    const body = { ...this.componentsToFlat(payload), ...payload };
    const { data } = await crmClient.post('/whatsapp/templates/', body);
    return this.mapLaravelTemplate(data);
  }

  /** Flatten a components-based create payload into Laravel's flat template shape. */
  private componentsToFlat(payload: CreateTemplatePayload): Record<string, unknown> {
    const comps = (payload.components || []) as any[];
    const up = (v: unknown) => String(v ?? '').toUpperCase();
    const header = comps.find((c) => up(c.type) === 'HEADER');
    const bodyC = comps.find((c) => up(c.type) === 'BODY');
    const footer = comps.find((c) => up(c.type) === 'FOOTER');
    const buttonsC = comps.find((c) => up(c.type) === 'BUTTONS');
    const headerFmt = header ? up(header.format) || 'TEXT' : 'NONE';
    const headerMedia = header?.example?.header_handle?.[0] || header?.url || undefined;

    return {
      template_name: payload.name,
      language_code: payload.language,
      category: payload.category,
      template_type: 'STANDARD',
      template_body: bodyC?.text || '',
      header_type: headerFmt,
      header_text: headerFmt === 'TEXT' ? header?.text : undefined,
      header_media_url: headerFmt !== 'TEXT' && headerFmt !== 'NONE' ? headerMedia : undefined,
      footer_text: footer?.text || undefined,
      buttons: buttonsC?.buttons || undefined,
    };
  }

  /**
   * Lightweight client-side template validation (BODY required, buttons need
   * text + target). Returns { valid, errors }. Replaces the missing method that
   * previously crashed the create flow.
   */
  validateTemplate(components: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const up = (v: unknown) => String(v ?? '').toUpperCase();
    const list = Array.isArray(components) ? components : [];

    const body = list.find((c) => up(c.type) === 'BODY');
    if (!body || !String(body.text || '').trim()) {
      errors.push('A body with text is required.');
    }
    const header = list.find((c) => up(c.type) === 'HEADER');
    if (header && up(header.format) === 'TEXT' && !String(header.text || '').trim()) {
      errors.push('Header text is required for a TEXT header.');
    }
    const buttons = list.find((c) => up(c.type) === 'BUTTONS');
    if (buttons?.buttons?.length) {
      buttons.buttons.forEach((b: any, i: number) => {
        if (!String(b.text || '').trim()) errors.push(`Button ${i + 1} needs text.`);
        if (up(b.type) === 'URL' && !String(b.url || '').trim()) errors.push(`Button ${i + 1} needs a URL.`);
        if (up(b.type) === 'PHONE_NUMBER' && !String(b.phone_number || '').trim()) errors.push(`Button ${i + 1} needs a phone number.`);
      });
    }
    return { valid: errors.length === 0, errors };
  }

  async updateTemplate(id: number | string, payload: UpdateTemplatePayload): Promise<Template> {
    const { data } = await crmClient.put(`/whatsapp/templates/${id}/`, payload);
    return this.mapLaravelTemplate(data);
  }

  async deleteTemplate(id: number | string): Promise<DeleteTemplateResponse> {
    await crmClient.delete(`/whatsapp/templates/${id}/`);
    return { ok: true, message: 'Template deleted successfully' };
  }

  async syncTemplates(): Promise<any> {
    const { data } = await crmClient.post('/whatsapp/templates/sync/');
    return data;
  }

  // The Laravel adapter only exposes a bulk sync. These wrappers keep the
  // "Sync all" / per-row "Sync" UI working (both trigger a full sync) instead
  // of throwing on non-existent methods.
  async syncAllTemplates(): Promise<{ synced: boolean }> {
    await this.syncTemplates();
    return { synced: true };
  }

  async syncTemplate(_id: number | string): Promise<{ updated: false; synced: boolean }> {
    await this.syncTemplates();
    return { updated: false, synced: true };
  }

  // No per-template analytics endpoint on the adapter yet — return null so the
  // caller can hide the analytics UI instead of crashing.
  async getTemplateAnalytics(_id: number | string): Promise<null> {
    return null;
  }

  async getApprovedTemplates(): Promise<TemplatesListResponse> {
    return this.getTemplates({ status: TemplateStatus.APPROVED });
  }

  async getTemplatesByStatus(status: TemplateStatus, limit?: number): Promise<TemplatesListResponse> {
    return this.getTemplates({ status, limit });
  }

  async getTemplatesByCategory(category: TemplateCategory, limit?: number): Promise<TemplatesListResponse> {
    return this.getTemplates({ category, limit });
  }

  // Single template send → digicrm proxy (JWT). Flat Laravel-style body; the
  // adapter forwards to Laravel. No vendor UID/token/base URL from the client.
  async sendTemplate(payload: TemplateSendRequest): Promise<TemplateSendResponse> {
    const p = payload.parameters ?? {};
    const body: Record<string, unknown> = {
      phone_number: payload.to,
      template_name: payload.template_name,
      template_language: payload.language,
      field_1: p['1'] ?? p.field_1,
      field_2: p['2'] ?? p.field_2,
      field_3: p['3'] ?? p.field_3,
      field_4: p['4'] ?? p.field_4,
      header_field_1: p.header_1 ?? p.header_field_1,
      header_image: p.header_image,
      header_video: p.header_video,
      header_document: p.header_document,
      button_0: p.button_0,
      button_1: p.button_1,
    };
    const { data } = await crmClient.post('/whatsapp/templates/send/', body);
    return data as TemplateSendResponse;
  }

  // Bulk send → digicrm proxy (JWT). The backend fans out + maps parameters to
  // the Laravel flat keys, returning { sent, failed, total, results }.
  async sendTemplateBulk(payload: TemplateBulkSendRequest): Promise<TemplateBulkSendResponse> {
    const { data } = await crmClient.post('/whatsapp/templates/send/bulk/', {
      template_name: payload.template_name,
      language: payload.language,
      recipients: payload.recipients,
      default_parameters: payload.default_parameters,
      parameters_per_recipient: payload.parameters_per_recipient,
    });
    return data as TemplateBulkSendResponse;
  }

  // Helper methods
  extractBodyText(template: Template): string {
    if (template.body) return template.body;
    const bodyComponent = template.components?.find((c) => c.type === 'BODY');
    return bodyComponent?.text || '';
  }

  extractHeaderType(template: Template): string | null {
    const headerComponent = template.components?.find((c) => c.type === 'HEADER');
    return headerComponent?.format || null;
  }

  extractButtons(template: Template): any[] {
    const buttonsComponent = template.components?.find((c) => c.type === 'BUTTONS');
    return buttonsComponent?.buttons || [];
  }

  extractFooterText(template: Template): string | null {
    const footerComponent = template.components?.find((c) => c.type === 'FOOTER');
    return footerComponent?.text || null;
  }

  extractVariables(content: string): string[] {
    const regex = /\{\{(\d+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables.sort((a, b) => parseInt(a) - parseInt(b));
  }

  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  }

  getTemplateStats(templates: Template[]) {
    return {
      total: templates.length,
      approved: templates.filter((t) => t.status === 'APPROVED').length,
      pending: templates.filter((t) => t.status === 'PENDING').length,
      rejected: templates.filter((t) => t.status === 'REJECTED').length,
    };
  }

  getStatusColor(status: TemplateStatus): string {
    switch (status) {
      case TemplateStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case TemplateStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case TemplateStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case TemplateStatus.PAUSED:
        return 'bg-gray-100 text-gray-800';
      case TemplateStatus.DISABLED:
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getCategoryColor(category: TemplateCategory): string {
    switch (category) {
      case TemplateCategory.MARKETING:
        return 'bg-blue-100 text-blue-800';
      case TemplateCategory.UTILITY:
        return 'bg-purple-100 text-purple-800';
      case TemplateCategory.AUTHENTICATION:
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  isConfigured(): boolean {
    // digicrm adapter uses the request JWT/tenant — always available when logged in.
    return true;
  }
}

export const templatesService = new TemplatesService();
