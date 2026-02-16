// src/lib/laravelClient.ts
// Laravel Web Routes Client - For endpoints in web.php (not api.php)
// Templates and other vendor-console routes are web routes that use session auth

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from './apiConfig';
import { tokenManager } from './client';

const USER_KEY = 'celiyo_user';

// Create Laravel client for web routes
// These routes are at /vendor-console/... and use session-based auth
const laravelClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.LARAVEL_APP_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Important for Laravel to treat as AJAX request
  },
  withCredentials: true, // Include cookies for session auth
});

// Request interceptor - attach Bearer token and tenant headers
laravelClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken();

    console.log('📤 Laravel Web Request:', {
      url: config.url,
      method: config.method?.toUpperCase(),
      hasToken: !!token
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Added Bearer token to Laravel request');
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
laravelClient.interceptors.response.use(
  (response) => {
    console.log('✅ Laravel Web response:', {
      status: response.status,
      url: response.config.url
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    console.error('❌ Laravel Web error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data
    });

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('🔄 Unauthorized - user may need to log in to Laravel app');

      // For web routes, we might need to redirect to login
      // or try token refresh if using API tokens
      originalRequest._retry = true;

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

          console.log('✅ Token refreshed, retrying Laravel request');

          originalRequest.headers.Authorization = `Bearer ${access}`;
          return laravelClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        // Don't redirect - let the calling code handle it
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('🚫 Laravel access forbidden:', error.response.data);
    }

    // Handle network errors
    if (!error.response) {
      console.error('🌐 Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

export { laravelClient };
