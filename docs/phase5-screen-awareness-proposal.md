# Phase 5 proposal: live screen/context awareness

**Status: proposal only, not approved, nothing in this doc is implemented.**
Per the desktop-app pivot spec, Phase 5 is explicitly gated behind review and
approval of this document before any code is written.

## The ambition

Right now (Phase 4), Metriq only sees a prompt if the user manually pastes or
types it into the capture window. The "scan the screen automatically" version
would have Metriq notice what the user is drafting in Claude, ChatGPT, Cursor,
or VS Code without that manual step. This document assesses what's actually
feasible, what it costs, and what a defensible first version looks like.

## Two fundamentally different problems

These aren't one feature with two platforms — they're two different technical
problems with different privacy postures and different engineering cost.

### A. Native/Electron apps (VS Code, Cursor)

**Path: OS accessibility APIs.** Every desktop OS exposes an "accessibility
tree" of running apps' UI (originally built for screen readers) that a
permitted process can read — including the text content of a focused input
field in another app.

- **macOS — `AXUIElement` (ApplicationServices).** The most mature path here.
  Two implementation options:
  - Shell out to AppleScript/JXA via `osascript` (e.g. `tell application
    "System Events" to tell process "Cursor" to get value of text area 1 of
    window 1`). No native compilation, callable from Electron's main process
    via `child_process` today. This is genuinely the cheapest way to
    prototype and validate whether this is even worth pursuing further.
  - A native Node addon calling the AX API directly. More robust and
    performant than shelling out, but real native-code engineering (Swift/
    Obj-C or a C addon via node-gyp), a second toolchain to maintain, and
    per-arch (Intel/Apple Silicon) build concerns.
  - **Concrete gotcha specific to our actual targets:** VS Code and Cursor
    are both Electron apps built on the Monaco editor. Chromium's own
    accessibility tree exposure is often lazy — it may only fully populate
    once a screen reader is detected, or once `editor.accessibilitySupport`
    is explicitly set to `"on"` in VS Code/Cursor settings (it defaults to
    `"auto"`). We would likely need to document a setup step ("enable
    accessibility support in your editor") rather than have this work
    silently out of the box — I haven't verified whether `"auto"` is
    sufficient without a real screen reader running, and that needs to be
    tested hands-on before committing to a design.
- **Windows — UI Automation (UIA), COM-based.** Same shape of problem, no
  direct analogue to `osascript` for a quick shell-based prototype, but
  PowerShell + .NET's `System.Windows.Automation` namespace gets close (no
  native compile needed for a prototype, same tradeoff as AppleScript).
- **Linux — AT-SPI2, D-Bus based.** Works reasonably well on GNOME; spottier
  and less consistent across other desktop environments. I'd treat Linux as
  best-effort / lowest priority for this feature specifically.

### B. Browser-based tools (Claude.ai, ChatGPT)

**A desktop app cannot read another process's rendered DOM.** The browser is
a sandboxed process; Metriq has no first-party way to see what's typed into a
`claude.ai` or `chatgpt.com` tab. There are two real options, not one:

