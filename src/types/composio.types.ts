// src/types/composio.types.ts
//
// Types for the Composio integration — third-party tool connections (Gmail,
// Notion, Google Drive, Google Calendar, ...) brokered by Composio's hosted
// auth. Contracts mirror `_plans/05-composio-integration.md` §C.1 / §D.4.
//
// The Composio API key is a SERVER-side secret. Nothing in this module — or
// anywhere else in the frontend — ever sees it. The browser only ever talks to
// our own Django API at /api/integrations/composio/*, which brokers Composio
// on our behalf and hands back a `redirect_url` for the hosted auth page.

/** Lifecycle of a connected account. Mirrors Composio's statuses plus our own PENDING/DELETED. */
export enum ComposioConnectionStatus {
  PENDING = 'PENDING',
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  DELETED = 'DELETED',
}

/** Who a connection belongs to: just me, or the whole workspace. */
export enum ComposioConnectionScope {
  USER = 'USER',
  TENANT = 'TENANT',
}

/** Statuses that end a connect flow — polling must stop when one is reached. */
export const COMPOSIO_TERMINAL_STATUSES: ComposioConnectionStatus[] = [
  ComposioConnectionStatus.ACTIVE,
  ComposioConnectionStatus.INACTIVE,
  ComposioConnectionStatus.FAILED,
  ComposioConnectionStatus.EXPIRED,
  ComposioConnectionStatus.REVOKED,
  ComposioConnectionStatus.DELETED,
];

export const isTerminalComposioStatus = (status?: ComposioConnectionStatus | string | null): boolean =>
  !!status && COMPOSIO_TERMINAL_STATUSES.includes(status as ComposioConnectionStatus);

/** Statuses a user can act on to get back to ACTIVE. */
export const isReconnectableComposioStatus = (status?: ComposioConnectionStatus | string | null): boolean =>
  status === ComposioConnectionStatus.EXPIRED ||
  status === ComposioConnectionStatus.REVOKED ||
  status === ComposioConnectionStatus.FAILED ||
  status === ComposioConnectionStatus.INACTIVE;

export interface ComposioToolkit {
  slug: string; // GMAIL | NOTION | GOOGLEDRIVE | GOOGLECALENDAR | …
  name: string;
  description?: string | null;
  logo_url?: string | null;
  categories?: string[] | null;
  auth_schemes?: string[] | null;
  composio_managed_auth_schemes?: string[] | null;
  no_auth?: boolean;
  tools_count?: number;
  triggers_count?: number;
  is_featured?: boolean;
  /** An auth config resolves for this tenant — i.e. Connect will actually work. */
  is_connectable?: boolean;
  /** The caller's live connection count for this toolkit. */
  connection_count?: number;
  /** The caller's most relevant connection, if any. */
  my_connection?: ComposioConnectionSummary | null;
}

export interface ComposioConnectionSummary {
  public_id: string;
  status: ComposioConnectionStatus;
  alias?: string | null;
  account_label?: string | null;
  connected_at?: string | null;
}

export interface ComposioConnection extends ComposioConnectionSummary {
  toolkit_slug: string;
  toolkit?: Pick<ComposioToolkit, 'slug' | 'name' | 'logo_url'> | null;
  scope: ComposioConnectionScope;
  granted_scopes?: string[] | null;
  expires_at?: string | null;
  last_used_at?: string | null;
  last_error?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Tenant-admin oversight row — same as a connection plus who owns it. */
export interface ComposioAdminConnection extends ComposioConnection {
  user_id?: string | null;
  created_by_user_id?: string | null;
  events_count?: number;
}

export interface ComposioConnectionEvent {
  public_id?: string;
  id?: number;
  event_type: string;
  message?: string | null;
  created_at: string;
}

export interface ComposioInitiateRequest {
  toolkit_slug: string;
  alias?: string;
  scope?: ComposioConnectionScope;
  /** Relative path the callback should bounce the browser back to. */
  return_to?: string;
}

export interface ComposioInitiateResponse {
  connection: ComposioConnection;
  /** Composio's hosted-auth page. Open it; never scrape it. */
  redirect_url: string;
  /** Opaque nonce that authenticates the callback. Echoed by the backend only. */
  state: string;
  /** ISO timestamp after which `redirect_url` stops working. */
  expires_at: string;
}

export interface ComposioStatusResponse {
  public_id: string;
  status: ComposioConnectionStatus;
  connected_at?: string | null;
  account_label?: string | null;
  last_error?: string | null;
  checked_at?: string;
}

export interface ComposioDisconnectResponse {
  message: string;
  connection: ComposioConnection;
}

/** DRF paginated envelope (redeclared per-domain, per house convention). */
export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface ComposioToolkitsQueryParams {
  search?: string;
  category?: string;
  connected?: boolean;
  page?: number;
  page_size?: number;
}

export interface ComposioConnectionsQueryParams {
  toolkit_slug?: string;
  status?: ComposioConnectionStatus;
  include_history?: boolean;
  page?: number;
  page_size?: number;
}

export interface ComposioAdminConnectionsQueryParams extends ComposioConnectionsQueryParams {
  user_id?: string;
  search?: string;
}

/** postMessage contract between the callback popup and the opener. */
export const COMPOSIO_MESSAGE_TYPE = 'COMPOSIO_CONNECT_RESULT' as const;

export type ComposioConnectResultStatus = 'connected' | 'pending' | 'error';

export interface ComposioConnectResultMessage {
  type: typeof COMPOSIO_MESSAGE_TYPE;
  status: ComposioConnectResultStatus;
  toolkit?: string;
  connection?: string; // public_id
  reason?: string;
}

/**
 * Query-param names the callback page forwards to the opener page when the
 * flow ran as a full-page redirect (popup blocked) instead of a popup.
 * Namespaced so they can't collide with the legacy `oauth_success`/`code` params
 * that Integrations.tsx already parses for the native Google Sheets flow.
 */
export const COMPOSIO_RESULT_PARAMS = {
  STATUS: 'composio_status',
  TOOLKIT: 'composio_toolkit',
  CONNECTION: 'composio_connection',
  REASON: 'composio_reason',
} as const;

/** Toolkits we surface first in the catalogue (plan §0.7.5). */
export const FEATURED_TOOLKIT_SLUGS = ['GMAIL', 'NOTION', 'GOOGLEDRIVE', 'GOOGLECALENDAR'] as const;

/** Display names for the featured toolkits, used before the catalogue loads. */
export const FEATURED_TOOLKIT_LABELS: Record<string, string> = {
  GMAIL: 'Gmail',
  NOTION: 'Notion',
  GOOGLEDRIVE: 'Google Drive',
  GOOGLECALENDAR: 'Google Calendar',
};

export const isFeaturedToolkit = (toolkit: Pick<ComposioToolkit, 'slug' | 'is_featured'>): boolean =>
  toolkit.is_featured === true ||
  (FEATURED_TOOLKIT_SLUGS as readonly string[]).includes((toolkit.slug || '').toUpperCase());
