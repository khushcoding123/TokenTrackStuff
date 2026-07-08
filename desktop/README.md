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

## Test

```bash
npm test              # pure-logic unit tests (protocol URL parsing)
```

The unit tests don't require Electron itself. End-to-end verification (real
window, real `safeStorage` encryption, the full auth-callback handoff) was
done via Playwright's `_electron` driver during development — see the PR/
session notes; there's no checked-in E2E script yet since it needs a real
Electron binary and isn't part of `npm test`.

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
