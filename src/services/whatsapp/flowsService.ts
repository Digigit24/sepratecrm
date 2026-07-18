// src/services/whatsapp/flowsService.ts
//
// DATA LAYER migrated to the digicrm adapter (crmClient → /api/whatsapp/flows/...,
// JWT). UI/return shapes unchanged.
//   GET|POST /whatsapp/flows/
//   GET|PUT|PATCH|DELETE /whatsapp/flows/<flow_id>/
//   POST /whatsapp/flows/<flow_id>/{publish|unpublish|duplicate|validate}/
//   GET /whatsapp/flows/stats/
//
// ⚠️ The Laravel WABA flows controller is currently MISSING, so the digicrm
// proxy returns 500 for these routes for now. Every method throws a clean Error
// on failure; the Flows UI (useFlows/Flows.tsx) catches it and shows an
// empty/error state instead of crashing. Remove this note once the backend
// flows controller ships.
import { crmClient } from '@/lib/client';
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

interface LaravelResponse<T = any> {
  result?: 'success' | 'failed';
  data?: T;
  message?: string;
}

// Tolerates both the Laravel {result,data} envelope and a raw DRF body.
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

const FLOWS = '/whatsapp/flows';

class FlowsService {
  async getFlows(query?: FlowsListQuery): Promise<FlowsListResponse> {
    try {
      const response = await crmClient.get<LaravelResponse<FlowsListResponse>>(`${FLOWS}/`, {
        params: query as Record<string, unknown>,
      });
      return unwrap<FlowsListResponse>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Failed to fetch flows');
    }
  }

  async getFlow(flow_id: string): Promise<Flow> {
    try {
      const response = await crmClient.get<LaravelResponse<Flow>>(`${FLOWS}/${flow_id}/`);
      return unwrap<Flow>(response);
    } catch (error: any) {
      if (error.response?.status === 404) throw new Error('Flow not found');
      throw new Error(error.response?.data?.message || 'Failed to fetch flow');
    }
  }

  async createFlow(payload: CreateFlowPayload): Promise<Flow> {
    try {
      const response = await crmClient.post<LaravelResponse<Flow>>(`${FLOWS}/`, payload);
      return unwrap<Flow>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create flow');
    }
  }

  async updateFlow(flow_id: string, payload: UpdateFlowPayload): Promise<Flow> {
    try {
      const response = await crmClient.put<LaravelResponse<Flow>>(`${FLOWS}/${flow_id}/`, payload);
      return unwrap<Flow>(response);
    } catch (error: any) {
      if (error.response?.status === 404) throw new Error('Flow not found');
      throw new Error(error.response?.data?.message || 'Failed to update flow');
    }
  }

  async deleteFlow(flow_id: string): Promise<DeleteFlowResponse> {
    try {
      const response = await crmClient.delete<LaravelResponse<DeleteFlowResponse>>(`${FLOWS}/${flow_id}/`);
      return unwrap<DeleteFlowResponse>(response);
    } catch (error: any) {
      if (error.response?.status === 404) throw new Error('Flow not found');
      throw new Error(error.response?.data?.message || 'Failed to delete flow');
    }
  }

  async publishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      const response = await crmClient.post<LaravelResponse<PublishFlowResponse>>(`${FLOWS}/${flow_id}/publish/`);
      return unwrap<PublishFlowResponse>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to publish flow');
    }
  }

  async unpublishFlow(flow_id: string): Promise<PublishFlowResponse> {
    try {
      const response = await crmClient.post<LaravelResponse<PublishFlowResponse>>(`${FLOWS}/${flow_id}/unpublish/`);
      return unwrap<PublishFlowResponse>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to unpublish flow');
    }
  }

  async duplicateFlow(flow_id: string, new_name?: string): Promise<Flow> {
    try {
      const response = await crmClient.post<LaravelResponse<Flow>>(
        `${FLOWS}/${flow_id}/duplicate/`,
        new_name ? { new_name } : undefined,
      );
      return unwrap<Flow>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to duplicate flow');
    }
  }

  async validateFlow(flow_id: string): Promise<FlowValidationResponse> {
    try {
      const response = await crmClient.post<LaravelResponse<FlowValidationResponse>>(`${FLOWS}/${flow_id}/validate/`);
      return unwrap<FlowValidationResponse>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to validate flow');
    }
  }

  async getFlowStats(): Promise<FlowStats> {
    try {
      const response = await crmClient.get<LaravelResponse<FlowStats>>(`${FLOWS}/stats/`);
      return unwrap<FlowStats>(response);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch flow stats');
    }
  }
}

export const flowsService = new FlowsService();
