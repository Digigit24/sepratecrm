// src/hooks/useIntegrations.ts
import useSWR from 'swr';
import { integrationService } from '@/services/integrationService';
import type {
  Integration,
  IntegrationCreateData,
  IntegrationUpdateData,
  Connection,
  ConnectionCreateData,
  ConnectionUpdateData,
  OAuthInitiateRequest,
  Workflow,
  WorkflowCreateData,
  WorkflowUpdateData,
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
  SheetColumnsResponse,
} from '@/types/integration.types';

// SWR Keys
const INTEGRATIONS_KEY = 'integrations';
const CONNECTIONS_KEY = 'connections';
const WORKFLOWS_KEY = 'workflows';
const WORKFLOW_TRIGGERS_KEY = 'workflow-triggers';
const WORKFLOW_ACTIONS_KEY = 'workflow-actions';
const WORKFLOW_MAPPINGS_KEY = 'workflow-mappings';
const EXECUTION_LOGS_KEY = 'execution-logs';
const WORKFLOW_STATISTICS_KEY = 'workflow-statistics';

export const useIntegrations = () => {
  // ==================== INTEGRATIONS ====================

  /**
   * Fetch all integrations with optional query parameters
   */
  const useIntegrationsList = (params?: IntegrationsQueryParams) => {
    const key = params ? [INTEGRATIONS_KEY, params] : INTEGRATIONS_KEY;
    return useSWR<PaginatedResponse<Integration>>(
      key,
      () => integrationService.getIntegrations(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }
    );
  };

  /**
   * Fetch single integration by ID
   */
  const useIntegration = (id?: number) => {
    const key = id ? [INTEGRATIONS_KEY, id] : null;
    return useSWR<Integration>(
      key,
      () => (id ? integrationService.getIntegration(id) : Promise.reject('No ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create new integration
   */
  const createIntegration = async (data: IntegrationCreateData): Promise<Integration> => {
    return integrationService.createIntegration(data);
  };

  /**
   * Update integration
   */
  const updateIntegration = async (id: number, data: IntegrationUpdateData): Promise<Integration> => {
    return integrationService.updateIntegration(id, data);
  };

  /**
   * Delete integration
   */
  const deleteIntegration = async (id: number): Promise<void> => {
    return integrationService.deleteIntegration(id);
  };

  // ==================== CONNECTIONS ====================

  /**
   * Fetch all connections with optional query parameters
   */
  const useConnectionsList = (params?: ConnectionsQueryParams) => {
    const key = params ? [CONNECTIONS_KEY, params] : CONNECTIONS_KEY;
    return useSWR<PaginatedResponse<Connection>>(
      key,
      () => integrationService.getConnections(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }
    );
  };

  /**
   * Fetch single connection by ID
   */
  const useConnection = (id?: number) => {
    const key = id ? [CONNECTIONS_KEY, id] : null;
    return useSWR<Connection>(
      key,
      () => (id ? integrationService.getConnection(id) : Promise.reject('No ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create new connection (non-OAuth)
   */
  const createConnection = async (data: ConnectionCreateData): Promise<Connection> => {
    return integrationService.createConnection(data);
  };

  /**
   * Update connection
   */
  const updateConnection = async (id: number, data: ConnectionUpdateData): Promise<Connection> => {
    return integrationService.updateConnection(id, data);
  };

  /**
   * Delete connection
   */
  const deleteConnection = async (id: number): Promise<void> => {
    return integrationService.deleteConnection(id);
  };

  /**
   * Initiate OAuth flow
   */
  const initiateOAuth = async (data: OAuthInitiateRequest) => {
    return integrationService.initiateOAuth(data);
  };

  /**
   * Disconnect connection
   */
  const disconnectConnection = async (id: number) => {
    return integrationService.disconnectConnection(id);
  };

  /**
   * Test connection
   */
  const testConnection = async (id: number) => {
    return integrationService.testConnection(id);
  };

  /**
   * Refresh connection token
   */
  const refreshConnectionToken = async (id: number) => {
    return integrationService.refreshConnectionToken(id);
  };

  /**
   * Get spreadsheets for a Google Sheets connection
   */
  const getSpreadsheets = async (connectionId: number) => {
    return integrationService.getSpreadsheets(connectionId);
  };

  /**
   * Get sheets for a spreadsheet
   */
  const getSheets = async (connectionId: number, spreadsheetId: string) => {
    return integrationService.getSheets(connectionId, spreadsheetId);
  };

  /**
   * Get column headers for a sheet
   */
  const getSheetColumns = async (
    connectionId: number,
    spreadsheetId: string,
    sheetName: string
  ): Promise<SheetColumnsResponse> => {
    return integrationService.getSheetColumns(connectionId, spreadsheetId, sheetName);
  };

  // ==================== WORKFLOWS ====================

  /**
   * Fetch all workflows with optional query parameters
   */
  const useWorkflowsList = (params?: WorkflowsQueryParams) => {
    const key = params ? [WORKFLOWS_KEY, params] : WORKFLOWS_KEY;
    return useSWR<PaginatedResponse<Workflow>>(
      key,
      () => integrationService.getWorkflows(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }
    );
  };

  /**
   * Fetch single workflow by ID
   */
  const useWorkflow = (id?: number) => {
    const key = id ? [WORKFLOWS_KEY, id] : null;
    return useSWR<Workflow>(
      key,
      () => (id ? integrationService.getWorkflow(id) : Promise.reject('No ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create new workflow
   */
  const createWorkflow = async (data: WorkflowCreateData): Promise<Workflow> => {
    return integrationService.createWorkflow(data);
  };

  /**
   * Update workflow
   */
  const updateWorkflow = async (id: number, data: WorkflowUpdateData): Promise<Workflow> => {
    return integrationService.updateWorkflow(id, data);
  };

  /**
   * Delete workflow
   */
  const deleteWorkflow = async (id: number): Promise<void> => {
    return integrationService.deleteWorkflow(id);
  };

  /**
   * Test workflow manually
   */
  const testWorkflow = async (id: number, data?: WorkflowTestRequest) => {
    return integrationService.testWorkflow(id, data);
  };

  /**
   * Toggle workflow active status
   */
  const toggleWorkflowActive = async (id: number): Promise<Workflow> => {
    return integrationService.toggleWorkflowActive(id);
  };

  /**
   * Get workflow statistics
   */
  const useWorkflowStatistics = (id?: number) => {
    const key = id ? [WORKFLOW_STATISTICS_KEY, id] : null;
    return useSWR(
      key,
      () => (id ? integrationService.getWorkflowStatistics(id) : Promise.reject('No ID provided')),
      {
        revalidateOnFocus: false,
        refreshInterval: 30000, // Refresh every 30 seconds
      }
    );
  };

  // ==================== WORKFLOW TRIGGERS ====================

  /**
   * Fetch triggers for a workflow
   */
  const useWorkflowTriggers = (workflowId?: number) => {
    const key = workflowId ? [WORKFLOW_TRIGGERS_KEY, workflowId] : null;
    return useSWR<WorkflowTrigger[]>(
      key,
      () => (workflowId ? integrationService.getWorkflowTriggers(workflowId) : Promise.reject('No workflow ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create workflow trigger
   */
  const createWorkflowTrigger = async (
    workflowId: number,
    data: Omit<WorkflowTriggerCreateData, 'workflow'>
  ): Promise<WorkflowTrigger> => {
    return integrationService.createWorkflowTrigger(workflowId, data);
  };

  /**
   * Update workflow trigger
   */
  const updateWorkflowTrigger = async (
    workflowId: number,
    triggerId: number,
    data: WorkflowTriggerUpdateData
  ): Promise<WorkflowTrigger> => {
    return integrationService.updateWorkflowTrigger(workflowId, triggerId, data);
  };

  /**
   * Delete workflow trigger
   */
  const deleteWorkflowTrigger = async (workflowId: number, triggerId: number): Promise<void> => {
    return integrationService.deleteWorkflowTrigger(workflowId, triggerId);
  };

  // ==================== WORKFLOW ACTIONS ====================

  /**
   * Fetch actions for a workflow
   */
  const useWorkflowActions = (workflowId?: number) => {
    const key = workflowId ? [WORKFLOW_ACTIONS_KEY, workflowId] : null;
    return useSWR<WorkflowAction[]>(
      key,
      () => (workflowId ? integrationService.getWorkflowActions(workflowId) : Promise.reject('No workflow ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create workflow action
   */
  const createWorkflowAction = async (
    workflowId: number,
    data: Omit<WorkflowActionCreateData, 'workflow'>
  ): Promise<WorkflowAction> => {
    return integrationService.createWorkflowAction(workflowId, data);
  };

  /**
   * Update workflow action
   */
  const updateWorkflowAction = async (
    workflowId: number,
    actionId: number,
    data: WorkflowActionUpdateData
  ): Promise<WorkflowAction> => {
    return integrationService.updateWorkflowAction(workflowId, actionId, data);
  };

  /**
   * Delete workflow action
   */
  const deleteWorkflowAction = async (workflowId: number, actionId: number): Promise<void> => {
    return integrationService.deleteWorkflowAction(workflowId, actionId);
  };

  // ==================== WORKFLOW MAPPINGS ====================

  /**
   * Fetch mappings for a workflow
   */
  const useWorkflowMappings = (workflowId?: number) => {
    const key = workflowId ? [WORKFLOW_MAPPINGS_KEY, workflowId] : null;
    return useSWR<WorkflowMapping[]>(
      key,
      () => (workflowId ? integrationService.getWorkflowMappings(workflowId) : Promise.reject('No workflow ID provided')),
      {
        revalidateOnFocus: false,
      }
    );
  };

  /**
   * Create workflow mapping
   */
  const createWorkflowMapping = async (
    workflowId: number,
    data: Omit<WorkflowMappingCreateData, 'workflow'>
  ): Promise<WorkflowMapping> => {
    return integrationService.createWorkflowMapping(workflowId, data);
  };

  /**
   * Update workflow mapping
   */
  const updateWorkflowMapping = async (
    workflowId: number,
    mappingId: number,
    data: WorkflowMappingUpdateData
  ): Promise<WorkflowMapping> => {
    return integrationService.updateWorkflowMapping(workflowId, mappingId, data);
  };

  /**
   * Delete workflow mapping
   */
  const deleteWorkflowMapping = async (workflowId: number, mappingId: number): Promise<void> => {
    return integrationService.deleteWorkflowMapping(workflowId, mappingId);
  };

  // ==================== EXECUTION LOGS ====================

  /**
   * Fetch execution logs for a workflow
   */
  const useExecutionLogs = (workflowId?: number, params?: ExecutionLogsQueryParams) => {
    const key = workflowId ? [EXECUTION_LOGS_KEY, workflowId, params] : null;
    return useSWR<PaginatedResponse<ExecutionLog>>(
      key,
      () => (workflowId ? integrationService.getExecutionLogs(workflowId, params) : Promise.reject('No workflow ID provided')),
      {
        revalidateOnFocus: false,
        refreshInterval: 10000, // Refresh every 10 seconds
      }
    );
  };

  /**
   * Fetch single execution log
   */
  const useExecutionLog = (workflowId?: number, logId?: number) => {
    const key = workflowId && logId ? [EXECUTION_LOGS_KEY, workflowId, logId] : null;
    return useSWR<ExecutionLog>(
      key,
      () =>
        workflowId && logId
          ? integrationService.getExecutionLog(workflowId, logId)
          : Promise.reject('No workflow ID or log ID provided'),
      {
        revalidateOnFocus: false,
      }
    );
  };

  // Return all hooks and functions
  return {
    // Integrations
    useIntegrationsList,
    useIntegration,
    createIntegration,
    updateIntegration,
    deleteIntegration,

    // Connections
    useConnectionsList,
    useConnection,
    createConnection,
    updateConnection,
    deleteConnection,
    initiateOAuth,
    disconnectConnection,
    testConnection,
    refreshConnectionToken,
    getSpreadsheets,
    getSheets,
    getSheetColumns,

    // Workflows
    useWorkflowsList,
    useWorkflow,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    testWorkflow,
    toggleWorkflowActive,
    useWorkflowStatistics,

    // Workflow Triggers
    useWorkflowTriggers,
    createWorkflowTrigger,
    updateWorkflowTrigger,
    deleteWorkflowTrigger,

    // Workflow Actions
    useWorkflowActions,
    createWorkflowAction,
    updateWorkflowAction,
    deleteWorkflowAction,

    // Workflow Mappings
    useWorkflowMappings,
    createWorkflowMapping,
    updateWorkflowMapping,
    deleteWorkflowMapping,

    // Execution Logs
    useExecutionLogs,
    useExecutionLog,
  };
};
