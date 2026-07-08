// Unit tests for the metriq analysis core. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { estimateTokens } from "../packages/core/tokenizer.js";
import { analyzePrompt, ratingFor } from "../packages/core/analyzer.js";
import { optimize, buildFocusedPrompt } from "../packages/core/rewrite.js";
import {
  keywordsFromPrompt,
  listSourceFiles,
  scanProjectContext,
} from "../packages/core/scanner.js";

function withTempProject(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "metriq-test-"));
  try {
    for (const [file, content] of Object.entries(files)) {
      const full = join(dir, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
    projectContext: {
      files: ["src/Dashboard.tsx", "src/usageApi.ts"],
      confidence: "high",
      subsystem: "dashboard",
    },
  });
  assert.match(text, /`src\/Dashboard\.tsx`/);
  assert.match(text, /`src\/usageApi\.ts`/);
  assert.match(text, /dashboard flow/i);
});

test("buildFocusedPrompt: asks for another clue on low-confidence scan", () => {
  const a = analyzePrompt("fix the dashboard bug");
  const { text } = buildFocusedPrompt(a, {
    projectContext: { files: [], confidence: "low", subsystem: "" },
  });
  assert.match(text, /couldn't confidently identify/i);
});

test("scanProjectContext: ranks likely ownership files using content and path", () => {
  withTempProject(
    {
      "src/dashboard/DashboardPage.tsx":
        "export function DashboardPage() { return <div>Token usage bug</div>; }",
      "src/dashboard/tokenUsage.ts":
        "export function calculateTokenUsage() { return 0; }",
      "src/auth/login.ts": "export function login() { return true; }",
    },
    (dir) => {
      const context = scanProjectContext("Fix the dashboard token bug", dir);
      assert.equal(context.confidence, "high");
      assert.ok(context.files.includes("src/dashboard/DashboardPage.tsx"));
      assert.ok(context.files.includes("src/dashboard/tokenUsage.ts"));
      assert.equal(context.subsystem, "dashboard");
    }
  );
});

test("scanProjectContext: returns low confidence when nothing matches", () => {
  withTempProject(
    {
      "src/auth/login.ts": "export function login() { return true; }",
      "src/api/user.ts": "export async function fetchUser() { return null; }",
    },
    (dir) => {
      const context = scanProjectContext("Fix the dashboard chart bug", dir);
      assert.equal(context.confidence, "low");
      assert.deepEqual(context.files, []);
    }
  );
});

test("keywordsFromPrompt: drops stopwords and short tokens", () => {
  const kws = keywordsFromPrompt("Fix the dashboard token bug");
  assert.ok(kws.includes("dashboard"));
  assert.ok(kws.includes("token"));
  assert.ok(!kws.includes("fix")); // stopword
  assert.ok(!kws.includes("the")); // stopword
});

test("listSourceFiles: finds this repo's own engine source files", () => {
  // fileURLToPath (not .pathname) so this works on Windows and paths with spaces:
  // .pathname yields a leading-slash, %20-encoded string that readdirSync can't open.
  const files = listSourceFiles(fileURLToPath(new URL("../packages/core", import.meta.url)));
  assert.ok(files.includes("analyzer.js"));
  assert.ok(files.includes("scanner.js"));
  assert.ok(files.every((f) => !f.includes("\\"))); // forward slashes only
});

test("listSourceFiles: returns [] for a nonexistent path", () => {
  assert.deepEqual(listSourceFiles("/definitely/not/a/real/path/xyz"), []);
});
