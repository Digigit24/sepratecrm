// src/hooks/useTelephony.ts
import useSWR from 'swr';
import { toast } from 'sonner';
import { telephonyService, TelephonyApiError } from '@/services/telephonyService';
import type {
  TeleCMICredential,
  TeleCMICredentialCreateData,
  TeleCMICredentialUpdateData,
  TeleCMIAgent,
  TeleCMIAgentCreateData,
  TeleCMIAgentUpdateData,
  ClickToCallRequest,
  ClickToCallResponse,
  HangupRequest,
  AddNoteRequest,
  CallLog,
  CallLogsQueryParams,
  CallSyncRequest,
  CallSyncResponse,
  SMSLog,
  SendSMSRequest,
  SMSLogsQueryParams,
  CallerIDsResponse,
  SetCallerIDRequest,
  BreakQueryParams,
  CallbacksQueryParams,
  WebRTCConfig,
  PaginatedResponse,
} from '@/types/telephony.types';

// ==================== SWR KEYS ====================
const CREDENTIALS_KEY = 'telephony:credentials';
const AGENTS_KEY = 'telephony:agents';
const CALLS_KEY = 'telephony:calls';
const SMS_KEY = 'telephony:sms';
const CALLER_IDS_KEY = 'telephony:caller-ids';
const BREAK_KEY = 'telephony:break';
const CALLBACKS_KEY = 'telephony:callbacks';
const WEBRTC_CONFIG_KEY = 'telephony:webrtc-config';

// ==================== ERROR -> TOAST ====================

const NOT_CONFIGURED_MSG = 'Set up telephony in Settings';

/**
 * Show a user-facing toast for a telephony error, picking the right message:
 *  - 401 => no toast; the global axios handler owns auth (refresh / redirect)
 *  - 403 => "Telephony isn't enabled for your account" (defends against gating drift)
 *  - 424 => "Set up telephony in Settings"
 *  - 502 => the backend `error` string
 *  - else => generic message from the error
 */
export const toastTelephonyError = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof TelephonyApiError) {
    // 401 is handled globally (token refresh / redirect to login). Don't double-toast.
    if (error.status === 401) return;
    if (error.status === 403) {
      toast.error('Telephony isn’t enabled for your account. Contact your admin.');
      return;
    }
    if (error.isNotConfigured) {
      toast.error(NOT_CONFIGURED_MSG);
      return;
    }
    if (error.isUpstreamError) {
      toast.error(error.backendError || 'TeleCMI returned an error');
      return;
    }
    if (error.fieldErrors) {
      const first = Object.values(error.fieldErrors)[0]?.[0];
      toast.error(first || error.message || fallback);
      return;
    }
    toast.error(error.backendError || error.message || fallback);
    return;
  }
  toast.error(fallback);
};

// SWR should not retry the "not configured" (424) state — it is a stable condition,
// not a transient failure.
const READ_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: (err: unknown) =>
    !(err instanceof TelephonyApiError && err.isNotConfigured),
} as const;

// ==================== HOOK ====================

