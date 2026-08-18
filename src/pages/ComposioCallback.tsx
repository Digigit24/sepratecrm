// src/pages/ComposioCallback.tsx
//
// Landing page for Composio's hosted-auth redirect (plan §D.8).
//
// It deliberately does NO data fetching and is NOT permission-gated: it may
// render in a fresh popup, or after a full-page redirect, before the SPA has
// finished hydrating. Its only job is to relay the result to whoever started
// the flow and get out of the way.
//
//   popup    → postMessage to window.opener, then close.
//   redirect → navigate back to `return_to` with the result in the query string,
//              where Integrations.tsx picks it up and toasts.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  COMPOSIO_MESSAGE_TYPE,
  COMPOSIO_RESULT_PARAMS,
} from '@/types/composio.types';
import type {
  ComposioConnectResultMessage,
  ComposioConnectResultStatus,
} from '@/types/composio.types';

const FALLBACK_RETURN_TO = '/integrations?tab=apps';

/**
 * Open-redirect guard. `return_to` arrives from a query string, so it must be a
 * relative, same-origin path. Anything else (absolute URL, protocol-relative
 * `//evil.com`, backslash tricks) falls back to the integrations page.
 */
const sanitizeReturnTo = (value: string | null): string => {
  if (!value) return FALLBACK_RETURN_TO;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return FALLBACK_RETURN_TO;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return FALLBACK_RETURN_TO;
  return trimmed;
};

const normalizeStatus = (value: string | null): ComposioConnectResultStatus => {
  if (value === 'connected' || value === 'pending' || value === 'error') return value;
  return 'error';
};

/** Append the composio result params to the (already sanitized) return path. */
const buildReturnUrl = (
  returnTo: string,
  result: { status: string; toolkit?: string | null; connection?: string | null; reason?: string | null }
): string => {
  const [path, existingQuery] = returnTo.split('?');
  const params = new URLSearchParams(existingQuery || '');
  params.set(COMPOSIO_RESULT_PARAMS.STATUS, result.status);
  if (result.toolkit) params.set(COMPOSIO_RESULT_PARAMS.TOOLKIT, result.toolkit);
  if (result.connection) params.set(COMPOSIO_RESULT_PARAMS.CONNECTION, result.connection);
  if (result.reason) params.set(COMPOSIO_RESULT_PARAMS.REASON, result.reason);
  return `${path}?${params.toString()}`;
};

export const ComposioCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const status = normalizeStatus(searchParams.get('status'));
    const toolkit = searchParams.get('toolkit');
    const connection = searchParams.get('connection');
    const reason = searchParams.get('reason');
    const returnTo = sanitizeReturnTo(searchParams.get('return_to'));

    const message: ComposioConnectResultMessage = {
      type: COMPOSIO_MESSAGE_TYPE,
      status,
      toolkit: toolkit ?? undefined,
      connection: connection ?? undefined,
      reason: reason ?? undefined,
    };

    const isPopup = (() => {
      try {
        return !!window.opener && window.opener !== window;
      } catch {
        return false;
      }
    })();

    if (isPopup) {
      try {
        // Target origin is pinned: the opener is our own SPA on this origin.
        window.opener.postMessage(message, window.location.origin);
      } catch {
        // Opener gone or cross-origin — fall through to the navigate path.
      }
      try {
        window.close();
      } catch {
        // Some browsers refuse window.close() for windows they did not open.
      }
      // If the window is still here shortly after, the close was blocked; show
      // a usable page instead of an eternal spinner.
      const timer = setTimeout(() => {
        if (!window.closed) setStuck(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    navigate(buildReturnUrl(returnTo, { status, toolkit, connection, reason }), { replace: true });
    return undefined;
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        {stuck ? (
          <>
            <p className="text-sm font-medium">All done</p>
            <p className="text-xs text-muted-foreground">You can close this window.</p>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Finishing connection…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ComposioCallback;
