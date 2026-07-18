const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  encodeMessage,
  LineDecoder,
  applyKeystrokes,
  buildReplaceInput,
  looksLikeDraftPrompt,
  socketPath,
} = require("../src/wrap-protocol");

test("encodeMessage: JSON + trailing newline", () => {
  assert.equal(encodeMessage({ type: "hello" }), '{"type":"hello"}\n');
});

test("LineDecoder: yields complete lines, buffers partial tail", () => {
  const decoder = new LineDecoder();
  assert.deepEqual(decoder.push('{"a":1}\n{"b":2}\n{"c":'), [{ a: 1 }, { b: 2 }]);
  assert.deepEqual(decoder.push('3}\n'), [{ c: 3 }]);
});

test("LineDecoder: drops malformed lines without throwing", () => {
  const decoder = new LineDecoder();
  assert.deepEqual(decoder.push("not json\n{\"ok\":true}\n"), [{ ok: true }]);
});

test("applyKeystrokes: accumulates printable characters", () => {
  assert.equal(applyKeystrokes("", "fix the bug"), "fix the bug");
});

test("applyKeystrokes: backspace/DEL erases", () => {
  assert.equal(applyKeystrokes("hello", "\x7f\x7f"), "hel");
});

test("applyKeystrokes: Enter/newline resets to empty (line submitted)", () => {
  assert.equal(applyKeystrokes("fix the bug", "\r"), "");
});

test("applyKeystrokes: Ctrl+U kills the line", () => {
  assert.equal(applyKeystrokes("fix the bug", "\x15"), "");
});

test("applyKeystrokes: Ctrl+C cancels the line", () => {
  assert.equal(applyKeystrokes("fix the bug", "\x03"), "");
});

test("applyKeystrokes: ignores unrecognized control bytes (e.g. escape sequences)", () => {
  assert.equal(applyKeystrokes("fix", "\x1b[A"), "fix");
});

test("buildReplaceInput: backspaces the old length, then writes new text, no Enter", () => {
  assert.equal(buildReplaceInput(3, "new text"), "\x7f\x7f\x7fnew text");
});

test("buildReplaceInput: clamps negative lengths to zero backspaces", () => {
  assert.equal(buildReplaceInput(-5, "hi"), "hi");
});

test("looksLikeDraftPrompt: accepts a real multi-word draft", () => {
  assert.equal(looksLikeDraftPrompt("fix the login bug in auth.js"), true);
});

test("looksLikeDraftPrompt: rejects too-short input", () => {
  assert.equal(looksLikeDraftPrompt("fix it"), false);
});

test("looksLikeDraftPrompt: rejects a single token", () => {
  assert.equal(looksLikeDraftPrompt("refactorEverythingNow"), false);
});

test("looksLikeDraftPrompt: rejects empty/whitespace", () => {
  assert.equal(looksLikeDraftPrompt(""), false);
  assert.equal(looksLikeDraftPrompt("   "), false);
});

test("socketPath: stable path under ~/.metriq on non-Windows", { skip: process.platform === "win32" }, () => {
  const p = socketPath();
  assert.match(p, /\.metriq[/\\]wrap\.sock$/);
});
