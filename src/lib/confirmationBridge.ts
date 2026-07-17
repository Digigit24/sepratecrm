// src/lib/confirmationBridge.ts
//
// Bridges the assistant-ui tool UI (which renders the Approve/Cancel card) and
// the streaming adapter (which pauses a write tool until the user decides).
//
// Flow (matches AI_COPILOT_PHASE2_PLAN.md §2.4):
//   1. Backend emits `tool-call` with status "awaiting_confirmation" and does
//      NOT execute the write.
//   2. Adapter calls `requestConfirmation(call)` → returns a Promise and marks
//      the toolCallId as pending.
//   3. The tool card (keyed by toolCallId) shows Approve / Cancel; the click
//      calls `resolveConfirmation(id, decision)`.
//   4. Adapter's awaited Promise resolves; on "approve" it re-POSTs
//      /api/ai/chat/ with `confirm:{id,name,args}` so the backend executes.

import { useSyncExternalStore } from 'react';

export type ConfirmDecision = 'approve' | 'cancel';

export interface PendingConfirmation {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface Entry {
  call: PendingConfirmation;
  resolve: (d: ConfirmDecision) => void;
}

const pending = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Adapter side: register a pending confirmation and await the user's decision. */
export function requestConfirmation(call: PendingConfirmation): Promise<ConfirmDecision> {
  return new Promise<ConfirmDecision>((resolve) => {
    pending.set(call.id, {
      call,
      resolve: (d) => {
        pending.delete(call.id);
        emit();
        resolve(d);
      },
    });
    emit();
  });
}

/** UI side: approve or cancel a pending confirmation. */
export function resolveConfirmation(id: string, decision: ConfirmDecision) {
  pending.get(id)?.resolve(decision);
}

export function isPending(id: string): boolean {
  return pending.has(id);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** React hook: re-renders when a given tool call's pending state changes. */
export function useAwaitingConfirmation(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isPending(id),
    () => false,
  );
}