export const useTelephony = () => {
  // ---------- CREDENTIALS (§4) ----------

  const useCredentials = () =>
    useSWR<PaginatedResponse<TeleCMICredential>>(
      CREDENTIALS_KEY,
      () => telephonyService.getCredentials(),
      READ_OPTIONS
    );

  const createCredential = async (
    data: TeleCMICredentialCreateData
  ): Promise<TeleCMICredential> => {
    try {
      const result = await telephonyService.createCredential(data);
      toast.success('TeleCMI account connected');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to connect TeleCMI account');
      throw e;
    }
  };

  const updateCredential = async (
    id: number,
    data: TeleCMICredentialUpdateData
  ): Promise<TeleCMICredential> => {
    try {
      const result = await telephonyService.updateCredential(id, data);
      toast.success('Telephony credentials updated');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to update credentials');
      throw e;
    }
  };

  const deleteCredential = async (id: number): Promise<void> => {
    try {
      await telephonyService.deleteCredential(id);
      toast.success('TeleCMI account disconnected');
    } catch (e) {
      toastTelephonyError(e, 'Failed to disconnect');
      throw e;
    }
  };

  // ---------- AGENTS (§5) ----------

  const useAgents = () =>
    useSWR<PaginatedResponse<TeleCMIAgent>>(
      AGENTS_KEY,
      () => telephonyService.getAgents(),
      READ_OPTIONS
    );

  /**
   * The current user's own agent record (or undefined if not yet registered).
   * Non-admins only receive their own row from the API; we still filter by
   * user_id so admins viewing their own Preferences see the right record.
   * Shares the AGENTS_KEY cache so mutations + `mutate()` keep it in sync.
   */
  const useMyAgent = (userId?: string) => {
    const swr = useSWR<PaginatedResponse<TeleCMIAgent>>(
      userId ? AGENTS_KEY : null,
      () => telephonyService.getAgents(),
      READ_OPTIONS
    );
    const agent =
      swr.data?.results?.find((a) => a.user_id === userId) ??
      swr.data?.results?.[0];
    return { ...swr, agent };
  };

  const createAgent = async (data: TeleCMIAgentCreateData): Promise<TeleCMIAgent> => {
    try {
      const result = await telephonyService.createAgent(data);
      toast.success('Telephony agent registered');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to register agent');
      throw e;
    }
  };

  const updateAgent = async (
    id: number,
    data: TeleCMIAgentUpdateData
  ): Promise<TeleCMIAgent> => {
    try {
      const result = await telephonyService.updateAgent(id, data);
      toast.success('Agent updated');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to update agent');
      throw e;
    }
  };

  const deleteAgent = async (id: number): Promise<void> => {
    try {
      await telephonyService.deleteAgent(id);
      toast.success('Agent removed');
    } catch (e) {
      toastTelephonyError(e, 'Failed to remove agent');
      throw e;
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      const res = await telephonyService.refreshToken();
      toast.success(res.detail || 'Token refreshed successfully.');
    } catch (e) {
      toastTelephonyError(e, 'Failed to refresh token');
      throw e;
    }
  };

  // ---------- CALL CONTROL (§6) ----------

  const clickToCall = async (data: ClickToCallRequest): Promise<ClickToCallResponse> => {
    try {
      const result = await telephonyService.clickToCall(data);
      toast.success(result.msg || 'Call initiated');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to initiate call');
      throw e;
    }
  };

  const hangup = async (data: HangupRequest): Promise<unknown> => {
    try {
      return await telephonyService.hangup(data);
    } catch (e) {
      toastTelephonyError(e, 'Failed to hang up call');
      throw e;
    }
  };

  const addNote = async (data: AddNoteRequest): Promise<unknown> => {
    try {
      const result = await telephonyService.addNote(data);
      toast.success('Note added to call');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to add note');
      throw e;
    }
  };

  // ---------- CALL LOGS / CDR (§7) ----------

  const useCalls = (params?: CallLogsQueryParams) =>
    useSWR<PaginatedResponse<CallLog>>(
      params ? [CALLS_KEY, params] : CALLS_KEY,
      () => telephonyService.getCalls(params),
      READ_OPTIONS
    );

  const useCall = (id?: number) =>
    useSWR<CallLog>(
      id ? [CALLS_KEY, 'detail', id] : null,
      () => telephonyService.getCall(id as number),
      READ_OPTIONS
    );

  /** Call logs for a single lead, newest first. Paginated via `page`. */
  const useLeadCalls = (leadId?: number, page = 1, pageSize = 10) => {
    const params: CallLogsQueryParams = {
      lead_id: leadId,
      ordering: '-call_time',
      page,
      page_size: pageSize,
    };
    return useSWR<PaginatedResponse<CallLog>>(
      leadId ? [CALLS_KEY, 'lead', leadId, page, pageSize] : null,
      () => telephonyService.getCalls(params),
      READ_OPTIONS
    );
  };

  const syncCalls = async (data?: CallSyncRequest): Promise<CallSyncResponse> => {
    try {
      const result = await telephonyService.syncCalls(data);
      toast.success(
        `Synced: ${result.created} new, ${result.updated} updated, ${result.errors} errors`
      );
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to sync calls');
      throw e;
    }
  };

  // ---------- SMS (§8) ----------

  const useSMS = (params?: SMSLogsQueryParams) =>
    useSWR<PaginatedResponse<SMSLog>>(
      params ? [SMS_KEY, params] : SMS_KEY,
      () => telephonyService.getSMS(params),
      READ_OPTIONS
    );

  /** SMS logs for a single lead, newest first. Paginated via `page`. */
  const useLeadSMS = (leadId?: number, page = 1, pageSize = 10) => {
    const params: SMSLogsQueryParams = {
      lead_id: leadId,
      ordering: '-created_at',
      page,
      page_size: pageSize,
    };
    return useSWR<PaginatedResponse<SMSLog>>(
      leadId ? [SMS_KEY, 'lead', leadId, page, pageSize] : null,
      () => telephonyService.getSMS(params),
      READ_OPTIONS
    );
  };

  const sendSMS = async (data: SendSMSRequest): Promise<SMSLog> => {
    try {
      const result = await telephonyService.sendSMS(data);
      toast.success('SMS sent');
      return result;
    } catch (e) {
      // On 502 the backend still logged the SMS as failed; surface the upstream reason.
      toastTelephonyError(e, 'Failed to send SMS');
      throw e;
    }
  };

  // ---------- CALLER ID (§9) ----------

  const useCallerIds = () =>
    useSWR<CallerIDsResponse>(
      CALLER_IDS_KEY,
      () => telephonyService.getCallerIds(),
      READ_OPTIONS
    );

  const setCallerId = async (data: SetCallerIDRequest): Promise<unknown> => {
    try {
      const result = await telephonyService.setCallerId(data);
      toast.success('Caller ID updated');
      return result;
    } catch (e) {
      toastTelephonyError(e, 'Failed to set caller ID');
      throw e;
    }
  };

  // ---------- BREAK MANAGEMENT (§10) ----------

  const useBreaks = (params?: BreakQueryParams) =>
    useSWR<unknown>(
      params ? [BREAK_KEY, params] : BREAK_KEY,
      () => telephonyService.getBreaks(params),
      READ_OPTIONS
    );

  // ---------- CALLBACKS (§11) ----------

  const useCallbacks = (params?: CallbacksQueryParams) =>
    useSWR<unknown>(
      params ? [CALLBACKS_KEY, params] : CALLBACKS_KEY,
      () => telephonyService.getCallbacks(params),
      READ_OPTIONS
    );

  // ---------- WEBRTC CONFIG (§12) ----------

  const useWebRTCConfig = (enabled = true) =>
    useSWR<WebRTCConfig>(
      enabled ? WEBRTC_CONFIG_KEY : null,
      () => telephonyService.getWebRTCConfig(),
      READ_OPTIONS
    );

  return {
    // reads (SWR)
    useCredentials,
    useAgents,
    useMyAgent,
    useCalls,
    useCall,
    useLeadCalls,
    useSMS,
    useLeadSMS,
    useCallerIds,
    useBreaks,
    useCallbacks,
    useWebRTCConfig,
    // mutations
    createCredential,
    updateCredential,
    deleteCredential,
    createAgent,
    updateAgent,
    deleteAgent,
    refreshToken,
    clickToCall,
    hangup,
    addNote,
    syncCalls,
    sendSMS,
    setCallerId,
  };
};

export default useTelephony;
