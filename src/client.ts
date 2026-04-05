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
  Business,
  CreateAgentInput,
  CreateBusinessInput,
  DavoxiClientOptions,
  Invoice,
  Subscription,
  UpdateAgentInput,
  UpdateBusinessInput,
  UsageRecord,
  UsageSummary,
  UserProfile,
} from "./types";

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
  //  Usage & Analytics                                                   //
  // ------------------------------------------------------------------ //

  async getUsage(signal?: AbortSignal): Promise<UsageRecord[]> {
    return this.request<UsageRecord[]>("GET", "/usage", undefined, signal);
  }

  async getUsageSummary(signal?: AbortSignal): Promise<UsageSummary> {
    return this.request<UsageSummary>("GET", "/usage/summary", undefined, signal);
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
}
