// Pure, dependency-free logic for the metriq-wrap <-> desktop-app protocol
// (Phase 5b: terminal-agent capture/insert). Deliberately separated from
// node-pty and Electron's `net` module so it's unit-testable with plain
// `node --test`, same pattern as protocol.js for the auth callback.
//
// Wire format: newline-delimited JSON over a local Unix domain socket
// (Windows: named pipe). Messages:
//   wrapper -> app:  {type:"hello", tool, pid}
//   wrapper -> app:  {type:"draft", text, tool}
//   app -> wrapper:  {type:"insert", text, forDraft}   // forDraft = verify-before-write
//
const os = require("node:os");
const path = require("node:path");

// Backspace/DEL byte, used both to erase what the user typed (tracking) and
// to erase it on-screen when inserting a replacement (writing).
const BACKSPACE = "\x7f";

// The local socket both sides connect to: the Electron main process (a
// server) and each `metriq-wrap`-spawned CLI session (a client). The
// wrapper runs as a plain Node process, not inside Electron, so this can't
// use `app.getPath('userData')` — instead it reuses `~/.metriq/`, the same
// stable, Electron-independent convention `src/core/session.js` already
// uses for the CLI's session log, so both processes agree on the path with
// no discovery handshake needed.
// Windows note: named pipes are machine-global, not per-user-ACL'd by
// default via plain node:net — on a shared Windows machine another local
// user could in principle see this pipe name. Accepted limitation for v1
// (documented in docs/phase5-screen-awareness-proposal.md); revisit with an
// explicit security descriptor if this ships beyond a single-user machine.
function socketPath() {
  if (process.platform === "win32") return "\\\\.\\pipe\\metriq-wrap";
  return path.join(os.homedir(), ".metriq", "wrap.sock");
}

function encodeMessage(obj) {
  return JSON.stringify(obj) + "\n";
}

// Accumulates raw bytes from a socket/stdout stream and yields complete
// newline-delimited JSON messages, buffering any partial trailing line.
class LineDecoder {
  constructor() {
    this.buffer = "";
  }

  // Feeds a chunk, returns an array of parsed messages (invalid lines are
  // dropped rather than throwing — a malformed line must never crash the
  // wrapper's passthrough of the user's actual terminal session).
  push(chunk) {
    this.buffer += String(chunk);
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop(); // last element is the incomplete tail (or "")
    const messages = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        messages.push(JSON.parse(line));
      } catch {
        // Drop malformed line — never break the passthrough.
      }
    }
    return messages;
  }
}

// Tracks "what the user has typed on the current input line so far" by
// replaying raw keystroke bytes forwarded to the child PTY. This is a
// heuristic, not a real terminal emulator: it does not track cursor
// position, so mid-line edits (arrow-key navigation + insert) aren't
// reflected correctly — only the common case of "type forward, optionally
// backspace, then submit" is tracked accurately. That's an accepted
// limitation for v1 (see docs/phase5-screen-awareness-proposal.md).
function applyKeystrokes(current, chunk) {
  let buffer = current;
  const text = String(chunk);
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const code = ch.charCodeAt(0);

    if (ch === "\x1b") {
      // ANSI escape sequence (arrow keys, etc: ESC [ ... final-byte). Skip
      // the whole sequence rather than letting its individual bytes leak
      // into the buffer as literal characters.
      if (text[i + 1] === "[") {
        let j = i + 2;
        while (j < text.length && !(text.charCodeAt(j) >= 0x40 && text.charCodeAt(j) <= 0x7e)) j++;
        i = j + 1;
      } else {
        i += 2; // best-effort skip of a 2-byte Alt/Meta sequence
      }
      continue;
    }

    if (ch === "\r" || ch === "\n") {
      buffer = ""; // line submitted
    } else if (ch === BACKSPACE || ch === "\b") {
      buffer = buffer.slice(0, -1);
    } else if (code === 0x15) {
      buffer = ""; // Ctrl+U: kill line
    } else if (code === 0x03) {
      buffer = ""; // Ctrl+C: cancelled
    } else if (ch === "\t" || code >= 0x20) {
      buffer += ch; // printable
    }
    // else: other control bytes are ignored rather than guessed at.
    i++;
  }
  return buffer;
}

// Bytes to write into the child PTY to erase `currentLength` typed
// characters and replace them with `newText`, as if the user had done it
// themselves. No Enter is sent — the user still submits manually.
function buildReplaceInput(currentLength, newText) {
  return BACKSPACE.repeat(Math.max(0, currentLength)) + newText;
}

// Heuristic used on the wrapper side to decide whether the accumulated
// input line is worth sending as a draft — same shape of check as
// prompt-watcher.js's looksLikePrompt, duplicated here (not imported) so
// this module stays dependency-free and usable outside Electron.
function looksLikeDraftPrompt(text) {
  const t = String(text || "").trim();
  if (t.length < 15 || t.length > 4000) return false;
  if (!/\s/.test(t)) return false;
  if (t.split(/\s+/).length < 3) return false;
  return /[a-z]{3,}/i.test(t);
}

module.exports = {
  BACKSPACE,
  socketPath,
  encodeMessage,
  LineDecoder,
  applyKeystrokes,
  buildReplaceInput,
  looksLikeDraftPrompt,
};
