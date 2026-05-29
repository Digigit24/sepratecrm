// src/services/telephonyService.ts
import { AxiosError } from 'axios';
import { crmClient } from '@/lib/client';
import { API_CONFIG, buildQueryString } from '@/lib/apiConfig';
import type {
  TeleCMICredential,
  TeleCMICredentialCreateData,
  TeleCMICredentialUpdateData,
  TeleCMIAgent,
  TeleCMIAgentCreateData,
  TeleCMIAgentUpdateData,
  RefreshTokenResponse,
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

const T = API_CONFIG.CRM.TELEPHONY;

/**
 * Normalized telephony error.
 *
 * The backend uses two non-standard statuses that callers must distinguish:
 *  - 424 Failed Dependency  => TeleCMI not configured for this user/tenant.
 *  - 502 Bad Gateway        => TeleCMI upstream returned an error (see `backendError`).
 *
 * `isNotConfigured` / `isUpstreamError` let hooks pick the right user-facing message
 * without re-inspecting the raw Axios error.
 */
export class TelephonyApiError extends Error {
  readonly status?: number;
  readonly isNotConfigured: boolean;
  readonly isUpstreamError: boolean;
  /** The backend's `error` string (present on 502 and most failures). */
  readonly backendError?: string;
  /** DRF field validation errors (present on 400). */
  readonly fieldErrors?: Record<string, string[]>;
  /** Raw response body for callers that need extra fields (e.g. sms_log_id on 502). */
  readonly data?: unknown;

  constructor(error: unknown) {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError?.response?.status;
    const data = axiosError?.response?.data;

    const backendError: string | undefined =
      (data && typeof data === 'object' && typeof data.error === 'string' && data.error) ||
      undefined;

    const message =
      backendError ||
      axiosError?.message ||
      'Telephony request failed';

    super(message);
    this.name = 'TelephonyApiError';
    this.status = status;
    this.isNotConfigured = status === 424;
    this.isUpstreamError = status === 502;
    this.backendError = backendError;
    this.data = data;

    // DRF validation errors: object of field -> string[] (excluding our known `error` key)
    if (status === 400 && data && typeof data === 'object') {
      const fieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) fieldErrors[key] = value as string[];
      }
      if (Object.keys(fieldErrors).length > 0) this.fieldErrors = fieldErrors;
    }
  }
}

/** Wraps any thrown error into a TelephonyApiError so callers get a consistent shape. */
const wrap = (error: unknown): never => {
  throw new TelephonyApiError(error);
};

class TelephonyService {
  // ==================== CREDENTIALS (§4) ====================

