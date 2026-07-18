// Pure-logic tests for the Phase 2 code indexer — excludes, chunking, symbol
// extraction, hashing, doc mapping, and incremental diffing. No network / no
// Electron. Live incremental indexing + delete cleanup is covered by
// test/typesense-live.test.js's companion (skips without a server).

const { test } = require("node:test");
const assert = require("node:assert");
const idx = require("../src/code-indexer");

test("shouldExcludeFile: blocks secrets, keys, lockfiles, minified, huge", () => {
  assert.ok(idx.shouldExcludeFile(".env", 10));
  assert.ok(idx.shouldExcludeFile("web/.env.local", 10));
  assert.ok(idx.shouldExcludeFile("certs/server.pem", 10));
  assert.ok(idx.shouldExcludeFile("id_rsa", 10));
  assert.ok(idx.shouldExcludeFile("package-lock.json", 10));
  assert.ok(idx.shouldExcludeFile("dist/app.min.js", 10));
  assert.ok(idx.shouldExcludeFile("bundle.js.map", 10));
  assert.ok(idx.shouldExcludeFile("huge.js", idx.MAX_FILE_BYTES + 1));
});

test("shouldExcludeFile: allows normal source files", () => {
  assert.ok(!idx.shouldExcludeFile("src/core/analyzer.js", 5000));
  assert.ok(!idx.shouldExcludeFile("desktop/renderer/renderer.js", 5000));
  assert.ok(!idx.shouldExcludeFile("app/page.tsx", 5000));
});

test("looksBinary: detects NUL bytes, passes text", () => {
  assert.ok(idx.looksBinary("abc" + String.fromCharCode(0) + "def"));
  assert.ok(!idx.looksBinary("function x() { return 1 }"));
});

test("chunkContent: splits on line boundaries under the size cap", () => {
  const line = "x".repeat(200);
  const content = Array.from({ length: 20 }, () => line).join("\n"); // ~4000 chars
  const chunks = idx.chunkContent(content, 1000);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 1000 + 200)); // within a line of cap
  assert.strictEqual(chunks.join("\n"), content); // lossless
});

test("chunkContent: short file yields a single chunk", () => {
  assert.deepStrictEqual(idx.chunkContent("hello\nworld", 1000), ["hello\nworld"]);
});

test("extractSymbols: finds functions, classes, consts, routes", () => {
  const src = `
    export function analyzePrompt(p) {}
    class TokenBudget {}
    export const UsageChart = () => {}
    def compute_totals(): pass
    app.get('/api/usage', handler)
  `;
  const syms = idx.extractSymbols(src);
  assert.ok(syms.includes("analyzePrompt"));
  assert.ok(syms.includes("TokenBudget"));
  assert.ok(syms.includes("UsageChart"));
  assert.ok(syms.includes("compute_totals"));
  assert.ok(syms.includes("/api/usage"));
});

test("hashContent + chunkId: deterministic and stable", () => {
  assert.strictEqual(idx.hashContent("abc"), idx.hashContent("abc"));
  assert.notStrictEqual(idx.hashContent("abc"), idx.hashContent("abd"));
  assert.strictEqual(idx.chunkId("p1", "a/b.js", 0), idx.chunkId("p1", "a/b.js", 0));
  assert.notStrictEqual(idx.chunkId("p1", "a/b.js", 0), idx.chunkId("p1", "a/b.js", 1));
  assert.notStrictEqual(idx.chunkId("p1", "a/b.js", 0), idx.chunkId("p2", "a/b.js", 0));
});

test("buildChunkDoc: full doc carries isolation keys + derived fields", () => {
  const doc = idx.buildChunkDoc({
    userId: "u1",
    projectId: "p1",
    relPath: "src/core/analyzer.js",
    chunkText: "function analyzePrompt() {}",
    chunkNumber: 2,
    contentHash: "deadbeef",
    symbols: ["analyzePrompt"],
    modifiedAt: 111,
    indexedAt: 222,
  });
  assert.strictEqual(doc.user_id, "u1");
  assert.strictEqual(doc.project_id, "p1");
  assert.strictEqual(doc.file_name, "analyzer.js");
  assert.strictEqual(doc.extension, ".js");
  assert.strictEqual(doc.directory, "src/core");
  assert.strictEqual(doc.chunk_number, 2);
  assert.strictEqual(doc.content, "function analyzePrompt() {}");
});

test("buildChunkDoc: metadata-only mode omits source content", () => {
  const doc = idx.buildChunkDoc({
    userId: "u1",
    projectId: "p1",
    relPath: "src/a.js",
    chunkText: "secret business logic",
    chunkNumber: 0,
    contentHash: "h",
    symbols: ["a"],
    includeContent: false,
  });
  assert.strictEqual(doc.content, "");
  assert.deepStrictEqual(doc.symbols, ["a"]); // symbols/paths still indexed
  assert.strictEqual(doc.file_path, "src/a.js");
});

test("diffFiles: classifies changed / unchanged / removed", () => {
  const prev = { "a.js": "h1", "b.js": "h2", "gone.js": "h3" };
  const cur = [
    { path: "a.js", hash: "h1" }, // unchanged
    { path: "b.js", hash: "h2-new" }, // changed
    { path: "c.js", hash: "h4" }, // new -> changed
  ];
  const d = idx.diffFiles(prev, cur);
  assert.deepStrictEqual(d.unchanged, ["a.js"]);
  assert.deepStrictEqual(d.changed.sort(), ["b.js", "c.js"]);
  assert.deepStrictEqual(d.removed, ["gone.js"]);
});
