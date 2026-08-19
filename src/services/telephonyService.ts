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
  SetCallOutcomeRequest,
  SMSLog,
  SendSMSRequest,
  SMSLogsQueryParams,
  CallerIDsResponse,
  SetCallerIDRequest,
  BreakQueryParams,
  CallbacksQueryParams,
  WebRTCConfig,
  WebRTCAuth,
  WebRTCConfigSource,
  TelephonyNotConfiguredReason,
  CallingProfile,
  CallingProfileCreateData,
  CallingProfileUpdateData,
  CallingProfileVerifyResponse,
  CallingProfileAssignment,
  PaginatedResponse,
  TelephonyAnalyticsDashboard,
  AgentDailyStatsResponse,
  TeleCMICampaign,
  TeleCMICampaignCreateData,
  TeleCMICampaignUpdateData,
  CampaignToggleActiveResponse,
  CampaignPushLeadsResponse,
  ZataStorageCredential,
  ZataStorageCredentialInput,
  RecordingAccessResponse,
} from '@/types/telephony.types';
import {
  TELEPHONY_NOT_CONFIGURED_REASONS,
  WEBRTC_CONFIG_SOURCES,
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
/**
 * Pull the machine-readable `reason` out of a 424 body. Unknown/missing values
 * collapse to null so the UI falls back to generic "not configured" copy rather
 * than rendering a raw backend string.
 */
const readNotConfiguredReason = (
  status: number | undefined,
  data: unknown,
): TelephonyNotConfiguredReason | null => {
  if (status !== 424 || !data || typeof data !== 'object') return null;
  const raw = (data as { reason?: unknown }).reason;
  return typeof raw === 'string' &&
    (TELEPHONY_NOT_CONFIGURED_REASONS as readonly string[]).includes(raw)
    ? (raw as TelephonyNotConfiguredReason)
    : null;
};

export class TelephonyApiError extends Error {
  readonly status?: number;
  readonly isNotConfigured: boolean;
  /**
   * On a 424, which of the two expected "not configured" states this is.
   * `null` when the backend did not send a recognised `reason` (older builds).
   */
  readonly notConfiguredReason: TelephonyNotConfiguredReason | null;
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
    this.notConfiguredReason = readNotConfiguredReason(status, data);
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

/**
 * "This endpoint is not deployed on this backend yet."
 *
 * Calling profiles are being built on the Django side in parallel with this UI,
 * so every read/write against them has to survive a backend that simply does not
 * route the URL. Mirrors `isComposioUnavailable` in composioService.ts — a 404 /
 * 501 / 502 / 503 must render as a calm "not available yet" panel, never a white
 * screen and never a red crash toast.
 *
 * Deliberately NOT used for `verify/`: there a 502 is a real upstream TeleCMI
 * rejection and the caller wants to show the reason.
 */
export const isTelephonyEndpointUnavailable = (error: unknown): boolean => {
  const status = error instanceof TelephonyApiError ? error.status : undefined;
  return status === 404 || status === 501 || status === 502 || status === 503;
};

/**
 * Calling-profile lists come back either as a bare array (early backend builds)
 * or as a DRF page. Normalise so callers only ever handle one shape.
 */
const asArray = <T>(data: T[] | PaginatedResponse<T> | null | undefined): T[] => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
};

/**
 * Defensively shape the webrtc-config payload.
 *
 * `auth` and `source` are newer fields; a backend that has not shipped them yet
 * (or ships a half-built shape) must degrade to "user types the password"
 * rather than white-screening the app. Anything unrecognised becomes undefined.
 */
const normalizeWebRTCConfig = (raw: unknown): WebRTCConfig => {
  const src = (raw ?? {}) as Record<string, unknown>;

  let auth: WebRTCAuth | undefined;
  const rawAuth = src.auth;
  if (rawAuth && typeof rawAuth === 'object') {
    const kind = (rawAuth as { kind?: unknown }).kind;
    const value = (rawAuth as { value?: unknown }).value;
    if ((kind === 'token' || kind === 'password') && typeof value === 'string' && value !== '') {
      auth = { kind, value };
    }
  }

  const rawSource = src.source;
  const source: WebRTCConfigSource | undefined =
    typeof rawSource === 'string' &&
    (WEBRTC_CONFIG_SOURCES as readonly string[]).includes(rawSource)
      ? (rawSource as WebRTCConfigSource)
      : undefined;

  return {
    telecmi_user_id: typeof src.telecmi_user_id === 'string' ? src.telecmi_user_id : '',
    sbc_host: typeof src.sbc_host === 'string' ? src.sbc_host : '',
    default_caller_id: typeof src.default_caller_id === 'string' ? src.default_caller_id : null,
    auth,
    source,
  };
};

/** Wraps any thrown error into a TelephonyApiError so callers get a consistent shape. */
const wrap = (error: unknown): never => {
  throw new TelephonyApiError(error);
};

// ── recording blob helpers ──────────────────────────────────────────────
// Anything that is not decodable audio must fail loudly here. If a JSON error
// body reaches URL.createObjectURL() the player mounts, reports a 0:00
// duration and silently never plays — the failure becomes invisible.

const PLAYABLE_AUDIO_TYPES = /^(audio\/|application\/octet-stream|binary\/octet-stream)/i;

const readBlobAsJson = async (blob: Blob): Promise<Record<string, unknown>> => {
  try {
    return JSON.parse(await blob.text()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** Build a TelephonyApiError from a body the server sent as a Blob. */
const blobError = (status: number, message: string): TelephonyApiError =>
  new TelephonyApiError({ response: { status, data: { error: message } }, message });

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

  async getZataStorageCredentials(): Promise<PaginatedResponse<ZataStorageCredential>> {
    try {
      const res = await crmClient.get<PaginatedResponse<ZataStorageCredential>>(T.STORAGE_CREDENTIALS);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createZataStorageCredential(data: ZataStorageCredentialInput): Promise<ZataStorageCredential> {
    try {
      const res = await crmClient.post<ZataStorageCredential>(T.STORAGE_CREDENTIALS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateZataStorageCredential(
    id: number,
    data: Partial<ZataStorageCredentialInput>,
  ): Promise<ZataStorageCredential> {
    try {
      const res = await crmClient.patch<ZataStorageCredential>(
        T.STORAGE_CREDENTIAL_DETAIL.replace(':id', String(id)),
        data,
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async testZataStorage(): Promise<{ detail: string }> {
    try {
      const res = await crmClient.post<{ detail: string }>(T.STORAGE_TEST, {});
      return res.data;
    } catch (e) {
      return wrap(e);
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

  // ==================== CALLING PROFILES (admin) ====================
  //
  // `password` is write-only end to end: it goes out on create/update and is
  // never present on any response, so nothing here can leak it back to the UI.

  async getCallingProfiles(): Promise<CallingProfile[]> {
    try {
      const res = await crmClient.get<CallingProfile[] | PaginatedResponse<CallingProfile>>(
        T.CALLING_PROFILES,
      );
      return asArray(res.data);
    } catch (e) {
      return wrap(e);
    }
  }

  async createCallingProfile(data: CallingProfileCreateData): Promise<CallingProfile> {
    try {
      const res = await crmClient.post<CallingProfile>(T.CALLING_PROFILES, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateCallingProfile(
    id: number,
    data: CallingProfileUpdateData,
  ): Promise<CallingProfile> {
    try {
      const res = await crmClient.patch<CallingProfile>(
        T.CALLING_PROFILE_DETAIL.replace(':id', String(id)),
        data,
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteCallingProfile(id: number): Promise<void> {
    try {
      await crmClient.delete(T.CALLING_PROFILE_DETAIL.replace(':id', String(id)));
    } catch (e) {
      wrap(e);
    }
  }

  /**
   * Ask the backend to log the stored credential into the SBC.
   * A rejected credential is a 200 with `{ok: false, error}` — NOT an exception —
   * so saving is never blocked on a failing extension.
   */
  async verifyCallingProfile(id: number): Promise<CallingProfileVerifyResponse> {
    try {
      const res = await crmClient.post<CallingProfileVerifyResponse>(
        T.CALLING_PROFILE_VERIFY.replace(':id', String(id)),
        {},
      );
      const body = (res.data ?? {}) as Partial<CallingProfileVerifyResponse>;
      return {
        ok: body.ok === true,
        error: typeof body.error === 'string' && body.error ? body.error : null,
      };
    } catch (e) {
      return wrap(e);
    }
  }

  async getCallingProfileAssignments(): Promise<CallingProfileAssignment[]> {
    try {
      const res = await crmClient.get<
        CallingProfileAssignment[] | PaginatedResponse<CallingProfileAssignment>
      >(T.CALLING_PROFILE_ASSIGNMENTS);
      return asArray(res.data);
    } catch (e) {
      return wrap(e);
    }
  }

  async assignCallingProfile(id: number, userId: string): Promise<void> {
    try {
      await crmClient.post(T.CALLING_PROFILE_ASSIGN.replace(':id', String(id)), {
        user_id: userId,
      });
    } catch (e) {
      wrap(e);
    }
  }

  /** DELETE with a body — axios needs it under `data`, not as a second arg. */
  async unassignCallingProfile(id: number, userId: string): Promise<void> {
    try {
      await crmClient.delete(T.CALLING_PROFILE_ASSIGN.replace(':id', String(id)), {
        data: { user_id: userId },
      });
    } catch (e) {
      wrap(e);
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

  /**
   * Fetch a call recording's audio as a Blob.
   *
   * Deliberately NOT a plain URL you can drop into `<audio src>` — crmClient
   * authenticates via an `Authorization: Bearer` header (see lib/client.ts's
   * request interceptor), and browsers never attach custom headers to
   * <audio>/<video> src requests. Backend: GET /api/telephony/calls/:id/recording/
   * proxy-streams the file straight from TeleCMI (telephony/views.py
   * CallLogViewSet.recording) — nothing is stored locally on the server.
   *
   * Callers should build an object URL from the result
   * (`URL.createObjectURL(blob)`) and revoke it (`URL.revokeObjectURL`) when
   * done — see the RecordingPlayer component in LeadTelephonyHistory.tsx.
   */
  async getRecordingBlob(id: number): Promise<Blob> {
    let res;
    try {
      res = await crmClient.get<Blob>(T.CALL_RECORDING.replace(':id', String(id)), {
        responseType: 'blob',
      });
    } catch (e) {
      // With responseType 'blob' Axios hands us the *error* body as a Blob too,
      // so TelephonyApiError's usual `data.error` lookup finds nothing and the
      // user gets a generic message. Decode it back to JSON first.
      const axiosError = e as AxiosError<unknown>;
      const body = axiosError?.response?.data;
      if (body instanceof Blob) {
        (axiosError.response as { data: unknown }).data = await readBlobAsJson(body);
      }
      return wrap(axiosError);
    }

    const blob = res.data;

    // A 200 does not guarantee audio: the TeleCMI proxy can pass through a
    // small JSON error payload. Reject it here rather than letting it become a
    // dead 0:00 player.
    if (blob.size === 0) {
      throw blobError(502, 'The recording file is empty.');
    }
    if (blob.type && !PLAYABLE_AUDIO_TYPES.test(blob.type)) {
      const payload = await readBlobAsJson(blob);
      const message =
        (typeof payload.error === 'string' && payload.error) ||
        (typeof payload.msg === 'string' && payload.msg) ||
        'The server did not return a playable recording.';
      throw blobError(502, message);
    }

    return blob;
  }

  async getRecordingAccess(id: number): Promise<RecordingAccessResponse> {
    try {
      const res = await crmClient.get<RecordingAccessResponse>(
        T.CALL_RECORDING_ACCESS.replace(':id', String(id)),
      );
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

  /**
   * Config for the in-browser PIOPIY SDK. 424 if telephony not configured.
   *
   * The response is normalised so a partially-shipped backend can never crash
   * the softphone: `auth` and `source` are dropped unless they are well-formed.
   * The raw response is never logged — it carries the SBC secret.
   */
  async getWebRTCConfig(): Promise<WebRTCConfig> {
    try {
      const res = await crmClient.get<WebRTCConfig>(T.WEBRTC_CONFIG);
      return normalizeWebRTCConfig(res.data);
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CALL OUTCOME (disposition) ====================

  /** Set the agent disposition on a call. Returns the updated CallLog. */
  async setCallOutcome(id: number, data: SetCallOutcomeRequest): Promise<CallLog> {
    try {
      const res = await crmClient.patch<CallLog>(T.CALL_OUTCOME.replace(':id', String(id)), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== ANALYTICS ====================

  /** Admin telephony analytics dashboard: team + per-agent summary, missed-unattended, outcome breakdown. */
  async getAnalyticsDashboard(days = 30): Promise<TelephonyAnalyticsDashboard> {
    try {
      const res = await crmClient.get<TelephonyAnalyticsDashboard>(
        `${T.ANALYTICS_DASHBOARD}${buildQueryString({ days })}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  /** Per-agent per-day breakdown. Backend restricts non-admins to their own stats. */
  async getAgentDailyStats(days = 7, agentUserId?: string): Promise<AgentDailyStatsResponse> {
    try {
      const res = await crmClient.get<AgentDailyStatsResponse>(
        `${T.ANALYTICS_DAILY}${buildQueryString({ days, agent_user_id: agentUserId })}`
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // ==================== CAMPAIGNS (auto-dialer) ====================

  async getCampaigns(): Promise<PaginatedResponse<TeleCMICampaign>> {
    try {
      const res = await crmClient.get<PaginatedResponse<TeleCMICampaign>>(T.CAMPAIGNS);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async createCampaign(data: TeleCMICampaignCreateData): Promise<TeleCMICampaign> {
    try {
      const res = await crmClient.post<TeleCMICampaign>(T.CAMPAIGNS, data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async updateCampaign(id: number, data: TeleCMICampaignUpdateData): Promise<TeleCMICampaign> {
    try {
      const res = await crmClient.patch<TeleCMICampaign>(T.CAMPAIGN_DETAIL.replace(':id', String(id)), data);
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async deleteCampaign(id: number): Promise<void> {
    try {
      await crmClient.delete(T.CAMPAIGN_DETAIL.replace(':id', String(id)));
    } catch (e) {
      wrap(e);
    }
  }

  async toggleCampaignActive(id: number): Promise<CampaignToggleActiveResponse> {
    try {
      const res = await crmClient.post<CampaignToggleActiveResponse>(
        T.CAMPAIGN_TOGGLE_ACTIVE.replace(':id', String(id)),
        {}
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  async pushCampaignLeads(id: number, leadIds: string[]): Promise<CampaignPushLeadsResponse> {
    try {
      const res = await crmClient.post<CampaignPushLeadsResponse>(
        T.CAMPAIGN_PUSH_LEADS.replace(':id', String(id)),
        { lead_ids: leadIds }
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }

  // Resolves the campaign's source Group's current members and pushes them
  // into the dialer — the "Sync from Group" action.
  async pushCampaignFromGroup(id: number, groupId: number): Promise<CampaignPushLeadsResponse> {
    try {
      const res = await crmClient.post<CampaignPushLeadsResponse>(
        T.CAMPAIGN_PUSH_GROUP.replace(':id', String(id)),
        { group_id: groupId }
      );
      return res.data;
    } catch (e) {
      return wrap(e);
    }
  }
}

export const telephonyService = new TelephonyService();
export default telephonyService;
