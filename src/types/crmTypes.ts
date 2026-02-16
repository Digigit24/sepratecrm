// CRM Types based on Django models

export enum PriorityEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum ActivityTypeEnum {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  SMS = 'SMS',
  OTHER = 'OTHER'
}

export enum TaskStatusEnum {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED'
}

export enum FieldTypeEnum {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  DROPDOWN = 'DROPDOWN',
  MULTISELECT = 'MULTISELECT',
  CHECKBOX = 'CHECKBOX',
  URL = 'URL',
  TEXTAREA = 'TEXTAREA',
  DECIMAL = 'DECIMAL',
  CURRENCY = 'CURRENCY'
}

export interface LeadStatus {
  id: number;
  tenant_id: string;
  name: string;
  order_index: number;
  color_hex?: string;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: number;
  tenant_id: string;
  lead: number;
  type: ActivityTypeEnum;
  content?: string;
  happened_at: string;
  by_user_id: string;
  meta?: Record<string, any>;
  file_url?: string;
  created_at: string;
}

export interface LeadOrder {
  id: number;
  tenant_id: string;
  lead: number;
  status: number;
  position: string; // DecimalField as string
  board_id?: number;
  updated_at: string;
}

export interface Task {
  id: number;
  tenant_id: string;
  lead: number;
  lead_name?: string; // From serializer
  title: string;
  description?: string;
  status: TaskStatusEnum;
  priority: PriorityEnum;
  due_date?: string;
  assignee_user_id?: string;
  reporter_user_id?: string;
  owner_user_id?: string;
  checklist?: any; // JSONField
  attachments_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface LeadFieldConfiguration {
  id: number;
  tenant_id?: string;
  field_name: string;
  field_label: string;
  is_standard: boolean;
  field_type?: FieldTypeEnum;
  is_visible: boolean;
  is_required: boolean;
  is_active: boolean;
  default_value?: string;
  options?: string[] | any; // JSON field for dropdown/multiselect options
  placeholder?: string;
  help_text?: string;
  display_order: number;
  validation_rules?: Record<string, any>; // JSON field
  created_at: string;
  updated_at: string;
  category?: 'standard' | 'custom'; // Computed field from serializer
}

export interface Lead {
  id: number;
  tenant_id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  title?: string;
  status?: LeadStatus | number; // Can be either LeadStatus object or number ID
  status_name?: string; // From serializer
  priority: PriorityEnum;
  lead_score?: number; // 0-100 score
  value_amount?: string; // DecimalField as string
  value_currency?: string;
  source?: string;
  owner_user_id: string;
  assigned_to?: string; // UUID of assigned user
  metadata?: Record<string, any>; // Custom fields stored as JSON
  last_contacted_at?: string;
  next_follow_up_at?: string;
  notes?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  created_at: string;
  updated_at: string;
  activities?: LeadActivity[]; // From serializer
}

// API Response Types
export interface LeadsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Lead[];
}

export interface LeadStatusesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LeadStatus[];
}

export interface LeadActivitiesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LeadActivity[];
}

export interface LeadOrdersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LeadOrder[];
}

export interface TasksResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Task[];
}

export interface LeadFieldConfigurationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LeadFieldConfiguration[];
}

export interface FieldSchemaResponse {
  standard_fields: LeadFieldConfiguration[];
  custom_fields: LeadFieldConfiguration[];
}

// Import/Export Types
export interface LeadImportFailure {
  row: number;
  phone: string;
  name: string;
  reason: string;
}

export interface LeadImportResponse {
  success_count: number;
  failed_count: number;
  total_count: number;
  failures: LeadImportFailure[];
}

export interface LeadExportResponse {
  count: number;
  exported_at: string;
  leads: Lead[];
}

export interface LeadExportQueryParams {
  format?: 'csv' | 'json';
}

export interface LeadImportPayload {
  leads: CreateLeadPayload[];
}

// Bulk Operation Types
export interface BulkDeletePayload {
  lead_ids: number[];
}

export interface BulkDeleteResponse {
  deleted_count: number;
  message: string;
}

export interface BulkStatusUpdatePayload {
  lead_ids: number[];
  status_id: number;
}

export interface BulkStatusUpdateResponse {
  updated_count: number;
  message: string;
}

