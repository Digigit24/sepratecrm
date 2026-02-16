// src/types/tenantConfig.ts

export interface TenantConfigBase {
  user_id?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  fb_app_id?: string | null;
  callback_url?: string | null;
  redirect_url?: string | null;
  verify_token?: string | null;
}

export interface TenantConfigCreate extends TenantConfigBase {
  // All fields are optional in the base
}

export interface TenantConfigUpdate {
  user_id?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  access_token?: string | null;
  fb_app_id?: string | null;
  fb_app_secret?: string | null;
  callback_url?: string | null;
  redirect_url?: string | null;
  verify_token?: string | null;
  is_active?: boolean | null;
}

export interface TenantConfigResponse extends TenantConfigBase {
  id: number;
  tenant_id: string;
  access_token?: string | null; // Masked access token
  fb_app_secret?: string | null; // Masked app secret
  token_expires_at?: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  onboarded_at?: string | null;
  last_verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantConfigFullResponse extends TenantConfigResponse {
  // Full data including sensitive fields (admin only)
  access_token?: string | null; // Full access token
  fb_app_secret?: string | null; // Full app secret
  refresh_token?: string | null;
}

export interface WhatsAppOnboardingRequest {
  code: string;
  waba_id: string;
  phone_number_id: string;
  redirect_uri: string;
}

export interface WhatsAppOnboardingResponse {
  success: boolean;
  message: string;
  tenant_id: string;
  config_id: number;
  waba_id: string;
  phone_number_id: string;
}
