"use strict";
/**
 * DavoxiClient -- unified HTTP client wrapping the Davoxi REST API.
 *
 * Uses native `fetch`, zero runtime dependencies.
 * All methods return parsed JSON or throw `DavoxiApiError`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DavoxiClient = exports.DavoxiApiError = void 0;
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
        return this.request("POST", `/businesses/${DavoxiClient.enc(businessId)}/agents`, data, signal);
    }
    async updateAgent(businessId, agentId, data, signal) {
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
}
exports.DavoxiClient = DavoxiClient;
