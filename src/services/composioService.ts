// src/services/composioService.ts
//
// Axios singleton over the Composio endpoints of our own Django API
// (`/api/integrations/composio/*`, plan §C.1). Matches the house service style
// of `integrationService.ts`: one class, one exported instance, every method
// normalising errors before they reach SWR.
//
// SECURITY: the Composio API key never appears here. It is a server-side secret
// held by Django (plan §E.1). The only Composio-owned URL the browser ever
// touches is the `redirect_url` returned by our own initiate endpoint, which we
// hand straight to `window.open` / `window.location`.

import axios from 'axios';
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  ComposioAdminConnection,
  ComposioAdminConnectionsQueryParams,
  ComposioConnection,
  ComposioConnectionEvent,
  ComposioConnectionsQueryParams,
  ComposioDisconnectResponse,
  ComposioInitiateRequest,
  ComposioInitiateResponse,
  ComposioStatusResponse,
  ComposioToolkit,
  ComposioToolkitsQueryParams,
  PaginatedResponse,
} from '@/types/composio.types';

const C = API_CONFIG.CRM.COMPOSIO;

type QueryRecord = Record<string, string | number | boolean | undefined>;

interface ApiErrorBody {
  error?: string;
  message?: string;
  detail?: string;
  non_field_errors?: string[];
}

/**
 * Error thrown by every method on this service. Unlike the plain `Error` the
 * legacy `integrationService` throws, this keeps the HTTP status so callers can
 * distinguish "Composio isn't set up for this workspace" (424) and "this build
 * of the backend doesn't have the endpoints yet" (404/501) from a real failure.
 */
export class ComposioApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ComposioApiError';
    this.status = status;
  }
}

const getStatus = (error: unknown): number | undefined => {
  if (error instanceof ComposioApiError) return error.status;
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
};

/** Normalise anything thrown by axios into a `ComposioApiError`. */
const toComposioError = (error: unknown, fallback: string): ComposioApiError => {
  if (error instanceof ComposioApiError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as ApiErrorBody | string | undefined;

    // Django's HTML 404/500 pages come back as strings — never surface raw HTML.
    const parsed = typeof body === 'string' ? undefined : body;
    const detail =
      parsed?.error || parsed?.message || parsed?.detail || parsed?.non_field_errors?.[0];

    if (status === 424) {
      return new ComposioApiError(
        detail || 'Connected apps are not set up for this workspace yet.',
        status
      );
    }
    if (status === 404 || status === 501) {
      return new ComposioApiError(detail || 'Connected apps are not available yet.', status);
    }
    if (status === 403) {
      return new ComposioApiError(detail || 'You do not have permission to do that.', status);
    }
    if (status === 429) {
      return new ComposioApiError(detail || 'Too many requests — please wait a moment.', status);
    }
    if (!error.response) {
      return new ComposioApiError('Network error — check your connection and try again.');
    }
    return new ComposioApiError(detail || fallback, status);
  }

  if (error instanceof Error) return new ComposioApiError(error.message || fallback);
  return new ComposioApiError(fallback);
};

/**
 * Composio is optional infrastructure: 424 means "not configured", not "broken".
 * Rendered as a calm `Alert`, not a red error (plan §D.9).
 */
export const isComposioUnconfigured = (error: unknown): boolean => getStatus(error) === 424;

/**
 * The endpoints are not deployed on this backend yet. The Django side is built
 * in parallel with this UI, so a 404/501 must degrade to the same calm "not set
 * up yet" surface rather than a scary failure.
 */
export const isComposioUnavailable = (error: unknown): boolean => {
  const status = getStatus(error);
  return status === 404 || status === 501 || status === 502 || status === 503;
};

/** The caller lacks the RBAC permission for this endpoint. */
export const isComposioForbidden = (error: unknown): boolean => getStatus(error) === 403;

/** True when the failure should be shown as informational rather than an error. */
export const isComposioNotReady = (error: unknown): boolean =>
  isComposioUnconfigured(error) || isComposioUnavailable(error);

export const getComposioErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

/**
 * Some endpoints are paginated by DRF and some (early backend builds, `sync`
 * results) return bare arrays. Normalise so callers always get one envelope.
 */
export const normalizePage = <T>(data: T[] | PaginatedResponse<T> | null | undefined): PaginatedResponse<T> => {
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    count: typeof data?.count === 'number' ? data.count : results.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
    results,
  };
};

const withPublicId = (template: string, publicId: string): string =>
  template.replace(':public_id', encodeURIComponent(publicId));

class ComposioService {
  // ==================== CATALOGUE ====================

  /** Browse the Composio toolkit catalogue (Gmail, Notion, Drive, Calendar, …). */
  async getToolkits(params?: ComposioToolkitsQueryParams): Promise<PaginatedResponse<ComposioToolkit>> {
    try {
      const query: QueryRecord = {
        search: params?.search,
        category: params?.category,
        connected: params?.connected,
        page: params?.page,
        page_size: params?.page_size,
      };
      const response = await crmClient.get<PaginatedResponse<ComposioToolkit> | ComposioToolkit[]>(
        `${C.TOOLKITS}${buildQueryString(query)}`
      );
      return normalizePage(response.data);
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch apps');
    }
  }

  async getToolkit(slug: string): Promise<ComposioToolkit> {
    try {
      const response = await crmClient.get<ComposioToolkit>(
        C.TOOLKIT_DETAIL.replace(':slug', encodeURIComponent(slug))
      );
      return response.data;
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch app details');
    }
  }

