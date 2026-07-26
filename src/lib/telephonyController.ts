// src/lib/telephonyController.ts
//
// Single entry point for placing a call from anywhere in the CRM (lead page,
// leads kanban, etc). Centralizing it here means Phase 6 can add the in-browser
// WebRTC path (piopiy.call(...)) in ONE place — none of the call sites change.
//
// Current behavior: always uses the Click-To-Call REST endpoint (rings the
// agent's registered softphone first, then dials the contact).
//
// Phase 6 plan: if the in-browser softphone is connected/ready, prefer
// `piopiy.call(toNumber, { lead_id })` and only fall back to REST when it isn't.

import { toast } from 'sonner';
import { telephonyService, TelephonyApiError } from '@/services/telephonyService';
import {
  toastTelephonyError,
  prependOptimisticCall,
  removeOptimisticCall,
  revalidateLeadCalls,
} from '@/hooks/useTelephony';

// Safety-net revalidation delay for the optimistic "Calling…" row. Real-time
// reconciliation (Pusher live events, see useTelephonyLiveEvents.ts) is the
// fast path but depends on PUSHER_SECRET being configured on the backend —
// until then, this timer is what clears the optimistic row instead of it
// sitting there until the user manually hits refresh. ~most calls have
// resolved (answered/missed) well within this window.
const OPTIMISTIC_RECONCILE_MS = 15_000;

export interface PlaceCallParams {
  /** Raw phone number (may contain +, spaces, dashes — it gets normalized). */
  toNumber: string;
  /** CRM Lead id so CDR webhooks can link the call back to the lead. */
  leadId?: number;
  /** Optional caller-id override for this call only. */
  callerId?: string;
}

export interface PlaceCallOptions {
  /**
   * Called when the call fails because telephony isn't set up (HTTP 424).
   * Used to render a "Open Settings" CTA on the toast. Typically a navigate().
   */
  onRequireSetup?: () => void;
}

/**
 * The in-browser softphone registers a dispatcher here so non-React code
 * (this controller, event handlers) can place WebRTC calls without importing
 * React context. TelephonyProvider sets it on mount and clears it on unmount.
 */
export interface TelephonyDispatcher {
  /** Current softphone status (e.g. 'ready', 'active'). */
  getStatus: () => string;
  /** Place an in-browser call. Returns true if it was handled here. */
  call: (params: { toNumber: string; leadId?: number }) => boolean;
}

let dispatcher: TelephonyDispatcher | null = null;

export const setTelephonyDispatcher = (d: TelephonyDispatcher | null): void => {
  dispatcher = d;
};

/** TeleCMI expects the destination number with country code and no '+'. */
export const normalizePhoneForDial = (raw: string): string => raw.replace(/\D/g, '');

/**
 * Place a call to a number. Returns true if the call was initiated.
 * Shows its own success / error toasts (incl. the 424 "set up telephony" CTA),
 * so callers can fire-and-forget.
 */
export const placeCall = async (
  params: PlaceCallParams,
  options?: PlaceCallOptions,
): Promise<boolean> => {
  const toNumber = normalizePhoneForDial(params.toNumber || '');
  if (!toNumber) {
    toast.error('No phone number available for this lead');
    return false;
  }

  // Prefer the in-browser softphone when it's connected and idle.
  if (dispatcher && dispatcher.getStatus() === 'ready') {
    const handled = dispatcher.call({ toNumber, leadId: params.leadId });
    if (handled) {
      // Show it immediately — the softphone doesn't round-trip through our
      // REST API, so there's no click2call response to key the toast off.
      if (params.leadId) {
        prependOptimisticCall(params.leadId, { toNumber });
        const leadId = params.leadId;
        setTimeout(() => revalidateLeadCalls(leadId), OPTIMISTIC_RECONCILE_MS);
      }
      return true;
    }
    // If it declined to handle, fall through to REST.
  }

  // Optimistic row: shows the call in the lead's history the instant the
  // button is clicked, before TeleCMI's CDR/live webhook has round-tripped.
  // Rolled back below if clickToCall itself fails outright (never placed).
  // If the call DOES go through, this synthetic row is reconciled once the
  // real CDR/live event arrives — see LeadTelephonyHistory's use of
  // useTelephonyLiveEvents + revalidateLeadCalls.
  const optimisticId = params.leadId ? prependOptimisticCall(params.leadId, { toNumber }) : null;

  try {
    const res = await telephonyService.clickToCall({
      to_number: toNumber,
      lead_id: params.leadId,
      caller_id: params.callerId,
    });
    toast.success(res.msg || 'Call initiated');
    if (params.leadId) {
      const leadId = params.leadId;
      setTimeout(() => revalidateLeadCalls(leadId), OPTIMISTIC_RECONCILE_MS);
    }
    return true;
  } catch (e) {
    if (params.leadId && optimisticId !== null) removeOptimisticCall(params.leadId, optimisticId);

    if (e instanceof TelephonyApiError && e.isNotConfigured && options?.onRequireSetup) {
      toast.error('Set up telephony in Settings', {
        action: { label: 'Open Settings', onClick: options.onRequireSetup },
      });
    } else {
      toastTelephonyError(e, 'Failed to initiate call');
    }
    return false;
  }
};
