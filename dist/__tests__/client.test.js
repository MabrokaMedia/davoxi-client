"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_js_1 = require("../client.js");
// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function mockFetch(status, body, statusText = "OK") {
    const fn = vitest_1.vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
        json: () => Promise.resolve(body),
    });
    vitest_1.vi.stubGlobal("fetch", fn);
    return fn;
}
function makeClient(opts) {
    return new client_js_1.DavoxiClient({
        apiKey: opts?.apiKey ?? "test-key",
        apiUrl: opts?.apiUrl,
        timeout: opts?.timeout,
    });
}
// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.restoreAllMocks();
    vitest_1.vi.unstubAllGlobals();
});
// ── Constructor ──────────────────────────────────────────────────────────
(0, vitest_1.describe)("Constructor", () => {
    (0, vitest_1.it)("uses default baseUrl when apiUrl is not provided", () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient();
        client.getProfile();
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/users/me", vitest_1.expect.anything());
    });
    (0, vitest_1.it)("accepts a custom apiUrl", () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient({ apiUrl: "https://custom.api.dev" });
        client.getProfile();
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://custom.api.dev/users/me", vitest_1.expect.anything());
    });
    (0, vitest_1.it)("strips trailing slashes from apiUrl", () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient({ apiUrl: "https://custom.api.dev///" });
        client.getProfile();
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://custom.api.dev/users/me", vitest_1.expect.anything());
    });
});
// ── Request method tests ─────────────────────────────────────────────────
(0, vitest_1.describe)("HTTP methods", () => {
    (0, vitest_1.it)("sends GET requests", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listBusinesses();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("GET");
    });
    (0, vitest_1.it)("sends POST requests with body", async () => {
        const fetchFn = mockFetch(200, { access_token: "a", refresh_token: "r" });
        const client = makeClient();
        await client.login("a@b.com", "pass");
        const init = fetchFn.mock.calls[0][1];
        (0, vitest_1.expect)(init.method).toBe("POST");
        (0, vitest_1.expect)(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "pass" });
    });
    (0, vitest_1.it)("sends PUT requests", async () => {
        const fetchFn = mockFetch(200, { business_id: "b1" });
        const client = makeClient();
        await client.updateBusiness("b1", { name: "New" });
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("PUT");
    });
    (0, vitest_1.it)("sends DELETE requests", async () => {
        const fetchFn = mockFetch(204, "");
        const client = makeClient();
        await client.deleteBusiness("b1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("DELETE");
    });
});
// ── Error handling ───────────────────────────────────────────────────────
(0, vitest_1.describe)("Error handling", () => {
    (0, vitest_1.it)("throws DavoxiApiError on 401", async () => {
        mockFetch(401, '{"code":"UNAUTHORIZED"}', "Unauthorized");
        const client = makeClient();
        await (0, vitest_1.expect)(client.getProfile()).rejects.toThrow(client_js_1.DavoxiApiError);
        try {
            await client.getProfile();
        }
        catch (err) {
            const e = err;
            (0, vitest_1.expect)(e.statusCode).toBe(401);
            (0, vitest_1.expect)(e.statusText).toBe("Unauthorized");
            (0, vitest_1.expect)(e.code).toBe("UNAUTHORIZED");
        }
    });
    (0, vitest_1.it)("throws DavoxiApiError on 500", async () => {
        mockFetch(500, "Internal Server Error", "Internal Server Error");
        const client = makeClient();
        await (0, vitest_1.expect)(client.getProfile()).rejects.toThrow(client_js_1.DavoxiApiError);
        try {
            await client.getProfile();
        }
        catch (err) {
            const e = err;
            (0, vitest_1.expect)(e.statusCode).toBe(500);
        }
    });
    (0, vitest_1.it)("throws on network error", async () => {
        vitest_1.vi.stubGlobal("fetch", vitest_1.vi.fn().mockRejectedValue(new TypeError("fetch failed")));
        const client = makeClient();
        await (0, vitest_1.expect)(client.getProfile()).rejects.toThrow("Network error");
    });
    (0, vitest_1.it)("handles non-JSON error body gracefully", async () => {
        mockFetch(400, "plain text error", "Bad Request");
        const client = makeClient();
        try {
            await client.getProfile();
        }
        catch (err) {
            const e = err;
            (0, vitest_1.expect)(e).toBeInstanceOf(client_js_1.DavoxiApiError);
            (0, vitest_1.expect)(e.body).toBe("plain text error");
            (0, vitest_1.expect)(e.code).toBeUndefined();
        }
    });
});
// ── Auth ─────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Auth methods", () => {
    (0, vitest_1.it)("login sends POST /auth/login", async () => {
        const fetchFn = mockFetch(200, { access_token: "at", refresh_token: "rt" });
        const client = makeClient();
        const result = await client.login("user@test.com", "secret");
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/auth/login", vitest_1.expect.anything());
        (0, vitest_1.expect)(result).toEqual({ access_token: "at", refresh_token: "rt" });
    });
    (0, vitest_1.it)("refresh sends POST /auth/refresh", async () => {
        const fetchFn = mockFetch(200, { access_token: "at2", refresh_token: "rt2" });
        const client = makeClient();
        const result = await client.refresh("old-rt");
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/auth/refresh", vitest_1.expect.anything());
        (0, vitest_1.expect)(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
            refresh_token: "old-rt",
        });
        (0, vitest_1.expect)(result).toEqual({ access_token: "at2", refresh_token: "rt2" });
    });
});
// ── Users ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("User methods", () => {
    (0, vitest_1.it)("getProfile sends GET /users/me", async () => {
        const profile = { user_id: "u1", email: "a@b.com", created_at: "2025-01-01" };
        const fetchFn = mockFetch(200, profile);
        const client = makeClient();
        const result = await client.getProfile();
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/users/me", vitest_1.expect.anything());
        (0, vitest_1.expect)(result).toEqual(profile);
    });
});
// ── Businesses ───────────────────────────────────────────────────────────
(0, vitest_1.describe)("Business methods", () => {
    (0, vitest_1.it)("listBusinesses sends GET /businesses", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listBusinesses();
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/businesses", vitest_1.expect.anything());
    });
    (0, vitest_1.it)("getBusiness sends GET /businesses/{id}", async () => {
        const fetchFn = mockFetch(200, { business_id: "b1" });
        const client = makeClient();
        await client.getBusiness("b1");
        (0, vitest_1.expect)(fetchFn).toHaveBeenCalledWith("https://api.davoxi.com/businesses/b1", vitest_1.expect.anything());
    });
    (0, vitest_1.it)("createBusiness sends POST /businesses", async () => {
        const fetchFn = mockFetch(200, { business_id: "b2", name: "Acme" });
        const client = makeClient();
        const result = await client.createBusiness({ name: "Acme" });
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("POST");
        (0, vitest_1.expect)(result.name).toBe("Acme");
    });
    (0, vitest_1.it)("updateBusiness sends PUT /businesses/{id}", async () => {
        const fetchFn = mockFetch(200, { business_id: "b1", name: "Updated" });
        const client = makeClient();
        await client.updateBusiness("b1", { name: "Updated" });
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("PUT");
    });
    (0, vitest_1.it)("deleteBusiness sends DELETE /businesses/{id}", async () => {
        const fetchFn = mockFetch(204, "");
        const client = makeClient();
        await client.deleteBusiness("b1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("DELETE");
    });
});
// ── Agents ───────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Agent methods", () => {
    (0, vitest_1.it)("listAgents sends GET /businesses/{bid}/agents", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listAgents("b1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents");
    });
    (0, vitest_1.it)("getAgent sends GET /businesses/{bid}/agents/{aid}", async () => {
        const fetchFn = mockFetch(200, { agent_id: "a1" });
        const client = makeClient();
        await client.getAgent("b1", "a1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
    });
    (0, vitest_1.it)("createAgent sends POST /businesses/{bid}/agents", async () => {
        const data = { description: "Test", system_prompt: "You are a test agent" };
        const fetchFn = mockFetch(200, { agent_id: "a2", ...data });
        const client = makeClient();
        await client.createAgent("b1", data);
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("POST");
    });
    (0, vitest_1.it)("updateAgent sends PUT /businesses/{bid}/agents/{aid}", async () => {
        const fetchFn = mockFetch(200, { agent_id: "a1" });
        const client = makeClient();
        await client.updateAgent("b1", "a1", { description: "Updated" });
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("PUT");
    });
    (0, vitest_1.it)("deleteAgent sends DELETE /businesses/{bid}/agents/{aid}", async () => {
        const fetchFn = mockFetch(204, "");
        const client = makeClient();
        await client.deleteAgent("b1", "a1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("DELETE");
    });
    (0, vitest_1.it)("encodes special characters in IDs", async () => {
        const fetchFn = mockFetch(200, { agent_id: "a/1" });
        const client = makeClient();
        await client.getAgent("b/1", "a/1");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b%2F1/agents/a%2F1");
    });
});
// ── Usage ────────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Usage methods", () => {
    (0, vitest_1.it)("getUsage sends GET /usage", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.getUsage();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/usage");
    });
    (0, vitest_1.it)("getUsageSummary sends GET /usage/summary", async () => {
        const summary = { total_calls: 10, total_minutes: 5, total_cost: 1.5, period_start: "s", period_end: "e" };
        const fetchFn = mockFetch(200, summary);
        const client = makeClient();
        const result = await client.getUsageSummary();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/usage/summary");
        (0, vitest_1.expect)(result).toEqual(summary);
    });
});
// ── Billing ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Billing methods", () => {
    (0, vitest_1.it)("getSubscription sends GET /billing/subscription", async () => {
        const sub = { plan: "pro", status: "active", current_period_start: "s", current_period_end: "e" };
        const fetchFn = mockFetch(200, sub);
        const client = makeClient();
        const result = await client.getSubscription();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/billing/subscription");
        (0, vitest_1.expect)(result).toEqual(sub);
    });
    (0, vitest_1.it)("listInvoices sends GET /billing/invoices", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listInvoices();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/billing/invoices");
    });
});
// ── API Keys ─────────────────────────────────────────────────────────────
(0, vitest_1.describe)("API Key methods", () => {
    (0, vitest_1.it)("listApiKeys sends GET /api-keys", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listApiKeys();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys");
    });
    (0, vitest_1.it)("createApiKey with name sends POST /api-keys with body", async () => {
        const fetchFn = mockFetch(200, { prefix: "dv_", key: "dv_123", name: "my-key", created_at: "now" });
        const client = makeClient();
        await client.createApiKey("my-key");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("POST");
        (0, vitest_1.expect)(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ name: "my-key" });
    });
    (0, vitest_1.it)("createApiKey without name sends POST /api-keys without body", async () => {
        const fetchFn = mockFetch(200, { prefix: "dv_", key: "dv_123", created_at: "now" });
        const client = makeClient();
        await client.createApiKey();
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("POST");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].body).toBeUndefined();
    });
    (0, vitest_1.it)("revokeApiKey sends DELETE /api-keys/{prefix}", async () => {
        const fetchFn = mockFetch(204, "");
        const client = makeClient();
        await client.revokeApiKey("dv_abc");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys/dv_abc");
        (0, vitest_1.expect)(fetchFn.mock.calls[0][1].method).toBe("DELETE");
    });
});
// ── AbortSignal ──────────────────────────────────────────────────────────
(0, vitest_1.describe)("AbortSignal support", () => {
    (0, vitest_1.it)("passes signal to fetch (combined with timeout)", async () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient();
        const controller = new AbortController();
        await client.getProfile(controller.signal);
        const init = fetchFn.mock.calls[0][1];
        // The client combines user signal with timeout signal via AbortSignal.any
        (0, vitest_1.expect)(init.signal).toBeDefined();
    });
    (0, vitest_1.it)("uses timeout signal when no user signal provided", async () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient();
        await client.getProfile();
        const init = fetchFn.mock.calls[0][1];
        (0, vitest_1.expect)(init.signal).toBeDefined();
    });
});
// ── Headers ──────────────────────────────────────────────────────────────
(0, vitest_1.describe)("Headers", () => {
    (0, vitest_1.it)("includes Authorization header with Bearer token", async () => {
        const fetchFn = mockFetch(200, {});
        const client = makeClient({ apiKey: "my-secret-key" });
        await client.getProfile();
        const headers = fetchFn.mock.calls[0][1].headers;
        (0, vitest_1.expect)(headers["Authorization"]).toBe("Bearer my-secret-key");
    });
    (0, vitest_1.it)("includes Accept: application/json on all requests", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listBusinesses();
        const headers = fetchFn.mock.calls[0][1].headers;
        (0, vitest_1.expect)(headers["Accept"]).toBe("application/json");
    });
    (0, vitest_1.it)("includes Content-Type: application/json on POST requests with body", async () => {
        const fetchFn = mockFetch(200, { access_token: "a", refresh_token: "r" });
        const client = makeClient();
        await client.login("a@b.com", "pass");
        const headers = fetchFn.mock.calls[0][1].headers;
        (0, vitest_1.expect)(headers["Content-Type"]).toBe("application/json");
    });
    (0, vitest_1.it)("does not include Content-Type on GET requests", async () => {
        const fetchFn = mockFetch(200, []);
        const client = makeClient();
        await client.listBusinesses();
        const headers = fetchFn.mock.calls[0][1].headers;
        (0, vitest_1.expect)(headers["Content-Type"]).toBeUndefined();
    });
    (0, vitest_1.it)("includes Content-Type on PUT requests with body", async () => {
        const fetchFn = mockFetch(200, { business_id: "b1" });
        const client = makeClient();
        await client.updateBusiness("b1", { name: "X" });
        const headers = fetchFn.mock.calls[0][1].headers;
        (0, vitest_1.expect)(headers["Content-Type"]).toBe("application/json");
    });
});
