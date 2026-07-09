// Tests for the session-behavior analysis (intent pie + wasted-tokens charts).

import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  classifyIntent,
  analyzeSessionBehavior,
  analyzeCurrentSession,
} from "../src/core/usage/behavior.js";
import { loadClaudeRecords } from "../src/core/usage/claude.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const CLAUDE_DIR = join(FIXTURES, "claude", "projects");

// Minimal record factory: one API request attributed to a prompt.
function rec(overrides = {}) {
  return {
    source: "codex",
    sessionId: "s1",
    project: "myapp",
    timestamp: "2026-01-15T10:00:00.000Z",
    model: "gpt-5",
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    prompt: null,
    ...overrides,
  };
}

// --- intent classification ---------------------------------------------------

test("classifyIntent: bug-fix wording wins even when feature words appear", () => {
  assert.equal(classifyIntent("fix the login feature, it crashes on submit"), "bugfix");
  assert.equal(classifyIntent("the dashboard is broken"), "bugfix");
  assert.equal(classifyIntent("this error keeps happening"), "bugfix");
});

test("classifyIntent: features, refactors, tests, questions, other", () => {
  assert.equal(classifyIntent("add a pie chart to the dashboard"), "feature");
  assert.equal(classifyIntent("refactor the session parser"), "refactor");
  assert.equal(classifyIntent("run the unit tests for the parser"), "testing");
  assert.equal(classifyIntent("how does the auth flow work?"), "question");
  assert.equal(classifyIntent("ok sounds good"), "other");
  assert.equal(classifyIntent(""), "other");
  assert.equal(classifyIntent(null), "other");
});

// --- intent rollup -------------------------------------------------------------

test("behavior: tokens roll up per intent with session and limit percentages", () => {
  const records = [
    // bugfix turn: 2 requests, 300 tokens
    rec({ prompt: "fix the crash", inputTokens: 100, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ prompt: "fix the crash", inputTokens: 150, outputTokens: 50, timestamp: "2026-01-15T10:01:00Z" }),
    // feature turn: 700 tokens
    rec({ prompt: "add a settings page", inputTokens: 500, outputTokens: 200, timestamp: "2026-01-15T10:05:00Z" }),
  ];
  const out = analyzeSessionBehavior(records, {
    rateLimits: { primary: { used_percent: 50 } },
  });

  assert.equal(out.turns, 2);
  assert.equal(out.sessionTokens, 1000);
  assert.equal(out.sessionUsedPctOfLimit, 50);

  const bugfix = out.intents.find((i) => i.key === "bugfix");
  assert.equal(bugfix.tokens, 300);
  assert.equal(bugfix.turns, 1);
  assert.equal(bugfix.pctOfSession, 30);
  // 30% of a session that consumed 50% of the limit → 15% of the limit.
  assert.equal(bugfix.pctOfLimit, 15);

  const feature = out.intents.find((i) => i.key === "feature");
  assert.equal(feature.pctOfSession, 70);
  assert.equal(feature.pctOfLimit, 35);
});

test("behavior: without rate limits pctOfLimit is null, pctOfSession still works", () => {
  const out = analyzeSessionBehavior([
    rec({ prompt: "fix it, it fails", inputTokens: 100 }),
  ]);
  assert.equal(out.sessionUsedPctOfLimit, null);
  assert.equal(out.intents[0].pctOfLimit, null);
  assert.equal(out.intents[0].pctOfSession, 100);
});

// --- waste heuristics -----------------------------------------------------------

test("waste: correction prompts count as rework (plus the discarded output)", () => {
  const out = analyzeSessionBehavior([
    rec({ prompt: "add a chart", inputTokens: 100, outputTokens: 500, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ prompt: "no, that's wrong — undo that", inputTokens: 200, outputTokens: 100, timestamp: "2026-01-15T10:05:00Z" }),
  ]);
  const rework = out.waste.find((w) => w.key === "rework");
  // correction turn (300) + previous turn's discarded output (500)
  assert.equal(rework.tokens, 800);
  assert.equal(rework.turns, 1);
});

test("waste: near-duplicate prompts count as retries", () => {
  const out = analyzeSessionBehavior([
    rec({ prompt: "make the sidebar collapse on mobile screens", inputTokens: 100, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ prompt: "make the sidebar collapse on mobile screens please", inputTokens: 300, timestamp: "2026-01-15T10:05:00Z" }),
  ]);
  const retries = out.waste.find((w) => w.key === "retries");
  assert.equal(retries.tokens, 300);
  assert.equal(retries.turns, 1);
});

test("waste: uncached input past the first turn counts as re-sent context", () => {
  const out = analyzeSessionBehavior([
    rec({ prompt: "add feature one to the settings page area", inputTokens: 1000, outputTokens: 500, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ prompt: "now add feature two with different words entirely", inputTokens: 800, outputTokens: 400, cacheReadTokens: 5000, timestamp: "2026-01-15T10:05:00Z" }),
  ]);
  const cacheMiss = out.waste.find((w) => w.key === "uncachedContext");
  assert.equal(cacheMiss.tokens, 800); // only the second turn's fresh input
});

test("waste: a clean focused session reports zero waste", () => {
  const out = analyzeSessionBehavior([
    rec({
      prompt: "add retry logic to src/core/usage/codex.js parse loop",
      inputTokens: 400,
      outputTokens: 600,
      timestamp: "2026-01-15T10:00:00Z",
    }),
  ]);
  assert.equal(out.wastedTokens, 0);
  assert.deepEqual(out.waste, []);
});

// --- current-session selection ----------------------------------------------------

test("analyzeCurrentSession picks the session with the newest record", () => {
  const out = analyzeCurrentSession([
    rec({ sessionId: "old", prompt: "fix bug", inputTokens: 100, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ sessionId: "new", prompt: "add chart", inputTokens: 200, timestamp: "2026-01-15T12:00:00Z" }),
  ]);
  assert.equal(out.sessionId, "new");
  assert.equal(out.sessionTokens, 200);
});

test("analyzeCurrentSession returns null with no records", () => {
  assert.equal(analyzeCurrentSession([]), null);
  assert.equal(analyzeCurrentSession(null), null);
});

// --- end to end through the Claude parser -------------------------------------------

test("claude parser attributes usage records to the prompt that started the turn", () => {
  const records = loadClaudeRecords({ dirs: [CLAUDE_DIR] });
  assert.ok(records.length > 0);
  // The fixture's first user line is "fix the login bug"; every assistant
  // record after it (there is no later user line) carries that prompt.
  for (const r of records) {
    assert.equal(r.prompt, "fix the login bug");
  }
  const breakdown = analyzeSessionBehavior(records);
  assert.equal(breakdown.intents[0].key, "bugfix");
  assert.equal(breakdown.intents[0].pctOfSession, 100);
});

test("behavior: deterministic — same records yield identical output", () => {
  const records = [
    rec({ prompt: "fix the crash", inputTokens: 100, timestamp: "2026-01-15T10:00:00Z" }),
    rec({ prompt: "add a page", inputTokens: 300, cacheReadTokens: 900, timestamp: "2026-01-15T10:05:00Z" }),
  ];
  const a = JSON.stringify(analyzeSessionBehavior(records));
  const b = JSON.stringify(analyzeSessionBehavior(records));
  assert.equal(a, b);
});
