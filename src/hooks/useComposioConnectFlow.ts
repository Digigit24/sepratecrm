// src/hooks/useComposioConnectFlow.ts
//
// The connect state machine for Composio hosted auth (plan §C.2 / §D.7).
//
//   idle → initiating → awaiting_user → polling → connected
//                            │             │
//                            └─────────────┴──────→ error
//
// Popup-first so the user's CRM state stays alive, with a full-page redirect
// fallback when the popup is blocked. Three independent things can end the
// flow, and all three are handled explicitly:
//
//   1. The callback page postMessages a result back to us (happy path, and the
//      path for a backend-detected failure such as `invalid_state`).
//   2. The user closes the auth window without finishing (OAuth cancellation).
//      A 300ms watchdog notices `popup.closed` and falls through to a SHORT
//      confirmation poll rather than hanging.
//   3. The link token's `expires_at` passes while the user is still on the
//      hosted page. A timer fires at exactly that moment and reports expiry.
//
// Polling is capped by a wall-clock deadline in addition to SWR stopping on a
// terminal status, so a backend stuck on INITIALIZING can never poll forever.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useComposio, revalidateComposio, COMPOSIO_POLL_TIMEOUT_MS } from '@/hooks/useComposio';
import {
  composioService,
  getComposioErrorMessage,
  isComposioForbidden,
  isComposioNotReady,
  isComposioUnconfigured,
} from '@/services/composioService';
import {
  COMPOSIO_MESSAGE_TYPE,
  ComposioConnectionScope,
  ComposioConnectionStatus,
  FEATURED_TOOLKIT_LABELS,
} from '@/types/composio.types';
import type { ComposioConnectResultMessage } from '@/types/composio.types';

export type ComposioConnectPhase =
  | 'idle'
  | 'initiating'
  | 'awaiting_user'
  | 'polling'
  | 'connected'
  | 'error';

/**
 * Grace period after the user closes the auth window without a result. Short on
 * purpose: a closed window usually means "cancelled", and making someone wait a
 * full minute to be told that is hostile. Long enough that a genuinely slow
 * callback still lands.
 */
const POPUP_CLOSED_GRACE_MS = 12_000;
/** Confirmation window after the callback already told us it succeeded. */
const CONFIRM_GRACE_MS = 20_000;
const WATCHDOG_INTERVAL_MS = 300;
const DEFAULT_RETURN_TO = '/integrations?tab=apps';

export interface ComposioConnectOptions {
  alias?: string;
  scope?: ComposioConnectionScope;
  /** Relative path the callback bounces back to when the popup was blocked. */
  returnTo?: string;
  /** Human-readable toolkit name, used in copy and toasts. */
  toolkitName?: string;
}

const toolkitLabel = (slug?: string | null, name?: string | null): string =>
  name || FEATURED_TOOLKIT_LABELS[(slug || '').toUpperCase()] || slug || 'this app';

/** Map a backend/Composio `reason` code onto copy a human can act on. */
export const describeComposioReason = (reason: string | null | undefined, toolkit: string): string => {
  switch ((reason || '').toLowerCase()) {
    case 'invalid_state':
    case 'state_expired':
    case 'state_consumed':
      return 'That connection link has expired or was already used. Please start again.';
    case 'link_expired':
    case 'expired':
      return `The link to connect ${toolkit} expired before it was used. Please try again.`;
    case 'auth_failed':
    case 'connection_failed':
      return `${toolkit} could not complete the sign-in. Please try again.`;
    case 'access_denied':
    case 'user_denied':
    case 'user_cancelled':
    case 'cancelled':
      return `You cancelled the sign-in before granting access to ${toolkit}.`;
    case 'permission_denied':
    case 'forbidden':
      return 'You do not have permission to connect apps. Ask a workspace administrator.';
    case 'not_configured':
      return 'Connected apps are not set up for this workspace yet.';
    case 'upstream_error':
    case 'provider_error':
      return `${toolkit} is not responding right now. Please try again in a few minutes.`;
    case 'timeout':
      return `We did not hear back from ${toolkit} in time. Check ${toolkit} and try again.`;
    default:
      return `We could not finish connecting ${toolkit}. Please try again.`;
  }
};

const reasonFromError = (error: unknown): string => {
  if (isComposioForbidden(error)) return 'permission_denied';
  if (isComposioUnconfigured(error)) return 'not_configured';
  if (isComposioNotReady(error)) return 'not_configured';
  return 'initiate_failed';
};

