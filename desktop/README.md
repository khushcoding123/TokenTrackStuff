# Metriq desktop app

Electron shell for Metriq. See `CLAUDE.md` at the repo root for the overall
product phases.

## Run it

```bash
cd desktop
npm install
npm start
```

Set `METRIQ_WEB_URL` to point "Log in" / "Create an account" at a local web
dev server instead of production, e.g.:

```bash
METRIQ_WEB_URL=http://localhost:3411 npm start
```

## Project Intelligence (Typesense)

Optional. See [TYPESENSE.md](./TYPESENSE.md) for local Docker setup, env vars,
privacy modes, and a manual verification checklist. When Typesense is off or
unreachable, prompt analysis falls back to the offline scanner automatically.

Phases shipped: code indexing, prompt file discovery, prompt memory, usage
session search, Cmd/Ctrl+K global search, and optional conceptual (hybrid)
query expansion. `packages/core` stays offline with zero Typesense deps.

## Test

```bash
npm test              # pure-logic + Typesense unit/live tests (live skip without a server)
```

The unit tests don't require Electron itself. End-to-end verification (real
window, real `safeStorage` encryption, the full auth-callback handoff) was
done via Playwright's `_electron` driver during development — see the PR/
session notes; there's no checked-in E2E script yet since it needs a real
Electron binary and isn't part of `npm test`.

## Terminal agent capture (`metriq-wrap`)

Phase 5b (see `docs/phase5-screen-awareness-proposal.md`) lets Metriq detect
a draft prompt as you type it into **Claude Code or Codex**, and insert an
approved rewrite directly back into that terminal session — no manual copy/
paste. It only works inside a session you explicitly start through the
wrapper; it never reads any other terminal or window.

1. Turn on **Settings → Capture & Integrations → Terminal agent capture** in
   the app (off by default).
2. Instead of running `claude` or `codex` directly, run them through the
   wrapper:

   ```bash
   node /path/to/TokenTrackStuff/desktop/bin/metriq-wrap.js claude
   node /path/to/TokenTrackStuff/desktop/bin/metriq-wrap.js codex
   ```

   or add a shell function so `claude`/`codex` transparently go through it
   (e.g. in `~/.zshrc`):

   ```bash
   claude() { node /path/to/TokenTrackStuff/desktop/bin/metriq-wrap.js claude "$@"; }
   codex()  { node /path/to/TokenTrackStuff/desktop/bin/metriq-wrap.js codex "$@"; }
   ```

3. Type a prompt as normal. After a short pause, if it looks like a real
   coding prompt, Metriq's suggestion popup opens automatically. Approving
   it clears your in-progress line and types the rewrite in for you — you
   still press Enter yourself, nothing is auto-submitted.

**How it works, and its limits:** the wrapper spawns the real `claude`/
`codex` binary inside a pseudo-terminal it owns (`node-pty`) and transparently
forwards everything, so the CLI behaves identically either way. It tees your
keystrokes to track the current input line (a heuristic — cursor-based
mid-line edits like arrow-key navigation aren't tracked, only
type-forward/backspace/submit) and talks to the desktop app over a local
Unix socket at `~/.metriq/wrap.sock` (a fixed named pipe on Windows). Before
writing a rewrite back in, it verifies your input line still matches what was
analyzed — if you kept typing after the popup appeared, the insert is
silently dropped rather than clobbering newer text. **If the desktop app
isn't running, or `node-pty` failed to build on your machine, the wrapper
transparently falls back to running the CLI with no capture** — it never
blocks or degrades your actual coding session.

`node-pty` ships prebuilt native binaries; `npm install` runs
`scripts/fix-node-pty-perms.js` afterward to make sure the bundled
`spawn-helper` executable keeps its executable bit (observed to get stripped
in some install/extraction environments, which otherwise fails every
`metriq-wrap` invocation with an opaque `posix_spawnp failed` error).

Out of scope for this version (see the proposal doc): Windows/Linux
hardening beyond basic support, and Claude.ai/ChatGPT browser capture.

## GUI editor capture (Cursor / VS Code, macOS only)

Phase 5a covers Cursor and VS Code directly — no wrapper command needed.
Turn on **Settings → Capture & Integrations → Editor capture (Cursor / VS
Code)** (off by default, macOS only). It requests the macOS **Accessibility**
permission the first time (same permission auto-capture already uses) —
grant it in System Settings and you may need to relaunch the app.

Once on: while Cursor or VS Code is the frontmost app, Metriq polls the
*currently focused text field* (e.g. Cursor's Composer input, VS Code's
Copilot Chat input) via `osascript`/`AXFocusedUIElement` — see
`src/mac-ax.js`. When it looks like a real draft prompt, the popup appears
automatically. Approving it brings the editor to the foreground and does a
select-all + paste to replace the field's contents with the rewrite.

**This write-back carries a real, accepted risk**, different in kind from
the terminal wrapper's: Metriq doesn't own the editor's input stream, so
inserting is a simulated paste into *whatever is currently focused and
selected*, not a guaranteed-correct operation. Two mitigations are in place
— `mac-ax.js` checks the focused element's AX role is actually a text field
before writing, and re-reads its value immediately before writing to confirm
it still matches what was analyzed (aborting the insert if it changed) — but
neither eliminates the risk of an insert landing somewhere unintended if
focus shifted in a way that still passes both checks. If that's not an
acceptable tradeoff for your workflow, leave this off and use the regular
clipboard-based auto-capture instead.

Reading is a plain accessibility-API text read, not a screenshot or screen
recording, and only happens while Cursor/VS Code is frontmost.

## How the login handoff works

1. Renderer calls `window.metriq.openLogin()` → main process
   `shell.openExternal("<web>/login?desktop=1")`.
2. The web app authenticates the user (email/password or Google OAuth) via
   InsForge exactly as it does for the regular dashboard, then redirects to
   `/desktop-connected?token=...&refresh_token=...&email=...&name=...`.
2. That page immediately navigates to `metriq://auth-callback?...`, which
   the OS hands back to this app (`open-url` on macOS; a `second-instance`
   event, or `process.argv` on cold start, on Windows/Linux).
3. `src/protocol.js` parses the URL; `src/auth-store.js` encrypts and
   persists the session via `safeStorage`, keyed to the OS keychain — the
   file on disk (`<userData>/credentials.enc`) is never plaintext.
4. The renderer is notified via the `auth:success` IPC event and switches to
   the logged-in view.

`metriq logout` clears the local file only for now — it does not yet call a
server-side revoke endpoint (there isn't a CLI-token-style revocable token on
the InsForge side the way the earlier device-auth CLI plan had; the desktop
app holds a normal InsForge access/refresh token pair instead).
