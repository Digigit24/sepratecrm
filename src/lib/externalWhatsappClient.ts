// src/lib/externalWhatsappClient.ts
// External WhatsApp client for Laravel API (whatsappapi.celiyo.com/api)
//
// LEGACY. This client talks to the Laravel gateway DIRECTLY, authenticated with
// the tenant-wide vendor API token. Every route still on it is administrative
// (contacts, campaigns, templates, bot flows, scheduling, QR codes) — chat,
// sending and realtime have all moved to DigiCRM and the user's own JWT.
//
// The token is no longer read from localStorage. It is fetched on demand into
// memory by lib/whatsapp/legacyVendorToken.ts, which is the only module allowed
// to touch it and which documents exactly what still depends on it.
//
// Do not add new callers. Add a DigiCRM endpoint instead.
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './apiConfig';
import { getLegacyVendorToken, getLegacyVendorUid } from './whatsapp/legacyVendorToken';

const USER_KEY = 'celiyo_user';

// Create external WhatsApp client for Laravel API
const externalWhatsappClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.WHATSAPP_EXTERNAL_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach the vendor API token (not the user auth token).
//
// Async on purpose: the token is fetched into memory on first use rather than
// read from localStorage, so the first request of a session awaits it. Later
// requests hit the in-memory cache and resolve immediately.
externalWhatsappClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const whatsappApiToken = await getLegacyVendorToken();

    if (whatsappApiToken) {
      config.headers.Authorization = `Bearer ${whatsappApiToken}`;
    } else {
      // Do NOT fall back to user JWT — the backend middleware compares the bearer token
      // directly against vendor_api_access_token and will reject any other token.
      console.warn('⚠️ WhatsApp API Token not configured. Set whatsapp_api_token in tenant settings.');
    }

    // Add tenant headers if available
    try {
      const userJson = localStorage.getItem(USER_KEY);
      if (userJson) {
        const user = JSON.parse(userJson);
        const tenant = user?.tenant;

        if (tenant) {
          const tenantId = tenant.id || tenant.tenant_id;

          if (tenantId) {
            config.headers['X-Tenant-Id'] = tenantId;
            config.headers['tenanttoken'] = tenantId;

            console.log('🏢 Added tenant headers to external WhatsApp request:', {
              'X-Tenant-Id': tenantId,
              'tenanttoken': tenantId
            });
          }

          if (tenant.slug) {
            config.headers['X-Tenant-Slug'] = tenant.slug;
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse user or attach tenant headers:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
externalWhatsappClient.interceptors.response.use(
  (response) => {
    console.log('✅ External WhatsApp API response:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.error('❌ External WhatsApp API error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data
    });

    // Handle 401 Unauthorized — static API key, no refresh possible
    if (error.response?.status === 401) {
      console.error('🔑 WhatsApp API Token is invalid. Update vendor_api_access_token in Admin Settings > Tenant Settings.');
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('🚫 External WhatsApp access forbidden:', error.response.data);
    }

    // Handle network errors
    if (!error.response) {
      console.error('🌐 Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * Get vendor UID from localStorage.
 *
 * Unlike the token, the vendor uid is NOT a secret — it appears in every gateway
 * URL — so it may stay in localStorage. Delegated so there is one resolution
 * order, in one place.
 */
export const getVendorUid = (): string | null => getLegacyVendorUid();

/**
 * Build URL with vendor UID
 */
export const buildExternalWhatsAppUrl = (
  endpoint: string,
  params?: Record<string, string | number>
): string => {
  const vendorUid = getVendorUid();
  
  if (!vendorUid && endpoint.includes(':vendorUid')) {
    throw new Error('Vendor UID not found. Please ensure user is logged in.');
  }
  
  let url = endpoint;
  
  // Replace vendorUid first
  if (vendorUid) {
    url = url.replace(':vendorUid', vendorUid);
  }
  
  // Replace other parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      const encoded = encodeURIComponent(String(value));
      url = url.replace(`:${key}`, encoded);
    });
  }
  
  return url;
};

export { externalWhatsappClient };
