// src/hooks/useAuth.ts
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { authService } from '@/services/authService';
import { LoginPayload, User } from '@/types/authTypes';

export const useAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get user from localStorage initially
  const [user, setUser] = useState<User | null>(() => authService.getCurrentUser());

  // Check authentication status
  const isAuthenticated = authService.isAuthenticated();

  // Update user state when auth service user changes (login/logout)
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
  }, [isAuthenticated]);

  // Sync React state when preferences are updated without re-login
  useEffect(() => {
    const handleUserUpdated = (event: CustomEvent<User>) => {
      setUser(event.detail);
    };
    window.addEventListener('celiyo:user-updated', handleUserUpdated as EventListener);
    return () => {
      window.removeEventListener('celiyo:user-updated', handleUserUpdated as EventListener);
    };
  }, []);

  // Login function
  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    setError(null);

    try {
      const loggedInUser = await authService.login(payload);
      
      // Update local state
      setUser(loggedInUser);
      
      // Clear any existing SWR cache to ensure fresh data
      mutate(() => true, undefined, { revalidate: false });
      
      // Navigate to dashboard
      navigate('/', { replace: true });
      
      return loggedInUser;
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Update local state
      setUser(null);
      
      // Clear all SWR cache
      mutate(() => true, undefined, { revalidate: false });
      
      // Navigate to login
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, []);

  // Check if user has access to a specific module
  // Reads from React user state so sidebar re-renders immediately when modules change
  const hasModuleAccess = useCallback((module: string) => {
    if (user?.tenant && Array.isArray(user.tenant.enabled_modules)) {
      return user.tenant.enabled_modules.includes(module);
    }
    // Fallback: read from localStorage/JWT (covers super-admin and edge cases)
    return authService.hasModuleAccess(module);
  }, [user]);

  // Get tenant information
  const getTenant = useCallback(() => {
    return authService.getTenant();
  }, [user]);

  // Get user roles
  const getUserRoles = useCallback(() => {
    return authService.getUserRoles();
  }, [user]);

  // Verify token validity
  const verifyToken = useCallback(async () => {
    try {
      const isValid = await authService.verifyToken();
      if (!isValid) {
        // Token is invalid, logout user
        await logout();
        return false;
      }
      return true;
    } catch (err) {
      console.error('Token verification failed:', err);
      await logout();
      return false;
    }
  }, [logout]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    hasModuleAccess,
    getTenant,
    getUserRoles,
    verifyToken,
  };
};