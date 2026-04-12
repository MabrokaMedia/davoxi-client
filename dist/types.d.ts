/**
 * TypeScript interfaces for the Davoxi API data models.
 *
 * Merged from davoxi-cli and davoxi-mcp — keeps the superset of all fields.
 */
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
}
export interface CreateBusinessInput {
    name: string;
    phone_numbers?: string[];
    voice_config?: Partial<VoiceConfig>;
    master_config?: Partial<MasterConfig>;
}
export interface UpdateBusinessInput {
    name?: string;
    phone_numbers?: string[];
    voice_config?: Partial<VoiceConfig>;
    master_config?: Partial<MasterConfig>;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    endpoint?: string;
    auth_ssm_path?: string;
    requires_confirmation?: boolean;
}
export interface AgentStats {
    total_invocations: number;
    resolved_invocations: number;
    avg_latency_ms: number;
    avg_caller_rating: number;
    paid_boost?: number;
}
export interface AgentDefinition {
    business_id: string;
    agent_id: string;
    description: string;
    system_prompt: string;
    tools: ToolDefinition[];
    knowledge_sources: string[];
    trigger_tags: string[];
    enabled: boolean;
    created_at: string;
    updated_at: string;
    stats: AgentStats;
}
export interface CreateAgentInput {
    description: string;
    system_prompt: string;
    tools?: ToolDefinition[];
    knowledge_sources?: string[];
    trigger_tags?: string[];
    enabled?: boolean;
}
export interface UpdateAgentInput {
    description?: string;
    system_prompt?: string;
    tools?: ToolDefinition[];
    knowledge_sources?: string[];
    trigger_tags?: string[];
    enabled?: boolean;
}
export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}
export interface UserProfile {
    user_id: string;
    email: string;
    name?: string;
    role?: string;
    created_at: string;
}
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
export interface ApiKey {
    prefix: string;
    name?: string;
    created_at: string;
    last_used_at?: string;
}
export interface ApiKeyCreated extends ApiKey {
    key: string;
}
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
export interface PhoneNumber {
    phone_number: string;
    business_id?: string;
    friendly_name?: string;
    capabilities: string[];
    status: string;
}
export interface DavoxiClientOptions {
    apiUrl?: string;
    apiKey: string;
    /** Default request timeout in milliseconds (default: 30 000). */
    timeout?: number;
}
