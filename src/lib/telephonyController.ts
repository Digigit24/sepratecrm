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
import { toastTelephonyError } from '@/hooks/useTelephony';

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

  try {
    // ── Phase 6 will branch here: if softphone ready -> piopiy.call(...) ──
    const res = await telephonyService.clickToCall({
      to_number: toNumber,
      lead_id: params.leadId,
      caller_id: params.callerId,
    });
    toast.success(res.msg || 'Call initiated');
    return true;
  } catch (e) {
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
