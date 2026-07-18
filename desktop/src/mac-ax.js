// macOS accessibility-tree (AXUIElement) reading/writing for Cursor/VS Code,
// via `osascript`/AppleScript against System Events — Phase 5a of
// docs/phase5-screen-awareness-proposal.md. See that doc for the tradeoffs;
// this is the "prototype via osascript before native code" path it
// recommended.
//
// Script-building logic is pure (exported separately, unit-testable without
// a real Mac/osascript). Execution (`runScript`) shells out and is the only
// part that needs to run on darwin with Accessibility permission granted.

const { execFileSync } = require("node:child_process");
const { clipboard } = require("electron");

// Process names (as `osascript`/System Events sees them, i.e. the actual
// running process, not the display name) for the two editors in scope.
const EDITOR_PROCESSES = { Cursor: "Cursor", "Visual Studio Code": "Code" };

function isSupported() {
  return process.platform === "darwin";
}

// Escapes a string for embedding inside a double-quoted AppleScript literal.
function escapeAppleScriptString(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// AppleScript to get the frontmost application process's name — used to
// decide whether the foreground app is one we're allowed to read at all.
function buildFrontmostAppScript() {
  return 'tell application "System Events" to get name of first application process whose frontmost is true';
}

// ASCII Unit Separator (0x1F) — a real delimiter between role and value in
// the single-string value the AppleScript below returns, extremely
// unlikely to appear in either (a role is always a short "AX..." token; a
// chat-input value is normal text). Named here so the JS-side split logic
// can't drift from what the script actually emits.
const FIELD_SEP = "\x1f";

// AppleScript to read the *value* of the currently-focused UI element
// inside a named process — this is the key trick: AXFocusedUIElement is an
// attribute of the application itself, so no manual traversal of the UI
// tree is needed to find "whatever text field the user is typing into
// right now" (e.g. Cursor's Composer input, VS Code's Copilot Chat input).
// Also reads the element's role (AXRole) so the caller can sanity-check
// it's actually a text-input-like element before trusting/writing to it.
function buildReadFocusedScript(processName) {
  const p = escapeAppleScriptString(processName);
  const lines = [
    'tell application "System Events"',
    '  tell process "' + p + '"',
    '    set theElement to value of attribute "AXFocusedUIElement"',
    '    set theRole to ""',
    '    set theValue to ""',
    "    try",
    '      set theRole to value of attribute "AXRole" of theElement',
    "    end try",
    "    try",
    '      set theValue to value of attribute "AXValue" of theElement',
    "    end try",
    "    return theRole & (ASCII character 31) & theValue",
    "  end tell",
    "end tell",
  ];
  return lines.join("\n");
}

// AppleScript to overwrite the focused element's value via select-all +
// paste. This deliberately does NOT try setting AXValue directly: that
// would need the replacement text embedded as an AppleScript string
// literal, and AppleScript string literals can't contain a raw newline —
// our rewritten prompts routinely do (see rewrite.js's multi-line
// intent/starting-point/scope-guard format), which would throw a *syntax*
// error at script-compile time, before any `on error` handler could catch
// it. Reading the clipboard-set replacement text via paste instead avoids
// embedding arbitrary text in the script at all. The caller (writeBack) is
// responsible for setting the clipboard to the replacement text beforehand
// and restoring the user's original clipboard afterward.
//
// Requires bringing the app to the foreground first — a real, visible
// focus change, never silent — since keystroke events go to whichever app
// is frontmost, not to an arbitrary named process.
function buildWriteScript(processName) {
  const p = escapeAppleScriptString(processName);
  const lines = [
    'tell application "System Events"',
    '  tell process "' + p + '"',
    "    set frontmost to true",
    '    keystroke "a" using command down',
    "    delay 0.05",
    '    keystroke "v" using command down',
    "  end tell",
    "end tell",
  ];
  return lines.join("\n");
}

function runScript(script) {
  return execFileSync("osascript", [], { input: script, timeout: 2000, encoding: "utf8" }).trim();
}

// Returns the frontmost app's process name, or null if it can't be
// determined (osascript failure, no Accessibility permission, etc.) — a
// failure here must always be treated as "don't act", handled by callers.
function getFrontmostProcessName() {
  try {
    return runScript(buildFrontmostAppScript());
  } catch {
    return null;
  }
}

// Returns { role, value } for the currently-focused UI element in the given
// process, or null on any failure (app not running, no focused element,
// permission revoked mid-session, etc.).
function readFocused(processName) {
  try {
    const raw = runScript(buildReadFocusedScript(processName));
    const sep = raw.indexOf(FIELD_SEP);
    if (sep === -1) return null;
    return { role: raw.slice(0, sep), value: raw.slice(sep + 1) };
  } catch {
    return null;
  }
}

// Text-input-like AXRoles worth reading/writing. Chromium's AX bridge (which
// is what VS Code/Cursor's chat panels expose, being Electron/webview UI)
// commonly reports one of these for an editable text control.
const TEXT_ROLES = new Set(["AXTextField", "AXTextArea", "AXComboBox", "AXTextView"]);

function isTextRole(role) {
  return TEXT_ROLES.has(String(role || ""));
}

// Writes `newText` into the focused element of `processName`, but only if
// its current value still equals `expectedCurrent` (verify-before-write) —
// the same safety principle as the terminal wrapper's forDraft check, here
// covering the wider window between "user approved" and "we're about to
// simulate a paste into whatever's focused right now." Temporarily
// overwrites the system clipboard with `newText` for the paste and restores
// whatever was there before, immediately after — the select-all+paste is
// synchronous within `runScript`, so it's safe to restore right after it
// returns.
function writeBack(processName, expectedCurrent, newText) {
  const current = readFocused(processName);
  if (!current) return { ok: false, reason: "no-focused-element" };
  if (!isTextRole(current.role)) return { ok: false, reason: "not-a-text-field" };
  if (current.value !== expectedCurrent) return { ok: false, reason: "changed-since-analyzed" };

  const previousClipboard = clipboard.readText();
  clipboard.writeText(newText);
  try {
    runScript(buildWriteScript(processName));
    return { ok: true, method: "paste" };
  } catch (err) {
    return { ok: false, reason: "script-failed", error: err.message };
  } finally {
    clipboard.writeText(previousClipboard);
  }
}

module.exports = {
  EDITOR_PROCESSES,
  FIELD_SEP,
  isSupported,
  escapeAppleScriptString,
  buildFrontmostAppScript,
  buildReadFocusedScript,
  buildWriteScript,
  isTextRole,
  getFrontmostProcessName,
  readFocused,
  writeBack,
};
