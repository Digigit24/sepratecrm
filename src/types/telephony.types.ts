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
  webhook_secret_configured: boolean;
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

export interface ZataStorageCredential {
  id: number;
  endpoint_url: string;
  bucket_name: string;
  access_key_id: string;
  secret_configured: boolean;
  object_prefix: string;
  region_name: string;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_error: string;
  created_at: string;
  updated_at: string;
}

export interface ZataStorageCredentialInput {
  endpoint_url: string;
  bucket_name: string;
  access_key_id: string;
  secret_access_key?: string;
  object_prefix: string;
  region_name?: string;
  is_active?: boolean;
}

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
  recording_storage_status: 'telecmi' | 'pending' | 'archiving' | 'archived' | 'failed';
  recording_content_type: string | null;
  recording_size: number | null;
  recording_archived_at: string | null;
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
  status: 'success' | 'partial' | 'failed';
  error?: string;
  error_details?: string[];
}

export interface RecordingAccessResponse {
  source: 'zata' | 'telecmi';
  url: string | null;
  expires_in: number;
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

// ==================== CALLING PROFILES (admin) ====================
//
// A calling profile is ONE TeleCMI extension (username + password + caller ID)
// configured centrally by an admin and then handed to one or more users. It is
// the answer to "where does an admin type the extension password?" — the
// per-user TeleCMIAgent record can only ever be written by that user.
//
// `password` is WRITE-ONLY, exactly like TeleCMICredential.secret: it is sent on
// create/update and NEVER comes back. `has_password` is the only signal that one
// is stored, and the UI must never attempt to render the value itself.

export interface CallingProfile {
  id: number;
  /** Human label an admin picks, e.g. "Sales line" / "Support line". */
  label: string;
  /** TeleCMI extension username, format `<extension>_<appid>`. */
  telecmi_user_id: string;
  caller_id: string | null;
  /** Used by any user in the tenant who has no personal assignment. */
  is_default: boolean;
  is_active: boolean;
  /** True when an extension password is stored. The value is never returned. */
  has_password: boolean;
  /** ISO timestamp of the last SUCCESSFUL verify, or null. */
  verified_at: string | null;
  /** Upstream reason the last verify failed, or null/'' when it succeeded. */
  verify_error: string | null;
}

export interface CallingProfileCreateData {
  label: string;
  telecmi_user_id: string;
  /** Write-only. The TeleCMI EXTENSION password, not a CRM password. */
  password: string;
  caller_id?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

/** On update every field is optional — a blank password means "leave it alone". */
export type CallingProfileUpdateData = Partial<CallingProfileCreateData>;

/** POST /calling-profiles/{id}/verify/ — never throws for a bad credential. */
export interface CallingProfileVerifyResponse {
  ok: boolean;
  error: string | null;
}

/** GET /calling-profiles/assignments/ — one row per assigned user. */
export interface CallingProfileAssignment {
  user_id: string;
  profile_id: number;
}

/**
 * Help text for the one field admins most often get wrong. Kept next to the
 * type so the settings card and its tests quote the same words.
 */
export const CALLING_PROFILE_PASSWORD_HELP =
  'This is the TeleCMI extension password from the TeleCMI dashboard (Users → the extension), not a Celiyo/CRM password.';

// ==================== WEBRTC CONFIG (§12) ====================
// What the frontend PIOPIY SDK needs for piopiy.login().
//
// `auth` is the SBC credential the server hands us so the softphone can log in
// without the user re-typing anything. It is a MEMORY-ONLY secret: never log it,
// never persist it (localStorage/sessionStorage/cookies), never put it in a URL.
// It is optional because older backends do not send it yet — in that case the
// user types the password into the softphone login form as before.

/** How to interpret `WebRTCAuth.value`. Both are passed to piopiy.login() as-is. */
export type WebRTCAuthKind = 'token' | 'password';

export interface WebRTCAuth {
  kind: WebRTCAuthKind;
  /** Secret. Memory only — never logged, never persisted, never in a URL. */
  value: string;
}

/**
 * Which identity resolved the config:
 *  - 'user'             → the caller's own TeleCMI agent/extension
 *  - 'assigned_profile' → an admin-managed calling profile assigned to this user
 *  - 'tenant_profile'   → the workspace's DEFAULT calling profile (no personal
 *                         assignment) — shared caller ID + shared SIP identity
 *  - 'tenant_default'   → the legacy tenant credential's default extension
 *                         (backend: the old `TeleCMICredential.default_agent_id`)
 *  - 'tenant'           → DEPRECATED alias for 'tenant_default'. The backend no
 *                         longer emits it, but the two repos deploy
 *                         independently, so an older server must not make the
 *                         widget misreport who it is calling as. Treat it
 *                         EXACTLY like 'tenant_default' everywhere.
 *
 * Anything not listed here is dropped by the service normaliser, so a backend
 * that adds a sixth value later degrades to `null` + neutral copy rather than
 * rendering garbage or blanking the row.
 */
export type WebRTCConfigSource =
  | 'user'
  | 'assigned_profile'
  | 'tenant_profile'
  | 'tenant_default'
  | 'tenant';

export const WEBRTC_CONFIG_SOURCES: readonly WebRTCConfigSource[] = [
  'user',
  'assigned_profile',
  'tenant_profile',
  'tenant_default',
  'tenant',
];

/**
 * True when the resolved identity is a workspace-wide extension rather than one
 * belonging to this user alone. Everyone on a shared identity calls out with the
 * same caller ID and registers the same SIP user — worth saying out loud.
 */
export const isSharedTelephonyIdentity = (
  source: WebRTCConfigSource | null | undefined,
): boolean => source === 'tenant' || source === 'tenant_profile' || source === 'tenant_default';

/** Short human label for a config source, for status rows. */
export const WEBRTC_CONFIG_SOURCE_LABEL: Record<WebRTCConfigSource, string> = {
  user: 'Your own extension',
  assigned_profile: 'Calling profile assigned to you',
  tenant_profile: 'Workspace default calling profile',
  tenant_default: 'Legacy workspace extension',
  // Deprecated alias — must read identically to 'tenant_default'.
  tenant: 'Legacy workspace extension',
};

/** Shown when the backend sends a source value this build does not know. */
export const WEBRTC_CONFIG_SOURCE_FALLBACK_LABEL = 'Workspace telephony identity';

/**
 * Safe label lookup. NEVER index the record directly at a call site: the value
 * ultimately comes off the wire, and a future backend value must land on
 * neutral copy rather than `undefined` (a blank cell) or a thrown narrowing.
 */
export const webrtcConfigSourceLabel = (
  source: WebRTCConfigSource | string | null | undefined,
): string => {
  if (!source) return '—';
  return (
    WEBRTC_CONFIG_SOURCE_LABEL[source as WebRTCConfigSource] ??
    WEBRTC_CONFIG_SOURCE_FALLBACK_LABEL
  );
};

export interface WebRTCConfig {
  telecmi_user_id: string;
  sbc_host: string;
  default_caller_id: string | null;
  /** Absent on backends that have not shipped server-side auth yet. */
  auth?: WebRTCAuth | null;
  /** Absent on backends that have not shipped identity attribution yet. */
  source?: WebRTCConfigSource | null;
}

// ==================== 424 "NOT CONFIGURED" REASONS ====================
// GET /telephony/webrtc-config/ answers 424 with { error, reason }. The two
// reasons need different copy and different calls to action — see
// TelephonyProvider / Softphone.

export type TelephonyNotConfiguredReason =
  /** The workspace has never connected TeleCMI. An admin must do it once. */
  | 'tenant_not_configured'
  /** Workspace is connected, but this user has no TeleCMI extension. */
  | 'no_agent';

export const TELEPHONY_NOT_CONFIGURED_REASONS: readonly TelephonyNotConfiguredReason[] = [
  'tenant_not_configured',
  'no_agent',
];

/** Generic copy for a 424 whose `reason` we do not recognise. */
export const TELEPHONY_NOT_CONFIGURED_FALLBACK = 'Set up telephony in Settings';

/**
 * User-facing copy per 424 reason. Lives here (a dependency-free module) so the
 * softphone, the settings card and toasts all say the same thing without any of
 * them pulling in the service layer. These are EXPECTED states — the UI must
 * never render them as a crash.
 */
export const TELEPHONY_NOT_CONFIGURED_COPY: Record<
  TelephonyNotConfiguredReason,
  { title: string; detail: string }
> = {
  tenant_not_configured: {
    title: "Telephony isn't set up for this workspace yet",
    detail: 'An admin needs to connect TeleCMI once in Telephony settings.',
  },
  no_agent: {
    title: 'Your account has no TeleCMI extension',
    detail: 'Register your extension in Settings, or ask an admin to assign you one.',
  },
};

/** One-line message for a 424, falling back to generic copy. */
export const telephonyNotConfiguredMessage = (
  reason: TelephonyNotConfiguredReason | null | undefined,
): string =>
  reason ? TELEPHONY_NOT_CONFIGURED_COPY[reason].title : TELEPHONY_NOT_CONFIGURED_FALLBACK;

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