  /** Admin-only: refresh the cached catalogue from Composio. */
  async syncToolkits(): Promise<{ synced?: number; message?: string }> {
    try {
      const response = await crmClient.post<{ synced?: number; message?: string }>(C.TOOLKITS_SYNC, {});
      return response.data ?? {};
    } catch (error) {
      throw toComposioError(error, 'Failed to refresh the app catalogue');
    }
  }

  // ==================== CONNECTIONS ====================

  async getConnections(
    params?: ComposioConnectionsQueryParams
  ): Promise<PaginatedResponse<ComposioConnection>> {
    try {
      const query: QueryRecord = {
        toolkit_slug: params?.toolkit_slug,
        status: params?.status,
        include_history: params?.include_history,
        page: params?.page,
        page_size: params?.page_size,
      };
      const response = await crmClient.get<PaginatedResponse<ComposioConnection> | ComposioConnection[]>(
        `${C.CONNECTIONS}${buildQueryString(query)}`
      );
      return normalizePage(response.data);
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch connections');
    }
  }

  async getConnection(publicId: string): Promise<ComposioConnection> {
    try {
      const response = await crmClient.get<ComposioConnection>(
        withPublicId(C.CONNECTION_DETAIL, publicId)
      );
      return response.data;
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch connection');
    }
  }

  /**
   * Start hosted auth. Returns the Composio `redirect_url` to open plus the
   * `expires_at` that bounds how long that URL stays valid (plan §C.2).
   */
  async initiateConnection(data: ComposioInitiateRequest): Promise<ComposioInitiateResponse> {
    try {
      const response = await crmClient.post<ComposioInitiateResponse>(C.INITIATE, data);
      if (!response.data?.redirect_url) {
        throw new ComposioApiError('The server did not return an authorization link.');
      }
      return response.data;
    } catch (error) {
      throw toComposioError(error, 'Failed to start connection');
    }
  }

  /** Poll a pending connection. `force` bypasses the backend's 10s status cache. */
  async getConnectionStatus(publicId: string, force = false): Promise<ComposioStatusResponse> {
    try {
      const url = withPublicId(C.STATUS, publicId) + (force ? '?force=true' : '');
      const response = await crmClient.get<ComposioStatusResponse>(url);
      return response.data;
    } catch (error) {
      throw toComposioError(error, 'Failed to check connection status');
    }
  }

  /** Re-authorise an expired/revoked connection. Same response shape as initiate. */
  async refreshConnection(publicId: string, returnTo?: string): Promise<ComposioInitiateResponse> {
    try {
      const response = await crmClient.post<ComposioInitiateResponse>(
        withPublicId(C.REFRESH, publicId),
        returnTo ? { return_to: returnTo } : {}
      );
      if (!response.data?.redirect_url) {
        throw new ComposioApiError('The server did not return an authorization link.');
      }
      return response.data;
    } catch (error) {
      throw toComposioError(error, 'Failed to start re-authorization');
    }
  }

  async enableConnection(publicId: string): Promise<{ status?: string; connection?: ComposioConnection }> {
    try {
      const response = await crmClient.post(withPublicId(C.ENABLE, publicId), {});
      return response.data ?? {};
    } catch (error) {
      throw toComposioError(error, 'Failed to enable connection');
    }
  }

  async disableConnection(publicId: string): Promise<{ status?: string; connection?: ComposioConnection }> {
    try {
      const response = await crmClient.post(withPublicId(C.DISABLE, publicId), {});
      return response.data ?? {};
    } catch (error) {
      throw toComposioError(error, 'Failed to disable connection');
    }
  }

  async disconnect(publicId: string): Promise<ComposioDisconnectResponse> {
    try {
      const response = await crmClient.post<ComposioDisconnectResponse>(
        withPublicId(C.DISCONNECT, publicId),
        {}
      );
      return response.data ?? { message: 'Disconnected', connection: null as unknown as ComposioConnection };
    } catch (error) {
      throw toComposioError(error, 'Failed to disconnect');
    }
  }

  async getConnectionEvents(
    publicId: string,
    page?: number
  ): Promise<PaginatedResponse<ComposioConnectionEvent>> {
    try {
      const query: QueryRecord = { page };
      const response = await crmClient.get<
        PaginatedResponse<ComposioConnectionEvent> | ComposioConnectionEvent[]
      >(`${withPublicId(C.EVENTS, publicId)}${buildQueryString(query)}`);
      return normalizePage(response.data);
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch connection history');
    }
  }

  // ==================== TENANT ADMIN ====================

  async getAdminConnections(
    params?: ComposioAdminConnectionsQueryParams
  ): Promise<PaginatedResponse<ComposioAdminConnection>> {
    try {
      const query: QueryRecord = {
        user_id: params?.user_id,
        toolkit_slug: params?.toolkit_slug,
        status: params?.status,
        search: params?.search,
        page: params?.page,
        page_size: params?.page_size,
      };
      const response = await crmClient.get<
        PaginatedResponse<ComposioAdminConnection> | ComposioAdminConnection[]
      >(`${C.ADMIN_CONNECTIONS}${buildQueryString(query)}`);
      return normalizePage(response.data);
    } catch (error) {
      throw toComposioError(error, 'Failed to fetch workspace connections');
    }
  }

  async revokeAdminConnection(
    publicId: string,
    reason?: string
  ): Promise<{ message?: string; connection?: ComposioAdminConnection }> {
    try {
      const response = await crmClient.post(
        withPublicId(C.ADMIN_REVOKE, publicId),
        reason ? { reason } : {}
      );
      return response.data ?? {};
    } catch (error) {
      throw toComposioError(error, 'Failed to revoke connection');
    }
  }
}

export const composioService = new ComposioService();
