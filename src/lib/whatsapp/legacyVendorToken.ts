// src/lib/whatsapp/legacyVendorToken.ts
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │  THE LAST PLACE IN THIS APP THAT TOUCHES THE WHATSAPP VENDOR API TOKEN.    │
// │  Do not read it anywhere else. Do not persist it. Delete this file as soon │
// │  as the last consumer below has a DigiCRM equivalent.                      │
// └───────────────────────────────────────────────────────────────────────────┘
//
// WHAT THIS TOKEN IS
// ------------------
// `whatsapp_api_token` is the Laravel gateway's `vendor_api_access_token`: a
// single, long-lived, tenant-wide bearer that grants FULL control of the
// tenant's WhatsApp Business account — read every conversation, send as the
// business, manage templates, launch campaigns. It has no per-user scope, no
// expiry, and no revocation path short of rotating it by hand.
//
// WHAT WAS WRONG BEFORE
// ---------------------
// It was fetched at login and written into `localStorage.celiyo_user`, where it
// sat forever. Any XSS anywhere in this SPA — one bad dependency, one unescaped
// render — was a full WhatsApp Business account takeover, silently, for every
// tenant. That was the single worst finding in the August 2026 gateway audit.
//
// WHAT CHANGED
// ------------
//   * The token is NEVER written to localStorage/sessionStorage/cookies again.
//     `authService` no longer fetches it at login. See the storage-write test in
//     src/lib/whatsapp/__tests__/legacyVendorToken.test.ts.
//   * Chat — history, send, templates-send, media, realtime — no longer uses it
//     at all. It goes through DigiCRM with the user's own JWT
//     (services/whatsappChatService.ts, services/whatsappRealtimeService.ts).
//   * What remains is held in MEMORY ONLY, for the life of the tab, fetched on
//     first use and dropped on logout. An XSS can still exfiltrate it while the
//     tab is open — that is strictly better than "forever, from disk", and it is
//     the reason the list below needs to reach zero.
//
// WHAT STILL NEEDS IT  (everything here is a direct-to-Laravel vendor route
// with no DigiCRM equivalent yet — each needs a proxy on the Django side)
// ----------------------------------------------------------------------------
//   * Contacts CRUD, import, labels, groups   services/whatsapp/contactsService,
//                                             groupsService
//   * Campaign CRUD + analytics               services/whatsapp/campaignsService
//   * Template CRUD + sync                    services/whatsapp/templatesService
//   * Bot flows / flow builder                services/whatsapp/botFlowService,
//                                             flowsService
//   * Scheduling / reminders                  services/schedulingService
//   * QR codes                                services/whatsapp/qrCodesService
//   * Inbox contact list + chat-context       services/externalWhatsappService
//
// Sending a message and reading a conversation — the operations that actually
// move customer data — are already off it. The remainder is administrative.

import { authClient } from '@/lib/client';
import { API_CONFIG } from '@/lib/apiConfig';

const USER_KEY = 'celiyo_user';

/**
 * In-memory only. Deliberately NOT localStorage, NOT sessionStorage, NOT a
 * cookie. Cleared on logout and on every full page load.
 */
let cachedToken: string | null = null;
let inflight: Promise<string | null> | null = null;

/** Has the token been fetched this session? Used by tests and diagnostics. */
export const hasLegacyVendorToken = (): boolean => cachedToken !== null;

/**
 * Synchronous read of the in-memory token. Returns null until
 * `getLegacyVendorToken()` has resolved at least once this session.
 */
export const peekLegacyVendorToken = (): string | null => cachedToken;

function readTenantId(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.tenant?.id ?? user?.tenant?.tenant_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the vendor token on demand, into memory.
 *
 * Concurrent callers share one request. A failure resolves to null rather than
 * throwing so a legacy call degrades into a clean 401 from Laravel instead of an
 * unhandled rejection in an axios interceptor.
 */
export async function getLegacyVendorToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (inflight) return inflight;

  const tenantId = readTenantId();
  if (!tenantId) return null;

  inflight = (async () => {
    try {
      const url = API_CONFIG.AUTH.TENANTS.DETAIL.replace(':id', String(tenantId));
      const response = await authClient.get(url, { suppressErrorToast: true });
      const settings = (response.data as Record<string, unknown> | undefined)?.settings as
        | Record<string, unknown>
        | undefined;
      const token = settings?.whatsapp_api_token;
      cachedToken = typeof token === 'string' && token !== '' ? token : null;
      return cachedToken;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Drop the in-memory token. MUST be called on logout and on tenant switch. */
export function clearLegacyVendorToken(): void {
  cachedToken = null;
  inflight = null;
}

/**
 * The Laravel vendor uid. Not a secret — it appears in every gateway URL — so
 * unlike the token it may stay in localStorage.
 */
export function getLegacyVendorUid(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return (
      user?.vendor_uid ??
      user?.tenant?.vendor_uid ??
      user?.tenant?.whatsapp_vendor_uid ??
      user?.tenant?.settings?.whatsapp_vendor_uid ??
      null
    );
  } catch {
    return null;
  }
}
