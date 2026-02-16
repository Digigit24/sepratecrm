// src/services/integrationService.ts
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  Integration,
  IntegrationCreateData,
  IntegrationUpdateData,
  Connection,
  ConnectionCreateData,
  ConnectionUpdateData,
  OAuthInitiateRequest,
  OAuthInitiateResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  ConnectionTestResponse,
  SpreadsheetsResponse,
  SheetsResponse,
  SheetColumnsResponse,
  Workflow,
  WorkflowCreateData,
  WorkflowUpdateData,
  WorkflowStatistics,
  WorkflowTrigger,
  WorkflowTriggerCreateData,
  WorkflowTriggerUpdateData,
  WorkflowAction,
  WorkflowActionCreateData,
  WorkflowActionUpdateData,
  WorkflowMapping,
  WorkflowMappingCreateData,
  WorkflowMappingUpdateData,
  ExecutionLog,
  IntegrationsQueryParams,
  ConnectionsQueryParams,
  WorkflowsQueryParams,
  ExecutionLogsQueryParams,
  PaginatedResponse,
  WorkflowTestRequest,
  WorkflowTestResponse,
} from '@/types/integration.types';

/**
 * Some endpoints are paginated by DRF. Normalize responses so callers always get arrays.
 */
const unwrapListResponse = <T>(data: T[] | PaginatedResponse<T>): T[] => {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
};

class IntegrationService {
  // ==================== INTEGRATIONS ====================

  // Get all available integrations
  async getIntegrations(params?: IntegrationsQueryParams): Promise<PaginatedResponse<Integration>> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<PaginatedResponse<Integration>>(
        `${API_CONFIG.CRM.INTEGRATIONS.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch integrations';
      throw new Error(message);
    }
  }

  // Get single integration by ID
  async getIntegration(id: number): Promise<Integration> {
    try {
      const response = await crmClient.get<Integration>(
        API_CONFIG.CRM.INTEGRATIONS.DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch integration';
      throw new Error(message);
    }
  }

  // Create new integration (admin only)
  async createIntegration(data: IntegrationCreateData): Promise<Integration> {
    try {
      const response = await crmClient.post<Integration>(API_CONFIG.CRM.INTEGRATIONS.CREATE, data);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create integration';
      throw new Error(message);
    }
  }

  // Update integration (admin only)
  async updateIntegration(id: number, data: IntegrationUpdateData): Promise<Integration> {
    try {
      const response = await crmClient.patch<Integration>(
        API_CONFIG.CRM.INTEGRATIONS.UPDATE.replace(':id', id.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update integration';
      throw new Error(message);
    }
  }

  // Delete integration (admin only)
  async deleteIntegration(id: number): Promise<void> {
    try {
      await crmClient.delete(API_CONFIG.CRM.INTEGRATIONS.DELETE.replace(':id', id.toString()));
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete integration';
      throw new Error(message);
    }
  }

  // ==================== CONNECTIONS ====================

  // Get all connections
  async getConnections(params?: ConnectionsQueryParams): Promise<PaginatedResponse<Connection>> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<PaginatedResponse<Connection>>(
        `${API_CONFIG.CRM.CONNECTIONS.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch connections';
      throw new Error(message);
    }
  }

