const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  FIELD_SEP,
  escapeAppleScriptString,
  buildFrontmostAppScript,
  buildReadFocusedScript,
  buildWriteScript,
  isTextRole,
  EDITOR_PROCESSES,
} = require("../src/mac-ax");

test("escapeAppleScriptString: escapes quotes and backslashes", () => {
  assert.equal(escapeAppleScriptString('say "hi"'), 'say \\"hi\\"');
  assert.equal(escapeAppleScriptString("C:\\path"), "C:\\\\path");
});

test("buildFrontmostAppScript: is a single-line System Events query", () => {
  const script = buildFrontmostAppScript();
  assert.match(script, /tell application "System Events"/);
  assert.match(script, /frontmost is true/);
});

test("buildReadFocusedScript: reads AXFocusedUIElement directly (no manual tree traversal)", () => {
  const script = buildReadFocusedScript("Cursor");
  assert.match(script, /tell process "Cursor"/);
  assert.match(script, /AXFocusedUIElement/);
  assert.match(script, /AXRole/);
  assert.match(script, /AXValue/);
  // Role and value are joined by a real separator, not string concatenation
  // with nothing between them (a real bug caught during development).
  assert.match(script, /ASCII character 31/);
});

test("buildReadFocusedScript: process name is escaped into the script", () => {
  const script = buildReadFocusedScript('Weird "Process"');
  assert.match(script, /tell process "Weird \\"Process\\""/);
});

test("buildWriteScript: never embeds arbitrary text into the script", () => {
  // Regression guard: an earlier version embedded the replacement text
  // directly as an AppleScript string literal, which breaks (compile-time
  // syntax error, not catchable via `on error`) for any multi-line prompt —
  // real rewritten prompts routinely have newlines. The write path must
  // only reference the clipboard, never take/embed a text argument.
  assert.equal(buildWriteScript.length, 1); // (processName) only
  const script = buildWriteScript("Code");
  assert.match(script, /keystroke "a" using command down/); // select all
  assert.match(script, /keystroke "v" using command down/); // paste
  assert.doesNotMatch(script, /AXValue.*to "/);
});

test("isTextRole: accepts known editable-text AX roles", () => {
  assert.equal(isTextRole("AXTextArea"), true);
  assert.equal(isTextRole("AXTextField"), true);
});

test("isTextRole: rejects non-text roles and empty/undefined", () => {
  assert.equal(isTextRole("AXButton"), false);
  assert.equal(isTextRole(""), false);
  assert.equal(isTextRole(undefined), false);
});

test("EDITOR_PROCESSES: maps the two in-scope editors to their real process names", () => {
  assert.equal(EDITOR_PROCESSES["Cursor"], "Cursor");
  assert.equal(EDITOR_PROCESSES["Visual Studio Code"], "Code");
});

test("FIELD_SEP: a single non-printable character, not empty", () => {
  assert.equal(FIELD_SEP.length, 1);
  assert.equal(FIELD_SEP.charCodeAt(0), 31);
});
