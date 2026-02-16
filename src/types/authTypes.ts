// Authentication Types for Celiyo Multi-Tenant Architecture

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TenantSettings {
  logo?: string;
  domain?: string;
  address?: string;
  website_url?: string;
  contact_email?: string;
  contact_phone?: string;
  footer_bg_color?: string;
  header_bg_color?: string;
  footer_text_color?: string;
  header_text_color?: string;
  [key: string]: any;
}

export interface TenantImage {
  id: string;
  tenant: string;
  image: string;
  label: string;
  description: string | null;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  enabled_modules: string[];
  settings?: TenantSettings;
  gallery_images?: TenantImage[];
  whatsapp_vendor_uid?: string;
  whatsapp_api_token?: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  [key: string]: any; // Allow any additional preference key-value pairs
}

export interface User {
  id: string;
  email: string;
  tenant: Tenant;
  roles: Role[];
  preferences?: UserPreferences;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshTokenPayload {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
  refresh?: string; // Optional: new refresh token if rotation enabled
}

export interface TokenVerifyPayload {
  token: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  decoded: {
    user_id: string;
    tenant_id: string;
    exp: number;
  };
}

export interface LogoutPayload {
  refresh: string;
}

export interface LogoutResponse {
  message: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Error response types
export interface AuthErrorResponse {
  error?: string;
  email?: string[];
  password?: string[];
}