// Guard: the preload bridge must never hand the Typesense API key to the renderer.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("preload.js Typesense surface does not expose apiKey", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/preload.js"), "utf8");
  assert.match(src, /getTypesenseStatus/);
  assert.match(src, /setTypesenseConfig/);
  assert.match(src, /reindexTypesense/);
  assert.match(src, /findSimilarPrompts/);
  assert.match(src, /searchUsageSessions/);
  assert.match(src, /globalSearch/);
  // Must not return or bridge a raw apiKey field to the renderer.
  assert.doesNotMatch(src, /apiKey\s*:/);
  assert.doesNotMatch(src, /TYPESENSE_API_KEY/);
});

test("typesense-service exports updateDocument but no key getter", () => {
  const svc = require("../src/typesense-service");
  assert.strictEqual(typeof svc.updateDocument, "function");
  assert.ok(!Object.keys(svc).some((n) => /apiKey|getKey/i.test(n)));
});