export const useComposioConnectFlow = () => {
  // Only the polling hook comes from useComposio(); the mutators are taken from
  // the service singleton so every callback below keeps a stable identity.
  const { useConnectionStatus } = useComposio();

  const [phase, setPhase] = useState<ComposioConnectPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [toolkitSlug, setToolkitSlug] = useState<string | null>(null);
  const [toolkitName, setToolkitName] = useState<string | null>(null);

  // Refs mirror the pieces of state the listeners/timers need, so the window
  // `message` listener can be registered exactly once for the hook's lifetime.
  const phaseRef = useRef<ComposioConnectPhase>('idle');
  const publicIdRef = useRef<string | null>(null);
  const toolkitNameRef = useRef<string>('this app');
  const popupRef = useRef<Window | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultReceivedRef = useRef(false);
  const optimisticRef = useRef(false);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── timers / window plumbing ──────────────────────────────────────────────

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const clearDeadline = useCallback(() => {
    if (deadlineRef.current) {
      clearTimeout(deadlineRef.current);
      deadlineRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearWatchdog();
    clearExpiryTimer();
    clearDeadline();
  }, [clearWatchdog, clearExpiryTimer, clearDeadline]);

  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    popupRef.current = null;
    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch {
        // Cross-origin close can throw in some browsers; nothing to do.
      }
    }
  }, []);

  // ── terminal transitions ──────────────────────────────────────────────────

  const succeed = useCallback(() => {
    if (!mountedRef.current) return;
    clearAllTimers();
    closePopup();
    setPhase('connected');
    setError(null);
    setReason(null);
    const label = toolkitNameRef.current;
    toast.success(`Connected to ${label}`, {
      description: `You can now use ${label} actions`,
      duration: 5000,
    });
    void revalidateComposio();
  }, [clearAllTimers, closePopup]);

  const fail = useCallback(
    (message: string, failReason: string | null = null, options?: { silent?: boolean }) => {
      if (!mountedRef.current) return;
      clearAllTimers();
      closePopup();
      setPhase('error');
      setError(message);
      setReason(failReason);
      if (!options?.silent) toast.error(message);
      // A FAILED / EXPIRED row may now exist server-side — surface it.
      void revalidateComposio();
    },
    [clearAllTimers, closePopup]
  );

  // ── polling ───────────────────────────────────────────────────────────────

  const beginPolling = useCallback(
    (opts: { graceMs: number; optimistic: boolean; cancelled: boolean }) => {
      if (!mountedRef.current) return;
      clearWatchdog();
      // The link has been used by now; its expiry no longer applies.
      clearExpiryTimer();
      clearDeadline();

      optimisticRef.current = opts.optimistic;
      cancelledRef.current = opts.cancelled;

      if (!publicIdRef.current) {
        // No connection id to poll (contract drift, or an initiate response that
        // omitted it). Trust the callback if it said we succeeded.
        if (opts.optimistic) succeed();
        else
          fail(
            describeComposioReason(opts.cancelled ? 'user_cancelled' : 'timeout', toolkitNameRef.current),
            opts.cancelled ? 'user_cancelled' : 'timeout'
          );
        return;
      }

      setPhase('polling');
      deadlineRef.current = setTimeout(() => {
        if (!mountedRef.current || phaseRef.current !== 'polling') return;
        if (optimisticRef.current) {
          // Our own backend already redirected with status=connected; the status
          // endpoint just did not confirm in time. Accept it.
          succeed();
          return;
        }
        if (cancelledRef.current) {
          fail(
            `The ${toolkitNameRef.current} sign-in window was closed before the connection finished.`,
            'user_cancelled'
          );
          return;
        }
        fail(describeComposioReason('timeout', toolkitNameRef.current), 'timeout');
      }, opts.graceMs);
    },
    [clearWatchdog, clearExpiryTimer, clearDeadline, succeed, fail]
  );

  const { data: statusData, error: statusError } = useConnectionStatus(
    publicId ?? undefined,
    phase === 'polling'
  );

  useEffect(() => {
    if (phase !== 'polling') return;

    if (statusData?.status) {
      switch (statusData.status) {
        case ComposioConnectionStatus.ACTIVE:
          succeed();
          return;
        case ComposioConnectionStatus.INACTIVE:
          fail(
            `${toolkitNameRef.current} was connected but is currently disabled. Enable it from My connections.`,
            'inactive'
          );
          return;
        case ComposioConnectionStatus.EXPIRED:
          fail(describeComposioReason('link_expired', toolkitNameRef.current), 'link_expired');
          return;
        case ComposioConnectionStatus.REVOKED:
          fail(`Access to ${toolkitNameRef.current} was revoked. Please connect again.`, 'revoked');
          return;
        case ComposioConnectionStatus.FAILED:
        case ComposioConnectionStatus.DELETED:
          fail(
            statusData.last_error || describeComposioReason('auth_failed', toolkitNameRef.current),
            'auth_failed'
          );
          return;
        default:
          // PENDING / INITIALIZING — keep polling until the deadline.
          return;
      }
    }

    if (statusError) {
      // The status endpoint is missing or the workspace is not configured:
      // there is nothing to wait for, so stop immediately instead of burning
      // the full deadline against a 404.
      if (isComposioNotReady(statusError)) {
        if (optimisticRef.current) succeed();
        else
          fail(
            getComposioErrorMessage(statusError, 'Connected apps are not available yet.'),
            'not_configured',
            { silent: true }
          );
        return;
      }
      if (isComposioForbidden(statusError)) {
        fail(describeComposioReason('permission_denied', toolkitNameRef.current), 'permission_denied');
      }
      // Any other error: transient — the interval will retry until the deadline.
    }
  }, [phase, statusData, statusError, succeed, fail]);

  // ── link expiry ───────────────────────────────────────────────────────────

  const scheduleExpiry = useCallback(
    (isoExpiry?: string | null) => {
      clearExpiryTimer();
      if (!isoExpiry) return;
      const ms = new Date(isoExpiry).getTime() - Date.now();
      if (!Number.isFinite(ms)) return;

      const expire = () => {
        // Only meaningful while the user is still on the hosted page. Once we
        // are polling, the link has already been consumed.
        if (!mountedRef.current || phaseRef.current !== 'awaiting_user') return;
        fail(describeComposioReason('link_expired', toolkitNameRef.current), 'link_expired');
      };

      if (ms <= 0) {
        expire();
        return;
      }
      expiryTimerRef.current = setTimeout(expire, ms);
    },
    [clearExpiryTimer, fail]
  );

  // ── auth window ───────────────────────────────────────────────────────────

  const startWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = setInterval(() => {
      const popup = popupRef.current;
      if (!popup) return;
      if (!popup.closed) return;
      clearWatchdog();
      popupRef.current = null;
      if (resultReceivedRef.current) return;
      if (phaseRef.current !== 'awaiting_user') return;
      // Closed without a result: most likely cancelled. Confirm briefly.
      beginPolling({ graceMs: POPUP_CLOSED_GRACE_MS, optimistic: false, cancelled: true });
    }, WATCHDOG_INTERVAL_MS);
  }, [clearWatchdog, beginPolling]);

  const openAuthWindow = useCallback(
    (url: string, isoExpiry?: string | null) => {
      let popup: Window | null = null;
      try {
        popup = window.open(url, 'composio_connect', 'width=520,height=720,noopener=no');
      } catch {
        popup = null;
      }

      if (!popup || popup.closed) {
        // Popup blocker (or mobile Safari). Fall back to a full-page redirect;
        // the callback page will bounce the browser back to `returnTo` with the
        // result encoded in the query string.
        toast.info('Popup blocked — continuing in this tab');
        window.location.href = url;
        return;
      }

      popupRef.current = popup;
      try {
        popup.focus();
      } catch {
        // Focus is best-effort.
      }
      setPhase('awaiting_user');
      startWatchdog();
      scheduleExpiry(isoExpiry);
    },
    [startWatchdog, scheduleExpiry]
  );

  // ── postMessage from the callback page ────────────────────────────────────

  const handleResult = useCallback(
    (message: ComposioConnectResultMessage) => {
      resultReceivedRef.current = true;
      clearWatchdog();
      clearExpiryTimer();
      closePopup();

      if (message.connection) {
        publicIdRef.current = message.connection;
        setPublicId(message.connection);
      }

      if (message.status === 'error') {
        const description = describeComposioReason(message.reason, toolkitNameRef.current);
        fail(description, message.reason ?? 'unknown');
        return;
      }

      // 'connected' and 'pending' both go through the status endpoint — our own
      // backend is the source of truth, not a query parameter.
      beginPolling({
        graceMs: message.status === 'connected' ? CONFIRM_GRACE_MS : COMPOSIO_POLL_TIMEOUT_MS,
        optimistic: message.status === 'connected',
        cancelled: false,
      });
    },
    [clearWatchdog, clearExpiryTimer, closePopup, fail, beginPolling]
  );

  const handleResultRef = useRef(handleResult);
  useEffect(() => {
    handleResultRef.current = handleResult;
  }, [handleResult]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Only ever trust our own origin — the callback page is served by us.
      if (event.origin !== window.location.origin) return;
      const data = event.data as ComposioConnectResultMessage | undefined;
      if (!data || data.type !== COMPOSIO_MESSAGE_TYPE) return;
      if (phaseRef.current !== 'awaiting_user' && phaseRef.current !== 'initiating') return;
      handleResultRef.current(data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  // ── unmount cleanup ───────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
      closePopup();
    };
  }, [clearAllTimers, closePopup]);

  // ── public API ────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    clearAllTimers();
    closePopup();
    resultReceivedRef.current = false;
    optimisticRef.current = false;
    cancelledRef.current = false;
    publicIdRef.current = null;
    setPhase('idle');
    setError(null);
    setReason(null);
    setPublicId(null);
    setRedirectUrl(null);
    setExpiresAt(null);
  }, [clearAllTimers, closePopup]);

  /** Abort an in-flight flow (the dialog's Cancel button). */
  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const beginFlow = useCallback(
    async (
      label: string,
      slug: string | null,
      request: () => Promise<{ connection?: { public_id?: string }; redirect_url: string; expires_at?: string }>
    ) => {
      clearAllTimers();
      closePopup();
      resultReceivedRef.current = false;
      optimisticRef.current = false;
      cancelledRef.current = false;
      publicIdRef.current = null;

      toolkitNameRef.current = label;
      setToolkitName(label);
      setToolkitSlug(slug);
      setPublicId(null);
      setRedirectUrl(null);
      setExpiresAt(null);
      setError(null);
      setReason(null);
      setPhase('initiating');

      try {
        const result = await request();
        if (!mountedRef.current) return;

        const id = result.connection?.public_id ?? null;
        publicIdRef.current = id;
        setPublicId(id);
        setRedirectUrl(result.redirect_url);
        setExpiresAt(result.expires_at ?? null);

        openAuthWindow(result.redirect_url, result.expires_at);
      } catch (err) {
        if (!mountedRef.current) return;
        fail(getComposioErrorMessage(err, `Could not start connecting ${label}`), reasonFromError(err), {
          // 403/424/404 already produce their own toast or a calm inline state.
          silent: isComposioNotReady(err),
        });
      }
    },
    [clearAllTimers, closePopup, openAuthWindow, fail]
  );

  /** Start a brand-new connection for a toolkit. */
  const connect = useCallback(
    async (slug: string, options?: ComposioConnectOptions) => {
      const label = toolkitLabel(slug, options?.toolkitName);
      await beginFlow(label, slug, () =>
        composioService.initiateConnection({
          toolkit_slug: slug,
          alias: options?.alias?.trim() || undefined,
          scope: options?.scope,
          return_to: options?.returnTo || DEFAULT_RETURN_TO,
        })
      );
    },
    [beginFlow]
  );

  /** Re-authorise an existing connection that expired, failed or was revoked. */
  const reconnect = useCallback(
    async (connectionPublicId: string, options?: ComposioConnectOptions & { toolkitSlug?: string }) => {
      const label = toolkitLabel(options?.toolkitSlug, options?.toolkitName);
      await beginFlow(label, options?.toolkitSlug ?? null, async () => {
        const result = await composioService.refreshConnection(
          connectionPublicId,
          options?.returnTo || DEFAULT_RETURN_TO
        );
        return {
          connection: result.connection ?? { public_id: connectionPublicId },
          redirect_url: result.redirect_url,
          expires_at: result.expires_at,
        };
      });
    },
    [beginFlow]
  );

  /** Re-open the auth window after the user accidentally closed or lost it. */
  const reopen = useCallback(() => {
    if (!redirectUrl) return;
    resultReceivedRef.current = false;
    openAuthWindow(redirectUrl, expiresAt);
  }, [redirectUrl, expiresAt, openAuthWindow]);

  return {
    phase,
    error,
    reason,
    publicId,
    redirectUrl,
    expiresAt,
    toolkitSlug,
    toolkitName,
    /** True while anything is in flight — use it to disable action buttons. */
    isBusy: phase === 'initiating' || phase === 'awaiting_user' || phase === 'polling',
    connect,
    reconnect,
    reopen,
    cancel,
    reset,
  };
};

export default useComposioConnectFlow;
