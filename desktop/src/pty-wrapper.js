#!/usr/bin/env node
// The metriq-wrap child process: `metriq-wrap claude` (or `codex`) spawns
// the real CLI inside a pseudo-TTY it owns, transparently forwards
// stdin/stdout/resize, and — only when it can reach the desktop app's local
// socket — tees stdin to track the current input line and can inject an
// approved rewrite back into it. Phase 5b of
// docs/phase5-screen-awareness-proposal.md.
//
// HARD REQUIREMENT: if the desktop app isn't running, the socket can't be
// reached, or node-pty itself is missing, this must still run the wrapped
// CLI exactly as if `metriq-wrap` weren't there. A user's coding session
// must never be blocked or degraded by this feature being unavailable.

const net = require("node:net");
const {
  socketPath,
  encodeMessage,
  LineDecoder,
  applyKeystrokes,
  buildReplaceInput,
  looksLikeDraftPrompt,
} = require("./wrap-protocol");

const DEBOUNCE_MS = 500;

function run(argv) {
  const [tool, ...args] = argv;
  if (!tool) {
    process.stderr.write("Usage: metriq-wrap <claude|codex> [args...]\n");
    process.exit(1);
  }

  let pty;
  try {
    pty = require("node-pty");
  } catch {
    // node-pty isn't installed/buildable on this machine — fall back to a
    // plain passthrough spawn with no capture, rather than failing to
    // launch the user's CLI at all.
    return passthroughSpawn(tool, args);
  }

  const ptyProcess = pty.spawn(tool, args, {
    name: "xterm-256color",
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    cwd: process.cwd(),
    env: process.env,
  });

  let lineBuffer = "";
  let debounceTimer = null;
  let socket = null;
  const decoder = new LineDecoder();

  function connectSocket() {
    const s = net.createConnection(socketPath());
    s.on("connect", () => {
      socket = s;
      s.write(encodeMessage({ type: "hello", tool, pid: process.pid }));
    });
    s.on("data", (chunk) => {
      for (const msg of decoder.push(chunk)) handleServerMessage(msg);
    });
    s.on("error", () => {
      socket = null; // desktop app not running / not reachable — capture just stays off
    });
    s.on("close", () => {
      socket = null;
    });
  }

  function handleServerMessage(msg) {
    if (!msg || msg.type !== "insert" || typeof msg.text !== "string") return;
    // Verify-before-write: only apply if the user hasn't kept typing since
    // this draft was analyzed. A stale insert is silently dropped rather
    // than clobbering newer text — see wrap-server.js's sendInsertToActive.
    if (msg.forDraft !== undefined && lineBuffer !== msg.forDraft) return;
    ptyProcess.write(buildReplaceInput(lineBuffer.length, msg.text));
    lineBuffer = msg.text;
  }

  function maybeSendDraft() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (socket && looksLikeDraftPrompt(lineBuffer)) {
        socket.write(encodeMessage({ type: "draft", text: lineBuffer, tool }));
      }
    }, DEBOUNCE_MS);
  }

  connectSocket();

  // Raw mode so every keystroke (including control chars) reaches us
  // one-at-a-time, exactly as the wrapped CLI itself expects to receive them.
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on("data", (chunk) => {
    ptyProcess.write(chunk.toString("utf8"));
    lineBuffer = applyKeystrokes(lineBuffer, chunk.toString("utf8"));
    maybeSendDraft();
  });

  ptyProcess.onData((data) => process.stdout.write(data));

  process.stdout.on("resize", () => {
    ptyProcess.resize(process.stdout.columns || 80, process.stdout.rows || 24);
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    socket?.end();
    process.exit(exitCode);
  });
}

// No-capture fallback: identical passthrough behavior, just without the
// draft-tracking/insert wiring. Used when node-pty isn't available.
function passthroughSpawn(tool, args) {
  const { spawn } = require("node:child_process");
  const child = spawn(tool, args, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

module.exports = { run };

if (require.main === module) {
  run(process.argv.slice(2));
}
