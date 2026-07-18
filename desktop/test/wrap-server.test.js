const { test } = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const { WrapServer } = require("../src/wrap-server");
const { socketPath, encodeMessage, LineDecoder } = require("../src/wrap-protocol");

// Full round-trip over the real Unix domain socket (skipped on Windows,
// where the pipe path is machine-fixed and this suite may race a real
// running app instance) — no Electron dependency needed, matching
// wrap-server.js/wrap-protocol.js's own zero-Electron design.
const skip = process.platform === "win32" ? "named pipe path is fixed/shared on Windows" : false;

test("WrapServer: emits a draft event when a client sends one", { skip }, async () => {
  const server = new WrapServer();
  server.start();
  let client;
  try {
    const draft = await new Promise((resolve) => {
      server.once("draft", resolve);
      client = net.createConnection(socketPath(), () => {
        client.write(encodeMessage({ type: "draft", text: "fix the login bug in auth.js", tool: "claude" }));
      });
    });
    assert.equal(draft.text, "fix the login bug in auth.js");
    assert.equal(draft.tool, "claude");
  } finally {
    client?.end();
    server.stop();
  }
});

test("WrapServer: sendInsertToActive delivers to the most recent draft sender", { skip }, async () => {
  const server = new WrapServer();
  server.start();
  try {
    const client = net.createConnection(socketPath());
    await new Promise((resolve) => client.on("connect", resolve));

    const decoder = new LineDecoder();
    const insertReceived = new Promise((resolve) => {
      client.on("data", (chunk) => {
        for (const msg of decoder.push(chunk)) resolve(msg);
      });
    });

    await new Promise((resolve) => {
      server.once("draft", resolve);
      client.write(encodeMessage({ type: "draft", text: "add tests for auth.js", tool: "codex" }));
    });

    assert.equal(server.hasInsertTarget(), true);
    const sent = server.sendInsertToActive("add unit tests for the login handler in auth.js");
    assert.equal(sent, true);

    const msg = await insertReceived;
    assert.equal(msg.type, "insert");
    assert.equal(msg.text, "add unit tests for the login handler in auth.js");
    assert.equal(msg.forDraft, "add tests for auth.js");

    client.end();
  } finally {
    server.stop();
  }
});

test("WrapServer: sendInsertToActive returns false with no connected client", { skip }, () => {
  const server = new WrapServer();
  assert.equal(server.sendInsertToActive("anything"), false);
});
