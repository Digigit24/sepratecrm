// src/hooks/useTenant.ts
import { useState } from 'react';
import useSWR from 'swr';
import { tenantService } from '@/services/tenantService';
import type {
  Tenant,
  TenantListParams,
  PaginatedResponse,
  TenantUpdateData,
  TenantImage,
  TenantImageUpload
} from '@/types/tenant.types';

export const useTenant = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get tenants with SWR caching
  const useTenantsList = (params?: TenantListParams) => {
    const key = ['tenants', params];

    return useSWR<PaginatedResponse<Tenant>>(
      key,
      () => tenantService.getTenants(params),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch tenants:', err);
          setError(err.message || 'Failed to fetch tenants');
        }
      }
    );
  };

  // Get single tenant with SWR caching
  const useTenantDetail = (id: string | null) => {
    const key = id ? ['tenant', id] : null;

    return useSWR<Tenant>(
      key,
      () => tenantService.getTenant(id!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch tenant:', err);
          setError(err.message || 'Failed to fetch tenant');
        }
      }
    );
  };

  // Get current tenant
  const useCurrentTenant = () => {
    const key = 'current-tenant';

    return useSWR<Tenant>(
      key,
      () => tenantService.getCurrentTenant(),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch current tenant:', err);
          setError(err.message || 'Failed to fetch current tenant');
        }
      }
    );
  };

  // Get tenant images with SWR caching
  const useTenantImages = (tenantId: string | null) => {
    const key = tenantId ? ['tenant-images', tenantId] : null;

    return useSWR<TenantImage[]>(
      key,
      () => tenantService.getTenantImages(tenantId!),
      {
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        shouldRetryOnError: false,
        onError: (err) => {
          console.error('Failed to fetch tenant images:', err);
          setError(err.message || 'Failed to fetch tenant images');
        }
      }
    );
  };

  // Update tenant
  const updateTenant = async (id: string, data: TenantUpdateData): Promise<Tenant> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tenantService.updateTenant(id, data);
      setIsLoading(false);
      return result;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to update tenant');
      throw err;
    }
  };

  // Upload tenant image
  const uploadTenantImage = async (tenantId: string, imageData: TenantImageUpload): Promise<TenantImage> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tenantService.uploadTenantImage(tenantId, imageData);
      setIsLoading(false);
      return result;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to upload tenant image');
      throw err;
    }
  };

  // Delete tenant image
  const deleteTenantImage = async (tenantId: string, imageId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await tenantService.deleteTenantImage(tenantId, imageId);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Failed to delete tenant image');
      throw err;
    }
  };

  return {
    useTenantsList,
    useTenantDetail,
    useCurrentTenant,
    useTenantImages,
    updateTenant,
    uploadTenantImage,
    deleteTenantImage,
    isLoading,
    error,
  };
};
