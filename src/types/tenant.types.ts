// src/types/tenant.types.ts

export interface CurrencySettings {
  currency_code: string;
  currency_symbol: string;
  currency_name: string;
  currency_decimals: number;
  currency_thousand_separator: string;
  currency_decimal_separator: string;
  currency_symbol_position: 'before' | 'after';
  currency_use_indian_numbering: boolean;
}

export interface TenantSettings extends Partial<CurrencySettings> {
  [key: string]: any;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  database_name: string | null;
  database_url: string | null;
  enabled_modules: string[];
  settings: TenantSettings;
  is_active: boolean;
  trial_ends_at: string | null;
  user_count?: number;
  created_at: string;
  updated_at: string;
  gallery_images?: TenantImage[];
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

export interface TenantUpdateData {
  name?: string;
  slug?: string;
  domain?: string | null;
  database_name?: string | null;
  database_url?: string | null;
  enabled_modules?: string[];
  settings?: TenantSettings;
  is_active?: boolean;
  trial_ends_at?: string | null;
}

export interface TenantImageUpload {
  image: File;
  label: string;
  description?: string;
  order?: number;
}

export interface TenantListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
