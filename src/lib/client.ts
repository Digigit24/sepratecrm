// src/lib/client.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './apiConfig';
import { toast } from 'sonner';
import { clearPersistentSWRCache } from './swrPersist';

// Dev-only logger — request/response logging is skipped entirely in production
// builds so every API call doesn't pay console-serialization overhead.
const IS_DEV = import.meta.env.DEV;
const devLog = (...args: unknown[]) => { if (IS_DEV) console.log(...args); };
const devWarn = (...args: unknown[]) => { if (IS_DEV) console.warn(...args); };

// Token management for JWT tokens
const ACCESS_TOKEN_KEY = 'celiyo_access_token';
const REFRESH_TOKEN_KEY = 'celiyo_refresh_token';
const USER_KEY = 'celiyo_user';

// Opt-out flag for the global 403 "Permission not granted" toast.
//
// Some requests are EXPECTED to 403 for perfectly ordinary users and must
// degrade silently instead of firing a red toast. The canonical case is the
// user-directory fetch (`GET /crm/users/` -> auth-service `/users/`), which
// historically required tenant-admin: every non-admin opening the Leads page
// would otherwise get a toast storm while the owner/assignee columns simply
// fall back to a muted placeholder.
//
// Set `suppressErrorToast: true` on the axios request config to opt out.
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Skip the global permission-denied toast for this request. */
    suppressErrorToast?: boolean;
  }
}

const showPermissionDeniedToast = (config?: { suppressErrorToast?: boolean }) => {
  if (config?.suppressErrorToast) return;
  toast.error('Permission not granted for this module');
};

export const tokenManager = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  
  setAccessToken: (token: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    devLog('💾 Access token saved to localStorage');
  },
  
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  
  setRefreshToken: (token: string): void => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
    devLog('💾 Refresh token saved to localStorage');
  },
  
  removeTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // The persisted SWR snapshot holds the tenant user directory (names +
    // emails). Wipe it with the tokens so a different user signing in on the
    // same browser can never see the previous tenant's directory.
    clearPersistentSWRCache();
    devLog('🗑️ Tokens removed from localStorage');
  },
  
  hasAccessToken: (): boolean => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  // Legacy methods for backward compatibility
  getToken: (): string | null => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  
  setToken: (token: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  
  removeToken: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },
  
  hasToken: (): boolean => {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  }
};

// Create auth client for authentication API (port 8000)
const authClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.AUTH_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create CRM client for CRM API (port 8001)
const crmClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.CRM_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// HMS client removed - not used in CRM app

