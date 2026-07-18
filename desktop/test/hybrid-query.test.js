const { test } = require("node:test");
const assert = require("node:assert");
const { expandQuery } = require("../src/hybrid-query");

test("expandQuery: off returns keyword tokens, not the full sentence", () => {
  const r = expandQuery("Fix the screen that shows how many tokens were consumed", {
    hybridSearch: false,
  });
  assert.strictEqual(r.hybrid, false);
  assert.deepStrictEqual(r.expanded, []);
  assert.match(r.q, /token/);
  assert.ok(!r.q.includes("Fix the screen"));
});

test("expandQuery: tokens/usage concept expands to usage files", () => {
  const r = expandQuery("Fix the screen that shows how many tokens were consumed", {
    hybridSearch: true,
  });
  assert.strictEqual(r.hybrid, true);
  assert.ok(r.expanded.includes("usage"));
  assert.ok(r.expanded.includes("aggregate") || r.expanded.includes("renderer"));
  assert.ok(r.q.startsWith("usage") || r.q.includes("usage"));
  // Synonyms should lead; full NL sentence must not be pasted in.
  assert.ok(!r.q.includes("Fix the screen that shows"));
});

test("expandQuery: auth concept expands", () => {
  const r = expandQuery("broken login oauth callback", { hybridSearch: true });
  assert.ok(r.expanded.includes("auth") || r.expanded.includes("protocol"));
});

test("expandQuery: empty prompt is a no-op", () => {
  assert.deepStrictEqual(expandQuery("", { hybridSearch: true }), {
    q: "",
    expanded: [],
    hybrid: false,
  });
});
