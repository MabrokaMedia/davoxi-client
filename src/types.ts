/**
 * TypeScript interfaces for the Davoxi API data models.
 *
 * Merged from davoxi-cli and davoxi-mcp — keeps the superset of all fields.
 */

// ── Voice & Master Config ──

export interface VoiceConfig {
  voice: string;
  language: string;
  personality_prompt: string;
  pipeline?: string;
  cartesia_voice_id?: string;
  groq_model?: string;
}

export interface MasterConfig {
  temperature: number;
  max_specialists_per_turn: number;
}

/**
 * Per-business LLM model + escalation-ladder override (doc-34 coupling #6).
 *
 * Every field is optional. Unset fields fall through to the platform
 * default in the backend's `shared::llm_defaults` module — so a row
 * with NO `llm_config` behaves identically to today's hardcoded
 * defaults. Operators flip an existing business to a custom model
 * via `update_business` without a code deploy.
 *
 * For each role (`master`, `specialist`, `brain`, `chat`):
 * - `*_model` pins the head model used by the agent's `LlmBinding`
 *   (the model attempted first by the EscalationLayer).
 * - `*_ladder` is the full escalation order. Set to a one-element
 *   array to PIN the business to that single model with NO fallback
 *   (the canonical "cost-optimize on Haiku-only" use case). Set to
 *   `[]` to skip escalation entirely and run the head model once.
 */
export interface LlmConfig {
  master_model?: string;
  master_ladder?: string[];
  specialist_model?: string;
  specialist_ladder?: string[];
  brain_model?: string;
  brain_ladder?: string[];
  chat_model?: string;
  chat_ladder?: string[];
}

// ── Business ──

/**
 * Per-business configuration for the broker network. Controls how this
 * business participates in org-scoped discovery (the master orchestrator
 * uses `discoverable` + `categories` to decide which businesses a caller
 * intent can fan out to). Mirrors `shared::models::NetworkConfig` on the
 * Rust backend — field names are snake_case on the wire.
 */
export interface NetworkConfig {
  /** Whether this business is discoverable by other businesses / the master orchestrator. Defaults to `true` on the backend when absent. */
  discoverable?: boolean;
  /** Contact methods other businesses may use. Values: `"api"`, `"ai"`, `"voice"`. */
  allowed_methods?: string[];
  /** Categories this business serves (e.g. `["music", "streaming"]`). Empty means all categories. */
  categories?: string[];
  /** Max voice calls per hour via the broker. */
  voice_rate_limit_per_hour?: number;
  /** Max total contacts (all methods) per hour via the broker. */
  total_rate_limit_per_hour?: number;
}

export interface Business {
  business_id: string;
  name: string;
  phone_numbers: string[];
  voice_config: VoiceConfig;
  master_config: MasterConfig;
  created_at: string;
  updated_at: string;
  extension?: string;
  owner_email?: string;
  network_config?: NetworkConfig;
  /** Per-business LLM model + ladder override. Absent when the business uses platform defaults. */
  llm_config?: LlmConfig;
}

export interface CreateBusinessInput {
  name: string;
  phone_numbers?: string[];
  voice_config?: Partial<VoiceConfig>;
  master_config?: Partial<MasterConfig>;
  network_config?: NetworkConfig;
}

export interface UpdateBusinessInput {
  name?: string;
  phone_numbers?: string[];
  voice_config?: Partial<VoiceConfig>;
  master_config?: Partial<MasterConfig>;
  network_config?: NetworkConfig;
  /**
   * Per-business LLM model + ladder override (doc-34 coupling #6).
   *
   * Partial-merge on the backend: fields present here REPLACE the
   * matching field on the row, fields absent are PRESERVED. To clear
   * a single field, send it as `null`. To drop the whole config and
   * fall back to platform defaults, send `llm_config: null`.
   */
  llm_config?: LlmConfig | null;
}

// ── Agents ──

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  endpoint?: string;
  auth_ssm_path?: string;
  requires_confirmation?: boolean;
}

/**
 * Reference to a tool in `davoxi-tool-registry-{stage}`. Attached to an
 * agent's `tool_refs` list. The runtime resolves each ref against the
 * registry at dispatch time — endpoint, schema, and auth all live on
 * the registry row. This is the tools-SSOT pattern that replaces
 * embedding a full `ToolDefinition` copy on each agent.
 */
export interface ToolRef {
  /** `tool_id` of the row in `davoxi-tool-registry-{stage}`. */
  tool_id: string;
  /**
   * Optional per-agent override of the registered tool's
   * `requires_confirmation` flag. `null` / absent means "use the
   * registry value".
   */
  requires_confirmation_override?: boolean | null;
}

