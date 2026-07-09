// Background prompt watcher.
//
// When auto-capture is enabled, this polls a "prompt source" for the prompt the
// user is currently drafting in their AI tool and emits it so the app can pop a
// suggestion. The debounce/dedupe/emit plumbing here is real and source-agnostic.
//
// PROMPT SOURCE SEAM
// ------------------
// Reading text out of ANOTHER app (Claude/Cursor/ChatGPT) is the OS-native,
// permission-gated, platform-specific part — and it's deliberately isolated as
// the async `source()` function so the rest of the app is shippable today and a
// real reader drops in without touching this file. A real source returns the
// draft prompt text (or "" if none), read via:
//   - macOS:   osascript / JXA against System Events (AXUIElement)
//   - Windows: PowerShell + System.Windows.Automation (UI Automation)
//   - browser: a companion extension posting to a localhost pairing endpoint
// Those are Phase 5 (gated on approval). The default source below reads nothing.

const { EventEmitter } = require("node:events");

/** Safe default: reads no external app. Replace via the `source` option. */
async function nullSource() {
  return "";
}

class PromptWatcher extends EventEmitter {
  /** @param {{ source?: () => Promise<string>, intervalMs?: number }} [opts] */
  constructor(opts = {}) {
    super();
    this.source = opts.source || nullSource;
    this.intervalMs = opts.intervalMs || 1500;
    this.timer = null;
    this.running = false;
    this.last = ""; // dedupe: don't re-emit the same draft
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.emit("state", true);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.last = "";
    this.emit("state", false);
  }

  isRunning() {
    return this.running;
  }

  async tick() {
    try {
      const text = await this.source();
      this.consider(text);
    } catch {
      // A flaky source must never crash the loop or the app.
    }
  }

  // Emit only genuinely-new, non-empty drafts. Shared by the poll loop and the
  // dev/test `feed()` hook so both go through the same dedupe.
  consider(text) {
    const prompt = String(text || "").trim();
    if (prompt && prompt !== this.last) {
      this.last = prompt;
      this.emit("prompt", prompt);
    }
  }

  // Seed `last` without emitting — used when starting so pre-existing clipboard
  // content doesn't immediately trigger a popup.
  prime(text) {
    this.last = String(text || "").trim();
  }

  /** Dev/test hook: inject a prompt as if the source produced it. */
  feed(prompt) {
    this.consider(prompt);
  }
}

// Heuristic: does this clipboard text look like an AI-coding prompt (vs. copied
// code, a URL, a file path, or a stray token)? Kept pure and exported so it can
// be unit-tested without Electron.
function looksLikePrompt(text) {
  const t = String(text || "").trim();
  if (t.length < 15 || t.length > 4000) return false; // too short / huge paste
  if (!/\s/.test(t)) return false; // a single token
  if (t.split(/\s+/).length < 3) return false; // needs a few words
  if (/^https?:\/\//i.test(t)) return false; // a URL
  if (/^[A-Za-z]:[\\/]/.test(t) || /^\/[\w./-]+$/.test(t)) return false; // a path
  if ((t.match(/[{};=<>]/g) || []).length > 4) return false; // looks like code
  return /[a-z]{3,}/i.test(t); // has real words
}

module.exports = { PromptWatcher, nullSource, looksLikePrompt };
