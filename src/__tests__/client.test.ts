import { describe, it, expect, vi, beforeEach } from "vitest";
import { DavoxiClient, DavoxiApiError } from "../client.js";

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function mockFetch(
  status: number,
  body: unknown,
  statusText = "OK",
): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function makeClient(opts?: Partial<{ apiUrl: string; apiKey: string; timeout: number }>) {
  return new DavoxiClient({
    apiKey: opts?.apiKey ?? "test-key",
    apiUrl: opts?.apiUrl,
    timeout: opts?.timeout,
  });
}

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Constructor ──────────────────────────────────────────────────────────

describe("Constructor", () => {
  it("uses default baseUrl when apiUrl is not provided", () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient();
    client.getProfile();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/users/me",
      expect.anything(),
    );
  });

  it("accepts a custom apiUrl", () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient({ apiUrl: "https://custom.api.dev" });
    client.getProfile();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://custom.api.dev/users/me",
      expect.anything(),
    );
  });

  it("strips trailing slashes from apiUrl", () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient({ apiUrl: "https://custom.api.dev///" });
    client.getProfile();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://custom.api.dev/users/me",
      expect.anything(),
    );
  });
});

// ── Request method tests ─────────────────────────────────────────────────

describe("HTTP methods", () => {
  it("sends GET requests", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listBusinesses();
    expect(fetchFn.mock.calls[0][1].method).toBe("GET");
  });

  it("sends POST requests with body", async () => {
    const fetchFn = mockFetch(200, { access_token: "a", refresh_token: "r" });
    const client = makeClient();
    await client.login("a@b.com", "pass");
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@b.com", password: "pass" });
  });

  it("sends PUT requests", async () => {
    const fetchFn = mockFetch(200, { business_id: "b1" });
    const client = makeClient();
    await client.updateBusiness("b1", { name: "New" });
    expect(fetchFn.mock.calls[0][1].method).toBe("PUT");
  });

  it("sends DELETE requests", async () => {
    const fetchFn = mockFetch(204, "");
    const client = makeClient();
    await client.deleteBusiness("b1");
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
  });

  it("getOrg targets /orgs/{id}", async () => {
    const fetchFn = mockFetch(200, {
      org_id: "org_abc",
      name: "Parlo",
      owner_id: "usr_x",
      plan_id: null,
      business_ids: [],
      twilio_link_kind: null,
    });
    const client = makeClient();
    const org = await client.getOrg("org_abc");
    expect(fetchFn.mock.calls[0][0]).toMatch(/\/orgs\/org_abc$/);
    expect(fetchFn.mock.calls[0][1].method).toBe("GET");
    expect(org.name).toBe("Parlo");
  });

  it("updateOrg sends PUT with the partial body", async () => {
    const fetchFn = mockFetch(200, {
      org_id: "org_abc",
      name: "Parlo",
      plan_id: null,
    });
    const client = makeClient();
    await client.updateOrg("org_abc", { name: "Parlo" });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Parlo" });
  });

  it("updateOrg URL-encodes the org_id", async () => {
    const fetchFn = mockFetch(200, { org_id: "org/with/slash", name: "X", plan_id: null });
    const client = makeClient();
    await client.updateOrg("org/with/slash", { name: "X" });
    expect(fetchFn.mock.calls[0][0]).toContain("/orgs/org%2Fwith%2Fslash");
  });
});

// ── Error handling ───────────────────────────────────────────────────────

