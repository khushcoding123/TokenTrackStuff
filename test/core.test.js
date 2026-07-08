// Unit tests for the TokenPilot analysis core. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateTokens } from "../packages/core/tokenizer.js";
import { analyzePrompt, ratingFor } from "../packages/core/analyzer.js";
import { optimize, buildFocusedPrompt } from "../packages/core/rewrite.js";
import { keywordsFromPrompt } from "../packages/core/scanner.js";

test("estimateTokens: empty and non-empty", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("   "), 0);
  assert.ok(estimateTokens("hello world") > 0);
  // Longer text estimates more tokens than shorter text.
  assert.ok(estimateTokens("a".repeat(400)) > estimateTokens("a".repeat(40)));
});

test("analyzePrompt: broad prompt scores high and flags issues", () => {
  const a = analyzePrompt("Fix the dashboard bug");
  assert.equal(a.rating, "broad");
  assert.ok(a.breadthScore >= 55);
  const ids = a.issues.map((i) => i.id);
  assert.ok(ids.includes("broad-scope"));
  assert.ok(ids.includes("vague-verb"));
  assert.ok(ids.includes("no-file-ref"));
});

test("analyzePrompt: focused prompt scores low with no issues", () => {
  const a = analyzePrompt(
    "In src/auth/login.ts, add a null check before decoding the token. Smallest change only."
  );
  assert.equal(a.rating, "focused");
  assert.equal(a.issues.length, 0);
  assert.ok(a.hasFileRef);
});

test("analyzePrompt: file reference suppresses vague-verb and no-file-ref", () => {
  const withRef = analyzePrompt("Fix the bug in `Dashboard.tsx`");
  const ids = withRef.issues.map((i) => i.id);
  assert.ok(!ids.includes("no-file-ref"));
  assert.ok(!ids.includes("vague-verb"));
});

test("analyzePrompt: scope guard lowers projected exploration", () => {
  const loose = analyzePrompt("refactor the auth module");
  const guarded = analyzePrompt(
    "refactor the auth module. Make the smallest change necessary."
  );
  assert.ok(guarded.projectedTokens < loose.projectedTokens);
});

test("analyzePrompt: detects near-duplicate against history", () => {
  const a = analyzePrompt("add authentication to the app", {
    history: ["add authentication to the app"],
  });
  assert.ok(a.issues.some((i) => i.id === "repeated"));
});

test("ratingFor: thresholds", () => {
  assert.equal(ratingFor(0), "focused");
  assert.equal(ratingFor(30), "moderate");
  assert.equal(ratingFor(80), "broad");
});

test("optimize: broad prompt yields positive savings and a rewrite", () => {
  const r = optimize("Fix the dashboard bug");
  assert.ok(r.savedTokens > 0);
  assert.ok(r.savedPct > 0);
  assert.match(r.focused.text, /smallest change/i);
  assert.match(r.focused.text, /briefly list what changed/i);
});

test("buildFocusedPrompt: uses scanned files when provided", () => {
  const a = analyzePrompt("fix the dashboard bug");
  const { text } = buildFocusedPrompt(a, {
    relevantFiles: ["src/Dashboard.tsx", "src/usageApi.ts"],
  });
  assert.match(text, /`src\/Dashboard\.tsx`/);
  assert.match(text, /`src\/usageApi\.ts`/);
});

test("keywordsFromPrompt: drops stopwords and short tokens", () => {
  const kws = keywordsFromPrompt("Fix the dashboard token bug");
  assert.ok(kws.includes("dashboard"));
  assert.ok(kws.includes("token"));
  assert.ok(!kws.includes("fix")); // stopword
  assert.ok(!kws.includes("the")); // stopword
});
