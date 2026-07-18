// Live integration tests against a real Typesense server. These SKIP
// automatically when no server is reachable, so CI / offline dev stays green;
// run a local Typesense (see desktop/TYPESENSE.md) to exercise them:
//
//   MSYS_NO_PATHCONV=1 docker run -p 8108:8108 -v metriq-ts-data:/data \
//     typesense/typesense:27.1 --data-dir=/data --api-key=metriq-local
//
// They use throwaway collections (a unique suffix) and drop them afterward, so
// they never touch the app's real metriq_* data.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const svc = require("../src/typesense-service");
const codeIndexer = require("../src/code-indexer");

const config = svc.resolveConfig(process.env, {});
const suffix = `_test_${Date.now()}`;
const COLL = `metriq_live${suffix}`;
const TEST_PROJECT_ID = `live_index_${Date.now()}`;
let serverUp = false;

before(async () => {
  const h = await svc.health(config);
  serverUp = h.ok;
});

after(async () => {
  if (serverUp) {
    await svc.dropCollection(config, COLL).catch(() => {});
    await codeIndexer.removeProjectIndex(config, TEST_PROJECT_ID).catch(() => {});
  }
});

test("live: ensure -> import -> search -> filter-isolation -> delete", async (t) => {
  if (!serverUp) return t.skip("no Typesense server reachable");

  const schema = {
    name: COLL,
    fields: [
      { name: "user_id", type: "string", facet: true },
      { name: "project_id", type: "string", facet: true },
      { name: "file_path", type: "string" },
      { name: "content", type: "string" },
      { name: "chunk_number", type: "int32" },
    ],
    default_sorting_field: "chunk_number",
  };
  const first = await svc.ensureCollection(config, schema);
  assert.strictEqual(first.created, true);

  // ensure is idempotent — re-ensuring the same collection tolerates the 409
  const again = await svc.ensureCollection(config, schema);
  assert.strictEqual(again.existed, true);

  const imp = await svc.importDocuments(config, COLL, [
    { id: "1", user_id: "u1", project_id: "p1", file_path: "src/auth/login.js", content: "function login() { authenticate() }", chunk_number: 0 },
    { id: "2", user_id: "u1", project_id: "p1", file_path: "src/auth/token.js", content: "refreshToken and access token handling", chunk_number: 0 },
    { id: "3", user_id: "u2", project_id: "p2", file_path: "src/other/thing.js", content: "unrelated login content here", chunk_number: 0 },
  ]);
  assert.strictEqual(imp.imported, 3);
  assert.strictEqual(imp.failed, 0);

  assert.strictEqual(await svc.documentCount(config, COLL), 3);

  // typo-tolerant search ("logon" -> "login"), isolated to project p1
  const res = await svc.search(config, COLL, {
    q: "logon",
    query_by: "content,file_path",
    filters: { project_id: "p1" },
  });
  const paths = res.hits.map((h) => h.document.file_path);
  assert.ok(paths.includes("src/auth/login.js"), "typo-tolerant match found login.js");
  assert.ok(!paths.includes("src/other/thing.js"), "project_id filter excluded p2's doc");

  // delete one file's docs by filter, confirm cleanup
  await svc.deleteByFilter(config, COLL, "project_id:=`p1` && file_path:=`src/auth/token.js`");
  assert.strictEqual(await svc.documentCount(config, COLL), 2);
});

test("live: indexProject indexes, then re-indexes incrementally + cleans deleted files", async (t) => {
  if (!serverUp) return t.skip("no Typesense server reachable");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "metriq-idx-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "login.js"), "export function authenticate() { return true }\n");
  fs.writeFileSync(path.join(root, "src", "usage.js"), "export const UsageChart = () => renderTokens()\n");
  fs.writeFileSync(path.join(root, ".env"), "SECRET=should-not-be-indexed\n");

  const files = ["src/login.js", "src/usage.js", ".env"];

  // First index — the .env must be excluded.
  const r1 = await codeIndexer.indexProject({
    config,
    userId: "u1",
    projectId: TEST_PROJECT_ID,
    root,
    files,
    previousHashes: {},
  });
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.fileCount, 2, ".env excluded from index");
  assert.ok(r1.chunkCount >= 2);

  // Symbol-weighted, project-isolated search finds the right file.
  const found = await svc.search(config, codeIndexer.COLLECTION, {
    q: "authenticate",
    query_by: "symbols,content,file_path",
    filters: { project_id: TEST_PROJECT_ID },
  });
  assert.ok(found.hits.some((h) => h.document.file_path === "src/login.js"));

  // Incremental re-index: change one file, delete another.
  fs.writeFileSync(path.join(root, "src", "login.js"), "export function authenticate() { return verifyPassword() }\n");
  fs.rmSync(path.join(root, "src", "usage.js"));
  const files2 = ["src/login.js", ".env"];
  const r2 = await codeIndexer.indexProject({
    config,
    userId: "u1",
    projectId: TEST_PROJECT_ID,
    root,
    files: files2,
    previousHashes: r1.hashes,
  });
  assert.strictEqual(r2.changedCount, 1, "only the edited file re-indexed");
  assert.strictEqual(r2.removedCount, 1, "deleted file detected");

  // The deleted file's chunks are gone.
  const afterDelete = await svc.search(config, codeIndexer.COLLECTION, {
    q: "*",
    query_by: "file_path",
    filters: { project_id: TEST_PROJECT_ID, file_path: "src/usage.js" },
  });
  assert.strictEqual(afterDelete.found, 0, "usage.js chunks cleaned up");

  fs.rmSync(root, { recursive: true, force: true });
});

test("live: multiSearch federates across queries", async (t) => {
  if (!serverUp) return t.skip("no Typesense server reachable");
  const res = await svc.multiSearch(config, [
    { collection: COLL, q: "login", query_by: "content", filters: { project_id: "p1" } },
    { collection: COLL, q: "*", query_by: "content", filters: { user_id: "u2" } },
  ]);
  assert.strictEqual(res.results.length, 2);
});
