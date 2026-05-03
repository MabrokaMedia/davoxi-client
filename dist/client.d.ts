/**
 * DavoxiClient -- unified HTTP client wrapping the Davoxi REST API.
 *
 * Uses native `fetch`, zero runtime dependencies.
 * All methods return parsed JSON or throw `DavoxiApiError`.
 */
import type { AgentDefinition, ApiKey, ApiKeyCreated, AuthTokens, ToolRef, BillingEventsResponse, BillingEventsSummary, Business, CallLog, CallLogFilters, GetCallLogFilters, CreateAgentInput, CreateBusinessInput, CreateTestCallTokenInput, CreateWebhookInput, DavoxiClientOptions, Invoice, LedgerResponse, Org, PhoneNumber, Subscription, UpdateOrgInput, TestCallToken, ToolCredential, UpdateAgentInput, UpdateBusinessInput, UpdateWebhookInput, UsageDetail, UsageRecord, UsageSummary, UserProfile, Webhook } from "./types";
export declare class DavoxiApiError extends Error {
    readonly statusCode: number;
    readonly statusText: string;
    readonly body: string;
    readonly code?: string | undefined;
    constructor(statusCode: number, statusText: string, body: string, code?: string | undefined);
}
export declare class DavoxiClient {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly timeout;
    constructor(options: DavoxiClientOptions);
    private request;
    private static enc;
    login(email: string, password: string, signal?: AbortSignal): Promise<AuthTokens>;
    refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthTokens>;
    getProfile(signal?: AbortSignal): Promise<UserProfile>;
    /** Read non-sensitive Org metadata (name, owner, plan, business_ids). */
    getOrg(orgId: string, signal?: AbortSignal): Promise<Org>;
    /**
     * Partial-update Org metadata. Only the fields you include are changed.
     * Pass `plan_id: null` to clear the plan.
     */
    updateOrg(orgId: string, input: UpdateOrgInput, signal?: AbortSignal): Promise<Pick<Org, "org_id" | "name" | "plan_id">>;
    listBusinesses(signal?: AbortSignal): Promise<Business[]>;
    getBusiness(id: string, signal?: AbortSignal): Promise<Business>;
    createBusiness(data: CreateBusinessInput, signal?: AbortSignal): Promise<Business>;
    updateBusiness(id: string, data: UpdateBusinessInput, signal?: AbortSignal): Promise<Business>;
    deleteBusiness(id: string, signal?: AbortSignal): Promise<void>;
    listAgents(businessId: string, signal?: AbortSignal): Promise<AgentDefinition[]>;
    getAgent(businessId: string, agentId: string, signal?: AbortSignal): Promise<AgentDefinition>;
    createAgent(businessId: string, data: CreateAgentInput, signal?: AbortSignal): Promise<AgentDefinition>;
    updateAgent(businessId: string, agentId: string, data: UpdateAgentInput, signal?: AbortSignal): Promise<AgentDefinition>;
    deleteAgent(businessId: string, agentId: string, signal?: AbortSignal): Promise<void>;
    attachToolRef(businessId: string, agentId: string, toolId: string, options?: {
        requires_confirmation_override?: boolean;
    }, signal?: AbortSignal): Promise<{
        agent_id: string;
        tool_refs: ToolRef[];
        replaced: boolean;
    }>;
    detachToolRef(businessId: string, agentId: string, toolId: string, signal?: AbortSignal): Promise<{
        removed: boolean;
    }>;
    getUsage(signal?: AbortSignal): Promise<UsageRecord[]>;
    getUsageSummary(signal?: AbortSignal): Promise<UsageSummary>;
    getUsageDetail(signal?: AbortSignal): Promise<UsageDetail>;
    getSubscription(signal?: AbortSignal): Promise<Subscription>;
    listInvoices(signal?: AbortSignal): Promise<Invoice[]>;
    listBillingEvents(params?: {
        limit?: number;
        cursor?: string;
        type?: string;
    }, signal?: AbortSignal): Promise<BillingEventsResponse>;
    getBillingEventsSummary(signal?: AbortSignal): Promise<BillingEventsSummary>;
    getLedger(signal?: AbortSignal): Promise<LedgerResponse>;
    listApiKeys(signal?: AbortSignal): Promise<ApiKey[]>;
    createApiKey(name?: string, signal?: AbortSignal): Promise<ApiKeyCreated>;
    revokeApiKey(prefix: string, signal?: AbortSignal): Promise<void>;
    /**
     * List all tool credentials available to this org. Each entry shows the
     * friendly `key_name`, the auto-generated `ssm_path`, and `is_set` (whether
     * a secret value is currently stored). Use the `ssm_path` when configuring
     * a tool's `auth_ssm_path`, or leave `auth_ssm_path` empty for public APIs.
     */
    listToolCredentials(signal?: AbortSignal): Promise<ToolCredential[]>;
    /**
     * Create or update a tool credential. The backend stores the value in AWS
     * SSM Parameter Store as a SecureString and returns the generated `ssm_path`.
     * Key name must be 1-50 chars, alphanumeric plus `-_`.
     */
    setToolCredential(keyName: string, value: string, signal?: AbortSignal): Promise<void>;
    listCallLogs(businessId: string, filters?: CallLogFilters, signal?: AbortSignal): Promise<{
        calls: CallLog[];
        next_cursor?: string;
    }>;
    getCallLog(businessId: string, callId: string, filters?: GetCallLogFilters, signal?: AbortSignal): Promise<CallLog>;
    listWebhooks(businessId: string, signal?: AbortSignal): Promise<Webhook[]>;
    createWebhook(businessId: string, data: CreateWebhookInput, signal?: AbortSignal): Promise<Webhook>;
    updateWebhook(businessId: string, webhookId: string, data: UpdateWebhookInput, signal?: AbortSignal): Promise<Webhook>;
    deleteWebhook(businessId: string, webhookId: string, signal?: AbortSignal): Promise<void>;
    listPhoneNumbers(signal?: AbortSignal): Promise<PhoneNumber[]>;
    /**
     * Mint a short-lived (60 s) JWT for a test WebSocket session against
     * a deployed business + agent. Used by MCP / dashboard clients to
     * exercise the same Brain → Master → Specialist chain that real
     * WhatsApp / voice traffic uses, without sending a real Twilio
     * message.
     *
     * Pair with `mode: "chat"` for text-based testing.
     */
    createTestCallToken(input: CreateTestCallTokenInput, signal?: AbortSignal): Promise<TestCallToken>;
    duplicateAgent(businessId: string, agentId: string, overrides?: Partial<CreateAgentInput>, signal?: AbortSignal): Promise<AgentDefinition>;
}
