// Pure-logic tests for Phase 3 Typesense → projectContext mapping.

const { test } = require("node:test");
const assert = require("node:assert");
const cs = require("../src/context-search");

test("hitsToContext: prefers grouped hits and builds reasons", () => {
  const { projectContext, matches } = cs.hitsToContext({
    grouped_hits: [
      {
        hits: [
          {
            text_match: 100,
            document: {
              file_path: "desktop/renderer/renderer.js",
              file_name: "renderer.js",
              symbols: ["refreshUsage", "psRenderResult"],
            },
            highlights: [
              { field: "symbols", matched_tokens: ["refreshUsage"] },
              { field: "file_name", snippet: "renderer.js" },
            ],
          },
        ],
      },
      {
        hits: [
          {
            text_match: 50,
            document: {
              file_path: "src/core/usage/aggregate.js",
              file_name: "aggregate.js",
              symbols: ["aggregate"],
            },
            highlights: [{ field: "content", snippet: "function <mark>aggregate</mark>() {}" }],
          },
        ],
      },
    ],
  });

  assert.strictEqual(projectContext.confidence, "high");
  assert.deepStrictEqual(projectContext.files, [
    "desktop/renderer/renderer.js",
    "src/core/usage/aggregate.js",
  ]);
  assert.strictEqual(matches[0].symbol, "refreshUsage");
  assert.ok(matches[0].reasons.some((r) => /filename|defines/i.test(r)));
  assert.ok(matches[1].snippet.includes("aggregate"));
});

test("hitsToContext: empty response yields low confidence", () => {
  const { projectContext, matches } = cs.hitsToContext({ hits: [] });
  assert.strictEqual(projectContext.confidence, "low");
  assert.deepStrictEqual(projectContext.files, []);
  assert.deepStrictEqual(matches, []);
});

test("findRelevantFiles: disabled Typesense returns null (scanner fallback)", async () => {
  const svc = require("../src/typesense-service");
  const config = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const res = await cs.findRelevantFiles({
    config,
    userId: "u1",
    projectId: "p1",
    prompt: "Fix the usage dashboard",
  });
  assert.strictEqual(res, null);
});

test("subsystemFromPath: skips generic dirs", () => {
  assert.strictEqual(cs.subsystemFromPath("src/core/usage/aggregate.js"), "usage");
  assert.notStrictEqual(cs.subsystemFromPath("src/lib/helpers/util.js"), "src");
  // All-generic path → empty (caller treats as no subsystem label)
  assert.strictEqual(cs.subsystemFromPath("desktop/renderer/index.js"), "");
});
