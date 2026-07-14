const { test } = require("node:test");
const assert = require("node:assert/strict");

const behaviorModule = import("../../src/core/usage/behavior.js");

function record({ timestamp, prompt, input = 0, output = 0, cacheRead = 0 }) {
  return {
    timestamp,
    prompt,
    source: "codex",
    sessionId: "session-1",
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: 0,
    cacheReadTokens: cacheRead,
  };
}

test("session behavior keeps questions separate from other activity", async () => {
  const { analyzeSessionBehavior } = await behaviorModule;
  const result = analyzeSessionBehavior([
    record({ timestamp: "2026-07-14T10:00:00Z", prompt: "How does this work?", output: 300 }),
    record({ timestamp: "2026-07-14T10:01:00Z", prompt: "Continue", output: 100 }),
  ]);

  assert.equal(result.intents.find((item) => item.key === "question").tokens, 300);
  assert.equal(result.intents.find((item) => item.key === "other").tokens, 100);
});

test("useful activity rows reconcile with the useful token total", async () => {
  const { analyzeSessionBehavior } = await behaviorModule;
  const result = analyzeSessionBehavior([
    record({ timestamp: "2026-07-14T10:00:00Z", prompt: "Build the dashboard", output: 600 }),
    record({ timestamp: "2026-07-14T10:01:00Z", prompt: "Review the dashboard", output: 400 }),
  ]);

  const breakdownTotal = result.usefulBreakdown.reduce((sum, item) => sum + item.tokens, 0);
  assert.equal(breakdownTotal, result.usefulTokens);
  assert.equal(result.usefulTokens + result.wastedTokens, result.sessionTokens);
});

test("overlapping waste signals stay capped and reconcile by cause", async () => {
  const { analyzeSessionBehavior } = await behaviorModule;
  const result = analyzeSessionBehavior([
    record({ timestamp: "2026-07-14T10:00:00Z", prompt: "Build the dashboard", output: 100 }),
    record({
      timestamp: "2026-07-14T10:01:00Z",
      prompt: "check this",
      input: 1000,
      output: 1,
      cacheRead: 1,
    }),
  ]);

  const causeTotal = result.waste.reduce((sum, item) => sum + item.tokens, 0);
  assert.ok(result.wastedPct <= 100);
  assert.equal(causeTotal, result.wastedTokens);
  assert.equal(result.usefulTokens + result.wastedTokens, result.sessionTokens);
});
