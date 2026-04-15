"use strict";
/**
 * DavoxiClient -- unified HTTP client wrapping the Davoxi REST API.
 *
 * Uses native `fetch`, zero runtime dependencies.
 * All methods return parsed JSON or throw `DavoxiApiError`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DavoxiClient = exports.DavoxiApiError = void 0;
const validation_1 = require("@davoxi/validation");
// ------------------------------------------------------------------ //
//  Error                                                              //
// ------------------------------------------------------------------ //
class DavoxiApiError extends Error {
    statusCode;
    statusText;
    body;
    code;
    constructor(statusCode, statusText, body, code) {
        super(`Davoxi API error ${statusCode} ${statusText}: ${body}`);
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.body = body;
        this.code = code;
        this.name = "DavoxiApiError";
    }
}
exports.DavoxiApiError = DavoxiApiError;
// ------------------------------------------------------------------ //
//  Client                                                             //
// ------------------------------------------------------------------ //
class DavoxiClient {
    baseUrl;
    apiKey;
    timeout;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.baseUrl = (options.apiUrl ?? "https://api.davoxi.com").replace(/\/+$/, "");
        this.timeout = options.timeout ?? 30_000;
    }
    // ------------------------------------------------------------------ //
    //  Internal helpers                                                    //
    // ------------------------------------------------------------------ //
    async request(method, path, body, signal) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
        };
        const timeoutSignal = AbortSignal.timeout(this.timeout);
        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutSignal])
            : timeoutSignal;
        const init = {
            method,
            headers,
            signal: combinedSignal,
        };
        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(body);
        }
        let res;
        try {
            res = await fetch(url, init);
        }
        catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                throw err;
            }
            throw new Error(`Network error calling Davoxi API (${method} ${path}): ${err instanceof Error ? err.message : String(err)}`);
        }
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            let code;
            try {
                const parsed = JSON.parse(text);
                code = parsed.code;
            }
            catch {
                // not JSON -- that's fine
            }
            throw new DavoxiApiError(res.status, res.statusText, text, code);
        }
        // 204 No Content
        if (res.status === 204) {
            return undefined;
        }
        const text = await res.text();
        try {
            return JSON.parse(text);
        }
        catch {
            throw new Error(`Davoxi API returned non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        }
    }
    static enc(value) {
        return encodeURIComponent(value);
    }
    // ------------------------------------------------------------------ //
    //  Auth                                                                //
    // ------------------------------------------------------------------ //
    async login(email, password, signal) {
        return this.request("POST", "/auth/login", { email, password }, signal);
    }
    async refresh(refreshToken, signal) {
        return this.request("POST", "/auth/refresh", { refresh_token: refreshToken }, signal);
    }
    // ------------------------------------------------------------------ //
    //  Users                                                               //
    // ------------------------------------------------------------------ //
    async getProfile(signal) {
        return this.request("GET", "/users/me", undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Businesses                                                          //
    // ------------------------------------------------------------------ //
    async listBusinesses(signal) {
        return this.request("GET", "/businesses", undefined, signal);
    }
    async getBusiness(id, signal) {
        return this.request("GET", `/businesses/${DavoxiClient.enc(id)}`, undefined, signal);
    }
    async createBusiness(data, signal) {
        return this.request("POST", "/businesses", data, signal);
    }
    async updateBusiness(id, data, signal) {
        return this.request("PUT", `/businesses/${DavoxiClient.enc(id)}`, data, signal);
    }
    async deleteBusiness(id, signal) {
        await this.request("DELETE", `/businesses/${DavoxiClient.enc(id)}`, undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Agents                                                              //
    // ------------------------------------------------------------------ //
    async listAgents(businessId, signal) {
        return this.request("GET", `/businesses/${DavoxiClient.enc(businessId)}/agents`, undefined, signal);
    }
    async getAgent(businessId, agentId, signal) {
        return this.request("GET", `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`, undefined, signal);
    }
    async createAgent(businessId, data, signal) {
        validation_1.createAgentSchema.parse(data);
        if (data.tools?.length) {
            (0, validation_1.validateAgentTools)(businessId, data.tools);
        }
        return this.request("POST", `/businesses/${DavoxiClient.enc(businessId)}/agents`, data, signal);
    }
    async updateAgent(businessId, agentId, data, signal) {
        validation_1.updateAgentSchema.parse(data);
        if (data.tools?.length) {
            (0, validation_1.validateAgentTools)(businessId, data.tools);
        }
        return this.request("PUT", `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`, data, signal);
    }
    async deleteAgent(businessId, agentId, signal) {
        await this.request("DELETE", `/businesses/${DavoxiClient.enc(businessId)}/agents/${DavoxiClient.enc(agentId)}`, undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Usage & Analytics                                                   //
    // ------------------------------------------------------------------ //
    async getUsage(signal) {
        return this.request("GET", "/usage", undefined, signal);
    }
    async getUsageSummary(signal) {
        return this.request("GET", "/usage/summary", undefined, signal);
    }
    async getUsageDetail(signal) {
        return this.request("GET", "/usage/detail", undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Billing                                                             //
    // ------------------------------------------------------------------ //
    async getSubscription(signal) {
        return this.request("GET", "/billing/subscription", undefined, signal);
    }
    async listInvoices(signal) {
        return this.request("GET", "/billing/invoices", undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Accounting (Billing Events & Ledger)                                //
    // ------------------------------------------------------------------ //
    async listBillingEvents(params, signal) {
        const qs = new URLSearchParams();
        if (params?.limit)
            qs.set("limit", String(params.limit));
        if (params?.cursor)
            qs.set("cursor", params.cursor);
        if (params?.type)
            qs.set("type", params.type);
        const query = qs.toString();
        return this.request("GET", `/billing/events${query ? `?${query}` : ""}`, undefined, signal);
    }
    async getBillingEventsSummary(signal) {
        return this.request("GET", "/billing/events/summary", undefined, signal);
    }
    async getLedger(signal) {
        return this.request("GET", "/billing/ledger", undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  API Keys                                                            //
    // ------------------------------------------------------------------ //
    async listApiKeys(signal) {
        return this.request("GET", "/api-keys", undefined, signal);
    }
    async createApiKey(name, signal) {
        return this.request("POST", "/api-keys", name ? { name } : undefined, signal);
    }
    async revokeApiKey(prefix, signal) {
        await this.request("DELETE", `/api-keys/${DavoxiClient.enc(prefix)}`, undefined, signal);
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
    async listToolCredentials(signal) {
        return this.request("GET", "/tools/api-keys", undefined, signal);
    }
    /**
     * Create or update a tool credential. The backend stores the value in AWS
     * SSM Parameter Store as a SecureString and returns the generated `ssm_path`.
     * Key name must be 1-50 chars, alphanumeric plus `-_`.
     */
    async setToolCredential(keyName, value, signal) {
        await this.request("POST", "/tools/api-keys", { key_name: keyName, value }, signal);
    }
    // ------------------------------------------------------------------ //
    //  Call Logs                                                           //
    // ------------------------------------------------------------------ //
    async listCallLogs(businessId, filters, signal) {
        const params = new URLSearchParams();
        if (filters?.start_date)
            params.set("start_date", filters.start_date);
        if (filters?.end_date)
            params.set("end_date", filters.end_date);
        if (filters?.status)
            params.set("status", filters.status);
        if (filters?.agent_id)
            params.set("agent_id", filters.agent_id);
        if (filters?.limit)
            params.set("limit", String(filters.limit));
        if (filters?.cursor)
            params.set("cursor", filters.cursor);
        const qs = params.toString();
        return this.request("GET", `/businesses/${DavoxiClient.enc(businessId)}/calls${qs ? `?${qs}` : ""}`, undefined, signal);
    }
    async getCallLog(businessId, callId, signal) {
        return this.request("GET", `/businesses/${DavoxiClient.enc(businessId)}/calls/${DavoxiClient.enc(callId)}`, undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Webhooks                                                            //
    // ------------------------------------------------------------------ //
    async listWebhooks(businessId, signal) {
        return this.request("GET", `/businesses/${DavoxiClient.enc(businessId)}/webhooks`, undefined, signal);
    }
    async createWebhook(businessId, data, signal) {
        return this.request("POST", `/businesses/${DavoxiClient.enc(businessId)}/webhooks`, data, signal);
    }
    async updateWebhook(businessId, webhookId, data, signal) {
        return this.request("PUT", `/businesses/${DavoxiClient.enc(businessId)}/webhooks/${DavoxiClient.enc(webhookId)}`, data, signal);
    }
    async deleteWebhook(businessId, webhookId, signal) {
        await this.request("DELETE", `/businesses/${DavoxiClient.enc(businessId)}/webhooks/${DavoxiClient.enc(webhookId)}`, undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Phone Numbers                                                       //
    // ------------------------------------------------------------------ //
    async listPhoneNumbers(signal) {
        return this.request("GET", "/phone-numbers", undefined, signal);
    }
    // ------------------------------------------------------------------ //
    //  Agent Duplication                                                    //
    // ------------------------------------------------------------------ //
    async duplicateAgent(businessId, agentId, overrides, signal) {
        const source = await this.getAgent(businessId, agentId, signal);
        const newAgent = {
            description: overrides?.description ?? `${source.description} (copy)`,
            system_prompt: overrides?.system_prompt ?? source.system_prompt,
            tools: overrides?.tools ?? source.tools,
            knowledge_sources: overrides?.knowledge_sources ?? source.knowledge_sources,
            trigger_tags: overrides?.trigger_tags ?? source.trigger_tags,
            enabled: overrides?.enabled ?? false,
        };
        return this.createAgent(businessId, newAgent, signal);
    }
}
exports.DavoxiClient = DavoxiClient;