describe("Error handling", () => {
  it("throws DavoxiApiError on 401", async () => {
    mockFetch(401, '{"code":"UNAUTHORIZED"}', "Unauthorized");
    const client = makeClient();
    await expect(client.getProfile()).rejects.toThrow(DavoxiApiError);
    try {
      await client.getProfile();
    } catch (err) {
      const e = err as DavoxiApiError;
      expect(e.statusCode).toBe(401);
      expect(e.statusText).toBe("Unauthorized");
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("throws DavoxiApiError on 500", async () => {
    mockFetch(500, "Internal Server Error", "Internal Server Error");
    const client = makeClient();
    await expect(client.getProfile()).rejects.toThrow(DavoxiApiError);
    try {
      await client.getProfile();
    } catch (err) {
      const e = err as DavoxiApiError;
      expect(e.statusCode).toBe(500);
    }
  });

  it("throws on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const client = makeClient();
    await expect(client.getProfile()).rejects.toThrow("Network error");
  });

  it("handles non-JSON error body gracefully", async () => {
    mockFetch(400, "plain text error", "Bad Request");
    const client = makeClient();
    try {
      await client.getProfile();
    } catch (err) {
      const e = err as DavoxiApiError;
      expect(e).toBeInstanceOf(DavoxiApiError);
      expect(e.body).toBe("plain text error");
      expect(e.code).toBeUndefined();
    }
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────

describe("Auth methods", () => {
  it("login sends POST /auth/login", async () => {
    const fetchFn = mockFetch(200, { access_token: "at", refresh_token: "rt" });
    const client = makeClient();
    const result = await client.login("user@test.com", "secret");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/auth/login",
      expect.anything(),
    );
    expect(result).toEqual({ access_token: "at", refresh_token: "rt" });
  });

  it("refresh sends POST /auth/refresh", async () => {
    const fetchFn = mockFetch(200, { access_token: "at2", refresh_token: "rt2" });
    const client = makeClient();
    const result = await client.refresh("old-rt");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/auth/refresh",
      expect.anything(),
    );
    expect(JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      refresh_token: "old-rt",
    });
    expect(result).toEqual({ access_token: "at2", refresh_token: "rt2" });
  });
});

// ── Users ────────────────────────────────────────────────────────────────

describe("User methods", () => {
  it("getProfile sends GET /users/me", async () => {
    const profile = { user_id: "u1", email: "a@b.com", created_at: "2025-01-01" };
    const fetchFn = mockFetch(200, profile);
    const client = makeClient();
    const result = await client.getProfile();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/users/me",
      expect.anything(),
    );
    expect(result).toEqual(profile);
  });
});

// ── Businesses ───────────────────────────────────────────────────────────

describe("Business methods", () => {
  it("listBusinesses sends GET /businesses", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listBusinesses();
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/businesses",
      expect.anything(),
    );
  });

  it("getBusiness sends GET /businesses/{id}", async () => {
    const fetchFn = mockFetch(200, { business_id: "b1" });
    const client = makeClient();
    await client.getBusiness("b1");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.davoxi.com/businesses/b1",
      expect.anything(),
    );
  });

  it("createBusiness sends POST /businesses", async () => {
    const fetchFn = mockFetch(200, { business_id: "b2", name: "Acme" });
    const client = makeClient();
    const result = await client.createBusiness({ name: "Acme" });
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
    expect(result.name).toBe("Acme");
  });

  it("updateBusiness sends PUT /businesses/{id}", async () => {
    const fetchFn = mockFetch(200, { business_id: "b1", name: "Updated" });
    const client = makeClient();
    await client.updateBusiness("b1", { name: "Updated" });
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1");
    expect(fetchFn.mock.calls[0][1].method).toBe("PUT");
  });

  it("deleteBusiness sends DELETE /businesses/{id}", async () => {
    const fetchFn = mockFetch(204, "");
    const client = makeClient();
    await client.deleteBusiness("b1");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1");
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
  });
});

// ── Agents ───────────────────────────────────────────────────────────────

describe("Agent methods", () => {
  it("listAgents sends GET /businesses/{bid}/agents", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listAgents("b1");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents");
  });

  it("getAgent sends GET /businesses/{bid}/agents/{aid}", async () => {
    const fetchFn = mockFetch(200, { agent_id: "a1" });
    const client = makeClient();
    await client.getAgent("b1", "a1");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
  });

  it("createAgent sends POST /businesses/{bid}/agents", async () => {
    const data = { description: "Test", system_prompt: "You are a test agent" };
    const fetchFn = mockFetch(200, { agent_id: "a2", ...data });
    const client = makeClient();
    await client.createAgent("b1", data);
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
  });

  it("updateAgent sends PUT /businesses/{bid}/agents/{aid}", async () => {
    const fetchFn = mockFetch(200, { agent_id: "a1" });
    const client = makeClient();
    await client.updateAgent("b1", "a1", { description: "Updated" });
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
    expect(fetchFn.mock.calls[0][1].method).toBe("PUT");
  });

  it("deleteAgent sends DELETE /businesses/{bid}/agents/{aid}", async () => {
    const fetchFn = mockFetch(204, "");
    const client = makeClient();
    await client.deleteAgent("b1", "a1");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/businesses/b1/agents/a1");
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
  });

  it("encodes special characters in IDs", async () => {
    const fetchFn = mockFetch(200, { agent_id: "a/1" });
    const client = makeClient();
    await client.getAgent("b/1", "a/1");
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://api.davoxi.com/businesses/b%2F1/agents/a%2F1",
    );
  });
});