1. **Also via the OS accessibility tree**, if the browser has accessibility
   mode engaged (browsers expose page content this way for screen readers,
   and web apps' ARIA markup feeds it). This technically can work, but it's
   fragile in a way native-app reading isn't: it depends on Claude/ChatGPT's
   own DOM structure and ARIA labeling staying stable, which is entirely
   outside our control and can silently break on any UI redesign of a
   product we don't own.
2. **A companion browser extension** (Manifest V3, so Chrome/Edge/Brave — the
   spec's own framing, and the right one). A content script on the relevant
   domains reads the actual prompt textarea's value directly — reliable,
   first-party, not guessing through an accessibility tree. It then needs to
   get that text to the desktop app, which means:
   - **Chrome Native Messaging** (the standard, store-compliant pattern): the
     extension talks to a native host process over stdio. Requires
     registering a native-messaging-host manifest at an OS-specific path
     during install (e.g. `~/Library/Application Support/Google/Chrome/
     NativeMessagingHosts/` on macOS) — real installer work, but no open
     network port.
   - **A localhost WebSocket/HTTP server** in the Electron app instead: much
     simpler to build, but it's a locally-listening port that, without a
     pairing/auth token issued at install time, any other local process
     could in principle connect to. Doable, but needs that token-based
     pairing to be secure, not just "trust localhost."

Building and maintaining a browser extension (plus Chrome Web Store review if
we ever want it publicly installable, not just side-loaded) is a real second
project, not a small add-on to the desktop app.

## Permissions, per platform

| Platform | Permission | Notes |
|---|---|---|
| macOS | **Accessibility** (System Settings → Privacy & Security → Accessibility) | Required for AX-tree reading of other apps. Can be triggered via Electron's `systemPreferences.isTrustedAccessibilityClient(true)`, which also surfaces the OS prompt. Often needs an app restart after the user grants it. |
| macOS | **Screen Recording** | Only needed if we ever do pixel-level screenshot capture (i.e., for OCR — see below). Not needed for AX-tree text reading. Also cannot be silently pre-approved; user must toggle it manually. |
| Windows | None comparable | Traditional desktop apps calling UIA don't hit a user-facing permission dialog the way macOS Accessibility does — a materially different security/consent posture, worth being explicit with users about even though the OS doesn't force it. |
| Linux | Varies | Generally no centralized permission-prompt system; depends on whether accessibility services are enabled at the OS/DE level. |

Whatever we build, this must be an explicit, off-by-default toggle in
Settings (per the spec's own privacy requirement), with plain-language copy
about exactly what gets read and when, and a visible indicator whenever the
feature is actively engaged — never a silent background capability.

## Is OCR-on-screenshot worth it as a fallback?

For apps with no accessibility hooks at all, the fallback is: take a
screenshot, run OCR, extract text. My assessment: **not worth it, at least
not for v1.**

- **Accuracy risk is specifically bad for our use case.** OCR on
  syntax-highlighted, monospaced code — mixed fonts, thin whitespace-
  sensitive indentation, easily-confused characters (`l`/`1`/`I`, `0`/`O`) —
  is meaningfully less reliable than on plain prose. Metriq's entire value
  proposition depends on accurately reading the user's actual prompt text;
  a misread token count or a mangled rewrite from bad OCR actively damages
  trust in the product, worse than just not having the feature.
- **A local-only OCR path does exist** (macOS Vision framework's
  `VNRecognizeTextRequest`, Windows' `Windows.Media.Ocr` — both on-device, no
  cloud call, consistent with our "nothing leaves the device" privacy
  principle), so this isn't a privacy blocker. But it's yet another
  platform-specific native integration stacked on top of the AX-API one,
  compounding the engineering surface for a fallback whose accuracy is
  already in question.
- **Recommendation:** skip OCR entirely for the first version. Revisit only
  if real usage shows AX-tree coverage is insufficient for the apps people
  actually use, and only then decide if the accuracy tradeoff is worth it
  for whichever specific gap it would fill.

## Recommended minimal version

Given the above, if this gets approved, I'd scope a first version as:

1. **macOS only.** Best tooling path (AppleScript/JXA needs no native
   compile), and skews toward where the target audience already is.
2. **Accessibility-tree reading only** — no OCR, no Screen Recording
   permission requested at all in v1.
3. **VS Code and Cursor only** (both native/Electron, both AX-reachable in
   principle) — not Claude.ai/ChatGPT web. Ship something that reliably
   works for two real tools rather than something flaky across four.
4. **Prototype via `osascript` shell-out first**, not a native addon —
   cheapest way to prove the concept actually works reliably against real
   Monaco-editor windows before investing in native code. This is also the
   point where we'd learn empirically whether the `editor.accessibilitySupport`
   setting is actually a blocker in practice.
5. **Explicit opt-in toggle**, clear copy, visible "currently reading" state
   whenever engaged.

**Explicitly out of scope for v1, revisit later:** Windows/Linux support,
Claude.ai/ChatGPT browser reading (the companion-extension project), and OCR.
The browser-extension path in particular is a separable, comparably-sized
second project on its own — it shouldn't gate shipping the native-app version.

## What I need from you

- Approval (or a different scope) for the "macOS + VS Code/Cursor + AX-tree
  only, no OCR, no browser extension" v1 described above, before any of this
  gets implemented.
- If approved, I'd start with the `osascript` prototype specifically to
  validate real Monaco-editor readability before writing a line of it into
  the actual app.
