// src/services/tenantService.ts
import { authClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import {
  Tenant,
  TenantListParams,
  PaginatedResponse,
  TenantUpdateData,
  TenantImage,
  TenantImageUpload
} from '@/types/tenant.types';

/**
 * Tenant Service
 *
 * Service for managing tenant data and configuration
 */
class TenantService {
  // Get tenants with optional query parameters
  async getTenants(params?: TenantListParams): Promise<PaginatedResponse<Tenant>> {
    try {
      const queryString = buildQueryString(params);
      const response = await authClient.get<PaginatedResponse<Tenant>>(
        `${API_CONFIG.AUTH.TENANTS.LIST}${queryString}`
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch tenants';
      throw new Error(message);
    }
  }

  // Get single tenant by ID
  async getTenant(id: string): Promise<Tenant> {
    try {
      const response = await authClient.get<Tenant>(
        API_CONFIG.AUTH.TENANTS.DETAIL.replace(':id', id)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch tenant';
      throw new Error(message);
    }
  }

  // Update tenant
  async updateTenant(id: string, data: TenantUpdateData): Promise<Tenant> {
    try {
      const response = await authClient.patch<Tenant>(
        API_CONFIG.AUTH.TENANTS.UPDATE.replace(':id', id),
        data
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to update tenant';
      throw new Error(message);
    }
  }

  // Get current tenant (if API endpoint exists)
  async getCurrentTenant(): Promise<Tenant> {
    try {
      // Assuming there's a /tenants/me/ endpoint or similar
      // If not, you'll need to get the tenant ID from the user's context
      const response = await authClient.get<Tenant>(
        '/tenants/me/'
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch current tenant';
      throw new Error(message);
    }
  }

  // Get tenant images
  async getTenantImages(tenantId: string): Promise<TenantImage[]> {
    try {
      const response = await authClient.get<TenantImage[]>(
        API_CONFIG.AUTH.TENANTS.IMAGES.LIST.replace(':tenant_id', tenantId)
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to fetch tenant images';
      throw new Error(message);
    }
  }

  // Upload tenant image
  async uploadTenantImage(tenantId: string, imageData: TenantImageUpload): Promise<TenantImage> {
    try {
      const formData = new FormData();
      formData.append('image', imageData.image);
      formData.append('label', imageData.label);
      if (imageData.description) {
        formData.append('description', imageData.description);
      }
      if (imageData.order !== undefined) {
        formData.append('order', imageData.order.toString());
      }

      const response = await authClient.post<TenantImage>(
        API_CONFIG.AUTH.TENANTS.IMAGES.CREATE.replace(':tenant_id', tenantId),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to upload tenant image';
      throw new Error(message);
    }
  }

  // Delete tenant image
  async deleteTenantImage(tenantId: string, imageId: string): Promise<void> {
    try {
      await authClient.delete(
        API_CONFIG.AUTH.TENANTS.IMAGES.DELETE
          .replace(':tenant_id', tenantId)
          .replace(':id', imageId)
      );
    } catch (error: any) {
      const message = error.response?.data?.error ||
                     error.response?.data?.message ||
                     'Failed to delete tenant image';
      throw new Error(message);
    }
  }
}

export const tenantService = new TenantService();
