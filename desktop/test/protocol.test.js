const { test } = require("node:test");
const assert = require("node:assert/strict");
const { findProtocolUrlInArgv, parseAuthCallbackUrl } = require("../src/protocol");

test("parseAuthCallbackUrl: extracts token, refresh_token, email, name", () => {
  const url = "metriq://auth-callback?token=abc123&refresh_token=r1&email=jane%40example.com&name=Jane%20Doe";
  assert.deepEqual(parseAuthCallbackUrl(url), {
    token: "abc123",
    refreshToken: "r1",
    email: "jane@example.com",
    name: "Jane Doe",
  });
});

test("parseAuthCallbackUrl: token is the only required field", () => {
  const url = "metriq://auth-callback?token=abc123";
  assert.deepEqual(parseAuthCallbackUrl(url), {
    token: "abc123",
    refreshToken: null,
    email: null,
    name: null,
  });
});

test("parseAuthCallbackUrl: rejects missing token", () => {
  assert.equal(parseAuthCallbackUrl("metriq://auth-callback?email=a@b.com"), null);
});

test("parseAuthCallbackUrl: rejects wrong scheme", () => {
  assert.equal(parseAuthCallbackUrl("https://evil.example/auth-callback?token=abc"), null);
});

test("parseAuthCallbackUrl: rejects wrong host under the right scheme", () => {
  assert.equal(parseAuthCallbackUrl("metriq://not-the-right-path?token=abc"), null);
});

test("parseAuthCallbackUrl: rejects garbage input", () => {
  assert.equal(parseAuthCallbackUrl("not a url at all"), null);
  assert.equal(parseAuthCallbackUrl(""), null);
  assert.equal(parseAuthCallbackUrl(null), null);
  assert.equal(parseAuthCallbackUrl(undefined), null);
});

test("findProtocolUrlInArgv: finds the metriq:// entry among other argv", () => {
  const argv = ["/usr/bin/electron", "--flag", "metriq://auth-callback?token=x", "--other"];
  assert.equal(findProtocolUrlInArgv(argv), "metriq://auth-callback?token=x");
});

test("findProtocolUrlInArgv: returns null when absent", () => {
  assert.equal(findProtocolUrlInArgv(["/usr/bin/electron", "--flag"]), null);
});