// Query Parameters Types
export interface LeadsQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: number;
  priority?: PriorityEnum;
  owner_user_id?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  created_at?: string;
  updated_at__gte?: string;
  updated_at__lte?: string;
  next_follow_up_at__gte?: string;
  next_follow_up_at__lte?: string;
  next_follow_up_at__isnull?: boolean;
  city?: string;
  city__icontains?: string;
  state?: string;
  state__icontains?: string;
  country?: string;
  country__icontains?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LeadStatusesQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_won?: boolean;
  is_lost?: boolean;
  is_active?: boolean;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LeadActivitiesQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  lead?: number;
  type?: ActivityTypeEnum;
  by_user_id?: string;
  happened_at?: string;
  happened_at__gte?: string;
  happened_at__lte?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LeadOrdersQueryParams {
  page?: number;
  page_size?: number;
  lead?: number;
  status?: number;
  board_id?: number;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TasksQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  lead?: number;
  status?: TaskStatusEnum;
  priority?: PriorityEnum;
  assignee_user_id?: string;
  reporter_user_id?: string;
  due_date?: string;
  due_date__gte?: string;
  due_date__lte?: string;
  due_date__isnull?: boolean;
  completed_at__gte?: string;
  completed_at__lte?: string;
  completed_at__isnull?: boolean;
  created_at__gte?: string;
  created_at__lte?: string;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LeadFieldConfigurationsQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  field_type?: FieldTypeEnum;
  is_required?: boolean;
  is_active?: boolean;
  is_visible?: boolean;
  is_standard?: boolean;
  ordering?: string;
  [key: string]: string | number | boolean | undefined;
}

// Create/Update Types
export interface CreateLeadPayload {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  title?: string;
  status?: number;
  priority?: PriorityEnum;
  lead_score?: number;
  value_amount?: string;
  value_currency?: string;
  source?: string;
  owner_user_id?: string;
  assigned_to?: string;
  metadata?: Record<string, any>;
  last_contacted_at?: string;
  next_follow_up_at?: string;
  notes?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface UpdateLeadPayload extends Partial<CreateLeadPayload> {}

export interface CreateLeadStatusPayload {
  name: string;
  order_index: number;
  color_hex?: string;
  is_won?: boolean;
  is_lost?: boolean;
  is_active?: boolean;
}

export interface UpdateLeadStatusPayload extends Partial<CreateLeadStatusPayload> {}

export interface CreateLeadActivityPayload {
  lead: number;
  type: ActivityTypeEnum;
  content?: string;
  happened_at: string;
  by_user_id?: string;
  meta?: Record<string, any>;
  file_url?: string;
}

export interface UpdateLeadActivityPayload extends Partial<CreateLeadActivityPayload> {}

export interface CreateLeadOrderPayload {
  lead: number;
  status: number;
  position: string;
  board_id?: number;
}

export interface UpdateLeadOrderPayload extends Partial<CreateLeadOrderPayload> {}

export interface CreateTaskPayload {
  lead: number;
  title: string;
  description?: string;
  status?: TaskStatusEnum;
  priority?: PriorityEnum;
  due_date?: string;
  assignee_user_id?: string;
  reporter_user_id?: string;
  checklist?: any;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {}

export interface CreateLeadFieldConfigurationPayload {
  field_name: string;
  field_label: string;
  is_standard?: boolean;
  field_type?: FieldTypeEnum;
  is_visible?: boolean;
  is_required?: boolean;
  is_active?: boolean;
  default_value?: string;
  options?: string[] | any;
  placeholder?: string;
  help_text?: string;
  display_order?: number;
  validation_rules?: Record<string, any>;
}

export interface UpdateLeadFieldConfigurationPayload extends Partial<CreateLeadFieldConfigurationPayload> {}

// Filter and Sort Options
export const PRIORITY_OPTIONS = [
  { value: PriorityEnum.LOW, label: 'Low' },
  { value: PriorityEnum.MEDIUM, label: 'Medium' },
  { value: PriorityEnum.HIGH, label: 'High' }
];

export const ACTIVITY_TYPE_OPTIONS = [
  { value: ActivityTypeEnum.CALL, label: 'Call' },
  { value: ActivityTypeEnum.EMAIL, label: 'Email' },
  { value: ActivityTypeEnum.MEETING, label: 'Meeting' },
  { value: ActivityTypeEnum.NOTE, label: 'Note' },
  { value: ActivityTypeEnum.SMS, label: 'SMS' },
  { value: ActivityTypeEnum.OTHER, label: 'Other' }
];

export const LEAD_ORDERING_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: '-name', label: 'Name (Z-A)' },
  { value: 'created_at', label: 'Created (Oldest)' },
  { value: '-created_at', label: 'Created (Newest)' },
  { value: 'updated_at', label: 'Updated (Oldest)' },
  { value: '-updated_at', label: 'Updated (Newest)' },
  { value: 'priority', label: 'Priority (Low to High)' },
  { value: '-priority', label: 'Priority (High to Low)' },
  { value: 'value_amount', label: 'Value (Low to High)' },
  { value: '-value_amount', label: 'Value (High to Low)' },
  { value: 'next_follow_up_at', label: 'Follow-up (Earliest)' },
  { value: '-next_follow_up_at', label: 'Follow-up (Latest)' }
];

