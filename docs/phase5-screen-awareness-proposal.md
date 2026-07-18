# Phase 5 proposal (v2): live capture across GUI + terminal agents, with auto-insert

**Status: proposal only, not approved, nothing in this doc is implemented.**
Per the desktop-app pivot spec, Phase 5 is explicitly gated behind review and
approval of this document before any code is written. This is a revision of
the original Phase 5 doc — v1's scope (macOS, VS Code/Cursor, read-only) is
folded in below, extended to cover the two gaps that were out of scope
before: **terminal-based CLI agents (Claude Code, Codex)** and
**auto-insert write-back**, per request.

## What exists today (Phase 4, shipped, no OS permissions needed)

The capture popup is already cross-tool in one specific sense: it triggers on
**clipboard content**, not on screen contents. `desktop/src/main.js`'s
`clipboardPromptSource()` polls `clipboard.readText()`, checks it against
`looksLikePrompt()` and a foreground-app allowlist (`CODING_APPS`, which
already includes terminal emulators — `wt`, `alacritty`, `iterm`, etc.), and
pops the suggestion window. Because the trigger is "you copied something,"
this already works today for Claude Code/Codex: **copy your draft prompt
before submitting it, and the popup appears with the rewrite** — same flow
as VS Code/Cursor. Output only ever goes back out via clipboard
(`capture:apply` writes to it); you paste it yourself. There is no reading of
un-copied screen/window content and no write-back into the source app.

`desktop/src/prompt-watcher.js` was deliberately built with the real reader
as a pluggable `source()` function precisely so this doc's outcome can drop
in without touching the watcher's debounce/dedupe/emit logic.

This proposal is about removing the **manual copy step** (auto-detect the
draft as you type, before you hit enter) and **the manual paste step**
(auto-insert the rewrite back into the source app) — for both GUI editors and
terminal agents.

## Four sub-problems, not one feature

They have different technical mechanisms and different risk profiles. Do not
treat them as a single on/off switch.

| # | Problem | Mechanism | Read confidence | Write confidence |
|---|---|---|---|---|
| 1 | Read draft from VS Code/Cursor (GUI) | OS accessibility tree | Medium — depends on `editor.accessibilitySupport`, unverified hands-on | N/A here |
| 2 | Read draft from Claude Code/Codex (terminal) | PTY/stdin interception via a wrapper | High (once built) | N/A here |
| 3 | Write rewrite back into VS Code/Cursor | AX `AXValue` set, or simulated select-all+paste | Medium-low — focus-stealing, selection races | Medium-low |
| 4 | Write rewrite back into Claude Code/Codex | Inject into the same PTY the wrapper owns | High (once built) | High, but only for the specific case below |

### 1 & 3. GUI editors (VS Code, Cursor) — unchanged from v1

**Read**, via macOS `AXUIElement` (prototype with `osascript`, as in the
original doc), Windows UI Automation, Linux AT-SPI2 (best-effort). Still
carries the same unverified assumption flagged in v1: Chromium/Monaco's AX
tree may need `editor.accessibilitySupport` set explicitly, and this has not
been tested hands-on.

**Write-back (new in this revision).** Two options, neither clean:
- **Set `AXValue` directly** on the focused text element. Where supported,
  this is the safest write path (no keystroke simulation, no focus theft),
  but Monaco's AX exposure for *setting* value (vs. reading it) is even less
  proven than reading — this needs the same `osascript` prototyping pass
  before it's trusted.
- **Simulate select-all + paste** (`Cmd+A` then `Cmd+V` via `osascript
  keystroke`, with the rewrite pre-loaded on the clipboard). Works more
  reliably across apps but is meaningfully riskier: it requires bringing the
  target window to the foreground (focus-stealing — a real UX interruption,
  not silent), and it blindly overwrites *whatever is currently selected*.
  If the user's cursor moved between when we read the draft and when we
  write back (a few hundred ms of polling latency, plus think-time), this
  can silently replace the wrong text or a different file's content. This is
  the single riskiest part of the whole proposal — a misfire here doesn't
  just show a bad suggestion, it corrupts what the user was writing.

**Recommendation:** for GUI editors, ship read-only auto-detect first (no
more manual copy). Do not ship write-back for GUI editors in v1 — the
selection-race risk above is a real "did it just eat my code" failure mode,
and it needs its own validation pass (e.g. a checksum-verify-before-write:
re-read the field immediately before writing and abort if it changed from
what was analyzed) that's out of scope to design blind.

### 2 & 4. Terminal agents (Claude Code, Codex) — new in this revision

