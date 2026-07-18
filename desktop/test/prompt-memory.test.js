// Pure-logic tests for Phase 4 prompt memory.

const { test } = require("node:test");
const assert = require("node:assert");
const mem = require("../src/prompt-memory");

test("runId: stable for same prompt, changes when prompt changes", () => {
  const a = mem.runId("u1", "p1", "Fix the dashboard bug");
  const b = mem.runId("u1", "p1", "  Fix   the dashboard bug  ");
  const c = mem.runId("u1", "p1", "Fix a different bug");
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, c);
});

test("buildRunDoc: isolation keys + truncated file list", () => {
  const doc = mem.buildRunDoc({
    userId: "u1",
    projectId: "p1",
    originalPrompt: "Fix token totals",
    optimizedPrompt: "Start with renderer.js…",
    tool: "claude",
    breadthScore: 72,
    projectedTokens: 12000,
    estimatedTokensSaved: 8400,
    relevantFiles: Array.from({ length: 25 }, (_, i) => `f${i}.js`),
    used: false,
    timestamp: 1000,
  });
  assert.strictEqual(doc.user_id, "u1");
  assert.strictEqual(doc.project_id, "p1");
  assert.strictEqual(doc.estimated_tokens_saved, 8400);
  assert.strictEqual(doc.relevant_files.length, 20);
  assert.strictEqual(doc.used, false);
  assert.strictEqual(doc.id, mem.runId("u1", "p1", "Fix token totals"));
});

test("runsToSimilar: maps hits for the UI", () => {
  const items = mem.runsToSimilar({
    hits: [
      {
        text_match: 99,
        document: {
          id: "abc",
          original_prompt: "Fix token totals not updating",
          optimized_prompt: "Start with desktop/renderer/renderer.js",
          estimated_tokens_saved: 8400,
          projected_tokens: 12000,
          breadth_score: 70,
          relevant_files: ["desktop/renderer/renderer.js"],
          tool: "claude",
          used: true,
          timestamp: 42,
        },
      },
    ],
  });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].originalPrompt, "Fix token totals not updating");
  assert.strictEqual(items[0].estimatedTokensSaved, 8400);
  assert.deepStrictEqual(items[0].relevantFiles, ["desktop/renderer/renderer.js"]);
  assert.strictEqual(items[0].used, true);
});

test("indexPromptRun: short prompts skipped without network", async () => {
  const res = await mem.indexPromptRun({ originalPrompt: "hi" });
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /short/i);
});

test("findSimilar: mode off returns empty array", async () => {
  const svc = require("../src/typesense-service");
  const config = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const items = await mem.findSimilar({
    config,
    userId: "u1",
    projectId: "p1",
    prompt: "expensive authentication sessions",
  });
  assert.deepStrictEqual(items, []);
});
