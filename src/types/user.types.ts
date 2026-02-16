// User Types

// Role interface
export interface Role {
  id: string;
  tenant: string;
  name: string;
  description: string;
  permissions: Record<string, any>;
  is_active: boolean;
  created_by: string;
  created_by_email?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
}

// Role create data
export interface RoleCreateData {
  name: string;
  description?: string;
  permissions?: Record<string, any>;
  is_active?: boolean;
}

// Role update data
export interface RoleUpdateData {
  name?: string;
  description?: string;
  permissions?: Record<string, any>;
  is_active?: boolean;
}

// Role list query parameters
export interface RoleListParams {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}

// Variable mapping for WhatsApp templates
export interface TemplateVariableMapping {
  variableNumber: string; // "1", "2", "3", etc.
  fieldSource: string;    // "patient_name", "followup_date", "followup_time", "custom"
  customValue?: string;   // For custom field source
}

// WhatsApp default templates interface
export interface WhatsAppDefaults {
  followup?: number | string;           // Template ID for followup reminders
  leadNotification?: number | string;   // Template ID for lead notifications
  appointmentReminder?: number | string; // Template ID for appointment reminders
  welcomeMessage?: number | string;     // Template ID for welcome messages
  followupVariableMapping?: TemplateVariableMapping[]; // Variable mappings for followup template
}

// User preferences interface - flexible key-value structure
export interface UserPreferences {
  theme?: 'light' | 'dark';
  whatsappDefaults?: WhatsAppDefaults;
  [key: string]: any; // Allow any additional preference key-value pairs
}

// User interface
export interface User {
  id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  tenant: string;
  tenant_name?: string;
  roles: Role[];
  is_super_admin: boolean;
  profile_picture?: string | null;
  timezone?: string;
  is_active: boolean;
  date_joined: string;
  preferences?: UserPreferences;
}

// User list query parameters
export interface UserListParams {
  search?: string;
  is_active?: boolean;
  role?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}

// User create data
export interface UserCreateData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone?: string;
  timezone?: string;
  tenant?: string;
  role_ids?: string[];
}

// User update data
export interface UserUpdateData {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone?: string;
  is_active?: boolean;
  profile_picture?: string | null;
  role_ids?: string[];
  preferences?: UserPreferences;
}

// Assign roles data
export interface AssignRolesData {
  role_ids: string[];
}

// Remove role data
export interface RemoveRoleData {
  role_id: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// API response wrapper
export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}