// ── Usage ────────────────────────────────────────────────────────────────

describe("Usage methods", () => {
  it("getUsage sends GET /usage", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.getUsage();
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/usage");
  });

  it("getUsageSummary sends GET /usage/summary", async () => {
    const summary = { total_calls: 10, total_minutes: 5, total_cost: 1.5, period_start: "s", period_end: "e" };
    const fetchFn = mockFetch(200, summary);
    const client = makeClient();
    const result = await client.getUsageSummary();
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/usage/summary");
    expect(result).toEqual(summary);
  });
});

// ── Billing ──────────────────────────────────────────────────────────────

describe("Billing methods", () => {
  it("getSubscription sends GET /billing/subscription", async () => {
    const sub = { plan: "pro", status: "active", current_period_start: "s", current_period_end: "e" };
    const fetchFn = mockFetch(200, sub);
    const client = makeClient();
    const result = await client.getSubscription();
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/billing/subscription");
    expect(result).toEqual(sub);
  });

  it("listInvoices sends GET /billing/invoices", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listInvoices();
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/billing/invoices");
  });
});

// ── API Keys ─────────────────────────────────────────────────────────────

describe("API Key methods", () => {
  it("listApiKeys sends GET /api-keys", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listApiKeys();
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys");
  });

  it("createApiKey with name sends POST /api-keys with body", async () => {
    const fetchFn = mockFetch(200, { prefix: "dv_", key: "dv_123", name: "my-key", created_at: "now" });
    const client = makeClient();
    await client.createApiKey("my-key");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys");
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchFn.mock.calls[0][1].body as string)).toEqual({ name: "my-key" });
  });

  it("createApiKey without name sends POST /api-keys without body", async () => {
    const fetchFn = mockFetch(200, { prefix: "dv_", key: "dv_123", created_at: "now" });
    const client = makeClient();
    await client.createApiKey();
    expect(fetchFn.mock.calls[0][1].method).toBe("POST");
    expect(fetchFn.mock.calls[0][1].body).toBeUndefined();
  });

  it("revokeApiKey sends DELETE /api-keys/{prefix}", async () => {
    const fetchFn = mockFetch(204, "");
    const client = makeClient();
    await client.revokeApiKey("dv_abc");
    expect(fetchFn.mock.calls[0][0]).toBe("https://api.davoxi.com/api-keys/dv_abc");
    expect(fetchFn.mock.calls[0][1].method).toBe("DELETE");
  });
});

// ── AbortSignal ──────────────────────────────────────────────────────────

describe("AbortSignal support", () => {
  it("passes signal to fetch (combined with timeout)", async () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient();
    const controller = new AbortController();
    await client.getProfile(controller.signal);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    // The client combines user signal with timeout signal via AbortSignal.any
    expect(init.signal).toBeDefined();
  });

  it("uses timeout signal when no user signal provided", async () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient();
    await client.getProfile();
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
  });
});

// ── Headers ──────────────────────────────────────────────────────────────

describe("Headers", () => {
  it("includes Authorization header with Bearer token", async () => {
    const fetchFn = mockFetch(200, {});
    const client = makeClient({ apiKey: "my-secret-key" });
    await client.getProfile();
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret-key");
  });

  it("includes Accept: application/json on all requests", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listBusinesses();
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });

  it("includes Content-Type: application/json on POST requests with body", async () => {
    const fetchFn = mockFetch(200, { access_token: "a", refresh_token: "r" });
    const client = makeClient();
    await client.login("a@b.com", "pass");
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("does not include Content-Type on GET requests", async () => {
    const fetchFn = mockFetch(200, []);
    const client = makeClient();
    await client.listBusinesses();
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("includes Content-Type on PUT requests with body", async () => {
    const fetchFn = mockFetch(200, { business_id: "b1" });
    const client = makeClient();
    await client.updateBusiness("b1", { name: "X" });
    const headers = fetchFn.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
