const { test } = require("node:test");
const assert = require("node:assert");
const idx = require("../src/usage-indexer");
const svc = require("../src/typesense-service");

const sampleSession = {
  sessionId: "abc123",
  source: "claude-code",
  project: "desktop renderer",
  startedAt: "2026-01-01T10:00:00.000Z",
  endedAt: "2026-01-01T11:00:00.000Z",
  models: ["claude-sonnet"],
  requests: 12,
  inputTokens: 60000,
  outputTokens: 2000,
  cacheCreationTokens: 1000,
  cacheReadTokens: 500,
  totalTokens: 63500,
  costUSD: 1.8,
};

test("deriveLabels: flags expensive, high_input, low_cache", () => {
  const labels = idx.deriveLabels(sampleSession);
  assert.ok(labels.includes("expensive"));
  assert.ok(labels.includes("high_input"));
  assert.ok(labels.includes("low_cache"));
});

test("buildSessionDoc: isolation keys + search_text", () => {
  const doc = idx.buildSessionDoc({
    userId: "u1",
    session: sampleSession,
    promptSnippets: ["fix authentication token refresh"],
  });
  assert.strictEqual(doc.user_id, "u1");
  assert.strictEqual(doc.tool, "claude-code");
  assert.strictEqual(doc.session_id, "abc123");
  assert.match(doc.search_text, /expensive/i);
  assert.match(doc.search_text, /authentication/);
  assert.ok(doc.input_tokens >= 50000);
});

test("promptsBySession: groups by source:sessionId", () => {
  const map = idx.promptsBySession([
    { source: "claude-code", sessionId: "s1", prompt: "hello" },
    { source: "claude-code", sessionId: "s1", prompt: "world" },
    { source: "codex", sessionId: "s1", prompt: "other" },
  ]);
  assert.deepStrictEqual(map.get("claude-code:s1"), ["hello", "world"]);
  assert.deepStrictEqual(map.get("codex:s1"), ["other"]);
});

test("searchUsageSessions: mode off returns []", async () => {
  const config = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const hits = await idx.searchUsageSessions({
    config,
    userId: "u1",
    q: "expensive authentication",
  });
  assert.deepStrictEqual(hits, []);
});

test("indexUsageSessions: mode off returns disabled", async () => {
  const config = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const res = await idx.indexUsageSessions({
    config,
    userId: "u1",
    sessions: [sampleSession],
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.disabled, true);
});
