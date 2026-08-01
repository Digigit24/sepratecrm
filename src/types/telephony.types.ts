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

/** Agent-set call disposition. */
export enum CallOutcome {
  INTERESTED = 'interested',
  CONVERTED = 'converted',
  FOLLOW_UP = 'follow_up',
  CALLBACK = 'callback',
  NOT_INTERESTED = 'not_interested',
  DND = 'dnd',
}

/** Auto-dialer campaign ring rule. */
export enum CampaignRingRule {
  RING_ALL = 'ring-all',
  ROUND_ROBIN = 'round-robin',
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
  /** True when a recording file exists for this call and can be fetched via GET /api/telephony/calls/{id}/recording/. */
  has_recording: boolean;
  created_at: string;

  // ── outbound Leg A/B dedup + routing metadata ──
  call_leg: 'a' | 'b' | null;
  telecmi_call_id: string | null;
  conversation_uuid: string | null;
  ivr_name: string | null;
  team_name: string | null;

  // ── voicemail (inbound missed) ──
  is_voicemail: boolean;
  voicemail_filename: string | null;
  wait_seconds: number | null;
  hangup_reason: string | null;

  // ── disposition ── (kept as plain string, not the CallOutcome enum, since
  // LeadTelephonyHistory's optimistic update assigns the raw string returned
  // by CallOutcomeButton's onOutcomeSet callback directly onto this field)
  call_outcome: string | null;
  call_outcome_note: string | null;
  call_outcome_set_at: string | null;
}

export interface CallLogsQueryParams {
  direction?: Direction;
  call_type?: CallType;
  call_outcome?: CallOutcome | string;
  lead_id?: number;
  agent_user_id?: string;
  ordering?: 'call_time' | '-call_time' | 'duration' | '-duration';
  page?: number;
  page_size?: number;
}

export interface SetCallOutcomeRequest {
  outcome: CallOutcome | string;
  note?: string;
}

// ==================== ANALYTICS ====================

export interface TeamCallSummary {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_talk_time: number;
  avg_call_duration: number | null;
  outbound_calls: number;
  inbound_calls: number;
  converted_calls: number;
  calls_with_outcome: number;
}

export interface AgentCallSummary {
  agent_user_id: string;
  agent_name: string;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_talk_time: number;
  avg_call_duration: number | null;
  outbound_calls: number;
  inbound_calls: number;
  converted_calls: number;
  miss_rate: number;
  conversion_rate: number;
}

export interface MissedUnattendedCall {
  id: number;
  from_number: string;
  call_time: string;
  agent_user_id: string | null;
  hours_waiting: number;
  is_urgent: boolean;
}

export interface CallOutcomeBreakdown {
  call_outcome: string;
  count: number;
}

export interface TelephonyAnalyticsDashboard {
  date_from: string;
  date_to: string;
  team_summary: TeamCallSummary;
  agent_summary: AgentCallSummary[];
  missed_unattended: MissedUnattendedCall[];
  outcome_breakdown: CallOutcomeBreakdown[];
}

export interface AgentDailyStat {
  agent_user_id: string;
  day: string;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  total_talk_time: number;
  outbound_calls: number;
  inbound_calls: number;
  calls_with_outcome: number;
  converted_calls: number;
}

export interface AgentDailyStatsResponse {
  date_from: string;
  date_to: string;
  data: AgentDailyStat[];
}

// ==================== CAMPAIGNS (auto-dialer) ====================

export interface CampaignSourceGroup {
  id: number;
  name: string;
  color_hex?: string;
}

export interface TeleCMICampaign {
  id: number;
  telecmi_campaign_id: string | null;
  name: string;
  is_active: boolean;
  timezone: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  call_interval: number;
  ring_rule: CampaignRingRule;
  agent_user_ids: string[];
  lead_count: number;
  leads_called: number;
  telecmi_lead_list_name: string | null;
  notes: string;
  /** CRM Lead Group this campaign's leads are synced from, if any. */
  source_group: CampaignSourceGroup | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TeleCMICampaignCreateData = Partial<
  Pick<
    TeleCMICampaign,
    | 'name'
    | 'timezone'
    | 'start_date'
    | 'end_date'
    | 'start_time'
    | 'end_time'
    | 'call_interval'
    | 'ring_rule'
    | 'agent_user_ids'
    | 'notes'
  > & { source_group_id: number | null }
>;

export type TeleCMICampaignUpdateData = TeleCMICampaignCreateData & { is_active?: boolean };

export interface CampaignToggleActiveResponse {
  is_active: boolean;
}

export interface CampaignPushLeadsRequest {
  lead_ids: string[];
}

export interface CampaignPushLeadsResponse {
  pushed: number;
  campaign_id: string;
}

export interface CampaignPushGroupRequest {
  group_id: number;
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
