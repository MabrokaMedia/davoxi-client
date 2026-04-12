/**
 * DavoxiClient -- unified HTTP client wrapping the Davoxi REST API.
 *
 * Uses native `fetch`, zero runtime dependencies.
 * All methods return parsed JSON or throw `DavoxiApiError`.
 */
import type { AgentDefinition, ApiKey, ApiKeyCreated, AuthTokens, Business, CallLog, CallLogFilters, CreateAgentInput, CreateBusinessInput, CreateWebhookInput, DavoxiClientOptions, Invoice, PhoneNumber, Subscription, UpdateAgentInput, UpdateBusinessInput, UpdateWebhookInput, UsageRecord, UsageSummary, UserProfile, Webhook } from "./types";
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
    getUsage(signal?: AbortSignal): Promise<UsageRecord[]>;
    getUsageSummary(signal?: AbortSignal): Promise<UsageSummary>;
    getSubscription(signal?: AbortSignal): Promise<Subscription>;
    listInvoices(signal?: AbortSignal): Promise<Invoice[]>;
    listApiKeys(signal?: AbortSignal): Promise<ApiKey[]>;
    createApiKey(name?: string, signal?: AbortSignal): Promise<ApiKeyCreated>;
    revokeApiKey(prefix: string, signal?: AbortSignal): Promise<void>;
    listCallLogs(businessId: string, filters?: CallLogFilters, signal?: AbortSignal): Promise<{
        calls: CallLog[];
        next_cursor?: string;
    }>;
    getCallLog(businessId: string, callId: string, signal?: AbortSignal): Promise<CallLog>;
    listWebhooks(businessId: string, signal?: AbortSignal): Promise<Webhook[]>;
    createWebhook(businessId: string, data: CreateWebhookInput, signal?: AbortSignal): Promise<Webhook>;
    updateWebhook(businessId: string, webhookId: string, data: UpdateWebhookInput, signal?: AbortSignal): Promise<Webhook>;
    deleteWebhook(businessId: string, webhookId: string, signal?: AbortSignal): Promise<void>;
    listPhoneNumbers(signal?: AbortSignal): Promise<PhoneNumber[]>;
    duplicateAgent(businessId: string, agentId: string, overrides?: Partial<CreateAgentInput>, signal?: AbortSignal): Promise<AgentDefinition>;
}