This is a genuinely different problem from GUI editors, not a variant of it.
**A terminal has no structured "input field" for AX to read.** Terminal
emulators (Terminal.app, iTerm2, Windows Terminal, the VS Code/Cursor
integrated terminal) expose their content to accessibility APIs as one flat
block of rendered text — the whole scrollback, undifferentiated. There is no
"the user is currently typing here" element the way a native text field
provides. Trying to extract "just the current input line" by diffing
scrollback text against a shell prompt regex is a real heuristic and will
break on ANSI control sequences, multi-line prompts, and Claude Code/Codex's
own TUI redraws (both render an interactive box UI, not a plain readline
prompt) — I would not trust AX reading for terminals; it belongs in the same
"not worth it" bucket the original doc put OCR in.

**The mechanism that actually works reliably here is different: a shell
wrapper around the `claude` / `codex` binaries**, not screen reading at all.

- The user installs a thin wrapper (e.g. metriq ships a `claude` /`codex`
  shell function or a PTY-proxy binary that the user opts into via `metriq
  wrap claude`, or a one-line addition to their shell rc). The wrapper spawns
  the real CLI inside a pseudo-TTY (`node-pty` or Python's `pty` module) that
  Metriq's desktop app controls, and passes keystrokes through transparently
  — except it can also read the input buffer being typed (before Enter) and,
  on request, **inject text directly into that same PTY**, which is
  indistinguishable from the user typing it.
- This means auto-insert here is *not* a selection-race guess like the GUI
  case — Metriq owns the actual input stream, so "replace the draft with the
  rewrite" is a clean, well-defined operation (clear the current input line,
  write the new text), not a blind keystroke simulation aimed at whatever
  happens to be focused.
- **Cost/risk is different, not lower.** This is a new piece of
  infrastructure (a PTY proxy, likely `node-pty`, which is a native module —
  breaks the "zero native deps outside what's already in desktop/" comfort
  zone) that sits directly in the critical path of the user's actual coding
  session. A bug here doesn't just misfire a suggestion — it can eat
  keystrokes, break terminal resizing/redraw, or hang the wrapped process.
  It needs its own opt-in (`metriq wrap claude`), its own fallback (if the
  wrapper crashes, it must transparently fall through to the real binary,
  never block the user from running their CLI tool), and cannot piggyback on
  the AX-permission work for GUI editors — it's a separate build.
- This approach only works for terminal agents Metriq explicitly wraps
  (`claude`, `codex` today). It does not generalize to "any terminal
  content" the way AX reading conceptually could for GUI apps.

**Recommendation:** build this as its own workstream, not bundled with the
GUI-editor AX work. It's higher engineering cost than GUI read+write
combined, but it's also the *only* one of the four sub-problems where
auto-insert is actually safe to ship, because Metriq owns the input stream
instead of guessing at screen state.

## Permissions, updated

Same table as v1 (macOS Accessibility permission for AX reading; Windows/
Linux have no comparable prompt) for sub-problems 1 & 3. Sub-problems 2 & 4
need **no OS accessibility permission at all** — the wrapper is a normal
child process the user explicitly launches — but do need clear, explicit
opt-in per the same privacy posture (a visible "Metriq is wrapping this
session" indicator any time the wrapper is active, and an easy one-command
way to stop wrapping).

## Recommended scoped v1 (revised)

Given the above, if this gets approved, I'd split it into two independently
shippable pieces rather than one Phase 5:

**5a — GUI auto-detect, read-only.** macOS only, VS Code/Cursor only,
AX-tree reading, **no write-back**. Removes the manual-copy step for GUI
editors. Prototype via `osascript` first, same as v1's plan.

**5b — Terminal wrapper, read + safe write.** `claude` and `codex` only,
via an opt-in shell wrapper (`node-pty`-based PTY proxy). Because Metriq
owns the input stream, this is the one piece where auto-insert is safe to
build, with a mandatory transparent-fallback requirement (wrapper failure
must never block the underlying CLI).

**Still explicitly out of scope:** GUI write-back (selection-race risk needs
its own design, not blind approval alongside everything else), Claude.ai/
ChatGPT browser reading (unchanged from v1 — separate companion-extension
project), OCR (unchanged from v1 — rejected), Windows/Linux AX (best-effort
later, not v1).

## What I need from you

Approval, or a different scope, on:
1. Whether to build **5a and 5b both**, or start with just one.
2. For 5b: whether shipping a native module (`node-pty`) inside `desktop/`
   is acceptable, given it's the one piece of this app with real runtime
   dependencies already, but this is a native compiled addon, a different
   category from the npm packages currently in `desktop/package.json`.
3. Confirmation that GUI write-back (the selection-race risk under "1 & 3")
   stays out of scope until it has its own follow-up design — I don't think
   it should be waved through as part of a bundle.

If approved, I'd start with whichever of 5a/5b is greenlit, prototyping via
`osascript` (5a) or a minimal `node-pty` spike outside the app (5b) before
writing anything into the real app.
