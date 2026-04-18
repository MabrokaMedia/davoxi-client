/**
 * DavoxiClient -- unified HTTP client wrapping the Davoxi REST API.
 *
 * Uses native `fetch`, zero runtime dependencies.
 * All methods return parsed JSON or throw `DavoxiApiError`.
 */

import type {
  AgentDefinition,
  ApiKey,
  ApiKeyCreated,
  AuthTokens,
  ToolRef,
  BillingEventsResponse,
  BillingEventsSummary,
  Business,
  CallLog,
  CallLogFilters,
  CreateAgentInput,
  CreateBusinessInput,
  CreateWebhookInput,
  DavoxiClientOptions,
  Invoice,
  LedgerResponse,
  PhoneNumber,
  Subscription,
  ToolCredential,
  UpdateAgentInput,
  UpdateBusinessInput,
  UpdateWebhookInput,
  UsageDetail,
  UsageRecord,
  UsageSummary,
  UserProfile,
  Webhook,
} from "./types";

import {
  createAgentSchema,
  updateAgentSchema,
  validateAgentTools,
} from "@davoxi/validation";

// ------------------------------------------------------------------ //
//  Error                                                              //
// ------------------------------------------------------------------ //

export class DavoxiApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly code?: string,
  ) {
    super(`Davoxi API error ${statusCode} ${statusText}: ${body}`);
    this.name = "DavoxiApiError";
  }
}

// ------------------------------------------------------------------ //
//  Client                                                             //
// ------------------------------------------------------------------ //

