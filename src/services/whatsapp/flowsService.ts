// src/services/whatsapp/flowsService.ts
import { whatsappClient } from '@/lib/whatsappClient';
import { API_CONFIG, buildUrl, buildQueryString } from '@/lib/apiConfig';
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

class FlowsService {
  /**
   * Get all flows with optional filters
   */
  async getFlows(query?: FlowsListQuery): Promise<FlowsListResponse> {
    try {
      console.log('📋 Fetching flows:', query);

      const queryString = buildQueryString(query as unknown as Record<string, string | number | boolean>);
      const url = `${API_CONFIG.WHATSAPP.FLOWS}${queryString}`;

      const response = await whatsappClient.get<FlowsListResponse>(url);

      console.log('✅ Flows fetched:', {
        total: response.data.total,
        count: response.data.flows.length,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flows:', error);
      const message = error.response?.data?.detail || error.message || 'Failed to fetch flows';
      throw new Error(message);
    }
  }

  /**
   * Get single flow by flow_id
   */
  async getFlow(flow_id: string): Promise<Flow> {
    try {
      console.log('📋 Fetching flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_DETAIL,
        { flow_id },
        'whatsapp'
      );

      const response = await whatsappClient.get<Flow>(url);

      console.log('✅ Flow fetched:', response.data.name);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.detail || 'Failed to fetch flow';
      throw new Error(message);
    }
  }

  /**
   * Create a new flow
   */
  async createFlow(payload: CreateFlowPayload): Promise<Flow> {
    try {
      console.log('➕ Creating flow:', payload.name);

      const response = await whatsappClient.post<Flow>(
        API_CONFIG.WHATSAPP.FLOW_CREATE,
        payload
      );

      console.log('✅ Flow created:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to create flow:', error);

      const message = error.response?.data?.detail || 'Failed to create flow';
      throw new Error(message);
    }
  }

  /**
   * Update an existing flow
   */
  async updateFlow(flow_id: string, payload: UpdateFlowPayload): Promise<Flow> {
    try {
      console.log('✏️ Updating flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_UPDATE,
        { flow_id },
        'whatsapp'
      );

      const response = await whatsappClient.put<Flow>(url, payload);

      console.log('✅ Flow updated:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to update flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.detail || 'Failed to update flow';
      throw new Error(message);
    }
  }

  /**
   * Delete a flow
   */
  async deleteFlow(flow_id: string, hard_delete: boolean = false): Promise<DeleteFlowResponse> {
    try {
      console.log('🗑️ Deleting flow:', flow_id, 'hard:', hard_delete);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_DELETE,
        { flow_id },
        'whatsapp'
      );

      const queryString = buildQueryString({ hard_delete });
      const fullUrl = `${url}${queryString}`;

      const response = await whatsappClient.delete<DeleteFlowResponse>(fullUrl);

      console.log('✅ Flow deleted:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to delete flow:', error);

      if (error.response?.status === 404) {
        throw new Error('Flow not found');
      }

      const message = error.response?.data?.detail || 'Failed to delete flow';
      throw new Error(message);
    }
  }

  /**
   * Publish a flow
   */
  async publishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      console.log('🚀 Publishing flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_PUBLISH,
        { flow_id },
        'whatsapp'
      );

      const response = await whatsappClient.post<PublishFlowResponse>(url);

      console.log('✅ Flow published:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to publish flow:', error);

      const message = error.response?.data?.detail || 'Failed to publish flow';
      throw new Error(message);
    }
  }

  /**
   * Unpublish a flow
   */
  async unpublishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      console.log('📥 Unpublishing flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_UNPUBLISH,
        { flow_id },
        'whatsapp'
      );

      const response = await whatsappClient.post<PublishFlowResponse>(url);

      console.log('✅ Flow unpublished:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to unpublish flow:', error);

      const message = error.response?.data?.detail || 'Failed to unpublish flow';
      throw new Error(message);
    }
  }

  /**
   * Duplicate a flow
   */
  async duplicateFlow(flow_id: string, new_name?: string): Promise<Flow> {
    try {
      console.log('📋 Duplicating flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_DUPLICATE,
        { flow_id },
        'whatsapp'
      );

      const queryString = new_name ? buildQueryString({ new_name }) : '';
      const fullUrl = `${url}${queryString}`;

      const response = await whatsappClient.post<Flow>(fullUrl);

      console.log('✅ Flow duplicated:', response.data.flow_id);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to duplicate flow:', error);

      const message = error.response?.data?.detail || 'Failed to duplicate flow';
      throw new Error(message);
    }
  }

  /**
   * Validate a flow
   */
  async validateFlow(flow_id: string): Promise<FlowValidationResponse> {
    try {
      console.log('✔️ Validating flow:', flow_id);

      const url = buildUrl(
        API_CONFIG.WHATSAPP.FLOW_VALIDATE,
        { flow_id },
        'whatsapp'
      );

      const response = await whatsappClient.post<FlowValidationResponse>(url);

      console.log('✅ Flow validation complete:', {
        is_valid: response.data.is_valid,
        errors: response.data.errors.length,
        warnings: response.data.warnings.length,
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to validate flow:', error);

      const message = error.response?.data?.detail || 'Failed to validate flow';
      throw new Error(message);
    }
  }

  /**
   * Get flow statistics
   */
  async getFlowStats(): Promise<FlowStats> {
    try {
      console.log('📊 Fetching flow stats');

      const response = await whatsappClient.get<FlowStats>(
        API_CONFIG.WHATSAPP.FLOW_STATS
      );

      console.log('✅ Flow stats fetched:', response.data.total_flows);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to fetch flow stats:', error);

      const message = error.response?.data?.detail || 'Failed to fetch flow stats';
      throw new Error(message);
    }
  }
}

export const flowsService = new FlowsService();
