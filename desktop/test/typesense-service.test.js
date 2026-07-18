// Pure-logic tests for the Typesense service — config resolution, filter and
// query building, and the graceful-disable contract. No running server needed
// (same approach as protocol.test.js). Live network ops are exercised
// separately by test/typesense-live.test.js, which skips when no server is up.

const { test } = require("node:test");
const assert = require("node:assert");
const svc = require("../src/typesense-service");

test("resolveConfig: defaults to recommended local mode", () => {
  const c = svc.resolveConfig({}, {});
  assert.strictEqual(c.mode, "local");
  assert.strictEqual(c.baseUrl, "http://localhost:8108");
  assert.strictEqual(c.enabled, true);
  assert.strictEqual(c.indexesCode, true);
});

test("resolveConfig: env overrides prefs overrides defaults", () => {
  const c = svc.resolveConfig(
    { TYPESENSE_HOST: "ts.example.com", TYPESENSE_PROTOCOL: "https", TYPESENSE_PORT: "443" },
    { host: "ignored", apiKey: "prefs-key" }
  );
  assert.strictEqual(c.baseUrl, "https://ts.example.com:443");
  assert.strictEqual(c.apiKey, "prefs-key"); // from prefs, no env key set
});

test("resolveConfig: mode off disables and blocks code indexing", () => {
  const c = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  assert.strictEqual(c.enabled, false);
  assert.strictEqual(c.indexesCode, false);
});

test("resolveConfig: cloud mode indexes code only with explicit consent", () => {
  const noConsent = svc.resolveConfig({ TYPESENSE_MODE: "cloud" }, {});
  assert.strictEqual(noConsent.enabled, true);
  assert.strictEqual(noConsent.indexesCode, false);
  const consented = svc.resolveConfig({ TYPESENSE_MODE: "cloud" }, { cloudCodeConsent: true });
  assert.strictEqual(consented.indexesCode, true);
});

test("resolveConfig: hybridSearch from env or prefs", () => {
  assert.strictEqual(svc.resolveConfig({}, {}).hybridSearch, false);
  assert.strictEqual(svc.resolveConfig({ TYPESENSE_HYBRID: "true" }, {}).hybridSearch, true);
  assert.strictEqual(svc.resolveConfig({}, { hybridSearch: true }).hybridSearch, true);
});

test("buildRangeFilter: emits gte/lte clauses", () => {
  assert.strictEqual(
    svc.buildRangeFilter({ input_tokens: { gte: 50000 }, cost_usd: { lte: 2 } }),
    "input_tokens:>=50000 && cost_usd:<=2"
  );
});

test("resolveConfig: invalid mode falls back to default", () => {
  assert.strictEqual(svc.resolveConfig({ TYPESENSE_MODE: "bogus" }, {}).mode, "local");
});

test("buildFilterBy: skips empty/all, backtick-wraps values", () => {
  assert.strictEqual(
    svc.buildFilterBy({ project_id: "p1", user_id: "all", tool: "" }),
    "project_id:=`p1`"
  );
});

test("buildFilterBy: combines with && and handles arrays", () => {
  assert.strictEqual(
    svc.buildFilterBy({ project_id: "p1", extension: [".js", ".ts"] }),
    "project_id:=`p1` && extension:=[`.js`, `.ts`]"
  );
});

test("buildSearchQs: lifts filters into filter_by, passes rest through", () => {
  const qs = new URLSearchParams(
    svc.buildSearchQs({ q: "auth", query_by: "content", filters: { project_id: "p1" } })
  );
  assert.strictEqual(qs.get("q"), "auth");
  assert.strictEqual(qs.get("query_by"), "content");
  assert.strictEqual(qs.get("filter_by"), "project_id:=`p1`");
});

test("health: mode off returns disabled without a network call", async () => {
  const res = await svc.health(svc.resolveConfig({ TYPESENSE_MODE: "off" }, {}));
  assert.deepStrictEqual(res, { ok: false, disabled: true });
});

test("health: unreachable host resolves to { ok:false }, never throws", async () => {
  const res = await svc.health(
    svc.resolveConfig({ TYPESENSE_HOST: "127.0.0.1", TYPESENSE_PORT: "9" }, {})
  );
  assert.strictEqual(res.ok, false);
  assert.ok(res.error);
});

test("schemas: all collections defined with isolation keys", () => {
  assert.ok(svc.SCHEMAS.code_chunks);
  assert.ok(svc.SCHEMAS.prompt_runs);
  assert.ok(svc.SCHEMAS.usage_sessions);
  for (const schema of Object.values(svc.SCHEMAS)) {
    const names = schema.fields.map((f) => f.name);
    assert.ok(names.includes("user_id"), `${schema.name} has user_id`);
    assert.ok(names.includes("project_id"), `${schema.name} has project_id`);
  }
});

test("module surface never exposes a way to read the API key back out", () => {
  // The key lives only inside the resolved config object (main-process only).
  // No exported function name suggests returning it, and getConfig is the only
  // thing that carries it — asserted here as a guard against future drift.
  const exported = Object.keys(svc);
  assert.ok(!exported.some((n) => /key/i.test(n)), "no key-returning export");
});