export class DavoxiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(options: DavoxiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.apiUrl ?? "https://api.davoxi.com").replace(
      /\/+$/,
      "",
    );
    this.timeout = options.timeout ?? 30_000;
  }

  // ------------------------------------------------------------------ //
  //  Internal helpers                                                    //
  // ------------------------------------------------------------------ //

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    const timeoutSignal = AbortSignal.timeout(this.timeout);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const init: RequestInit = {
      method,
      headers,
      signal: combinedSignal,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      throw new Error(
        `Network error calling Davoxi API (${method} ${path}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let code: string | undefined;
      try {
        const parsed = JSON.parse(text) as { code?: string };
        code = parsed.code;
      } catch {
        // not JSON -- that's fine
      }
      throw new DavoxiApiError(res.status, res.statusText, text, code);
    }

    // 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        `Davoxi API returned non-JSON response (${res.status}): ${text.slice(0, 200)}`,
      );
    }
  }

  private static enc(value: string): string {
    return encodeURIComponent(value);
  }

  // ------------------------------------------------------------------ //
  //  Auth                                                                //
  // ------------------------------------------------------------------ //

  async login(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<AuthTokens> {
    return this.request<AuthTokens>("POST", "/auth/login", { email, password }, signal);
  }

  async refresh(
    refreshToken: string,
    signal?: AbortSignal,
  ): Promise<AuthTokens> {
    return this.request<AuthTokens>(
      "POST",
      "/auth/refresh",
      { refresh_token: refreshToken },
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Users                                                               //
  // ------------------------------------------------------------------ //

  async getProfile(signal?: AbortSignal): Promise<UserProfile> {
    return this.request<UserProfile>("GET", "/users/me", undefined, signal);
  }

  // ------------------------------------------------------------------ //
  //  Businesses                                                          //
  // ------------------------------------------------------------------ //

  async listBusinesses(signal?: AbortSignal): Promise<Business[]> {
    return this.request<Business[]>("GET", "/businesses", undefined, signal);
  }

  async getBusiness(id: string, signal?: AbortSignal): Promise<Business> {
    return this.request<Business>(
      "GET",
      `/businesses/${DavoxiClient.enc(id)}`,
      undefined,
      signal,
    );
  }

  async createBusiness(
    data: CreateBusinessInput,
    signal?: AbortSignal,
  ): Promise<Business> {
    return this.request<Business>("POST", "/businesses", data, signal);
  }

  async updateBusiness(
    id: string,
    data: UpdateBusinessInput,
    signal?: AbortSignal,
  ): Promise<Business> {
    return this.request<Business>(
      "PUT",
      `/businesses/${DavoxiClient.enc(id)}`,
      data,
      signal,
    );
  }

  async deleteBusiness(id: string, signal?: AbortSignal): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/businesses/${DavoxiClient.enc(id)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Agents                                                              //
  // ------------------------------------------------------------------ //

  async listAgents(
    businessId: string,
    signal?: AbortSignal,
  ): Promise<AgentDefinition[]> {
    return this.request<AgentDefinition[]>(
      "GET",
      `/businesses/${DavoxiClient.enc(businessId)}/agents`,
      undefined,
      signal,
    );
  }

  async getAgent(
    businessId: string,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<AgentDefinition> {
    return this.request<AgentDefinition>(
      "GET",
      `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`,
      undefined,
      signal,
    );
  }

  async createAgent(
    businessId: string,
    data: CreateAgentInput,
    signal?: AbortSignal,
  ): Promise<AgentDefinition> {
    createAgentSchema.parse(data);
    if (data.tools?.length) {
      validateAgentTools(businessId, data.tools);
    }
    return this.request<AgentDefinition>(
      "POST",
      `/businesses/${DavoxiClient.enc(businessId)}/agents`,
      data,
      signal,
    );
  }

  async updateAgent(
    businessId: string,
    agentId: string,
    data: UpdateAgentInput,
    signal?: AbortSignal,
  ): Promise<AgentDefinition> {
    updateAgentSchema.parse(data);
    if (data.tools?.length) {
      validateAgentTools(businessId, data.tools);
    }
    return this.request<AgentDefinition>(
      "PUT",
      `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`,
      data,
      signal,
    );
  }

  async deleteAgent(
    businessId: string,
    agentId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Agent tool_refs (tools-SSOT)                                        //
  //                                                                      //
  //  Attach / detach a registered tool (by tool_id from the tool-       //
  //  registry) to an agent's tool_refs list. Replaces the legacy pattern //
  //  of embedding a full ToolDefinition copy on the agent row — the     //
  //  runtime now resolves tool_refs against the registry at dispatch    //
  //  time so endpoint / schema / auth config flow from one source of    //
  //  truth.                                                              //
  //                                                                      //
  //  Attach is idempotent: re-attaching the same tool_id with a new     //
  //  `requires_confirmation_override` just updates the override in-     //
  //  place. Detach is idempotent too — no error when the ref is absent. //
  // ------------------------------------------------------------------ //

  async attachToolRef(
    businessId: string,
    agentId: string,
    toolId: string,
    options?: { requires_confirmation_override?: boolean },
    signal?: AbortSignal,
  ): Promise<{ agent_id: string; tool_refs: ToolRef[]; replaced: boolean }> {
    return this.request(
      "POST",
      `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}/tool-refs`,
      {
        tool_id: toolId,
        ...(options?.requires_confirmation_override !== undefined && {
          requires_confirmation_override: options.requires_confirmation_override,
        }),
      },
      signal,
    );
  }

  async detachToolRef(
    businessId: string,
    agentId: string,
    toolId: string,
    signal?: AbortSignal,
  ): Promise<{ removed: boolean }> {
    return this.request(
      "DELETE",
      `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}/tool-refs/${DavoxiClient.enc(toolId)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Usage & Analytics                                                   //
  // ------------------------------------------------------------------ //

  async getUsage(signal?: AbortSignal): Promise<UsageRecord[]> {
    return this.request<UsageRecord[]>("GET", "/usage", undefined, signal);
  }

  async getUsageSummary(signal?: AbortSignal): Promise<UsageSummary> {
    return this.request<UsageSummary>("GET", "/usage/summary", undefined, signal);
  }

  async getUsageDetail(signal?: AbortSignal): Promise<UsageDetail> {
    return this.request<UsageDetail>("GET", "/usage/detail", undefined, signal);
  }

  // ------------------------------------------------------------------ //
  //  Billing                                                             //
  // ------------------------------------------------------------------ //

  async getSubscription(signal?: AbortSignal): Promise<Subscription> {
    return this.request<Subscription>(
      "GET",
      "/billing/subscription",
      undefined,
      signal,
    );
  }

  async listInvoices(signal?: AbortSignal): Promise<Invoice[]> {
    return this.request<Invoice[]>("GET", "/billing/invoices", undefined, signal);
  }

  // ------------------------------------------------------------------ //
  //  Accounting (Billing Events & Ledger)                                //
  // ------------------------------------------------------------------ //

  async listBillingEvents(
    params?: { limit?: number; cursor?: string; type?: string },
    signal?: AbortSignal,
  ): Promise<BillingEventsResponse> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.type) qs.set("type", params.type);
    const query = qs.toString();
    return this.request<BillingEventsResponse>(
      "GET",
      `/billing/events${query ? `?${query}` : ""}`,
      undefined,
      signal,
    );
  }

  async getBillingEventsSummary(
    signal?: AbortSignal,
  ): Promise<BillingEventsSummary> {
    return this.request<BillingEventsSummary>(
      "GET",
      "/billing/events/summary",
      undefined,
      signal,
    );
  }

  async getLedger(signal?: AbortSignal): Promise<LedgerResponse> {
    return this.request<LedgerResponse>(
      "GET",
      "/billing/ledger",
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  API Keys                                                            //
  // ------------------------------------------------------------------ //

  async listApiKeys(signal?: AbortSignal): Promise<ApiKey[]> {
    return this.request<ApiKey[]>("GET", "/api-keys", undefined, signal);
  }

  async createApiKey(
    name?: string,
    signal?: AbortSignal,
  ): Promise<ApiKeyCreated> {
    return this.request<ApiKeyCreated>(
      "POST",
      "/api-keys",
      name ? { name } : undefined,
      signal,
    );
  }

  async revokeApiKey(prefix: string, signal?: AbortSignal): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/api-keys/${DavoxiClient.enc(prefix)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Tool Credentials (org-wide, consumed by agent tools)               //
  // ------------------------------------------------------------------ //

  /**
   * List all tool credentials available to this org. Each entry shows the
   * friendly `key_name`, the auto-generated `ssm_path`, and `is_set` (whether
   * a secret value is currently stored). Use the `ssm_path` when configuring
   * a tool's `auth_ssm_path`, or leave `auth_ssm_path` empty for public APIs.
   */
  async listToolCredentials(signal?: AbortSignal): Promise<ToolCredential[]> {
    return this.request<ToolCredential[]>(
      "GET",
      "/tools/api-keys",
      undefined,
      signal,
    );
  }

  /**
   * Create or update a tool credential. The backend stores the value in AWS
   * SSM Parameter Store as a SecureString and returns the generated `ssm_path`.
   * Key name must be 1-50 chars, alphanumeric plus `-_`.
   */
  async setToolCredential(
    keyName: string,
    value: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.request<void>(
      "POST",
      "/tools/api-keys",
      { key_name: keyName, value },
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Call Logs                                                           //
  // ------------------------------------------------------------------ //

  async listCallLogs(
    businessId: string,
    filters?: CallLogFilters,
    signal?: AbortSignal,
  ): Promise<{ calls: CallLog[]; next_cursor?: string }> {
    const params = new URLSearchParams();
    if (filters?.start_date) params.set("start_date", filters.start_date);
    if (filters?.end_date) params.set("end_date", filters.end_date);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.agent_id) params.set("agent_id", filters.agent_id);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.cursor) params.set("cursor", filters.cursor);
    const qs = params.toString();
    return this.request(
      "GET",
      `/businesses/${DavoxiClient.enc(businessId)}/calls${qs ? `?${qs}` : ""}`,
      undefined,
      signal,
    );
  }

  async getCallLog(
    businessId: string,
    callId: string,
    signal?: AbortSignal,
  ): Promise<CallLog> {
    return this.request<CallLog>(
      "GET",
      `/businesses/${DavoxiClient.enc(businessId)}/calls/${DavoxiClient.enc(callId)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Webhooks                                                            //
  // ------------------------------------------------------------------ //

  async listWebhooks(
    businessId: string,
    signal?: AbortSignal,
  ): Promise<Webhook[]> {
    return this.request<Webhook[]>(
      "GET",
      `/businesses/${DavoxiClient.enc(businessId)}/webhooks`,
      undefined,
      signal,
    );
  }

  async createWebhook(
    businessId: string,
    data: CreateWebhookInput,
    signal?: AbortSignal,
  ): Promise<Webhook> {
    return this.request<Webhook>(
      "POST",
      `/businesses/${DavoxiClient.enc(businessId)}/webhooks`,
      data,
      signal,
    );
  }

  async updateWebhook(
    businessId: string,
    webhookId: string,
    data: UpdateWebhookInput,
    signal?: AbortSignal,
  ): Promise<Webhook> {
    return this.request<Webhook>(
      "PUT",
      `/businesses/${DavoxiClient.enc(businessId)}/webhooks/${DavoxiClient.enc(webhookId)}`,
      data,
      signal,
    );
  }

  async deleteWebhook(
    businessId: string,
    webhookId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/businesses/${DavoxiClient.enc(businessId)}/webhooks/${DavoxiClient.enc(webhookId)}`,
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Phone Numbers                                                       //
  // ------------------------------------------------------------------ //

  async listPhoneNumbers(signal?: AbortSignal): Promise<PhoneNumber[]> {
    return this.request<PhoneNumber[]>(
      "GET",
      "/phone-numbers",
      undefined,
      signal,
    );
  }

  // ------------------------------------------------------------------ //
  //  Agent Duplication                                                    //
  // ------------------------------------------------------------------ //

  async duplicateAgent(
    businessId: string,
    agentId: string,
    overrides?: Partial<CreateAgentInput>,
    signal?: AbortSignal,
  ): Promise<AgentDefinition> {
    const source = await this.getAgent(businessId, agentId, signal);
    const newAgent: CreateAgentInput = {
      description: overrides?.description ?? `${source.description} (copy)`,
      system_prompt: overrides?.system_prompt ?? source.system_prompt,
      tools: overrides?.tools ?? source.tools,
      knowledge_sources:
        overrides?.knowledge_sources ?? source.knowledge_sources,
      trigger_tags: overrides?.trigger_tags ?? source.trigger_tags,
      enabled: overrides?.enabled ?? false,
    };
    return this.createAgent(businessId, newAgent, signal);
  }
}