export interface AgentStats {
  total_invocations: number;
  resolved_invocations: number;
  avg_latency_ms: number;
  avg_caller_rating: number;
  paid_boost?: number;
}

export interface ReadWritePerm {
  read: boolean;
  write: boolean;
}

export interface AgentPermissions {
  tool_access?: {
    mode: 'allow_all' | 'allow_list' | 'deny_list';
    tools?: string[];
  };
  memory?: {
    session?: ReadWritePerm;
    caller?: ReadWritePerm;
    business?: ReadWritePerm;
    kind?: ReadWritePerm;
    global?: ReadWritePerm;
  };
  pii_policy?: 'allow' | 'redact' | 'forbid';
  budget?: {
    tokens_per_turn?: number;
    tool_calls?: number;
    wall_clock_ms?: number;
  };
  cross_org?: {
    mode: 'in_org_only' | 'approved' | 'allow';
    approved_businesses?: string[];
  };
  allowed_agents?: string[];
  allowed_hosts?: string[];
}

export interface AgentDefinition {
  business_id: string;
  agent_id: string;
  /**
   * Human name chosen by the business — "Ride booking", "Airtime top-up".
   * Distinct from `description`, which is prose the master routes on and
   * indexing embeds. Absent on every agent written before the field
   * existed, so consumers fall back to the capability or the description.
   */
  name?: string;
  description: string;
  system_prompt: string;
  /**
   * Registry-driven tool references (tools-SSOT). Each entry points at a
   * `RegisteredTool` in the tool-registry by id; the runtime resolves
   * endpoint / schema / auth from the registry at dispatch time.
   *
   * When `tool_refs` is non-empty the runtime prefers it over the
   * legacy `tools` array — see `davoxi-backend/docs/tools-ssot` for the
   * migration model. Optional for back-compat with pre-migration rows.
   */
  tool_refs?: ToolRef[];
  /**
   * Legacy embedded tool definitions. Preferred path is `tool_refs`
   * above; `tools` stays populated during the migration window so
   * in-flight Lambdas that haven't picked up the new resolution code
   * can still dispatch. Cleanup lands once every row has `tool_refs`.
   */
  tools: ToolDefinition[];
  knowledge_sources: string[];
  trigger_tags: string[];
  enabled: boolean;
  permissions?: AgentPermissions;
  created_at: string;
  updated_at: string;
  stats: AgentStats;
}

export interface CreateAgentInput {
  /** Human name for the agent (max 80 chars). */
  name?: string;
  description: string;
  system_prompt: string;
  tools?: ToolDefinition[];
  knowledge_sources?: string[];
  trigger_tags?: string[];
  enabled?: boolean;
  permissions?: AgentPermissions;
}

export interface UpdateAgentInput {
  /** Rename the agent. Does not re-embed it — the description is what
   *  indexing matches against, not this. */
  name?: string;
  description?: string;
  system_prompt?: string;
  tools?: ToolDefinition[];
  knowledge_sources?: string[];
  trigger_tags?: string[];
  enabled?: boolean;
  permissions?: AgentPermissions | null;
}

// ── Auth ──

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

// ── Users ──

export interface UserProfile {
  user_id: string;
  email: string;
  name?: string;
  role?: string;
  created_at: string;
}

// ── Usage ──

export interface UsageRecord {
  resource: string;
  period: string;
  count: number;
  cost: number;
}

export interface UsageSummary {
  total_calls: number;
  total_minutes: number;
  total_cost: number;
  period_start: string;
  period_end: string;
}

// ── Billing ──

export interface Subscription {
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  monthly_cost?: number;
  usage_limit?: number;
  cancel_at_period_end?: boolean;
}

export interface Invoice {
  invoice_id: string;
  amount: number;
  currency?: string;
  status: string;
  date?: string;
  created_at?: string;
  pdf_url?: string;
}

// ── Usage Detail ──

export interface UsageByKind {
  calls: number;
  minutes: number;
  api_requests: number;
  llm_input_tokens: number;
  llm_output_tokens: number;
  tool_calls: number;
  tts_characters: number;
  stt_seconds: number;
  mesh_dispatches: number;
  voice_minutes: number;
}

export interface CostBreakdown {
  base_plan_cents: number;
  overage_cents: number;
  overage_minutes: number;
  overage_api_requests: number;
  estimated_total_cents: number;
}

export interface UsageDetail {
  org_id: string;
  period: string;
  plan_id: string;
  by_kind: UsageByKind;
  daily: UsageRecord[];
  cost_breakdown: CostBreakdown;
}

// ── Accounting (Billing Events & Ledger) ──

