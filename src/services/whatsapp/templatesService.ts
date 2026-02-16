// src/services/whatsapp/templatesService.ts
import { externalWhatsappService, CreateTemplatePayload, UpdateTemplatePayload } from '@/services/externalWhatsappService';
import {
  Template,
  TemplatesListQuery,
  TemplatesListResponse,
  DeleteTemplateResponse,
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
    const response = await externalWhatsappService.getTemplates({
      status: query?.status,
      category: query?.category,
      language: query?.language,
      limit: query?.limit,
      page: query?.page,
    });

    const templates = Array.isArray(response) ? response : [];
    const mappedTemplates = templates.map((t: any) => this.mapLaravelTemplate(t));

    return {
      items: mappedTemplates,
      total: mappedTemplates.length,
      page: query?.page || 1,
      page_size: query?.limit || mappedTemplates.length,
    };
  }

  async getTemplate(id: number | string): Promise<Template> {
    const response = await externalWhatsappService.getTemplate(String(id));
    return this.mapLaravelTemplate(response);
  }

  async getTemplateByName(name: string, language?: string): Promise<Template> {
    const template = await externalWhatsappService.getTemplateByName(name, language);
    return this.mapLaravelTemplate(template);
  }

  async createTemplate(payload: CreateTemplatePayload): Promise<Template> {
    const response = await externalWhatsappService.createTemplate(payload);
    return this.mapLaravelTemplate(response);
  }

  async updateTemplate(id: number | string, payload: UpdateTemplatePayload): Promise<Template> {
    const response = await externalWhatsappService.updateTemplate(String(id), payload);
    return this.mapLaravelTemplate(response);
  }

  async deleteTemplate(id: number | string): Promise<DeleteTemplateResponse> {
    await externalWhatsappService.deleteTemplate(String(id));
    return { ok: true, message: 'Template deleted successfully' };
  }

  async syncTemplates(): Promise<any> {
    return externalWhatsappService.syncTemplates();
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

  async sendTemplate(payload: TemplateSendRequest): Promise<TemplateSendResponse> {
    const response = await externalWhatsappService.sendTemplateMessage({
      phone_number: payload.to,
      template_name: payload.template_name,
      template_language: payload.language,
      field_1: payload.parameters?.['1'] || payload.parameters?.field_1,
      field_2: payload.parameters?.['2'] || payload.parameters?.field_2,
      field_3: payload.parameters?.['3'] || payload.parameters?.field_3,
      field_4: payload.parameters?.['4'] || payload.parameters?.field_4,
      header_field_1: payload.parameters?.header_1 || payload.parameters?.header_field_1,
      button_0: payload.parameters?.button_0,
      button_1: payload.parameters?.button_1,
    });
    return response;
  }

  async sendTemplateBulk(payload: TemplateBulkSendRequest): Promise<TemplateBulkSendResponse> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < payload.recipients.length; i++) {
      const phone = payload.recipients[i];
      const parameters = payload.parameters_per_recipient?.[i] || payload.default_parameters;
      try {
        await this.sendTemplate({
          template_name: payload.template_name,
          to: phone,
          language: payload.language,
          parameters,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed, total: payload.recipients.length };
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
    return externalWhatsappService.isConfigured();
  }
}

export const templatesService = new TemplatesService();
