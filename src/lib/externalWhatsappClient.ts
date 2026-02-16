// src/lib/externalWhatsappClient.ts
// External WhatsApp client for Laravel API (whatsappapi.celiyo.com/api)
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './apiConfig';
import { tokenManager } from './client';

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
    // Use WhatsApp API token for external WhatsApp API calls
    const whatsappApiToken = getWhatsappApiToken();
    // Fallback to user auth token if WhatsApp API token is not set
    const userAuthToken = tokenManager.getAccessToken();
    const token = whatsappApiToken || userAuthToken;

    console.log('📤 External WhatsApp API Request:', {
      url: config.url,
      method: config.method?.toUpperCase(),
      hasWhatsappApiToken: !!whatsappApiToken,
      hasUserAuthToken: !!userAuthToken,
      usingToken: whatsappApiToken ? 'WhatsApp API Token' : (userAuthToken ? 'User Auth Token' : 'None')
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Added Bearer token to external WhatsApp request:',
        whatsappApiToken ? '(WhatsApp API Token)' : '(User Auth Token - fallback)');
    } else {
      console.warn('⚠️ No token found for external WhatsApp request! Please configure WhatsApp API Token in Admin Settings.');
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

    // Check if we're using WhatsApp API token (static token, no refresh)
    const whatsappApiToken = getWhatsappApiToken();

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      if (whatsappApiToken) {
        // If using WhatsApp API token and it's invalid, don't try to refresh
        // Just log the error - the token needs to be updated in Admin Settings
        console.error('🔑 WhatsApp API Token is invalid or expired. Please update it in Admin Settings > Tenant Settings.');
      } else if (!originalRequest._retry) {
        // Only try to refresh if we're using user auth token
        originalRequest._retry = true;

        console.log('🔄 Attempting to refresh token for external WhatsApp request...');

        try {
          const refreshToken = tokenManager.getRefreshToken();
          if (refreshToken) {
            const { authClient } = await import('./client');

            const response = await authClient.post(API_CONFIG.AUTH.REFRESH, {
              refresh: refreshToken
            });

            const { access, refresh } = response.data;
            tokenManager.setAccessToken(access);

            if (refresh) {
              tokenManager.setRefreshToken(refresh);
            }

            console.log('✅ Token refreshed, retrying external WhatsApp request');

            originalRequest.headers.Authorization = `Bearer ${access}`;
            return externalWhatsappClient(originalRequest);
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);

          tokenManager.removeTokens();
          localStorage.removeItem(USER_KEY);

          if (!window.location.pathname.includes('/login')) {
            console.log('↪️ Redirecting to login...');
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
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
