// src/services/whatsapp/campaignsService.ts
import { externalWhatsappService, CreateCampaignPayload as ExternalCreateCampaignPayload } from '@/services/externalWhatsappService';
import {
  Campaign,
  CampaignDetail,
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
  private mapLaravelCampaign(data: any): Campaign {
    return {
      id: data._uid || data.id || data.campaign_id,
      campaign_id: data._uid || data.campaign_id || data.id,
      campaign_name: data.title || data.campaign_name || data.name || '',
      status: data.status || 'pending',
      total_recipients: data.contacts_count || data.total_recipients || 0,
      sent: data.executed_at ? (data.contacts_count || 0) : 0,
      failed: 0,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      scheduled_at: data.scheduled_at,
      completed_at: data.executed_at,
      message_text: data.message_text || '',
      template_name: data.template_name,
      template_language: data.template_language,
    } as Campaign;
  }

  async getCampaigns(query?: CampaignsListQuery): Promise<CampaignsListResponse> {
    const response = await externalWhatsappService.getCampaigns({
      status: query?.status as 'active' | 'archived' | undefined,
    });

    const campaigns = Array.isArray(response) ? response : [];
    const mappedCampaigns = campaigns.map((c: any) => this.mapLaravelCampaign(c));

    return {
      total: mappedCampaigns.length,
      campaigns: mappedCampaigns,
    };
  }

  async getCampaign(id: string): Promise<CampaignDetail> {
    const response = await externalWhatsappService.getCampaign(id);
    const mappedCampaign = this.mapLaravelCampaign(response);

    try {
      const statusResponse = await externalWhatsappService.getCampaignStatus(id);
      mappedCampaign.sent = statusResponse.sent || statusResponse.delivered || 0;
      mappedCampaign.failed = statusResponse.failed || 0;
      mappedCampaign.total_recipients = statusResponse.total_recipients || mappedCampaign.total_recipients;
    } catch (e) {
      // Status endpoint may not exist
    }

    return mappedCampaign as CampaignDetail;
  }

  async createCampaign(payload: CreateCampaignRequest): Promise<Campaign> {
    const response = await externalWhatsappService.createCampaign(payload);
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

  calculateSuccessRate(campaign: Campaign | CampaignDetail): number {
    const total = campaign.total_recipients ?? 0;
    const sent = campaign.sent ?? 0;
    if (!total) return 0;
    return (sent / total) * 100;
  }

  getCampaignStats(campaign: Campaign | CampaignDetail) {
    const successRate = this.calculateSuccessRate(campaign);
    return {
      total_recipients: campaign.total_recipients ?? 0,
      sent: campaign.sent ?? 0,
      failed: campaign.failed ?? 0,
      success_rate: successRate,
      failure_rate: 100 - successRate,
    };
  }
}

export const campaignsService = new CampaignsService();