  // Get single connection by ID
  async getConnection(id: number): Promise<Connection> {
    try {
      const response = await crmClient.get<Connection>(
        API_CONFIG.CRM.CONNECTIONS.DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch connection';
      throw new Error(message);
    }
  }

  // Create new connection (non-OAuth)
  async createConnection(data: ConnectionCreateData): Promise<Connection> {
    try {
      const response = await crmClient.post<Connection>(API_CONFIG.CRM.CONNECTIONS.CREATE, data);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create connection';
      throw new Error(message);
    }
  }

  // Update connection
  async updateConnection(id: number, data: ConnectionUpdateData): Promise<Connection> {
    try {
      const response = await crmClient.patch<Connection>(
        API_CONFIG.CRM.CONNECTIONS.UPDATE.replace(':id', id.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update connection';
      throw new Error(message);
    }
  }

  // Delete connection
  async deleteConnection(id: number): Promise<void> {
    try {
      await crmClient.delete(API_CONFIG.CRM.CONNECTIONS.DELETE.replace(':id', id.toString()));
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete connection';
      throw new Error(message);
    }
  }

  // Initiate OAuth flow
  async initiateOAuth(data: OAuthInitiateRequest): Promise<OAuthInitiateResponse> {
    try {
      const response = await crmClient.post<OAuthInitiateResponse>(
        API_CONFIG.CRM.CONNECTIONS.OAUTH_INITIATE,
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to initiate OAuth';
      throw new Error(message);
    }
  }

  // OAuth callback - POST code and state to backend to complete OAuth flow
  async oauthCallback(params: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
    try {
      // POST to backend with code and state in request body (requires authentication)
      const response = await crmClient.post<OAuthCallbackResponse>(
        API_CONFIG.CRM.CONNECTIONS.OAUTH_CALLBACK,
        params
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'OAuth callback failed';
      throw new Error(message);
    }
  }

  // Disconnect connection
  async disconnectConnection(id: number): Promise<{ message: string }> {
    try {
      const response = await crmClient.post<{ message: string }>(
        API_CONFIG.CRM.CONNECTIONS.DISCONNECT.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to disconnect connection';
      throw new Error(message);
    }
  }

  // Test connection
  async testConnection(id: number): Promise<ConnectionTestResponse> {
    try {
      const response = await crmClient.post<ConnectionTestResponse>(
        API_CONFIG.CRM.CONNECTIONS.TEST.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Connection test failed';
      throw new Error(message);
    }
  }

  // Refresh connection token
  async refreshConnectionToken(id: number): Promise<Connection> {
    try {
      const response = await crmClient.post<Connection>(
        API_CONFIG.CRM.CONNECTIONS.REFRESH_TOKEN.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to refresh token';
      throw new Error(message);
    }
  }

  // Get spreadsheets for a Google Sheets connection
  async getSpreadsheets(connectionId: number): Promise<SpreadsheetsResponse> {
    try {
      const response = await crmClient.get<SpreadsheetsResponse>(
        API_CONFIG.CRM.CONNECTIONS.SPREADSHEETS.replace(':id', connectionId.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch spreadsheets';
      throw new Error(message);
    }
  }

  // Get sheets for a spreadsheet
  async getSheets(connectionId: number, spreadsheetId: string): Promise<SheetsResponse> {
    try {
      const queryString = buildQueryString({ spreadsheet_id: spreadsheetId });
      const response = await crmClient.get<SheetsResponse>(
        `${API_CONFIG.CRM.CONNECTIONS.SHEETS.replace(':id', connectionId.toString())}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch sheets';
      throw new Error(message);
    }
  }

  // Get column headers for a sheet
  async getSheetColumns(
    connectionId: number,
    spreadsheetId: string,
    sheetName: string
  ): Promise<SheetColumnsResponse> {
    try {
      const queryString = buildQueryString({
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
      });
      const response = await crmClient.get<SheetColumnsResponse>(
        `${API_CONFIG.CRM.CONNECTIONS.SHEET_COLUMNS.replace(':id', connectionId.toString())}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch sheet columns';
      throw new Error(message);
    }
  }

  // ==================== WORKFLOWS ====================

  // Get all workflows
  async getWorkflows(params?: WorkflowsQueryParams): Promise<PaginatedResponse<Workflow>> {
    try {
      const queryString = buildQueryString(params);
      const response = await crmClient.get<PaginatedResponse<Workflow>>(
        `${API_CONFIG.CRM.WORKFLOWS.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch workflows';
      throw new Error(message);
    }
  }

  // Get single workflow by ID
  async getWorkflow(id: number): Promise<Workflow> {
    try {
      const response = await crmClient.get<Workflow>(
        API_CONFIG.CRM.WORKFLOWS.DETAIL.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch workflow';
      throw new Error(message);
    }
  }

  // Create new workflow
  async createWorkflow(data: WorkflowCreateData): Promise<Workflow> {
    try {
      const response = await crmClient.post<Workflow>(API_CONFIG.CRM.WORKFLOWS.CREATE, data);
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create workflow';
      throw new Error(message);
    }
  }

  // Update workflow
  async updateWorkflow(id: number, data: WorkflowUpdateData): Promise<Workflow> {
    try {
      const response = await crmClient.patch<Workflow>(
        API_CONFIG.CRM.WORKFLOWS.UPDATE.replace(':id', id.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update workflow';
      throw new Error(message);
    }
  }

  // Delete workflow
  async deleteWorkflow(id: number): Promise<void> {
    try {
      await crmClient.delete(API_CONFIG.CRM.WORKFLOWS.DELETE.replace(':id', id.toString()));
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete workflow';
      throw new Error(message);
    }
  }

  // Test workflow manually
  async testWorkflow(id: number, data?: WorkflowTestRequest): Promise<WorkflowTestResponse> {
    try {
      const response = await crmClient.post<WorkflowTestResponse>(
        API_CONFIG.CRM.WORKFLOWS.TEST.replace(':id', id.toString()),
        data || {}
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Workflow test failed';
      throw new Error(message);
    }
  }

  // Toggle workflow active status
  async toggleWorkflowActive(id: number): Promise<Workflow> {
    try {
      const response = await crmClient.post<Workflow>(
        API_CONFIG.CRM.WORKFLOWS.TOGGLE_ACTIVE.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to toggle workflow status';
      throw new Error(message);
    }
  }

  // Get workflow statistics
  async getWorkflowStatistics(id: number): Promise<WorkflowStatistics> {
    try {
      const response = await crmClient.get<WorkflowStatistics>(
        API_CONFIG.CRM.WORKFLOWS.STATISTICS.replace(':id', id.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch workflow statistics';
      throw new Error(message);
    }
  }

  // ==================== WORKFLOW TRIGGERS ====================

  // Get triggers for a workflow
  async getWorkflowTriggers(workflowId: number): Promise<WorkflowTrigger[]> {
    try {
      const response = await crmClient.get<WorkflowTrigger[] | PaginatedResponse<WorkflowTrigger>>(
        API_CONFIG.CRM.WORKFLOWS.TRIGGERS.replace(':workflow_id', workflowId.toString())
      );
      return unwrapListResponse(response.data);
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch triggers';
      throw new Error(message);
    }
  }

  // Create workflow trigger
  async createWorkflowTrigger(workflowId: number, data: Omit<WorkflowTriggerCreateData, 'workflow'>): Promise<WorkflowTrigger> {
    try {
      const response = await crmClient.post<WorkflowTrigger>(
        API_CONFIG.CRM.WORKFLOWS.TRIGGERS.replace(':workflow_id', workflowId.toString()),
        { ...data, workflow: workflowId }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create trigger';
      throw new Error(message);
    }
  }

  // Update workflow trigger
  async updateWorkflowTrigger(workflowId: number, triggerId: number, data: WorkflowTriggerUpdateData): Promise<WorkflowTrigger> {
    try {
      const response = await crmClient.patch<WorkflowTrigger>(
        API_CONFIG.CRM.WORKFLOWS.TRIGGER_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', triggerId.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update trigger';
      throw new Error(message);
    }
  }

  // Delete workflow trigger
  async deleteWorkflowTrigger(workflowId: number, triggerId: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.WORKFLOWS.TRIGGER_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', triggerId.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete trigger';
      throw new Error(message);
    }
  }

  // ==================== WORKFLOW ACTIONS ====================

  // Get actions for a workflow
  async getWorkflowActions(workflowId: number): Promise<WorkflowAction[]> {
    try {
      const response = await crmClient.get<WorkflowAction[] | PaginatedResponse<WorkflowAction>>(
        API_CONFIG.CRM.WORKFLOWS.ACTIONS.replace(':workflow_id', workflowId.toString())
      );
      return unwrapListResponse(response.data);
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch actions';
      throw new Error(message);
    }
  }

  // Create workflow action
  async createWorkflowAction(workflowId: number, data: Omit<WorkflowActionCreateData, 'workflow'>): Promise<WorkflowAction> {
    try {
      const response = await crmClient.post<WorkflowAction>(
        API_CONFIG.CRM.WORKFLOWS.ACTIONS.replace(':workflow_id', workflowId.toString()),
        { ...data, workflow: workflowId }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create action';
      throw new Error(message);
    }
  }

  // Update workflow action
  async updateWorkflowAction(workflowId: number, actionId: number, data: WorkflowActionUpdateData): Promise<WorkflowAction> {
    try {
      const response = await crmClient.patch<WorkflowAction>(
        API_CONFIG.CRM.WORKFLOWS.ACTION_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', actionId.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update action';
      throw new Error(message);
    }
  }

  // Delete workflow action
  async deleteWorkflowAction(workflowId: number, actionId: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.WORKFLOWS.ACTION_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', actionId.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete action';
      throw new Error(message);
    }
  }

  // ==================== WORKFLOW MAPPINGS ====================

  // Get mappings for a workflow
  async getWorkflowMappings(workflowId: number): Promise<WorkflowMapping[]> {
    try {
      const response = await crmClient.get<WorkflowMapping[] | PaginatedResponse<WorkflowMapping>>(
        API_CONFIG.CRM.WORKFLOWS.MAPPINGS.replace(':workflow_id', workflowId.toString())
      );
      return unwrapListResponse(response.data);
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch mappings';
      throw new Error(message);
    }
  }

  // Create workflow mapping
  async createWorkflowMapping(workflowId: number, data: Omit<WorkflowMappingCreateData, 'workflow'>): Promise<WorkflowMapping> {
    try {
      const response = await crmClient.post<WorkflowMapping>(
        API_CONFIG.CRM.WORKFLOWS.MAPPINGS.replace(':workflow_id', workflowId.toString()),
        { ...data, workflow: workflowId }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to create mapping';
      throw new Error(message);
    }
  }

  // Update workflow mapping
  async updateWorkflowMapping(workflowId: number, mappingId: number, data: WorkflowMappingUpdateData): Promise<WorkflowMapping> {
    try {
      const response = await crmClient.patch<WorkflowMapping>(
        API_CONFIG.CRM.WORKFLOWS.MAPPING_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', mappingId.toString()),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to update mapping';
      throw new Error(message);
    }
  }

  // Delete workflow mapping
  async deleteWorkflowMapping(workflowId: number, mappingId: number): Promise<void> {
    try {
      await crmClient.delete(
        API_CONFIG.CRM.WORKFLOWS.MAPPING_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', mappingId.toString())
      );
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete mapping';
      throw new Error(message);
    }
  }

  // ==================== EXECUTION LOGS ====================

  // Get execution logs for a workflow
  async getExecutionLogs(workflowId: number, params?: ExecutionLogsQueryParams): Promise<PaginatedResponse<ExecutionLog>> {
    try {
      const queryString = buildQueryString({ ...params, workflow: workflowId });
      const response = await crmClient.get<PaginatedResponse<ExecutionLog>>(
        `${API_CONFIG.CRM.WORKFLOWS.EXECUTION_LOGS.replace(':workflow_id', workflowId.toString())}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch execution logs';
      throw new Error(message);
    }
  }

  // Get single execution log
  async getExecutionLog(workflowId: number, logId: number): Promise<ExecutionLog> {
    try {
      const response = await crmClient.get<ExecutionLog>(
        API_CONFIG.CRM.WORKFLOWS.EXECUTION_LOG_DETAIL
          .replace(':workflow_id', workflowId.toString())
          .replace(':id', logId.toString())
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to fetch execution log';
      throw new Error(message);
    }
  }
}

// Export singleton instance
export const integrationService = new IntegrationService();