// Request interceptor for auth client - attach token and tenant headers
authClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();

    devLog('📤 Auth API Request:', {
      url: config.url,
      method: config.method?.toUpperCase(),
      hasToken: !!token
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      devLog('🔑 Added Bearer token to Auth request');
    } else {
      devWarn('⚠️ No access token found for Auth request!');
    }

    // Multi-tenant header propagation (read from stored user)
    try {
      const userJson = localStorage.getItem(USER_KEY);
      if (userJson) {
        const user = JSON.parse(userJson);
        const tenant = user?.tenant;

        if (tenant) {
          // Get tenant ID (could be tenant.id or tenant.tenant_id)
          const tenantId = tenant.id || tenant.tenant_id;

          if (tenantId) {
            config.headers['X-Tenant-Id'] = tenantId;
            config.headers['x-tenant-id'] = tenantId; // Backend expects lowercase
            config.headers['tenanttoken'] = tenantId; // Your API uses 'tenanttoken' header

            devLog('🏢 Added tenant headers to Auth:', {
              'X-Tenant-Id': tenantId,
              'x-tenant-id': tenantId,
              'tenanttoken': tenantId
            });
          }

          if (tenant.slug) {
            config.headers['X-Tenant-Slug'] = tenant.slug;
          }
        } else {
          devWarn('⚠️ No tenant found in user object for Auth');
        }
      } else {
        devWarn('⚠️ No user found in localStorage for Auth');
      }
    } catch (error) {
      console.error('❌ Failed to parse user or attach tenant headers for Auth:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Request interceptor for CRM client - attach token and tenant headers
crmClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();
    
    devLog('📤 CRM API Request:', {
      url: config.url,
      method: config.method?.toUpperCase(),
      hasToken: !!token
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      devLog('🔑 Added Bearer token to CRM request');
    } else {
      devWarn('⚠️ No access token found for CRM request!');
    }

    // Multi-tenant header propagation (read from stored user)
    try {
      const userJson = localStorage.getItem(USER_KEY);
      if (userJson) {
        const user = JSON.parse(userJson);
        const tenant = user?.tenant;
        
        if (tenant) {
          // Get tenant ID (could be tenant.id or tenant.tenant_id)
          const tenantId = tenant.id || tenant.tenant_id;
          
          if (tenantId) {
            config.headers['X-Tenant-Id'] = tenantId;
            config.headers['tenanttoken'] = tenantId; // Your API uses 'tenanttoken' header
            
            devLog('🏢 Added tenant headers:', {
              'X-Tenant-Id': tenantId,
              'tenanttoken': tenantId
            });
          }
          
          if (tenant.slug) {
            config.headers['X-Tenant-Slug'] = tenant.slug;
          }
        } else {
          devWarn('⚠️ No tenant found in user object');
        }
      } else {
        devWarn('⚠️ No user found in localStorage');
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

// HMS client interceptors removed - not used in CRM app

// Response interceptor for auth client
authClient.interceptors.response.use(
  (response) => {
    devLog('✅ Auth API response:', response.status);
    return response;
  },
  (error) => {
    console.error('❌ Auth API error:', {
      status: error.response?.status,
      data: error.response?.data
    });
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      tokenManager.removeTokens();
      localStorage.removeItem(USER_KEY);
      
      // Only redirect to login if not already on login page
      if (!window.location.pathname.includes('/login')) {
        devLog('↪️ Redirecting to login...');
        window.location.href = '/login';
      }
    }
    
    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('🚫 Access forbidden:', error.response.data);
      showPermissionDeniedToast(error.config);
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('🌐 Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// ─── Single-flight token refresh ─────────────────────────────────────────────
// When many requests fail with 401 at once (e.g. a dashboard burst after token
// expiry), only ONE refresh call is made; all other 401s await the same promise.
// Previously each 401 fired its own POST /auth/refresh, which multiplied load
// and could race token rotation.
let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const response = await authClient.post(API_CONFIG.AUTH.REFRESH, {
        refresh: refreshToken,
      });
      const { access, refresh } = response.data;
      tokenManager.setAccessToken(access);
      if (refresh) {
        tokenManager.setRefreshToken(refresh);
      }
      return access as string;
    })().finally(() => {
      // Allow a future refresh once this one settles
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

// Response interceptor for CRM client
crmClient.interceptors.response.use(
  (response) => {
    devLog('✅ CRM API response:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 424 Failed Dependency is an EXPECTED state (e.g. TeleCMI not configured
    // for the tenant on /telephony/webrtc-config/). It is handled by feature
    // code as a normal "not configured" condition — don't spam the console.
    if (error.response?.status === 424) {
      devLog('ℹ️ CRM 424 (feature not configured):', error.config?.url);
    } else {
      console.error('❌ CRM API error:', {
        status: error.response?.status,
        url: error.config?.url,
        data: error.response?.data
      });
    }

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      devLog('🔄 Attempting to refresh token...');

      try {
        if (tokenManager.getRefreshToken()) {
          // Single-flight: concurrent 401s share one refresh request
          const access = await refreshAccessToken();

          devLog('✅ Token refreshed, retrying original request');

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return crmClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // Refresh failed, clear tokens and redirect to login
        tokenManager.removeTokens();
        localStorage.removeItem(USER_KEY);
        
        if (!window.location.pathname.includes('/login')) {
          devLog('↪️ Redirecting to login...');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden - CRM module not enabled
    if (error.response?.status === 403) {
      console.error('🚫 CRM access forbidden:', error.response.data);
      showPermissionDeniedToast(error.config);
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('🌐 Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// HMS response interceptor removed - not used in CRM app

// Export all clients
export { authClient, crmClient };

// Export auth client as default for backward compatibility
export default authClient;