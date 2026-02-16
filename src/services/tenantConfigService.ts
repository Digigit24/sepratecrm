// src/services/tenantConfigService.ts
import { whatsappClient } from '@/lib/whatsappClient';
import { API_CONFIG } from '@/lib/apiConfig';
import {
  TenantConfigCreate,
  TenantConfigUpdate,
  TenantConfigResponse,
  TenantConfigFullResponse,
  WhatsAppOnboardingRequest,
  WhatsAppOnboardingResponse,
} from '@/types/tenantConfig';

const USER_KEY = 'celiyo_user';

// Helper function to get tenant ID from localStorage
const getTenantId = (): string | null => {
  try {
    const userJson = localStorage.getItem(USER_KEY);
    if (userJson) {
      const user = JSON.parse(userJson);
      const tenant = user?.tenant;
      return tenant?.id || tenant?.tenant_id || null;
    }
  } catch (error) {
    console.error('Failed to get tenant ID:', error);
  }
  return null;
};

/**
 * Onboard WhatsApp Business API via OAuth
 */
export const onboardWhatsAppClient = async (
  request: WhatsAppOnboardingRequest
): Promise<WhatsAppOnboardingResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Onboarding WhatsApp client:', {
    waba_id: request.waba_id,
    phone_number_id: request.phone_number_id,
    tenant_id: tenantId,
  });

  const response = await whatsappClient.post<WhatsAppOnboardingResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.ONBOARD_WHATSAPP,
    {
      ...request,
      tenant_id: tenantId, // Include tenant_id in the payload
    }
  );

  console.log('✅ WhatsApp onboarding successful:', response.data);
  return response.data;
};

/**
 * Get tenant configuration (masked sensitive data)
 */
export const getTenantConfig = async (): Promise<TenantConfigResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Fetching tenant config for tenant:', tenantId);

  const response = await whatsappClient.get<TenantConfigResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.CONFIG
  );

  console.log('✅ Tenant config fetched:', response.data);
  return response.data;
};

/**
 * Get full tenant configuration including sensitive data (admin only)
 */
export const getTenantConfigFull = async (): Promise<TenantConfigFullResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Fetching full tenant config for tenant:', tenantId);

  const response = await whatsappClient.get<TenantConfigFullResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.CONFIG_FULL
  );

  console.log('✅ Full tenant config fetched');
  return response.data;
};

/**
 * Create a new tenant configuration manually
 */
export const createTenantConfig = async (
  configData: TenantConfigCreate
): Promise<TenantConfigResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Creating tenant config:', {
    tenant_id: tenantId,
    waba_id: configData.waba_id,
  });

  const response = await whatsappClient.post<TenantConfigResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.CONFIG,
    {
      ...configData,
      tenant_id: tenantId, // Include tenant_id in the payload
    }
  );

  console.log('✅ Tenant config created:', response.data);
  return response.data;
};

/**
 * Update tenant configuration
 */
export const updateTenantConfig = async (
  configUpdate: TenantConfigUpdate
): Promise<TenantConfigResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Updating tenant config:', {
    tenant_id: tenantId,
    updates: Object.keys(configUpdate),
  });

  const response = await whatsappClient.put<TenantConfigResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.CONFIG,
    {
      ...configUpdate,
      tenant_id: tenantId, // Include tenant_id in the payload
    }
  );

  console.log('✅ Tenant config updated:', response.data);
  return response.data;
};

/**
 * Delete tenant configuration
 */
export const deleteTenantConfig = async (): Promise<void> => {
  const tenantId = getTenantId();

  console.log('📤 Deleting tenant config for tenant:', tenantId);

  await whatsappClient.delete(API_CONFIG.WHATSAPP.TENANT_CONFIG.CONFIG);

  console.log('✅ Tenant config deleted');
};

/**
 * Deactivate tenant configuration
 */
export const deactivateTenantConfig = async (): Promise<TenantConfigResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Deactivating tenant config for tenant:', tenantId);

  const response = await whatsappClient.post<TenantConfigResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.DEACTIVATE
  );

  console.log('✅ Tenant config deactivated');
  return response.data;
};

/**
 * Activate tenant configuration
 */
export const activateTenantConfig = async (): Promise<TenantConfigResponse> => {
  const tenantId = getTenantId();

  console.log('📤 Activating tenant config for tenant:', tenantId);

  const response = await whatsappClient.post<TenantConfigResponse>(
    API_CONFIG.WHATSAPP.TENANT_CONFIG.ACTIVATE
  );

  console.log('✅ Tenant config activated');
  return response.data;
};
