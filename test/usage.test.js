// Unit tests for the usage-import pipeline (dashboard data source).
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { loadClaudeRecords } from "../src/core/usage/claude.js";
import { loadCodexUsage } from "../src/core/usage/codex.js";
import { loadCursorRecords } from "../src/core/usage/cursor.js";
import { pricingFor, costForRecord, cacheSavingsForRecord } from "../src/core/usage/pricing.js";
import { aggregate, BLOCK_MS } from "../src/core/usage/aggregate.js";
import { generateInsights } from "../src/core/usage/insights.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const CLAUDE_DIR = join(FIXTURES, "claude", "projects");
const CODEX_DIR = join(FIXTURES, "codex", "sessions");
const CURSOR_DIR = join(FIXTURES, "cursor", "projects");

// Convenience factory for synthetic normalized records.
function rec(overrides = {}) {
  return {
    source: "claude-code",
    sessionId: "s1",
    project: "myapp",
    timestamp: "2026-01-15T10:00:00.000Z",
    model: "claude-sonnet-4-5",
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    ...overrides,
  };
}

test("claude parser: dedupes retries, skips synthetic and corrupt lines", () => {
  const records = loadClaudeRecords({ dirs: [CLAUDE_DIR] });
  // 5 usage lines in the fixture: 1 duplicate + 1 synthetic are dropped.
  assert.equal(records.length, 3);

  const [r1, r2, r3] = records;
  assert.equal(r1.inputTokens, 1000);
  assert.equal(r1.outputTokens, 200);
  assert.equal(r1.cacheCreationTokens, 500);
  assert.equal(r1.cacheReadTokens, 8000);
  assert.equal(r1.source, "claude-code");
  assert.equal(r1.project, "myapp");
  assert.equal(r1.sessionId, "11111111-aaaa-bbbb-cccc-000000000001");

  assert.equal(r2.cacheReadTokens, 9200);
  assert.equal(r3.model, "claude-opus-4-1-20250805");
});

test("codex parser: per-turn deltas from last_token_usage, cache as input subset", () => {
  const { records, rateLimits } = loadCodexUsage({ dir: CODEX_DIR });
  const modern = records.filter((r) => r.sessionId === "codex-modern-001");
  assert.equal(modern.length, 2);

  // input_tokens minus cached_input_tokens becomes fresh input.
  assert.equal(modern[0].inputTokens, 2000);
  assert.equal(modern[0].cacheReadTokens, 3000);
  assert.equal(modern[0].outputTokens, 150);
  assert.equal(modern[0].model, "gpt-5.4");
  assert.equal(modern[0].project, "myapp");

  assert.equal(modern[1].inputTokens, 1000);
  assert.equal(modern[1].cacheReadTokens, 5000);

  // Latest rate-limit snapshot from the newest file wins.
  assert.equal(rateLimits.primary.used_percent, 55);
  assert.equal(rateLimits.plan_type, "plus");
});

test("codex parser: latest rate-limit telemetry wins by timestamp, not filename", () => {
  const tmp = mkdtempSync(join(tmpdir(), "metriq-codex-fixture-"));
  try {
    cpSync(CODEX_DIR, tmp, { recursive: true });
    const staleDir = join(tmp, "2026", "01", "15");
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(
      join(staleDir, "rollout-2026-01-15T13-00-00-stale-later-file.jsonl"),
      [
        JSON.stringify({
          timestamp: "2026-01-15T11:00:00.000Z",
          type: "session_meta",
          payload: { session_id: "codex-stale-later-file", cwd: "/Users/dev/myapp" },
        }),
        JSON.stringify({
          timestamp: "2026-01-15T11:01:00.000Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            info: {
              last_token_usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 },
              total_token_usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 },
            },
            rate_limits: {
              limit_id: "codex",
              primary: { used_percent: 17, window_minutes: 300 },
              secondary: { used_percent: 3, window_minutes: 10080 },
              plan_type: "plus",
            },
          },
        }),
        "",
      ].join("\n"),
      "utf8"
    );

    const { rateLimits } = loadCodexUsage({ dir: tmp });
    assert.equal(rateLimits.observedAt, "2026-01-15T12:05:00.000Z");
    assert.equal(rateLimits.primary.used_percent, 55);
    assert.equal(rateLimits.secondary.used_percent, 11);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("codex parser: legacy files without turn_context fall back and use cumulative deltas", () => {
  const { records } = loadCodexUsage({ dir: CODEX_DIR });
  const legacy = records.filter((r) => r.sessionId === "codex-legacy-001");
  assert.equal(legacy.length, 2);
  assert.equal(legacy[0].model, "gpt-5");
  assert.equal(legacy[0].modelIsFallback, true);

  // First event: full totals count (nothing before them).
  assert.equal(legacy[0].inputTokens, 3000);
  assert.equal(legacy[0].cacheReadTokens, 1000);
  assert.equal(legacy[0].outputTokens, 100);

  // Second event only adds the cumulative delta, never double-counts.
  const totalLegacy =
    legacy[0].inputTokens + legacy[0].outputTokens + legacy[0].cacheReadTokens +
    legacy[1].inputTokens + legacy[1].outputTokens + legacy[1].cacheReadTokens;
  assert.ok(totalLegacy <= 8300, `legacy total ${totalLegacy} must not exceed cumulative 8300`);
});

