// ==================== TELEPHONY (TeleCMI) TYPES ====================
// TypeScript types for the telephony module.
// Mirrors the backend API reference §4–§13 (TeleCMI integration).
// All shapes are scoped to a tenant on the backend; the frontend never sends tenant_id.

// ==================== ENUMS ====================

/** Call direction. CDR `call_type` field maps to this on the backend. */
export enum Direction {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

/** Whether the call connected. Derived from CDR `duration` (0 => missed). */
export enum CallType {
  MISSED = 'missed',
  ANSWERED = 'answered',
}

/** TeleCMI SBC region. Determines the SBC host the WebRTC SDK authenticates against. */
export enum SbcRegion {
  IND = 'ind', // India        -> sbcind.telecmi.com
  SG = 'sg',   // Asia (SG)    -> sbcsg.telecmi.com
  US = 'us',   // Americas     -> sbcus.telecmi.com
  UK = 'uk',   // Europe       -> sbcuk.telecmi.com
}

/** Delivery status of an outgoing SMS. */
export enum SmsStatus {
  SENT = 'sent',
  FAILED = 'failed',
}

/** How a CallLog row entered the system. */
export enum CallSyncedVia {
  WEBHOOK = 'webhook',
  SYNC = 'sync',
}

// ==================== SHARED ====================

/** Standard DRF paginated list envelope. */
export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

/** A note stored against a call in TeleCMI (returned within a CallLog). */
export interface TeleCMINote {
  msg: string;
  /** UTC timestamp in milliseconds. */
  date: number;
  /** TeleCMI agent id, e.g. "103_1111112". */
  agent: string;
}

// ==================== CREDENTIALS (§4) ====================
// One record per tenant. `secret` is write-only and never returned by the API.

export interface TeleCMICredential {
  id: number;
  app_id: string;
  sbc_region: SbcRegion;
  /** Derived from sbc_region on the backend (read-only), e.g. "sbcind.telecmi.com". */
  sbc_host: string;
  default_caller_id: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeleCMICredentialCreateData {
  app_id: string;
  /** Write-only. Required on create. Stored encrypted. */
  secret: string;
  sbc_region?: SbcRegion;
  default_caller_id?: string;
  webhook_secret?: string;
}

/** On update every field is optional (e.g. rotate secret, change caller id). */
export type TeleCMICredentialUpdateData = Partial<TeleCMICredentialCreateData>;

// ==================== AGENTS (§5) ====================
// One record per CRM user. `password` is write-only and never returned.

export interface TeleCMIAgent {
  id: number;
  user_id: string; // CRM user UUID
  telecmi_user_id: string; // format: <extension>_<appid>
  /** true if the cached TeleCMI token is < 20 hours old. */
  token_is_fresh: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeleCMIAgentCreateData {
  user_id: string;
  telecmi_user_id: string;
  /** Write-only. Required on create. Stored encrypted. */
  password: string;
}

export type TeleCMIAgentUpdateData = Partial<TeleCMIAgentCreateData>;

export interface RefreshTokenResponse {
  detail: string;
}

// ==================== CALL CONTROL (§6) ====================

export interface ClickToCallRequest {
  /** Destination number with country code, no leading '+'. */
  to_number: string;
  /** Override the caller id for this call only. */
  caller_id?: string;
  /** CRM Lead id — attached so CDR webhooks can link back. */
  lead_id?: number;
  /** Any extra key-values forwarded verbatim to TeleCMI. */
  extra_params?: Record<string, unknown>;
}

export interface ClickToCallResponse {
  code: number;
  msg: string;
  request_id: string;
}

export interface HangupRequest {
  /** TeleCMI Leg B UUID (from a live event webhook payload). */
  cmiuuid: string;
}

export interface AddNoteRequest {
  from_number: string;
  caller_name?: string;
  /** UTC timestamp of the call in milliseconds. */
  timestamp_ms: number;
  message: string;
}

// ==================== CALL LOGS / CDR (§7) ====================

export interface CallLog {
  id: number;
  cmiuid: string;
  direction: Direction;
  direction_display: string;
  call_type: CallType;
  call_type_display: string;
  from_number: string;
  to_number: string;
  /** Total call duration in seconds. */
  duration: number;
  /** Billed seconds. */
  billed_sec: number;
  /** Decimal string, e.g. "0.0100". */
  rate: string;
  caller_name: string | null;
  telecmi_notes: TeleCMINote[];
  call_time: string;
  lead_id: number | null;
  agent_user_id: string | null;
  synced_via: CallSyncedVia;
  created_at: string;
}

export interface CallLogsQueryParams {
  direction?: Direction;
  call_type?: CallType;
  lead_id?: number;
  agent_user_id?: string;
  ordering?: 'call_time' | '-call_time' | 'duration' | '-duration';
  page?: number;
  page_size?: number;
}

export interface CallSyncRequest {
  /** Hours of history to sync. Default 24, max 720 (30 days). */
  hours_back?: number;
}

export interface CallSyncResponse {
  created: number;
  updated: number;
  errors: number;
}

// ==================== SMS (§8) ====================

export interface SMSLog {
  id: number;
  from_number: string | null;
  to_number: string;
  message: string;
  status: SmsStatus;
  status_display: string;
  lead_id: number | null;
  sent_by_user_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SendSMSRequest {
  /** Recipient number with country code. */
  to_number: string;
  message: string;
  lead_id?: number;
}

export interface SMSLogsQueryParams {
  status?: SmsStatus;
  lead_id?: number;
  sent_by_user_id?: string;
  ordering?: 'created_at' | '-created_at';
  page?: number;
  page_size?: number;
}

// ==================== CALLER ID (§9) ====================

export interface CallerID {
  callerid: string;
  name: string;
}

/** Raw TeleCMI response for the caller-ids list. */
export interface CallerIDsResponse {
  code: number;
  callerids: CallerID[];
}

export interface SetCallerIDRequest {
  caller_id: string;
}

// ==================== BREAK MANAGEMENT (§10) ====================

export interface BreakQueryParams {
  /** UTC millisecond timestamp. Defaults to last 24h on the backend. */
  from_date_ms?: number;
}

// ==================== CALLBACKS (§11) ====================

export interface CallbacksQueryParams {
  /** UTC ms. Default: 24h ago. */
  from_ts?: number;
  /** UTC ms. Default: now. */
  to_ts?: number;
  page?: number;
  /** Max 10. Default 10. */
  limit?: number;
}

// ==================== WEBRTC CONFIG (§12) ====================
// What the frontend PIOPIY SDK needs for piopiy.login(). Never exposes the password.

export interface WebRTCConfig {
  telecmi_user_id: string;
  sbc_host: string;
  default_caller_id: string | null;
}

// ==================== SBC REGION REFERENCE ====================

export const SBC_REGION_OPTIONS: ReadonlyArray<{
  value: SbcRegion;
  label: string;
  host: string;
}> = [
  { value: SbcRegion.IND, label: 'India', host: 'sbcind.telecmi.com' },
  { value: SbcRegion.SG, label: 'Asia (Singapore)', host: 'sbcsg.telecmi.com' },
  { value: SbcRegion.US, label: 'Americas', host: 'sbcus.telecmi.com' },
  { value: SbcRegion.UK, label: 'Europe', host: 'sbcuk.telecmi.com' },
];
