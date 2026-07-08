// Tests for the `metriq trace` localhost server + dashboard.
// The usage engine itself (parsing, pricing, aggregation) is covered by
// usage.test.js; here we verify the server's token guard and payload passthrough.

import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { createTraceServer, dashboardHTML } from "../src/commands/trace-server.js";

const SAMPLE = { available: true, sources: ["claude-code"], days: 30, totals: { totalTokens: 5, costUSD: 1.23 } };

async function withServer(getData, token, fn) {
  const server = createTraceServer({ getData, token });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("trace server refuses requests without the session token", async () => {
  await withServer(() => SAMPLE, "secret", async (base) => {
    assert.equal((await fetch(`${base}/api/data`)).status, 403);
    assert.equal((await fetch(`${base}/api/data?t=wrong`)).status, 403);
    assert.equal((await fetch(`${base}/`)).status, 403);
  });
});

test("trace server serves the payload with a valid token", async () => {
  await withServer((days) => ({ ...SAMPLE, days }), "secret", async (base) => {
    const res = await fetch(`${base}/api/data?t=secret&days=7`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, true);
    assert.equal(body.days, 7); // days param is threaded through to getData
    assert.equal(body.totals.costUSD, 1.23);
  });
});

test("trace server serves the dashboard HTML on /", async () => {
  await withServer(() => SAMPLE, "secret", async (base) => {
    const res = await fetch(`${base}/?t=secret`);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assert.ok(html.includes("metriq trace"));
  });
});

test("dashboardHTML embeds the token so its own fetch is authorized", () => {
  const html = dashboardHTML("abc123");
  assert.ok(html.includes("abc123"));
  assert.ok(html.includes("/api/data?days="));
});
