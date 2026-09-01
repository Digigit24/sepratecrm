// src/pages/TelephonyEmbed.tsx
//
// SPIKE (Option B — WebView bridge, see
// _plans/09-flutter-voip-webview-bridge-spike.md). Isolated, chrome-free
// route rendering ONLY <TelephonyProvider><Softphone/></TelephonyProvider> —
// no sidebar, no header, nothing else — so a mobile WebView can load just
// the softphone, not the whole SPA shell.
//
// Auth: NOT a new mechanism. The Flutter app already holds a valid bearer
// token (crmDioProvider) and the user/tenant object it deserialized from the
// same login response sepratecrm itself stores under `celiyo_user`. Both
// arrive here as query params — `token` (raw) and `u` (the user object,
// JSON + base64, since it contains nested objects) — written directly into
// the same localStorage keys `src/lib/client.ts`'s axios interceptors and
// `authService` already read on every other page. No TeleCMI password, no
// new secret: same short-lived session token used everywhere else in the
// app.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { tokenManager } from '@/lib/client';
import { authService } from '@/services/authService';
import { TelephonyProvider, useTelephonyPhone } from '@/context/TelephonyProvider';
import { Softphone } from '@/components/telephony/Softphone';
import type { User } from '@/types/authTypes';

type InitState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

/** utf-8-safe base64 decode — `atob` alone mangles anything outside Latin-1
 * (tenant/user names, etc.), which a plain `atob(...)` would silently corrupt
 * rather than throw on. */
const decodeBase64Utf8 = (value: string): string => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

export default function TelephonyEmbed() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<InitState>({ kind: 'loading' });

  useEffect(() => {
    const token = searchParams.get('token');
    const userB64 = searchParams.get('u');

    if (!token || !userB64) {
      setState({ kind: 'error', message: 'Missing token or user context in the URL.' });
      return;
    }

    try {
      const user = JSON.parse(decodeBase64Utf8(userB64)) as User;
      if (!user?.tenant?.id) {
        setState({ kind: 'error', message: 'User context is missing tenant info.' });
        return;
      }
      // Same storage the rest of the app's axios interceptors / useAuth()
      // read from — this is the whole trick, not a parallel auth path.
      tokenManager.setAccessToken(token);
      authService.setUser(user);
      setState({ kind: 'ready' });
    } catch (err) {
      setState({ kind: 'error', message: `Failed to parse embedded session: ${String(err)}` });
    }
  }, [searchParams]);

  if (state.kind === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-sm font-medium text-destructive">Couldn't start the softphone</p>
          <p className="text-xs text-muted-foreground">{state.message}</p>
        </div>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // `embedded` matters more than it looks. Without it the widget renders its
  // normal overlay form: a 48px launcher in the corner of an otherwise empty
  // WebView, with the dialler hidden behind a tap that nothing prompts you to
  // make. Embedded, the panel opens itself and fills the viewport, so the
  // route shows the dialler and nothing else — which is the whole ask.
  return (
    <div className="min-h-screen bg-background">
      <TelephonyProvider>
        <AutoDialer number={searchParams.get('number')} />
        <Softphone embedded />
      </TelephonyProvider>
    </div>
  );
}

/**
 * Places the call the user already asked for, instead of showing them a
 * dialler and asking again.
 *
 * The host app (crmflutter's lead screen) forwards `?number=` when the user
 * taps Call on a lead. Until now this route ignored it: the panel announced
 * "Calling 9191..." while presenting an empty keypad, so the number had to be
 * typed by hand — the header was effectively lying about what was happening.
 *
 * WHY AUTO-DIAL RATHER THAN PREFILL. Tapping Call on a named lead IS the
 * confirmation; a second press on a keypad the user did not ask to see is
 * friction, not safety. Prefilling would still leave them one tap from the
 * thing they already asked for.
 *
 * FIRES AT MOST ONCE. This is a real outbound call to a real customer, so a
 * WebView reload, a remount, a reconnect or React re-running an effect must
 * never place a second one. The latch is set when a call is OBSERVED to
 * exist — not when one is merely attempted, which is what the first version
 * got wrong: it marked itself done before `dial()` had actually taken, and
 * `dial()` fails silently, so a no-op looked identical to success.
 */
function AutoDialer({ number }: { number: string | null }) {
  const { status, currentCall, dial } = useTelephonyPhone();
  const digits = (number ?? '').replace(/\D/g, '');
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!digits) return;
    if (startedRef.current) return;

    // A call exists, so the dial landed (or the user started one by hand).
    // Latch for good — this is the ONLY thing that marks us done.
    if (currentCall) {
      startedRef.current = true;
      return;
    }

    if (status !== 'ready') return; // not registered yet

    // DEFERRED ON PURPOSE, and this one line is the whole bug fix.
    //
    // `dial()` gates on `statusRef.current`, but the provider syncs that ref
    // inside its own `useEffect`. React runs CHILD effects before PARENT
    // effects, and AutoDialer is a child of TelephonyProvider — so on the very
    // render where `status` first becomes 'ready', `statusRef.current` is still
    // the previous value. Calling dial() there hits `statusRef.current !==
    // 'ready'` and returns silently: no call, no error, no state change, and
    // nothing to re-trigger the effect. The panel just sits on the keypad
    // while the host app's header says "Calling …".
    //
    // A macrotask runs after React has flushed every passive effect for the
    // commit, parent included, so by the time this fires the ref is current.
    const id = window.setTimeout(() => {
      if (startedRef.current) return;
      dial({ toNumber: digits });
    }, 0);
    return () => window.clearTimeout(id);
  }, [status, currentCall, digits, dial]);

  return null;
}
