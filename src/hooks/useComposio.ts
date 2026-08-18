// src/hooks/useComposio.ts
//
// SWR factory hook for the Composio module, matching the house style of
// `useIntegrations.ts`: reads return the raw SWR object, writes are plain async
// pass-throughs. Unlike the legacy hook, the write helpers here revalidate the
// affected key namespaces themselves — toolkit tiles and the connections list
// derive from the same server state, so leaving that to every caller would
// guarantee drift.
//
// react-query is deliberately NOT used (it belongs to the WhatsApp chat module).

import useSWR, { mutate as swrMutate } from 'swr';
import { composioService } from '@/services/composioService';
import type {
  ComposioAdminConnection,
  ComposioAdminConnectionsQueryParams,
  ComposioConnection,
  ComposioConnectionEvent,
  ComposioConnectionsQueryParams,
  ComposioInitiateRequest,
  ComposioStatusResponse,
  ComposioToolkit,
  ComposioToolkitsQueryParams,
  PaginatedResponse,
} from '@/types/composio.types';
import { isTerminalComposioStatus } from '@/types/composio.types';

// SWR key namespaces
const TOOLKITS_KEY = 'composio:toolkits';
const CONNECTIONS_KEY = 'composio:connections';
const ADMIN_CONNECTIONS_KEY = 'composio:admin-connections';

const READ_OPTIONS = { revalidateOnFocus: false, revalidateOnReconnect: false } as const;

/** How often a pending connection is re-checked while the user authorises. */
export const COMPOSIO_POLL_INTERVAL_MS = 2000;
/** Hard cap on polling: 30 attempts x 2s = 60s (plan §D.7 step 5). */
export const COMPOSIO_MAX_POLL_ATTEMPTS = 30;
export const COMPOSIO_POLL_TIMEOUT_MS = COMPOSIO_POLL_INTERVAL_MS * COMPOSIO_MAX_POLL_ATTEMPTS;

/**
 * Revalidate every SWR key under a namespace prefix.
 *
 * Swallows rejections on purpose: revalidation is a side effect of a mutation
 * that already succeeded, and the Composio endpoints may not exist yet on this
 * backend. A rejected `mutate` here would surface as an unhandled promise
 * rejection rather than anything a user could act on — the hooks already render
 * their own error state from `error`.
 */
const revalidatePrefix = (prefix: string) =>
  swrMutate((key) => key === prefix || (Array.isArray(key) && key[0] === prefix), undefined, {
    revalidate: true,
  }).catch(() => undefined);

/**
 * Revalidate everything that can change when a connection changes state.
 *
 * Module-level (not created per render) so consumers such as
 * `useComposioConnectFlow` can depend on a stable identity inside `useCallback`
 * and `setTimeout` closures.
 */
export const revalidateComposio = async (): Promise<void> => {
  await Promise.all([
    revalidatePrefix(CONNECTIONS_KEY),
    revalidatePrefix(TOOLKITS_KEY),
    revalidatePrefix(ADMIN_CONNECTIONS_KEY),
  ]);
};

export const useComposio = () => {
  // ==================== CATALOGUE ====================

  const useToolkits = (params?: ComposioToolkitsQueryParams) =>
    useSWR<PaginatedResponse<ComposioToolkit>>(
      params ? [TOOLKITS_KEY, params] : TOOLKITS_KEY,
      () => composioService.getToolkits(params),
      READ_OPTIONS
    );

  const useToolkit = (slug?: string) =>
    useSWR<ComposioToolkit>(
      slug ? [TOOLKITS_KEY, slug] : null,
      () => composioService.getToolkit(slug as string),
      READ_OPTIONS
    );

  // ==================== CONNECTIONS ====================

  const useConnections = (params?: ComposioConnectionsQueryParams) =>
    useSWR<PaginatedResponse<ComposioConnection>>(
      params ? [CONNECTIONS_KEY, params] : CONNECTIONS_KEY,
      () => composioService.getConnections(params),
      READ_OPTIONS
    );

  const useConnection = (publicId?: string) =>
    useSWR<ComposioConnection>(
      publicId ? [CONNECTIONS_KEY, publicId] : null,
      () => composioService.getConnection(publicId as string),
      READ_OPTIONS
    );

  /**
   * Poll a pending connection.
   *
   * `enabled` gates the fetch (a null key means SWR never fires), and the
   * refresh interval collapses to 0 the moment the status is terminal — so this
   * can never poll forever. The caller additionally enforces a wall-clock cap
   * (see `useComposioConnectFlow`) because a backend that keeps answering
   * INITIALIZING would otherwise keep the 2s interval alive indefinitely.
   */
  const useConnectionStatus = (publicId?: string, enabled = false) =>
    useSWR<ComposioStatusResponse>(
      publicId && enabled ? [CONNECTIONS_KEY, publicId, 'status'] : null,
      () => composioService.getConnectionStatus(publicId as string),
      {
        ...READ_OPTIONS,
        dedupingInterval: 0,
        shouldRetryOnError: false,
        refreshInterval: (latest?: ComposioStatusResponse) =>
          isTerminalComposioStatus(latest?.status) ? 0 : COMPOSIO_POLL_INTERVAL_MS,
      }
    );

  const useConnectionEvents = (publicId?: string, page?: number) =>
    useSWR<PaginatedResponse<ComposioConnectionEvent>>(
      publicId ? [CONNECTIONS_KEY, publicId, 'events', page ?? 1] : null,
      () => composioService.getConnectionEvents(publicId as string, page),
      READ_OPTIONS
    );

  // ==================== TENANT ADMIN ====================

  const useAdminConnections = (params?: ComposioAdminConnectionsQueryParams) =>
    useSWR<PaginatedResponse<ComposioAdminConnection>>(
      params ? [ADMIN_CONNECTIONS_KEY, params] : ADMIN_CONNECTIONS_KEY,
      () => composioService.getAdminConnections(params),
      READ_OPTIONS
    );

  // ==================== MUTATIONS ====================

  const initiateConnection = (data: ComposioInitiateRequest) =>
    composioService.initiateConnection(data);

  const refreshConnection = (publicId: string, returnTo?: string) =>
    composioService.refreshConnection(publicId, returnTo);

  const checkConnectionStatus = (publicId: string, force = true) =>
    composioService.getConnectionStatus(publicId, force);

  const disconnect = async (publicId: string) => {
    const result = await composioService.disconnect(publicId);
    await revalidateComposio();
    return result;
  };

  const enableConnection = async (publicId: string) => {
    const result = await composioService.enableConnection(publicId);
    await revalidateComposio();
    return result;
  };

  const disableConnection = async (publicId: string) => {
    const result = await composioService.disableConnection(publicId);
    await revalidateComposio();
    return result;
  };

  const revokeAdminConnection = async (publicId: string, reason?: string) => {
    const result = await composioService.revokeAdminConnection(publicId, reason);
    await revalidateComposio();
    return result;
  };

  const syncToolkits = async () => {
    const result = await composioService.syncToolkits();
    await revalidatePrefix(TOOLKITS_KEY);
    return result;
  };

  return {
    // reads
    useToolkits,
    useToolkit,
    useConnections,
    useConnection,
    useConnectionStatus,
    useConnectionEvents,
    useAdminConnections,
    // writes
    initiateConnection,
    refreshConnection,
    checkConnectionStatus,
    disconnect,
    enableConnection,
    disableConnection,
    revokeAdminConnection,
    syncToolkits,
    revalidateComposio,
  };
};

export default useComposio;