  async getCredentials(): Promise<PaginatedResponse<TeleCMICredential>> {
    try {
      const res = await crmClient.get<PaginatedResponse<TeleCMICredential>>(T.CREDENTIALS);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createCredential(data: TeleCMICredentialCreateData): Promise<TeleCMICredential> {
    try {
      const res = await crmClient.post<TeleCMICredential>(T.CREDENTIALS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateCredential(
    id: number,
    data: TeleCMICredentialUpdateData
  ): Promise<TeleCMICredential> {
    try {
      const res = await crmClient.patch<TeleCMICredential>(
        T.CREDENTIAL_DETAIL.replace(':id', String(id)),
        data
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteCredential(id: number): Promise<void> {
    try {
      await crmClient.delete(T.CREDENTIAL_DETAIL.replace(':id', String(id)));
    } catch (e) {
      wrap(e);
    }
  }

  // ==================== AGENTS (§5) ====================

  async getAgents(): Promise<PaginatedResponse<TeleCMIAgent>> {
    try {
      const res = await crmClient.get<PaginatedResponse<TeleCMIAgent>>(T.AGENTS);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createAgent(data: TeleCMIAgentCreateData): Promise<TeleCMIAgent> {
    try {
      const res = await crmClient.post<TeleCMIAgent>(T.AGENTS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateAgent(id: number, data: TeleCMIAgentUpdateData): Promise<TeleCMIAgent> {
    try {
      const res = await crmClient.patch<TeleCMIAgent>(
        T.AGENT_DETAIL.replace(':id', String(id)),
        data
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteAgent(id: number): Promise<void> {
    try {
      await crmClient.delete(T.AGENT_DETAIL.replace(':id', String(id)));
    } catch (e) {
      wrap(e);
    }
  }

  /** Force a fresh TeleCMI token for the current user. 424 if no agent record. */
  async refreshToken(): Promise<RefreshTokenResponse> {
    try {
      const res = await crmClient.post<RefreshTokenResponse>(T.AGENT_REFRESH_TOKEN, {});
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CALL CONTROL (§6) ====================

  async clickToCall(data: ClickToCallRequest): Promise<ClickToCallResponse> {
    try {
      const res = await crmClient.post<ClickToCallResponse>(T.CLICK_TO_CALL, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async hangup(data: HangupRequest): Promise<unknown> {
    try {
      const res = await crmClient.post(T.HANGUP, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async addNote(data: AddNoteRequest): Promise<unknown> {
    try {
      const res = await crmClient.post(T.ADD_NOTE, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CALL LOGS / CDR (§7) ====================

  async getCalls(params?: CallLogsQueryParams): Promise<PaginatedResponse<CallLog>> {
    try {
      const res = await crmClient.get<PaginatedResponse<CallLog>>(
        `${T.CALLS}${buildQueryString(params as Record<string, string | number | boolean | undefined>)}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async getCall(id: number): Promise<CallLog> {
    try {
      const res = await crmClient.get<CallLog>(T.CALL_DETAIL.replace(':id', String(id)));
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  /** Manually pull CDR for the current agent and upsert into call logs. */
  async syncCalls(data?: CallSyncRequest): Promise<CallSyncResponse> {
    try {
      const res = await crmClient.post<CallSyncResponse>(T.CALL_SYNC, data ?? {});
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== SMS (§8) ====================

  async sendSMS(data: SendSMSRequest): Promise<SMSLog> {
    try {
      const res = await crmClient.post<SMSLog>(T.SMS_SEND, data);
      return res.data;
    } catch (e) {
      // On 502 the SMS log is still created (status: failed) and the body carries
      // sms_log_id — preserved on TelephonyApiError.data for callers that want it.
      return wrap(e);
    }
  }

  async getSMS(params?: SMSLogsQueryParams): Promise<PaginatedResponse<SMSLog>> {
    try {
      const res = await crmClient.get<PaginatedResponse<SMSLog>>(
        `${T.SMS}${buildQueryString(params as Record<string, string | number | boolean | undefined>)}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CALLER ID (§9) ====================

  async getCallerIds(): Promise<CallerIDsResponse> {
    try {
      const res = await crmClient.get<CallerIDsResponse>(T.CALLER_IDS);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async setCallerId(data: SetCallerIDRequest): Promise<unknown> {
    try {
      const res = await crmClient.post(T.CALLER_IDS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== BREAK MANAGEMENT (§10) ====================

  async getBreaks(params?: BreakQueryParams): Promise<unknown> {
    try {
      const res = await crmClient.get(
        `${T.BREAK}${buildQueryString(params as Record<string, string | number | boolean | undefined>)}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CALLBACKS (§11) ====================

  async getCallbacks(params?: CallbacksQueryParams): Promise<unknown> {
    try {
      const res = await crmClient.get(
        `${T.CALLBACKS}${buildQueryString(params as Record<string, string | number | boolean | undefined>)}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== WEBRTC CONFIG (§12) ====================

  /** Config for the in-browser PIOPIY SDK. 424 if telephony not configured. */
  async getWebRTCConfig(): Promise<WebRTCConfig> {
    try {
      const res = await crmClient.get<WebRTCConfig>(T.WEBRTC_CONFIG);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }
}

export const telephonyService = new TelephonyService();
export default telephonyService;
