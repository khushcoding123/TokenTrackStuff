// Manual E2E smoke of Typesense Project Intelligence against a real local server.
// Run: node scripts/smoke-typesense.js
// Exits non-zero on any failed assertion.

const path = require("node:path");
const assert = require("node:assert");
const { pathToFileURL } = require("node:url");

function pathToFileUrl(p) {
  return pathToFileURL(p).href;
}

const svc = require("../src/typesense-service");
const codeIndexer = require("../src/code-indexer");
const contextSearch = require("../src/context-search");
const promptMemory = require("../src/prompt-memory");
const usageIndexer = require("../src/usage-indexer");
const globalSearch = require("../src/global-search");
const { expandQuery } = require("../src/hybrid-query");
// packages/core is ESM — load via dynamic import from CJS.
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const USER_ID = "smoke-user";
const PROJECT_ID = `smoke_${Date.now()}`;
const config = svc.resolveConfig(
  { TYPESENSE_MODE: "local", TYPESENSE_HOST: "localhost", TYPESENSE_PORT: "8108", TYPESENSE_API_KEY: "metriq-local" },
  { hybridSearch: true }
);

function ok(label) {
  console.log(`  ✓ ${label}`);
}
function section(title) {
  console.log(`\n== ${title} ==`);
}

async function main() {
  const { listSourceFiles } = await import(
    pathToFileUrl(path.join(PROJECT_ROOT, "packages/core/scanner.js"))
  );
  const { optimize } = await import(
    pathToFileUrl(path.join(PROJECT_ROOT, "packages/core/rewrite.js"))
  );

  section("1. Health");
  const health = await svc.health(config);
  assert.ok(health.ok, `Typesense health failed: ${health.error}`);
  ok(`Typesense reachable at ${config.baseUrl}`);

  section("2. Ensure collections");
  await svc.ensureAllCollections(config);
  for (const name of Object.values(svc.SCHEMAS).map((s) => s.name)) {
    const info = await svc.collectionInfo(config, name);
    assert.ok(info, `missing collection ${name}`);
    ok(`collection ${name} ready`);
  }

  section("3. Index this repo (desktop + packages/core sample)");
  // Skip hybrid-query.js itself — it lists every synonym string and would
  // otherwise dominate ranking during self-tests of this repo.
  const files = listSourceFiles(PROJECT_ROOT).filter(
    (f) =>
      (f.startsWith("desktop/src/") ||
        f.startsWith("desktop/renderer/") ||
        f.startsWith("packages/core/") ||
        f.startsWith("src/core/usage/")) &&
      !f.endsWith("hybrid-query.js")
  );
  assert.ok(files.length > 20, `expected many source files, got ${files.length}`);
  const indexed = await codeIndexer.indexProject({
    config,
    userId: USER_ID,
    projectId: PROJECT_ID,
    root: PROJECT_ROOT,
    files,
    previousHashes: {},
  });
  assert.ok(indexed.ok, indexed.error);
  assert.ok(indexed.chunkCount > 0, "no chunks indexed");
  ok(`indexed ${indexed.fileCount} files / ${indexed.chunkCount} chunks`);

  section("4. Context search (vague prompt)");
  const vague = "Fix the screen that shows how many tokens were consumed";
  const hit = await contextSearch.findRelevantFiles({
    config,
    userId: USER_ID,
    projectId: PROJECT_ID,
    prompt: vague,
  });
  assert.ok(hit, "Typesense returned no relevant files");
  assert.ok(hit.projectContext.files.length, "empty files list");
  ok(`source=${hit.source} hybrid=${Boolean(hit.hybrid)} files=${hit.projectContext.files.slice(0, 4).join(", ")}`);
  const joined = hit.projectContext.files.join(" ");
  // With hybrid on we expect usage/renderer-ish files; without hybrid, any
  // non-empty Typesense hit that feeds the rewrite is still success.
  if (hit.hybrid) {
    assert.ok(
      /usage|aggregate|renderer|impact|token/i.test(joined),
      `expected usage-related files under hybrid, got ${joined}`
    );
    ok("hybrid files look relevant to usage/tokens UI");
  } else {
    ok(`non-hybrid files: ${joined}`);
  }

  section("5. Rewrite with Typesense context");
  const result = optimize(vague, {
    relevantFiles: hit.projectContext.files,
    projectContext: hit.projectContext,
  });
  assert.ok(result.focused.text.length > vague.length / 2);
  assert.ok(
    hit.projectContext.files.some((f) => result.focused.text.includes(f)),
    "rewrite should mention a relevant file"
  );
  ok(`rewrite mentions files; saved≈${result.savedTokens} tokens (${result.savedPct}%)`);
  console.log(`     → ${result.focused.text.slice(0, 180)}…`);

  section("6. Prompt memory");
  const run = await promptMemory.indexPromptRun({
    config,
    userId: USER_ID,
    projectId: PROJECT_ID,
    originalPrompt: vague,
    optimizedPrompt: result.focused.text,
    tool: "claude",
    breadthScore: result.analysis.breadthScore,
    projectedTokens: result.analysis.projectedTokens,
    estimatedTokensSaved: result.savedTokens,
    relevantFiles: hit.projectContext.files,
  });
  assert.ok(run.ok, run.error);
  const similar = await promptMemory.findSimilar({
    config,
    userId: USER_ID,
    projectId: PROJECT_ID,
    prompt: "token totals not updating on the usage screen",
  });
  assert.ok(similar.length >= 1, "expected similar prompt hit");
  ok(`similar[0]="${similar[0].originalPrompt.slice(0, 60)}…" saved=${similar[0].estimatedTokensSaved}`);

  section("7. Usage sessions index + search");
  const sessions = [
    {
      sessionId: "smoke-sess-1",
      source: "claude-code",
      project: "TokenVibeCodeTrack",
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      endedAt: new Date().toISOString(),
      models: ["claude-sonnet"],
      requests: 20,
      inputTokens: 72000,
      outputTokens: 3000,
      cacheCreationTokens: 2000,
      cacheReadTokens: 800,
      totalTokens: 77800,
      costUSD: 2.4,
    },
  ];
  const usageIdx = await usageIndexer.indexUsageSessions({
    config,
    userId: USER_ID,
    sessions,
    records: [
      {
        source: "claude-code",
        sessionId: "smoke-sess-1",
        prompt: "fix authentication token refresh on the desktop renderer",
      },
    ],
  });
  assert.ok(usageIdx.ok, usageIdx.error);
  // Typesense may need a brief moment for searchability after import
  await new Promise((r) => setTimeout(r, 400));
  const expensive = await usageIndexer.searchUsageSessions({
    config,
    userId: USER_ID,
    q: "expensive authentication sessions",
    limit: 10,
  });
  assert.ok(expensive.some((h) => h.sessionId === "smoke-sess-1"), "usage search missed smoke session");
  ok(`usage search found session (${expensive[0].labels.join(", ")})`);

  section("8. Global multi-search (Cmd+K)");
  const g = await globalSearch.globalSearch({
    config,
    userId: USER_ID,
    projectId: PROJECT_ID,
    q: "usage tokens renderer",
  });
  assert.strictEqual(g.source, "typesense");
  assert.ok(g.code.length || g.prompts.length || g.usage.length, "global search empty");
  ok(`code=${g.code.length} prompts=${g.prompts.length} usage=${g.usage.length} hybrid=${g.hybrid}`);

  section("9. Hybrid expansion");
  const exp = expandQuery(vague, { hybridSearch: true });
  assert.ok(exp.expanded.includes("usage"));
  ok(`expanded terms: ${exp.expanded.join(", ")}`);

  section("10. Fallback when Typesense off");
  const off = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const miss = await contextSearch.findRelevantFiles({
    config: off,
    userId: USER_ID,
    projectId: PROJECT_ID,
    prompt: vague,
  });
  assert.strictEqual(miss, null);
  ok("disabled mode returns null → scanner fallback path intact");

  section("Cleanup");
  await codeIndexer.removeProjectIndex(config, PROJECT_ID);
  await svc
    .deleteByFilter(config, svc.SCHEMAS.prompt_runs.name, `project_id:=\`${PROJECT_ID}\``)
    .catch(() => {});
  await svc
    .deleteByFilter(config, svc.SCHEMAS.usage_sessions.name, `user_id:=\`${USER_ID}\``)
    .catch(() => {});
  ok("removed smoke documents");

  console.log("\nAll smoke checks passed.\n");
}

main().catch((err) => {
  console.error("\nSMOKE FAILED:", err);
  process.exit(1);
});
