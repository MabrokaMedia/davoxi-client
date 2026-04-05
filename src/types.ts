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

// ── Business ──

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

// ── Agents ──

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

// ── Client Options ──

export interface DavoxiClientOptions {
  apiUrl?: string;
  apiKey: string;
  /** Default request timeout in milliseconds (default: 30 000). */
  timeout?: number;
}
