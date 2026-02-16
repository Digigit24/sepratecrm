// ==================== INTEGRATION SYSTEM TYPES ====================
// TypeScript types for the Zapier-like Integration System

// ==================== ENUMS ====================

export enum IntegrationTypeEnum {
  GOOGLE_SHEETS = 'GOOGLE_SHEETS',
  WEBHOOK = 'WEBHOOK',
  API = 'API',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  CUSTOM = 'CUSTOM',
}

export enum TriggerTypeEnum {
  NEW_ROW = 'NEW_ROW',
  UPDATED_ROW = 'UPDATED_ROW',
  WEBHOOK = 'WEBHOOK',
  SCHEDULE = 'SCHEDULE',
  MANUAL = 'MANUAL',
}

export enum ActionTypeEnum {
  CREATE_LEAD = 'CREATE_LEAD',
  UPDATE_LEAD = 'UPDATE_LEAD',
  CREATE_CONTACT = 'CREATE_CONTACT',
  SEND_EMAIL = 'SEND_EMAIL',
  SEND_SMS = 'SEND_SMS',
  WEBHOOK = 'WEBHOOK',
  CUSTOM = 'CUSTOM',
}

export enum ExecutionStatusEnum {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export enum TransformationTypeEnum {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  BOOLEAN = 'BOOLEAN',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  URL = 'URL',
  JSON = 'JSON',
  CUSTOM = 'CUSTOM',
}

// ==================== BASE TYPES ====================

export interface Integration {
  id: number;
  name: string;
  type: IntegrationTypeEnum;
  description: string;
  logo_url?: string;
  is_active: boolean;
  requires_oauth: boolean;
  config_schema?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationCreateData {
  name: string;
  type: IntegrationTypeEnum;
  description: string;
  logo_url?: string;
  is_active?: boolean;
  requires_oauth?: boolean;
  config_schema?: Record<string, any>;
}

export interface IntegrationUpdateData extends Partial<IntegrationCreateData> {}

// ==================== CONNECTION TYPES ====================

export interface Connection {
  id: number;
  integration: number;
  integration_details?: Integration;
  name: string;
  credentials: Record<string, any>;
  is_active: boolean;
  last_synced_at?: string;
  last_error?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectionCreateData {
  integration: number;
  name: string;
  credentials?: Record<string, any>;
  is_active?: boolean;
}

export interface ConnectionUpdateData extends Partial<ConnectionCreateData> {}

export interface OAuthInitiateRequest {
  integration_id: number;
  redirect_uri?: string;
}

export interface OAuthInitiateResponse {
  authorization_url: string;
  state: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
  integration_id: number;
  connection_name?: string;
  redirect_uri?: string;
}

export interface OAuthCallbackResponse {
  connection: Connection;
  message: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface Spreadsheet {
  id: string;
  name: string;
  url?: string;
}

export interface Sheet {
  id: string;
  name: string;
  index: number;
}

export interface SpreadsheetsResponse {
  spreadsheets: Spreadsheet[];
}

export interface SheetsResponse {
  sheets: Sheet[];
}

export interface SheetColumnsResponse {
  headers: string[];
}

// ==================== WORKFLOW TYPES ====================

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  // Related objects
  triggers?: WorkflowTrigger[];
  actions?: WorkflowAction[];
  mappings?: WorkflowMapping[];
}

export interface WorkflowCreateData {
  name: string;
  description?: string;
  is_active?: boolean;
  connection_id: number;
}

export interface WorkflowUpdateData extends Partial<WorkflowCreateData> {}

export interface WorkflowStatistics {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  last_execution?: string;
  average_duration?: number;
}

// ==================== WORKFLOW TRIGGER TYPES ====================

export interface WorkflowTrigger {
  id: number;
  workflow: number;
  connection: number;
  connection_details?: Connection;
  trigger_type: TriggerTypeEnum;
  trigger_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTriggerCreateData {
  workflow: number;
  connection: number;
  trigger_type: TriggerTypeEnum;
  trigger_config: Record<string, any>;
  poll_interval_minutes?: number;
  is_active?: boolean;
}

export interface WorkflowTriggerUpdateData extends Partial<Omit<WorkflowTriggerCreateData, 'workflow'>> {}

// ==================== WORKFLOW ACTION TYPES ====================

export interface WorkflowAction {
  id: number;
  workflow: number;
  action_type: ActionTypeEnum;
  action_config: Record<string, any>;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowActionCreateData {
  workflow: number;
  action_type: ActionTypeEnum;
  action_config: Record<string, any>;
  order?: number;
  is_active?: boolean;
}

export interface WorkflowActionUpdateData extends Partial<Omit<WorkflowActionCreateData, 'workflow'>> {}

// ==================== WORKFLOW MAPPING TYPES ====================

export interface WorkflowMapping {
  id: number;
  workflow: number;
  source_field: string;
  destination_field: string;
  transformation_type: TransformationTypeEnum;
  transformation_config?: Record<string, any>;
  validation_rules?: Record<string, any>;
  is_required: boolean;
  default_value?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowMappingCreateData {
  workflow: number;
  workflow_action_id: number;
  source_field: string;
  destination_field: string;
  transformation_type: TransformationTypeEnum;
  transformation_config?: Record<string, any>;
  validation_rules?: Record<string, any>;
  is_required?: boolean;
  default_value?: string;
}

export interface WorkflowMappingUpdateData extends Partial<Omit<WorkflowMappingCreateData, 'workflow'>> {}

// ==================== EXECUTION LOG TYPES ====================

export interface ExecutionLog {
  id: number;
  workflow: number;
  workflow_details?: Workflow;
  status: ExecutionStatusEnum;
  started_at: string;
  completed_at?: string;
  duration?: number;
  trigger_data?: Record<string, any>;
  result_data?: Record<string, any>;
  error_message?: string;
  error_traceback?: string;
  steps_log: ExecutionStep[];
  created_at: string;
}

export interface ExecutionStep {
  step_number: number;
  step_name: string;
  status: ExecutionStatusEnum;
  started_at: string;
  completed_at?: string;
  duration?: number;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
}

// ==================== QUERY PARAMS ====================

export interface IntegrationsQueryParams {
  page?: number;
  page_size?: number;
  ordering?: string;
  search?: string;
  type?: IntegrationTypeEnum;
  is_active?: boolean;
}

export interface ConnectionsQueryParams {
  page?: number;
  page_size?: number;
  ordering?: string;
  search?: string;
  integration?: number;
  is_active?: boolean;
}

export interface WorkflowsQueryParams {
  page?: number;
  page_size?: number;
  ordering?: string;
  search?: string;
  is_active?: boolean;
  created_by?: number;
}

export interface ExecutionLogsQueryParams {
  page?: number;
  page_size?: number;
  ordering?: string;
  workflow?: number;
  status?: ExecutionStatusEnum;
  started_at_after?: string;
  started_at_before?: string;
}

// ==================== API RESPONSE TYPES ====================

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

// ==================== WORKFLOW TEST TYPES ====================

export interface WorkflowTestRequest {
  test_data?: Record<string, any>;
}

export interface WorkflowTestResponse {
  success: boolean;
  message: string;
  execution_log?: ExecutionLog;
}

// ==================== LEAD FIELD OPTIONS ====================
// Standard CRM lead fields for mapping
export interface LeadFieldOption {
  value: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'select';
  required?: boolean;
}

export const LEAD_FIELD_OPTIONS: LeadFieldOption[] = [
  { value: 'name', label: 'Name', type: 'text', required: true },
  { value: 'phone', label: 'Phone', type: 'phone', required: true },
  { value: 'email', label: 'Email', type: 'email' },
  { value: 'company', label: 'Company', type: 'text' },
  { value: 'title', label: 'Title', type: 'text' },
  { value: 'address_line1', label: 'Address Line 1', type: 'text' },
  { value: 'address_line2', label: 'Address Line 2', type: 'text' },
  { value: 'city', label: 'City', type: 'text' },
  { value: 'state', label: 'State', type: 'text' },
  { value: 'postal_code', label: 'Postal Code', type: 'text' },
  { value: 'country', label: 'Country', type: 'text' },
  { value: 'value_amount', label: 'Value Amount', type: 'number' },
  { value: 'value_currency', label: 'Value Currency', type: 'text' },
  { value: 'source', label: 'Source', type: 'text' },
  { value: 'priority', label: 'Priority', type: 'select' },
  { value: 'notes', label: 'Notes', type: 'text' },
];