test("cursor parser: normalizes transcript entries with usage metadata", () => {
  const records = loadCursorRecords({ dir: CURSOR_DIR });
  assert.equal(records.length, 1);
  assert.equal(records[0].source, "cursor");
  assert.equal(records[0].sessionId, "cursor-session-001");
  assert.equal(records[0].project, "myapp");
  assert.equal(records[0].model, "claude-3.5-sonnet");
  assert.equal(records[0].inputTokens, 1200);
  assert.equal(records[0].outputTokens, 240);
  assert.equal(records[0].cacheCreationTokens, 300);
  assert.equal(records[0].cacheReadTokens, 1800);
  assert.match(records[0].prompt, /Fix the dashboard card spacing/);
  // Real usage metadata was present, so this is not an estimate.
  assert.notEqual(records[0].estimated, true);
});

test("cursor parser: transcripts without usage metadata get estimated token counts", () => {
  const tmp = mkdtempSync(join(tmpdir(), "metriq-cursor-fixture-"));
  try {
    const chatDir = join(tmp, "Users-dev-otherapp", "agent-transcripts", "chat-estimated");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(
      join(chatDir, "chat-estimated.jsonl"),
      [
        JSON.stringify({
          role: "user",
          message: {
            content: [
              {
                type: "text",
                text: "<timestamp>Tuesday, Jul 7, 2026, 1:20 PM (UTC-7)</timestamp>\n<user_query>\nfix the sidebar bug\n</user_query>",
              },
            ],
          },
        }),
        JSON.stringify({
          role: "assistant",
          message: {
            content: [{ type: "text", text: "I found the issue in the sidebar component and fixed the broken class name." }],
          },
        }),
        "",
      ].join("\n"),
      "utf8"
    );

    const records = loadCursorRecords({ dir: tmp });
    assert.equal(records.length, 1);
    const r = records[0];
    assert.equal(r.source, "cursor");
    assert.equal(r.project, "otherapp");
    assert.equal(r.estimated, true);
    assert.equal(r.model, "cursor-agent");
    assert.equal(r.prompt, "fix the sidebar bug");
    // Human-readable timestamp is converted to the correct UTC instant.
    assert.equal(r.timestamp, "2026-07-07T20:20:00.000Z");
    assert.ok(r.inputTokens > 0, "prompt tokens estimated");
    assert.ok(r.outputTokens > 0, "assistant tokens estimated");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("pricing: model matching, modifiers, and unknown-model fallback", () => {
  assert.equal(pricingFor("claude-sonnet-4-5-20250929").label, "Claude Sonnet");
  assert.equal(pricingFor("claude-opus-4-1").input, 15);
  assert.equal(pricingFor("gpt-5.4-mini").label, "GPT-5 mini");
  assert.equal(pricingFor("gpt-5.4").label, "GPT-5");

  const unknownClaude = pricingFor("claude-x9-experimental");
  assert.equal(unknownClaude.approximate, true);
  assert.equal(unknownClaude.input, 3);

  // 1M fresh input tokens of Sonnet = $3.
  const cost = costForRecord(rec({ inputTokens: 1_000_000 }));
  assert.equal(cost, 3);

  // Cache savings = reads priced at input rate minus cache-read rate.
  const savings = cacheSavingsForRecord(rec({ cacheReadTokens: 1_000_000 }));
  assert.equal(Math.round(savings * 100) / 100, 2.7);
});

test("aggregate: totals, daily calendar fill, sessions, and models", () => {
  const records = loadClaudeRecords({ dirs: [CLAUDE_DIR] });
  const agg = aggregate(records, { days: 7, now: new Date("2026-01-16T00:00:00Z") });

  assert.equal(agg.totals.inputTokens, 3050);
  assert.equal(agg.totals.outputTokens, 1400);
  assert.equal(agg.totals.cacheReadTokens, 17200);
  assert.equal(agg.totals.totalTokens, 22150);

  // 7-day window renders 7 calendar days even though only 1 has activity.
  assert.equal(agg.daily.length, 7);
  const active = agg.daily.filter((d) => d.totalTokens > 0);
  assert.equal(active.length, 1);
  assert.equal(active[0].date, "2026-01-15");

  assert.equal(agg.sessions.length, 1);
  assert.equal(agg.sessions[0].requests, 3);
  assert.deepEqual(
    agg.sessions[0].models.sort(),
    ["claude-opus-4-1-20250805", "claude-sonnet-4-5-20250929"]
  );

  // Models sorted by cost: Opus (2000 in / 800 out) costs more than Sonnet here.
  assert.equal(agg.models[0].label, "Claude Opus");
});

test("aggregate: daily buckets use the local calendar day, not UTC", () => {
  const agg = aggregate(
    [
      rec({
        timestamp: "2026-07-07T23:30:00-07:00",
        inputTokens: 100,
      }),
    ],
    { days: 1, now: new Date("2026-07-07T23:45:00-07:00") }
  );

  assert.equal(agg.daily.length, 1);
  assert.equal(agg.daily[0].date, "2026-07-07");
  assert.equal(agg.daily[0].totalTokens, 100);
});

test("aggregate: 5-hour blocks split on gaps and merge sources", () => {
  const records = [
    rec({ timestamp: "2026-01-15T08:00:00Z", inputTokens: 100 }),
    rec({ timestamp: "2026-01-15T09:30:00Z", inputTokens: 100 }),
    // 6h after block start → new block.
    rec({ timestamp: "2026-01-15T14:30:00Z", inputTokens: 100, source: "codex", sessionId: "c1", model: "gpt-5" }),
  ];
  const agg = aggregate(records, { now: new Date("2026-01-15T15:00:00Z") });

  assert.equal(agg.blocks.length, 2);
  // Sorted newest first; the newest block is still active at `now`.
  assert.equal(agg.blocks[0].active, true);
  assert.equal(agg.blocks[0].requests, 1);
  assert.equal(agg.blocks[1].requests, 2);
  assert.equal(
    new Date(agg.blocks[1].end) - new Date(agg.blocks[1].start),
    BLOCK_MS
  );
  assert.deepEqual(Object.keys(agg.bySource).sort(), ["claude-code", "codex"]);
});

test("insights: high input ratio and low cache hit trigger with evidence", () => {
  const agg = aggregate(
    [rec({ inputTokens: 300_000, outputTokens: 10_000 })],
    { now: new Date("2026-01-16T00:00:00Z") }
  );
  const ids = generateInsights(agg).map((i) => i.id);
  assert.ok(ids.includes("high-input-ratio"));
  assert.ok(ids.includes("low-cache-hit"));
});

test("insights: healthy caching produces the info insight, not the warning", () => {
  const agg = aggregate(
    [rec({ inputTokens: 20_000, outputTokens: 10_000, cacheReadTokens: 400_000 })],
    { now: new Date("2026-01-16T00:00:00Z") }
  );
  const insights = generateInsights(agg);
  const ids = insights.map((i) => i.id);
  assert.ok(ids.includes("good-cache-hit"));
  assert.ok(!ids.includes("low-cache-hit"));
});

test("insights: codex rate-limit pressure is surfaced with severity", () => {
  const agg = aggregate([rec({ inputTokens: 1000 })], { now: new Date("2026-01-16T00:00:00Z") });
  const insights = generateInsights(agg, {
    primary: { used_percent: 85, window_minutes: 300 },
    secondary: { used_percent: 20, window_minutes: 10080 },
  });
  const limit = insights.find((i) => i.id === "codex-rate-limit");
  assert.ok(limit);
  assert.equal(limit.severity, "high");
  assert.ok(limit.evidence.includes("85%"));
});

test("insights: deterministic — same input yields identical output", () => {
  const records = loadClaudeRecords({ dirs: [CLAUDE_DIR] });
  const now = new Date("2026-01-16T00:00:00Z");
  const a = generateInsights(aggregate(records, { days: 7, now }));
  const b = generateInsights(aggregate(records, { days: 7, now }));
  assert.deepEqual(a, b);
});
