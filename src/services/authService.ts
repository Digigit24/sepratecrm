// src/services/authService.ts
import { authClient, tokenManager } from '@/lib/client';
import { API_CONFIG } from '@/lib/apiConfig';
import { 
  LoginPayload, 
  LoginResponse, 
  RefreshTokenPayload,
  RefreshTokenResponse,
  TokenVerifyPayload,
  TokenVerifyResponse,
  LogoutPayload,
  LogoutResponse,
  User 
} from '@/types/authTypes';

const USER_KEY = 'celiyo_user';

// Decode a JWT access token safely and return its payload
function parseJwt(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

class AuthService {
  // Login
  async login(payload: LoginPayload): Promise<User> {
    try {
      console.log('🔐 Login attempt:', { email: payload.email });

      const response = await authClient.post<any>(
        API_CONFIG.AUTH.LOGIN,
        payload
      );

      console.log('✅ Login API response:', response.data);

      // Handle the actual API response structure
      const { tokens, user: userData } = response.data;
      const access = tokens.access;
      const refresh = tokens.refresh;

      console.log('🎫 Tokens received:', {
        access: access ? 'Yes ✓' : 'No ✗',
        refresh: refresh ? 'Yes ✓' : 'No ✗'
      });

      // Decode JWT to get tenant info and modules
      const decoded = parseJwt(access);
      console.log('🔍 Decoded JWT:', decoded);

      // Build proper user object with tenant structure
      const user: User = {
        id: userData.id,
        email: userData.email,
        tenant: {
          id: userData.tenant || decoded?.tenant_id || '',
          name: userData.tenant_name || '',
          slug: decoded?.tenant_slug || '',
          enabled_modules: decoded?.enabled_modules || []
        },
        roles: userData.roles || [],
        preferences: userData.preferences || {}
      };

      console.log('👤 Constructed user object:', user);

      // Store tokens and user temporarily
      tokenManager.setAccessToken(access);
      tokenManager.setRefreshToken(refresh);

      // Fetch full user details including preferences if not in login response
      if (!userData.preferences) {
        try {
          console.log('🔄 Fetching user preferences...');
          const userDetailUrl = API_CONFIG.AUTH.USERS.DETAIL.replace(':id', userData.id);
          const userDetailResponse = await authClient.get(userDetailUrl);
          user.preferences = userDetailResponse.data?.preferences || {};
          console.log('✅ User preferences fetched:', user.preferences);
        } catch (prefError) {
          console.warn('⚠️ Failed to fetch user preferences, using defaults:', prefError);
          user.preferences = {};
        }
      }

      // Fetch tenant settings to get whatsapp_vendor_uid
      if (user.tenant?.id) {
        try {
          console.log('🔄 Fetching tenant settings...');
          const tenantDetailUrl = API_CONFIG.AUTH.TENANTS.DETAIL.replace(':id', user.tenant.id);
          const tenantResponse = await authClient.get(tenantDetailUrl);
          const tenantSettings = tenantResponse.data?.settings || {};

          // Store whatsapp_vendor_uid in tenant object
          if (tenantSettings.whatsapp_vendor_uid) {
            user.tenant.whatsapp_vendor_uid = tenantSettings.whatsapp_vendor_uid;
            console.log('✅ WhatsApp Vendor UID fetched:', tenantSettings.whatsapp_vendor_uid);
          }

          // Store whatsapp_api_token in tenant object
          if (tenantSettings.whatsapp_api_token) {
            user.tenant.whatsapp_api_token = tenantSettings.whatsapp_api_token;
            console.log('✅ WhatsApp API Token fetched:', '****' + tenantSettings.whatsapp_api_token.slice(-4));
          }
        } catch (tenantError) {
          console.warn('⚠️ Failed to fetch tenant settings:', tenantError);
        }
      }

      // Apply theme preference
      if (user.preferences?.theme) {
        console.log('🎨 Applying theme preference:', user.preferences.theme);
        this.applyThemePreference(user.preferences.theme);
      }

      // Store user with preferences
      this.setUser(user);

      // Verify storage
      const storedAccess = tokenManager.getAccessToken();
      const storedRefresh = tokenManager.getRefreshToken();
      const storedUser = this.getUser();

      console.log('💾 Storage verification:', {
        accessTokenStored: storedAccess ? 'Yes ✓' : 'No ✗',
        refreshTokenStored: storedRefresh ? 'Yes ✓' : 'No ✗',
        userStored: storedUser ? 'Yes ✓' : 'No ✗',
        tenantId: storedUser?.tenant?.id,
        modules: storedUser?.tenant?.enabled_modules,
        preferences: storedUser?.preferences
      });

      return user;
    } catch (error: any) {
      console.error('❌ Login failed:', error);

      // Clear any stale data
      this.clearAuth();

      const message = error.response?.data?.error ||
                     error.response?.data?.email?.[0] ||
                     error.response?.data?.password?.[0] ||
                     'Login failed. Please check your credentials.';
      throw new Error(message);
    }
  }

  // Apply theme preference to document
  private applyThemePreference(theme: 'light' | 'dark'): void {
    try {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      console.log('✅ Theme applied:', theme);
    } catch (error) {
      console.error('❌ Failed to apply theme:', error);
    }
  }

  // Apply all preferences from stored user (for app initialization)
  applyStoredPreferences(): void {
    try {
      const user = this.getUser();
      if (user?.preferences) {
        console.log('🔄 Applying stored preferences:', user.preferences);

        // Apply theme
        if (user.preferences.theme) {
          this.applyThemePreference(user.preferences.theme);
        }

        // You can add more preference applications here as needed
        console.log('✅ Stored preferences applied');
      }
    } catch (error) {
      console.error('❌ Failed to apply stored preferences:', error);
    }
  }

  // Get user preferences
  getUserPreferences() {
    const user = this.getUser();
    return user?.preferences || {};
  }

  // Update user preferences in storage
  updateUserPreferences(preferences: any): void {
    const user = this.getUser();
    if (user) {
      user.preferences = { ...user.preferences, ...preferences };
      this.setUser(user);

      // Apply theme if it changed
      if (preferences.theme) {
        this.applyThemePreference(preferences.theme);
      }

      console.log('✅ User preferences updated in storage:', user.preferences);
    }
  }

  // Refresh token
  async refreshToken(): Promise<string> {
    try {
      console.log('🔄 Refreshing token...');
      
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await authClient.post<RefreshTokenResponse>(
        API_CONFIG.AUTH.REFRESH,
        { refresh: refreshToken }
      );

      const { access, refresh } = response.data;

      console.log('✅ Token refreshed successfully');

      // Update tokens
      tokenManager.setAccessToken(access);
      if (refresh) {
        tokenManager.setRefreshToken(refresh);
      }

      return access;
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error);
      
      // Clear auth data if refresh fails
      this.clearAuth();
      
      const message = error.response?.data?.error || 'Token refresh failed';
      throw new Error(message);
    }
  }

  // Verify token
  async verifyToken(token?: string): Promise<boolean> {
    try {
      const tokenToVerify = token || tokenManager.getAccessToken();
      if (!tokenToVerify) {
        return false;
      }

      const response = await authClient.post<TokenVerifyResponse>(
        API_CONFIG.AUTH.VERIFY,
        { token: tokenToVerify }
      );

      return response.data.valid;
    } catch (error) {
      console.error('Token verification failed:', error);
      return false;
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      console.log('👋 Logging out...');
      
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        // Call logout endpoint to invalidate tokens on server
        await authClient.post<LogoutResponse>(
          API_CONFIG.AUTH.LOGOUT,
          { refresh: refreshToken }
        );
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local auth data
      this.clearAuth();
      console.log('✅ Logged out successfully');
    }
  }

  // Get current user (from localStorage)
  getCurrentUser(): User | null {
    return this.getUser();
  }

  // Token methods
  getAccessToken(): string | null {
    return tokenManager.getAccessToken();
  }

  getRefreshToken(): string | null {
    return tokenManager.getRefreshToken();
  }

  setAccessToken(token: string): void {
    tokenManager.setAccessToken(token);
  }

  setRefreshToken(token: string): void {
    tokenManager.setRefreshToken(token);
  }

  removeTokens(): void {
    tokenManager.removeTokens();
  }

  // User methods
  getUser(): User | null {
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) return null;
    
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const hasToken = tokenManager.hasAccessToken();
    const hasUser = !!this.getUser();
    
    console.log('🔒 Auth check:', { hasToken, hasUser });
    
    return hasToken && hasUser;
  }

  // Check if user has access to specific module
  hasModuleAccess(module: string): boolean {
    const user = this.getUser();

    // If user object already has structured tenant with enabled_modules, use it
    const tenant: any = (user as any)?.tenant;
    if (tenant && typeof tenant === 'object' && Array.isArray(tenant.enabled_modules)) {
      const hasAccess = tenant.enabled_modules.includes(module);
      console.log(`🔑 Module access check for "${module}":`, hasAccess ? 'Granted ✓' : 'Denied ✗');
      return hasAccess;
    }

    // Fallback to claims from access token (supports backend that places modules in JWT)
    const access = tokenManager.getAccessToken();
    const decoded: any = access ? parseJwt(access) : null;

    // Super admin has access to all modules
    if (decoded?.is_super_admin) {
      console.log(`🔑 Module access for "${module}": Granted (Super Admin) ✓`);
      return true;
    }

    const enabledFromToken: string[] | undefined = decoded?.enabled_modules;
    const hasAccess = Array.isArray(enabledFromToken) ? enabledFromToken.includes(module) : false;
    console.log(`🔑 Module access check for "${module}":`, hasAccess ? 'Granted ✓' : 'Denied ✗');
    
    return hasAccess;
  }

  // Get user's tenant information
  getTenant() {
    const user: any = this.getUser();
    const tenant = user?.tenant;

    // If tenant is already a structured object, return it
    if (tenant && typeof tenant === 'object') {
      return tenant;
    }

    // Fallback: build minimal tenant object from JWT claims (supports backend where user.tenant is an ID string)
    const access = tokenManager.getAccessToken();
    const decoded: any = access ? parseJwt(access) : null;

    if (decoded?.tenant_id) {
      return {
        id: decoded.tenant_id,
        name: user?.tenant_name || '', // optional, may come in auth response
        slug: decoded.tenant_slug || '',
        enabled_modules: Array.isArray(decoded?.enabled_modules) ? decoded.enabled_modules : [],
      };
    }

    return null;
  }

  // Get user's roles
  getUserRoles() {
    const user = this.getUser();
    return user?.roles || [];
  }

  // Clear all auth data
  clearAuth(): void {
    console.log('🧹 Clearing all auth data...');
    this.removeTokens();
    this.removeUser();
  }

  // Legacy methods for backward compatibility
  getToken(): string | null {
    return this.getAccessToken();
  }

  setToken(token: string): void {
    this.setAccessToken(token);
  }

  removeToken(): void {
    tokenManager.removeToken();
  }

  hasToken(): boolean {
    return tokenManager.hasToken();
  }
}

export const authService = new AuthService();