export const LEAD_STATUS_ORDERING_OPTIONS = [
  { value: 'order_index', label: 'Order (First to Last)' },
  { value: '-order_index', label: 'Order (Last to First)' },
  { value: 'name', label: 'Name (A-Z)' },
  { value: '-name', label: 'Name (Z-A)' },
  { value: 'created_at', label: 'Created (Oldest)' },
  { value: '-created_at', label: 'Created (Newest)' },
  { value: 'updated_at', label: 'Updated (Oldest)' },
  { value: '-updated_at', label: 'Updated (Newest)' },
  { value: 'is_active', label: 'Active First' },
  { value: '-is_active', label: 'Inactive First' }
];

export const LEAD_ACTIVITY_ORDERING_OPTIONS = [
  { value: '-happened_at', label: 'Most Recent First' },
  { value: 'happened_at', label: 'Oldest First' },
  { value: 'type', label: 'Type (A-Z)' },
  { value: '-type', label: 'Type (Z-A)' },
  { value: 'created_at', label: 'Created (Oldest)' },
  { value: '-created_at', label: 'Created (Newest)' }
];

export const TASK_STATUS_OPTIONS = [
  { value: TaskStatusEnum.TODO, label: 'To Do' },
  { value: TaskStatusEnum.IN_PROGRESS, label: 'In Progress' },
  { value: TaskStatusEnum.DONE, label: 'Done' },
  { value: TaskStatusEnum.CANCELLED, label: 'Cancelled' }
];

export const TASK_ORDERING_OPTIONS = [
  { value: 'due_date', label: 'Due Date (Earliest)' },
  { value: '-due_date', label: 'Due Date (Latest)' },
  { value: 'priority', label: 'Priority (Low to High)' },
  { value: '-priority', label: 'Priority (High to Low)' },
  { value: 'created_at', label: 'Created (Oldest)' },
  { value: '-created_at', label: 'Created (Newest)' },
  { value: 'updated_at', label: 'Updated (Oldest)' },
  { value: '-updated_at', label: 'Updated (Newest)' },
  { value: 'title', label: 'Title (A-Z)' },
  { value: '-title', label: 'Title (Z-A)' },
  { value: 'status', label: 'Status (A-Z)' },
  { value: '-status', label: 'Status (Z-A)' }
];

export const FIELD_TYPE_OPTIONS = [
  { value: FieldTypeEnum.TEXT, label: 'Text' },
  { value: FieldTypeEnum.NUMBER, label: 'Number' },
  { value: FieldTypeEnum.EMAIL, label: 'Email' },
  { value: FieldTypeEnum.PHONE, label: 'Phone' },
  { value: FieldTypeEnum.DATE, label: 'Date' },
  { value: FieldTypeEnum.DATETIME, label: 'Date Time' },
  { value: FieldTypeEnum.DROPDOWN, label: 'Dropdown' },
  { value: FieldTypeEnum.MULTISELECT, label: 'Multi Select' },
  { value: FieldTypeEnum.CHECKBOX, label: 'Checkbox' },
  { value: FieldTypeEnum.URL, label: 'URL' },
  { value: FieldTypeEnum.TEXTAREA, label: 'Text Area' },
  { value: FieldTypeEnum.DECIMAL, label: 'Decimal' },
  { value: FieldTypeEnum.CURRENCY, label: 'Currency' }
];

export const FIELD_CONFIGURATION_ORDERING_OPTIONS = [
  { value: 'display_order', label: 'Display Order (First to Last)' },
  { value: '-display_order', label: 'Display Order (Last to First)' },
  { value: 'field_label', label: 'Field Label (A-Z)' },
  { value: '-field_label', label: 'Field Label (Z-A)' },
  { value: 'created_at', label: 'Created (Oldest)' },
  { value: '-created_at', label: 'Created (Newest)' },
  { value: 'updated_at', label: 'Updated (Oldest)' },
  { value: '-updated_at', label: 'Updated (Newest)' }
];