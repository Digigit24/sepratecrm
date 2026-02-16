// src/hooks/whatsapp/useCampaigns.ts
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { campaignsService, CreateCampaignRequest } from '@/services/whatsapp/campaignsService';
import { templatesService } from '@/services/whatsapp/templatesService';
import type { Campaign, CampaignsListQuery, TemplateBulkSendRequest, TemplateBulkSendResponse } from '@/types/whatsappTypes';

export interface UseCampaignsOptions {
  initialQuery?: CampaignsListQuery;
  autoFetch?: boolean;
}

export interface UseCampaignsReturn {
  campaigns: Campaign[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  fetchCampaigns: (query?: CampaignsListQuery) => Promise<void>;
  createCampaign: (payload: CreateCampaignRequest) => Promise<Campaign | null>;
  sendTemplateBroadcastBulk: (payload: TemplateBulkSendRequest) => Promise<TemplateBulkSendResponse | null>;
  deleteCampaign: (id: string) => Promise<boolean>;
  archiveCampaign: (id: string) => Promise<boolean>;
  unarchiveCampaign: (id: string) => Promise<boolean>;
  getCampaign: (id: string) => Promise<Campaign | null>;
  refetch: () => Promise<void>;
  stats: (campaign: Campaign) => {
    total_recipients: number;
    sent: number;
    failed: number;
    success_rate: number;
    failure_rate: number;
  };
}

export function useCampaigns(options: UseCampaignsOptions = {}): UseCampaignsReturn {
  const { initialQuery, autoFetch = true } = options;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async (query?: CampaignsListQuery) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await campaignsService.getCampaigns(query || initialQuery);
      setCampaigns(response.campaigns);
      setTotal(response.total);
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch campaigns';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [initialQuery]);

  const createCampaign = useCallback(async (payload: CreateCampaignRequest) => {
    try {
      setIsCreating(true);
      setError(null);
      const created = await campaignsService.createCampaign(payload);
      setCampaigns((prev) => [created, ...prev]);
      setTotal((prev) => prev + 1);
      toast.success(`Campaign "${payload.title}" created`);
      return created;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create campaign';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const sendTemplateBroadcastBulk = useCallback(async (payload: TemplateBulkSendRequest) => {
    try {
      setIsCreating(true);
      setError(null);
      const result = await templatesService.sendTemplateBulk(payload);
      await fetchCampaigns();
      return result;
    } catch (err: any) {
      const msg = err?.message || 'Failed to send template broadcast';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [fetchCampaigns]);

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      await campaignsService.deleteCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.campaign_id !== id && c.id !== id));
      setTotal((prev) => prev - 1);
      toast.success('Campaign deleted');
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete campaign');
      return false;
    }
  }, []);

  const archiveCampaign = useCallback(async (id: string) => {
    try {
      await campaignsService.archiveCampaign(id);
      toast.success('Campaign archived');
      await fetchCampaigns();
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive campaign');
      return false;
    }
  }, [fetchCampaigns]);

  const unarchiveCampaign = useCallback(async (id: string) => {
    try {
      await campaignsService.unarchiveCampaign(id);
      toast.success('Campaign unarchived');
      await fetchCampaigns();
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unarchive campaign');
      return false;
    }
  }, [fetchCampaigns]);

  const getCampaign = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const campaign = await campaignsService.getCampaign(id);
      return campaign;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load campaign');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const stats = useCallback((campaign: Campaign) => {
    return campaignsService.getCampaignStats(campaign);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchCampaigns();
    }
  }, [autoFetch, fetchCampaigns]);

  return {
    campaigns,
    total,
    isLoading,
    isCreating,
    error,
    fetchCampaigns,
    createCampaign,
    sendTemplateBroadcastBulk,
    deleteCampaign,
    archiveCampaign,
    unarchiveCampaign,
    getCampaign,
    refetch,
    stats,
  };
}
