// src/lib/externalWhatsappClient.ts
// External WhatsApp client for Laravel API (whatsappapi.celiyo.com/api)
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './apiConfig';

const USER_KEY = 'celiyo_user';

/**
 * Get WhatsApp API token from localStorage
 * This token is stored in: celiyo_user.tenant.whatsapp_api_token
 * and is used for authenticating with the WhatsApp API
 */
export const getWhatsappApiToken = (): string | null => {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
      const user = JSON.parse(userJson);
      return user?.tenant?.whatsapp_api_token || null;
    }
  } catch (error) {
    console.error('Failed to get WhatsApp API token:', error);
  }
  return null;
};

// Create external WhatsApp client for Laravel API
const externalWhatsappClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.WHATSAPP_EXTERNAL_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach WhatsApp API token (not user auth token)
externalWhatsappClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const whatsappApiToken = getWhatsappApiToken();

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
 * Get vendor UID from localStorage
 */
export const getVendorUid = (): string | null => {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
      const user = JSON.parse(userJson);
      return user?.vendor_uid
        || user?.tenant?.vendor_uid
        || user?.tenant?.whatsapp_vendor_uid
        || null;
    }
  } catch (error) {
    console.error('Failed to get vendor UID:', error);
  }
  return null;
};

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
