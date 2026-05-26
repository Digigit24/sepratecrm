// src/hooks/useLeadsFilterConfig.ts
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { authClient } from '@/lib/client';
import { API_CONFIG, buildUrl } from '@/lib/apiConfig';
import { authService } from '@/services/authService';
import { tenantService } from '@/services/tenantService';
import { DEFAULT_FILTER_CONFIG } from '@/types/filterTypes';
import type { CrmLeadsFilterConfig } from '@/types/filterTypes';

export const useLeadsFilterConfig = () => {
  const [isSaving, setIsSaving] = useState(false);

  const user = authService.getUser();
  const tenant = authService.getTenant();
  const userId = user?.id || null;
  const tenantId = (tenant as any)?.id || null;

  // Fetch user preferences to get user-level config
  const { data: userData, mutate: mutateUser } = useSWR(
    userId ? ['user-detail', userId] : null,
    async () => {
      const url = buildUrl(API_CONFIG.AUTH.USERS.DETAIL, { id: userId! }, 'auth');
      const response = await authClient.get(url);
      return response.data;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  // Fetch tenant data for tenant-level config
  const { data: tenantData, mutate: mutateTenant } = useSWR(
    tenantId ? ['tenant', tenantId] : null,
    () => tenantService.getTenant(tenantId!),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const config = useMemo<CrmLeadsFilterConfig>(() => {
    // User preferences take priority over tenant settings
    const userConfig = userData?.preferences?.crmLeadsFilterConfig;
    if (userConfig) return userConfig;

    const tenantConfig = tenantData?.settings?.crmLeadsFilterConfig;
    if (tenantConfig) return tenantConfig;

    return DEFAULT_FILTER_CONFIG;
  }, [userData, tenantData]);

  const saveForMe = async (newConfig: CrmLeadsFilterConfig) => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const url = buildUrl(API_CONFIG.AUTH.USERS.UPDATE, { id: userId }, 'auth');
      const currentPrefs = userData?.preferences || {};
      const response = await authClient.patch(url, {
        preferences: { ...currentPrefs, crmLeadsFilterConfig: newConfig },
      });
      await mutateUser(response.data, false);
      // Keep local storage in sync
      authService.updateUserPreferences({ crmLeadsFilterConfig: newConfig });
    } finally {
      setIsSaving(false);
    }
  };

  const saveForEveryone = async (newConfig: CrmLeadsFilterConfig) => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const currentSettings = tenantData?.settings || {};
      await tenantService.updateTenant(tenantId, {
        settings: { ...currentSettings, crmLeadsFilterConfig: newConfig },
      });
      await mutateTenant();
    } finally {
      setIsSaving(false);
    }
  };

  return { config, saveForMe, saveForEveryone, isSaving };
};
