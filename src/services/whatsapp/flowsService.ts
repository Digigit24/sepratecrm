// src/services/whatsapp/flowsService.ts
import { externalWhatsappClient, getVendorUid } from '@/lib/externalWhatsappClient';
import { buildQueryString } from '@/lib/apiConfig';
import {
  Flow,
  FlowsListQuery,
  FlowsListResponse,
  CreateFlowPayload,
  UpdateFlowPayload,
  FlowValidationResponse,
  FlowStats,
  DeleteFlowResponse,
  PublishFlowResponse,
} from '@/types/whatsappTypes';

// =========================================================================
// HELPERS
// =========================================================================

interface LaravelResponse<T = any> {
  result?: 'success' | 'failed';
  data?: T;
  message?: string;
}

function unwrap<T>(response: { data: LaravelResponse<T> | T }): T {
  const body = response.data as LaravelResponse<T>;
  if (body && body.result === 'failed') {
    throw new Error(body.message || 'API request failed');
  }
  if (body && body.result === 'success' && body.data !== undefined) {
    return body.data as T;
  }
  return response.data as T;
}

function vendorUrl(path: string): string {
  const vendorUid = getVendorUid();
  if (!vendorUid) throw new Error('Vendor UID not found. Please ensure user is logged in.');
  return `/${vendorUid}/flows${path}`;
}

// =========================================================================
// SERVICE
// =========================================================================

class FlowsService {
  /**
   * Get all flows with optional filters
   */
  async getFlows(query?: FlowsListQuery): Promise<FlowsListResponse> {
    try {
      console.log('📋 Fetching flows:', query);

      const queryString = buildQueryString(query as unknown as Record<string, string | number | boolean>);
      const url = vendorUrl(`${queryString}`);

      const response = await externalWhatsappClient.get<LaravelResponse<FlowsListResponse>>(url);
      const data = unwrap<FlowsListResponse>(response);

      console.log('✅ Flows fetched:', { total: data.total, count: data.flows.length });

      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flows:', error);
      const message = error.response?.data?.message || error.message || 'Failed to fetch flows';
      throw new Error(message);
    }
  }

  /**
   * Get single flow by flow_id
   */
  async getFlow(flow_id: string): Promise<Flow> {
    try {
      console.log('📋 Fetching flow:', flow_id);

      const response = await externalWhatsappClient.get<LaravelResponse<Flow>>(
        vendorUrl(`/${flow_id}`)
      );
      const data = unwrap<Flow>(response);

      console.log('✅ Flow fetched:', data.name);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.message || 'Failed to fetch flow';
      throw new Error(message);
    }
  }

  /**
   * Create a new flow
   */
  async createFlow(payload: CreateFlowPayload): Promise<Flow> {
    try {
      console.log('➕ Creating flow:', payload.name);

      const response = await externalWhatsappClient.post<LaravelResponse<Flow>>(
        vendorUrl(''),
        payload
      );
      const data = unwrap<Flow>(response);

      console.log('✅ Flow created:', data.flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to create flow:', error);

      const message = error.response?.data?.message || 'Failed to create flow';
      throw new Error(message);
    }
  }

  /**
   * Update an existing flow
   */
  async updateFlow(flow_id: string, payload: UpdateFlowPayload): Promise<Flow> {
    try {
      console.log('✏️ Updating flow:', flow_id);

      const response = await externalWhatsappClient.put<LaravelResponse<Flow>>(
        vendorUrl(`/${flow_id}`),
        payload
      );
      const data = unwrap<Flow>(response);

      console.log('✅ Flow updated:', data.flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to update flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.message || 'Failed to update flow';
      throw new Error(message);
    }
  }

  /**
   * Delete a flow
   */
  async deleteFlow(flow_id: string): Promise<DeleteFlowResponse> {
    try {
      console.log('🗑️ Deleting flow:', flow_id);

      const response = await externalWhatsappClient.delete<LaravelResponse<DeleteFlowResponse>>(
        vendorUrl(`/${flow_id}`)
      );
      const data = unwrap<DeleteFlowResponse>(response);

      console.log('✅ Flow deleted:', flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to delete flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.message || 'Failed to delete flow';
      throw new Error(message);
    }
  }

  /**
   * Publish a flow
   */
  async publishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      console.log('🚀 Publishing flow:', flow_id);

      const response = await externalWhatsappClient.post<LaravelResponse<PublishFlowResponse>>(
        vendorUrl(`/${flow_id}/publish`)
      );
      const data = unwrap<PublishFlowResponse>(response);

      console.log('✅ Flow published:', flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to publish flow:', error);

      const message = error.response?.data?.message || 'Failed to publish flow';
      throw new Error(message);
    }
  }

  /**
   * Unpublish (deprecate) a flow
   */
  async unpublishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      console.log('📥 Unpublishing flow:', flow_id);

      const response = await externalWhatsappClient.post<LaravelResponse<PublishFlowResponse>>(
        vendorUrl(`/${flow_id}/unpublish`)
      );
      const data = unwrap<PublishFlowResponse>(response);

      console.log('✅ Flow unpublished:', flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to unpublish flow:', error);

      const message = error.response?.data?.message || 'Failed to unpublish flow';
      throw new Error(message);
    }
  }

  /**
   * Duplicate a flow
   */
  async duplicateFlow(flow_id: string, new_name?: string): Promise<Flow> {
    try {
      console.log('📋 Duplicating flow:', flow_id);

      const queryString = new_name ? buildQueryString({ new_name }) : '';
      const response = await externalWhatsappClient.post<LaravelResponse<Flow>>(
        vendorUrl(`/${flow_id}/duplicate${queryString}`)
      );
      const data = unwrap<Flow>(response);

      console.log('✅ Flow duplicated:', data.flow_id);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to duplicate flow:', error);

      const message = error.response?.data?.message || 'Failed to duplicate flow';
      throw new Error(message);
    }
  }

  /**
   * Validate a flow
   */
  async validateFlow(flow_id: string): Promise<FlowValidationResponse> {
    try {
      console.log('✔️ Validating flow:', flow_id);

      const response = await externalWhatsappClient.post<LaravelResponse<FlowValidationResponse>>(
        vendorUrl(`/${flow_id}/validate`)
      );
      const data = unwrap<FlowValidationResponse>(response);

      console.log('✅ Flow validation complete:', {
        is_valid: data.is_valid,
        errors: data.errors.length,
        warnings: data.warnings.length,
      });

      return data;
    } catch (error: any) {
      console.error('❌ Failed to validate flow:', error);

      const message = error.response?.data?.message || 'Failed to validate flow';
      throw new Error(message);
    }
  }

  /**
   * Get flow statistics
   */
  async getFlowStats(): Promise<FlowStats> {
    try {
      console.log('📊 Fetching flow stats');

      const response = await externalWhatsappClient.get<LaravelResponse<FlowStats>>(
        vendorUrl('/stats')
      );
      const data = unwrap<FlowStats>(response);

      console.log('✅ Flow stats fetched:', data.total_flows);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flow stats:', error);

      const message = error.response?.data?.message || 'Failed to fetch flow stats';
      throw new Error(message);
    }
  }
}

export const flowsService = new FlowsService();
