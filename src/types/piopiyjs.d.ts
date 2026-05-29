// src/types/piopiyjs.d.ts
// Minimal ambient types for the `piopiyjs` WebRTC SDK (no types shipped upstream).
// Covers only the surface we use (see API doc §15). Payloads are intentionally loose.

declare module 'piopiyjs' {
  export interface PiopiyOptions {
    name?: string;
    debug?: boolean;
    /** Handle the inbound audio stream automatically (recommended). */
    autoplay?: boolean;
    /** Seconds to ring before auto-reject. */
    ringTime?: number;
  }

  /** Generic event payload — most events carry at least a status `code`. */
  export interface PiopiyEventPayload {
    code?: number;
    [key: string]: unknown;
  }

  /** Payload for the `callStream` event when autoplay is disabled. */
  export interface PiopiyStreamPayload {
    stream: MediaStream;
    [key: string]: unknown;
  }

  export type PiopiyEvent =
    | 'login'
    | 'loginFailed'
    | 'logout'
    | 'inComingCall'
    | 'trying'
    | 'ringing'
    | 'answered'
    | 'callStream'
    | 'hangup'
    | 'ended'
    | 'hold'
    | 'unhold';

  export default class PIOPIY {
    constructor(options?: PiopiyOptions);

    /** Authenticate against the TeleCMI SBC. */
    login(userId: string, password: string, sbcHost: string): void;
    logout(): void;

    /** Place an outbound call. `extraParams` is forwarded to TeleCMI. */
    call(toNumber: string, extraParams?: Record<string, unknown>): void;
    answer(): void;
    reject(): void;

    hold(): void;
    unHold(): void;
    mute(): void;
    unMute(): void;

    sendDtmf(digit: string): void;
    transfer(to: string): void;
    merge(): void;

    /** Hang up the current call. */
    terminate(): void;

    getCallId(): string;

    on(event: 'callStream', handler: (payload: PiopiyStreamPayload) => void): void;
    on(event: PiopiyEvent, handler: (payload: PiopiyEventPayload) => void): void;
  }
}
