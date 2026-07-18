// Electron-main-process side of Phase 5b (terminal-agent capture/insert).
//
// Listens on a local Unix domain socket (Windows: a named pipe) that
// `metriq-wrap`-wrapped `claude`/`codex` sessions connect to. This is a
// same-machine, filesystem-permission-scoped channel (socket file created
// 0600 in this app's userData dir) — not a TCP port, so there's no
// "any local process on any port could connect" surface to reason about.
//
// Draft prompts arrive here and are routed into the *same* capture-window
// seeding path the clipboard watcher already uses (see main.js's
// `getWatcher()` / `seededPrompt`), so the popup, the analysis, and the
// "Approve & apply" button are identical UI regardless of source. The only
// new behavior this module adds is the reverse path: sending the approved
// rewrite back to the wrapper so it can inject it into the terminal.

const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { encodeMessage, LineDecoder, socketPath } = require("./wrap-protocol");

class WrapServer extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    // The most recent connection to send a draft — the only one eligible to
    // receive an insert-back, since the capture popup is a single-instance
    // side popup (one active suggestion at a time, same as the clipboard
    // path). Cleared when that connection closes.
    this.activeConn = null;
    this.activeDraftText = "";
  }

  start() {
    if (this.server) return;
    const target = socketPath();
    if (process.platform !== "win32") {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (fs.existsSync(target)) fs.unlinkSync(target); // stale socket from a crashed run
    }

    this.server = net.createServer((conn) => {
      const decoder = new LineDecoder();
      conn.on("data", (chunk) => {
        for (const msg of decoder.push(chunk)) this._handleMessage(conn, msg);
      });
      conn.on("close", () => {
        if (this.activeConn === conn) {
          this.activeConn = null;
          this.activeDraftText = "";
        }
      });
      conn.on("error", () => {}); // a dropped wrapper connection is not an app error
    });

    this.server.on("error", (err) => {
      // A permission/lock error here must never crash the desktop app —
      // Phase 5b failing to start just means terminal capture is
      // unavailable this session, the rest of the app is unaffected.
      console.warn("metriq-wrap server error:", err.message);
    });

    this.server.listen(target, () => {
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(target, 0o600);
        } catch {
          // best-effort
        }
      }
    });
  }

  stop() {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.activeConn = null;
    this.activeDraftText = "";
    const target = socketPath();
    if (process.platform !== "win32") {
      try {
        fs.unlinkSync(target);
      } catch {
        // already gone
      }
    }
  }

  _handleMessage(conn, msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "draft" && typeof msg.text === "string" && msg.text.trim()) {
      this.activeConn = conn;
      this.activeDraftText = msg.text;
      this.emit("draft", { text: msg.text, tool: msg.tool || "terminal" });
    }
  }

  hasInsertTarget() {
    return !!(this.activeConn && !this.activeConn.destroyed);
  }

  // Sends the approved rewrite back to whichever wrapper connection most
  // recently sent a draft. Includes the original draft text the analysis
  // was run against (`forDraft`) so the wrapper can verify its current
  // input line still matches before overwriting anything — if the user
  // kept typing after the draft was sent, the wrapper aborts the insert
  // rather than clobbering text that was never analyzed.
  sendInsertToActive(text) {
    if (!this.hasInsertTarget()) return false;
    this.activeConn.write(encodeMessage({ type: "insert", text, forDraft: this.activeDraftText }));
    return true;
  }
}

module.exports = { WrapServer, socketPath };