export interface BillingEventRecord {
  org_id: string;
  event_id: string;
  event_type: string;
  payload: string;
  created_at: string;
}

export interface BillingEventsResponse {
  events: BillingEventRecord[];
  next_cursor: string | null;
  count: number;
}

export interface EventTypeSummary {
  count: number;
  latest_at: string;
}

export interface BillingEventsSummary {
  org_id: string;
  period: string;
  total_events: number;
  by_type: Record<string, EventTypeSummary>;
}

export interface LedgerEntry {
  type: "record" | "event";
  timestamp: string;
  data: Record<string, unknown>;
}

export interface LedgerResponse {
  org_id: string;
  entries: LedgerEntry[];
  count: number;
}

// ── API Keys ──

export interface ApiKey {
  prefix: string;
  name?: string;
  created_at: string;
  last_used_at?: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

// ── Tool Credentials (shared, org-wide API keys consumed by tools) ──

export interface ToolCredential {
  /** Friendly name — e.g. "ticketmaster", "openweathermap". */
  key_name: string;
  /** Fully-qualified SSM parameter path (auto-generated from key_name). */
  ssm_path: string;
  /** Whether a value is currently stored for this key. */
  is_set: boolean;
  /** Human-readable description of what this credential is for. */
  description: string;
}

// ── Call Logs ──

export interface CallLog {
  call_id: string;
  business_id: string;
  agent_id?: string;
  phone_number: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "failed" | "in_progress";
  duration_seconds: number;
  started_at: string;
  ended_at?: string;
  summary?: string;
  recording_url?: string;
  transcript_url?: string;
}

export interface CallLogFilters {
  /** ISO 8601 start date (e.g. '2026-01-01'). */
  start_date?: string;
  /** ISO 8601 end date (e.g. '2026-01-31'). */
  end_date?: string;
  /** Filter by call status. */
  status?: "completed" | "missed" | "failed" | "in_progress";
  /** Filter by agent ID. */
  agent_id?: string;
  /** Max results to return (default 50, max 100). */
  limit?: number;
  /** Pagination cursor from previous response. */
  cursor?: string;
}

export interface GetCallLogFilters {
  /**
   * Date the call started, in YYYY-MM-DD (UTC). Required by the upstream
   * Davoxi API to locate the call log under the per-day S3 partition.
   */
  date?: string;
}

// ── Webhooks ──

export interface Webhook {
  webhook_id: string;
  business_id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  enabled?: boolean;
}

export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  enabled?: boolean;
}

// ── Test Call Token (chat-mode WebSocket session) ──

export interface CreateTestCallTokenInput {
  /** Business whose agents to test. Must belong to the authenticated org. */
  business_id: string;
  /**
   * Session mode. Use `"chat"` for WhatsApp-style text testing from
   * MCP / SDK clients. `"voice"` (the default) requires a real-time
   * audio stream and is only useful from a browser.
   */
  mode?: "chat" | "voice";
  /** Restrict the test session to a specific specialist agent. */
  agent_id?: string;
}

export interface TestCallToken {
  /** Short-lived (60 s) JWT to send as the first WebSocket frame. */
  token: string;
  /** Apprunner WebSocket URL — e.g. `wss://apprunner.davoxi.com/ws/voice`. */
  ws_url: string;
  mode?: string;
  agent_id?: string;
}

// ── Phone Numbers ──

export interface PhoneNumber {
  phone_number: string;
  business_id?: string;
  friendly_name?: string;
  capabilities: string[];
  status: string;
}

// ── Org metadata ──

/**
 * Non-sensitive Org metadata returned by `GET /api/orgs/{id}`.
 *
 * Sensitive fields (`twilio_link` credentials, etc.) are NOT included; they
 * have their own dedicated endpoints. `twilio_link_kind` is a presence-only
 * signal — typically `"subaccount"` / `"connect"` / null when no link is
 * configured.
 */
export interface Org {
  org_id: string;
  name: string;
  owner_id: string | null;
  plan_id: string | null;
  business_ids: string[];
  twilio_link_kind: string | null;
}

/**
 * Partial-update payload for `PUT /api/orgs/{id}`.
 *
 * Only the fields you want to change need to be present. Pass `plan_id: null`
 * to clear the plan.
 *
 * `business_ids`, `twilio_link`, and `owner_id` are read-only on this
 * endpoint — they're maintained by their respective sub-resources.
 */
export interface UpdateOrgInput {
  name?: string;
  plan_id?: string | null;
}

// ── Client Options ──

export interface DavoxiClientOptions {
  apiUrl?: string;
  apiKey: string;
  /** Default request timeout in milliseconds (default: 30 000). */
  timeout?: number;
}
