// src/services/whatsapp/campaignsService.ts
import { externalWhatsappService, CreateCampaignPayload as ExternalCreateCampaignPayload } from '@/services/externalWhatsappService';
import {
  WACampaign,
  CampaignMessagesResponse,
  CampaignsListQuery,
  CampaignsListResponse,
} from '@/types/whatsappTypes';

// Service-specific types
export interface CreateCampaignRequest {
  title: string;
  template_uid: string;
  contact_group: string;
  timezone?: string;
  schedule_at?: string;
  expire_at?: string;
}

class CampaignsService {
  private mapLaravelCampaign(data: any): WACampaign {
    return {
      campaign_id: data._uid || data.id || data.campaign_id,
      campaign_name: data.title || data.campaign_name || data.name || '',
      template_name: data.template_name,
      template_language: data.template_language,
      status: data.status ?? 0,
      status_text: data.status_text,
      scheduled_at: data.scheduled_at,
      created_at: data.created_at || new Date().toISOString(),
      timezone: data.timezone,
      total_recipients: data.total_contacts ?? data.total_recipients ?? data.contacts_count ?? 0,
      // Status breakdown fields (populated when fetched from /status endpoint)
      queue_pending: data.queue_pending,
      queue_failed: data.queue_failed,
      queue_processing: data.queue_processing,
      queue_expired: data.queue_expired,
      executed: data.executed,
      delivered: data.delivered,
      read: data.read,
      sent_count: data.sent,
      failed_count: data.failed,
    };
  }

  async getCampaigns(query?: CampaignsListQuery): Promise<CampaignsListResponse> {
    const response = await externalWhatsappService.getCampaigns({
      status: query?.status as 'active' | 'archived' | undefined,
    });

    const campaigns = Array.isArray(response) ? response : [];
    const mappedCampaigns = campaigns.map((c: any) => this.mapLaravelCampaign(c));

    return {
      total: mappedCampaigns.length,
      campaigns: mappedCampaigns as any,
    };
  }

  async getCampaign(id: string): Promise<WACampaign> {
    const response = await externalWhatsappService.getCampaign(id);
    const mapped = this.mapLaravelCampaign(response);

    try {
      const statusResponse = await externalWhatsappService.getCampaignStatus(id);
      mapped.status_text = statusResponse.status_text ?? mapped.status_text;
      mapped.total_recipients = statusResponse.total_contacts ?? statusResponse.total_recipients ?? mapped.total_recipients;
      mapped.queue_pending = statusResponse.queue_pending;
      mapped.queue_failed = statusResponse.queue_failed;
      mapped.queue_processing = statusResponse.queue_processing;
      mapped.queue_expired = statusResponse.queue_expired;
      mapped.executed = statusResponse.executed;
      mapped.delivered = statusResponse.delivered;
      mapped.read = statusResponse.read;
      mapped.sent_count = statusResponse.sent;
      mapped.failed_count = statusResponse.failed;
    } catch {
      // Status endpoint may not be available
    }

    return mapped;
  }

  async getCampaignMessages(
    campaignId: string,
    params?: { status?: 'sent' | 'delivered' | 'read' | 'failed'; page?: number; limit?: number }
  ): Promise<CampaignMessagesResponse> {
    return externalWhatsappService.getCampaignMessages(campaignId, params);
  }

  async createCampaign(payload: CreateCampaignRequest): Promise<WACampaign> {
    const response = await externalWhatsappService.createCampaign(payload as any);
    return this.mapLaravelCampaign(response);
  }

  async deleteCampaign(id: string): Promise<void> {
    await externalWhatsappService.deleteCampaign(id);
  }

  async archiveCampaign(id: string): Promise<void> {
    await externalWhatsappService.archiveCampaign(id);
  }

  async unarchiveCampaign(id: string): Promise<void> {
    await externalWhatsappService.unarchiveCampaign(id);
  }

  async getRecentCampaigns(limit: number = 10): Promise<CampaignsListResponse> {
    const result = await this.getCampaigns({ limit });
    if (result.campaigns.length > limit) {
      result.campaigns = result.campaigns.slice(0, limit);
      result.total = limit;
    }
    return result;
  }
}

export const campaignsService = new CampaignsService();
