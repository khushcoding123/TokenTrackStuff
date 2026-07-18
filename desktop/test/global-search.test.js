const { test } = require("node:test");
const assert = require("node:assert");
const gs = require("../src/global-search");
const svc = require("../src/typesense-service");

test("mapMultiSearchResults: groups code, prompts, usage", () => {
  const mapped = gs.mapMultiSearchResults({
    results: [
      {
        hits: [
          {
            text_match: 10,
            document: {
              id: "1",
              file_path: "desktop/renderer/renderer.js",
              file_name: "renderer.js",
              symbols: ["refreshUsage"],
              directory: "desktop/renderer",
            },
            highlights: [{ field: "symbols", matched_tokens: ["refreshUsage"] }],
          },
          {
            text_match: 5,
            document: {
              id: "2",
              file_path: "desktop/renderer/renderer.js",
              file_name: "renderer.js",
            },
            highlights: [],
          },
        ],
      },
      {
        hits: [
          {
            text_match: 8,
            document: {
              id: "p1",
              original_prompt: "Fix token totals not updating after refresh",
              optimized_prompt: "Start with renderer.js",
              estimated_tokens_saved: 8400,
              relevant_files: ["desktop/renderer/renderer.js"],
            },
          },
        ],
      },
      {
        hits: [
          {
            text_match: 4,
            document: {
              id: "u1",
              project: "metriq",
              session_id: "sess1",
              tool: "claude-code",
              total_tokens: 90000,
              cost_usd: 2.1,
              labels: ["expensive"],
            },
          },
        ],
      },
    ],
  });

  assert.strictEqual(mapped.code.length, 1); // deduped by file
  assert.strictEqual(mapped.code[0].symbol, "refreshUsage");
  assert.strictEqual(mapped.prompts.length, 1);
  assert.match(mapped.prompts[0].subtitle, /8,?400/);
  assert.strictEqual(mapped.usage.length, 1);
  assert.match(mapped.usage[0].subtitle, /expensive/);
});

test("globalSearch: mode off returns empty groups", async () => {
  const config = svc.resolveConfig({ TYPESENSE_MODE: "off" }, {});
  const res = await gs.globalSearch({
    config,
    userId: "u1",
    projectId: "p1",
    q: "usage dashboard",
  });
  assert.deepStrictEqual(res.code, []);
  assert.deepStrictEqual(res.prompts, []);
  assert.deepStrictEqual(res.usage, []);
  assert.strictEqual(res.source, "offline");
});

test("globalSearch: empty query returns none", async () => {
  const res = await gs.globalSearch({ q: "   " });
  assert.strictEqual(res.source, "none");
});
