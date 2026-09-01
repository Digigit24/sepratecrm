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
 * FIRES EXACTLY ONCE, and that guard is the important part of this component.
 * This is a real outbound call to a real customer. A WebView reload, a
 * remount, a reconnect, or React re-running an effect must never place a
 * second one, so the ref latches on the first successful dial and is never
 * reset. `dial()` itself is also a no-op unless status is `ready`, so this
 * waits for registration rather than firing into a dead socket.
 */
function AutoDialer({ number }: { number: string | null }) {
  const { status, dial } = useTelephonyPhone();
  const dialedRef = React.useRef(false);

  React.useEffect(() => {
    if (dialedRef.current) return;
    if (status !== 'ready') return; // not registered yet, or already on a call
    const digits = (number ?? '').replace(/\D/g, '');
    if (!digits) return;

    dialedRef.current = true;
    dial({ toNumber: digits });
  }, [status, number, dial]);

  return null;
}
