# CLAUDE.md

Context for AI assistants working in this repo. Read this first — it replaces
having to re-explain the project each session.

## What this is

**metriq** — an AI coding companion that sits between a developer and their AI
coding tool (Claude, ChatGPT, Cursor, VS Code, etc.). Before a prompt is sent,
metriq analyzes it against the developer's real codebase, flags whether it's
too broad, estimates its token cost, and rewrites vague prompts into focused
ones that keep the AI on the right files instead of searching the whole
codebase.

**Product direction (as of the current pivot):** metriq is moving from
"terminal-first CLI" to a **desktop app** (Electron) as the primary product,
with the web app repositioned as a marketing site + no-download live demo,
and the CLI kept alive as a secondary interface. See "Product phases" below
for what's actually built vs. planned.

This repo contains three deliverables:

| Path | What it is |
| --- | --- |
| `packages/core/` | The **shared engine** (analyze → scan → rewrite) — zero runtime deps, used by the CLI, the web demo, and (soon) the desktop app |
| `bin/`, `src/` | The **CLI** — published to npm as `metriq`; now a secondary interface, not the focus |
| `web/` | The **web app** — Next.js 14, deployed to Vercel. Marketing landing page + live `/prompt-studio` demo + auth (shared with the future desktop app) |
| `desktop/` | The **desktop app** (Electron) — window/tray/auth, repo linking, and the prompt-capture window are built; see "Product phases" |

## Live locations

- **npm:** https://www.npmjs.com/package/metriq (`metriq`)
- **Landing page:** https://tokenpilot-mocha.vercel.app
- **GitHub:** https://github.com/khushcoding123/TokenTrackStuff
- **Vercel project:** `tokenpilot` (team `khush-kotharis-projects`), root directory `web`, auto-deploys on push to `main`.

Note: the repo, GitHub URL, Vercel project, and `bin/tokenpilot.js` filename
still carry the old "tokenpilot" name — only the product branding (package
name, CLI command, page copy) was renamed to metriq. Don't "fix" these to
match; they're intentionally unchanged infrastructure identifiers.

## Product phases (pivot in progress)

The desktop-app pivot is being built phase by phase, each reviewed before the
next starts. Status:

- ✅ **Restructure:** `src/core` extracted into `packages/core` (a workspace
  package, zero runtime deps) so the CLI, web demo, and future desktop app
  all import the same engine instead of duplicating it. `packages/core`
  contains `analyzer.js`, `scanner.js`, `rewrite.js`, `tokenizer.js`,
  `config.js` — logic unchanged from the original `src/core`, only relocated.
  `session.js` (local `~/.metriq/session.json` tracking) stayed in
  `src/core/` — it's CLI-specific persistence, not part of the reusable
  engine.
- ✅ **Phase 1 (web):** `/` is now a marketing landing page (hero, before/after
  prompt example, "how it works", download CTAs for macOS/Windows/Linux
  pointing at GitHub Releases — placeholder until real builds exist). CLI is
  mentioned as a secondary option (`npx metriq analyze "..."`).
  `/prompt-studio` is unchanged and is the live, no-download demo of the real
  engine. `/login`, `/signup`, `/account` (InsForge-backed auth) are
  unchanged — the desktop app will reuse this exact auth flow. `/sessions`
  and `/sustainability` still work but are deprioritized (mock data, no
  further design investment for now).
- ✅ **Phase 2 (desktop shell + auth):** Electron app at `desktop/` — window,
  tray icon, app menu, `metriq://` protocol registration. Login opens the web
  `/login?desktop=1` (or `/signup?desktop=1`); on success the web app lands
  on `/desktop-connected`, which redirects to `metriq://auth-callback?
  token=...`. The OS hands that back to the app (`open-url` on macOS;
  `second-instance`/argv on Windows/Linux — see `desktop/src/protocol.js`),
  which persists the session via `safeStorage` (`desktop/src/auth-store.js`)
  — never a plain file. Web-side handoff support lives in the same
  login/signup/google/callback routes as Phase 1's auth, gated behind
  `desktopHandoff`/`?desktop=1`, not a separate system.
- ✅ **Phase 3 (repo linking):** "Link a project" in the desktop app's home
  screen — native folder picker only (GitHub-repo linking, the spec's
  secondary option, is not implemented). Scans via a new
  `packages/core/scanner.js#listSourceFiles` export (reuses the existing
  walk/ignore/extension logic unchanged). Local file-index cache in
  `userData/project-cache/`; linked-project records synced via a new
  InsForge `linked_projects` table (see `migrations/`), RLS-scoped so
  `user_id` defaults to `auth.uid()` server-side — the client never sends
  or could spoof it. "Active project" selection is local-only
  (`userData/prefs.json`), not synced.
- ✅ **Phase 4 (capture MVP):** Tool preference chips (local-only pref, used
  only to frame feedback text, no live tool integration). `Cmd/Ctrl+Shift+M`
  (or the in-app button) opens a small always-on-top capture window
  (`desktop/renderer/capture.*`) that runs `optimize()` +
  `findRelevantFiles()` from `packages/core` against the active project's
  real path — same engine, same output as the CLI/`/prompt-studio` — on a
  debounced keystroke, with one-click copy to clipboard. No screen/window
  reading of other apps.
- 📄 **Phase 5 (proposal only, not approved):** see
  `docs/phase5-screen-awareness-proposal.md`. Recommends, if approved:
  macOS-only, accessibility-tree reading only (no OCR, no browser
  extension), VS Code/Cursor only, prototyped via `osascript` shell-out
  before any native code. **Do not implement anything from that document
  without explicit approval of its scope first.**

## Hard rules / conventions

- **`packages/core` has ZERO runtime dependencies**, same rule that used to
  apply to the whole CLI. This is deliberate — the CLI must still run
  instantly via `npx` with no install step, and the engine must stay
  embeddable in a browser bundle (`/prompt-studio` imports it directly) and
  later an Electron renderer. Do not add dependencies there without a very
  good reason.
- **The engine (`packages/core`) is offline-only.** No network calls, no API
  keys. All analysis is local heuristics. (An optional AI-powered rewrite is
  on the roadmap but not built.)
- The **web app** is a normal Next.js project with real dependencies
  (`@insforge/sdk`, etc.) — the zero-dependency rule applies to
  `packages/core` and the CLI's own code, not to `web/`.
- **ES Modules** everywhere in the engine/CLI (`"type": "module"`). Use
  `import`/`export`.
- **Node ≥ 18.** Target that baseline.
- **Windows dev environment.** Paths use backslashes locally; when generating
  file paths that go *into prompts*, normalize to forward slashes (the scanner
  already does this).
- Root `package.json` declares `"workspaces": ["packages/*"]` so
  `packages/core` resolves as a proper local package. Its own imports (in
  `src/`, `test/`, `web/`) currently use plain relative paths into
  `packages/core/*.js` rather than the `@metriq/core` package name — simplest
  option, no bundling concerns for `npm publish` (see `"files"` in root
  `package.json`, which must include `packages/core`).

## Engine (`packages/core/`)

The actual product value — analyze → scan → rewrite. Reused as-is by the CLI
and the web demo; will be reused by the desktop app too. Do not fork or
duplicate this logic elsewhere.

- `packages/core/tokenizer.js` — offline token estimator (blends chars/4 and
  words/0.75, plus a punctuation bump). No real BPE tokenizer.
- `packages/core/analyzer.js` — **the heart.** Heuristic engine. Detects vague
  verbs, broad scope, heavy-change verbs, missing file refs, too-short/long
  prompts, missing scope guards, and near-duplicates. Produces a 0–100
  `breadthScore` and projects total token cost. Key model detail: a concrete
  file reference (×0.45) and an explicit scope guard (×0.6) each *reduce*
  projected exploration cost — because those are what actually bound how far
  the AI wanders. If you change scoring, update `test/core.test.js`.
- `packages/core/scanner.js` — scans a working dir for source files whose
  names/paths match prompt keywords, so rewrites can name real files. Ignores
  `node_modules`, `.git`, build dirs, etc. Returns forward-slash paths. Uses
  `node:fs`/`node:path`, so it's CLI/Electron-only (not imported by the
  browser-side `/prompt-studio`, which has no filesystem to scan).
- `packages/core/rewrite.js` — turns analysis + scanned files into a focused
  prompt: intent → starting point → scope guard → report-back. `optimize()`
  is the convenience entry that analyzes, rewrites, and computes savings.
- `packages/core/config.js` — provider pricing table + exploration-token
  constants.

## CLI (`bin/`, `src/`) — secondary interface

Data flows: **cli → command → packages/core (analyze → scan → rewrite) → ui
(format)**, with `session` recording results.

- `bin/tokenpilot.js` — entry point (shebang), calls `src/cli.js`.
- `src/cli.js` — arg parsing + command dispatch + `--help`.
- `src/core/session.js` — local session log at `~/.metriq/session.json`
  (best-effort; never blocks the user). Powers `stats`/`history`. CLI-only —
  not part of `packages/core`.
- `src/ui/colors.js` — hand-rolled ANSI colors; auto-disabled when not a TTY or
  when `NO_COLOR`/`TOKENPILOT_NO_COLOR` is set (env var name kept as-is, unrenamed).
- `src/ui/format.js` — renders the analysis report, bars, boxes, stats tables.
- `src/commands/` — `analyze.js`, `start.js` (interactive REPL), `stats.js`
  (also `history`, `reset`).

## Commands (how to run / test / ship)

```bash
# Run the CLI locally
node bin/tokenpilot.js analyze "Fix the dashboard bug"
node bin/tokenpilot.js start

# Test the engine
npm test                      # node --test (test/core.test.js, imports packages/core)

# Web app (from web/)
cd web
npm install
npm run dev                   # local dev
npm run build                 # production build

# Desktop app (from desktop/)
cd desktop
npm install
npm start                                       # launch it
METRIQ_WEB_URL=http://localhost:3411 npm start  # point login at a local web dev server
npm test                                        # pure-logic unit tests (protocol URL parsing)

# InsForge backend (from repo root, needs the CLI linked — see .insforge/)
npx @insforge/cli db migrations new <name>      # new schema change
npx @insforge/cli db migrations up --all        # apply pending migrations

# Ship
npm version patch && npm publish        # CLI → npm (from repo root)
git push origin main                    # web → Vercel auto-deploys
```

## Web app (`web/`)

- Next.js 14 App Router, plain JS (no TypeScript). Styled with real Tailwind
  CSS (build-time, via `tailwind.config.js` + `postcss.config.js` +
  `@tailwind` directives in `globals.css`). Theme is switchable (dark
  default, light via a curtain-wipe transition — see `ThemeProvider.js` /
  `ThemeToggle.js`), driven by CSS custom properties in `globals.css` so
  colors flip at runtime rather than at Tailwind build time. Glass-card
  aesthetic, green/blue accent palette, Geist / Inter / JetBrains Mono fonts,
  Material Symbols Outlined for icons.
- **Routes:**
  - `/` — marketing landing page (hero, before/after prompt example, "how it
    works", download CTAs). Static, no dashboard chrome (no Sidebar/TopBar).
  - `/prompt-studio` — **runs the real engine, not mock data.**
    `PromptStudioClient.js` imports `analyzePrompt`/`optimize` directly from
    `packages/core/analyzer.js` / `rewrite.js` (and pricing from
    `packages/core/config.js`) — those modules are pure JS with no Node
    built-ins, so they run fine in the browser. Typing in the editor live-
    recomputes breadth score, token savings, and reasoning; the magic-wand
    button actually calls `optimize()`; "Run Evaluation" snapshots a
    revision history you can restore from. If you change scoring in
    `packages/core/analyzer.js`, this page's numbers change too — same
    source of truth as the CLI and `test/core.test.js`.
  - `/login`, `/signup`, `/account` — auth, backed by **InsForge**
    (`@insforge/sdk`), not a hand-rolled Prisma/JWT stack (an earlier Prisma-
    based implementation was fully superseded — don't resurrect it). Email +
    Google OAuth (PKCE, via InsForge's shared OAuth callback), session
    refreshed by `web/middleware.js`. See `AGENTS.md` for the InsForge
    project details and which InsForge skills to use for backend changes.
    **The desktop app reuses this exact web auth flow.** `/login` and
    `/signup` accept `?desktop=1`; when set, the login/signup API routes
    also return a bearer `token`/`refreshToken` (normally cookie-only), and
    a successful auth lands on `/desktop-connected` instead of `/account` —
    that page immediately redirects to `metriq://auth-callback?token=...`
    for the desktop app to pick up. Don't change this shape without checking
    `desktop/src/protocol.js` and `desktop/README.md`.
  - `/sessions`, `/sustainability` — still work, still mock data, currently
    deprioritized (no further design investment planned right now).
  - `/settings` — persisted prefs (pricing provider, reduced motion) via
    `localStorage`.
- `web/app/components/Sidebar.js` + `TopBar.js` — shared dashboard chrome
  used by the dashboard-ish pages (`/prompt-studio`, `/sessions`,
  `/sustainability`, `/settings`, `/account`). **Not** used by the `/`
  landing page, which has its own minimal marketing header/footer.
- `web/app/components/ToastProvider.js` — wraps the whole app in `layout.js`;
  `useToast()` gives any client component a `notify(message)` snackbar.

## Desktop app (`desktop/`)

Own npm project (own `package.json`/`node_modules`), normal dependencies are
fine here (only `packages/core` and the CLI enforce zero-deps). CommonJS, not
ESM, throughout `desktop/src/` — Electron's main process is plain Node.

- `desktop/src/main.js` — everything: window/tray/menu creation, `metriq://`
  protocol registration (with dev-mode argv handling), single-instance lock,
  all `ipcMain.handle(...)` endpoints. It's one file by design at this size;
  split it up if it keeps growing rather than before.
- `desktop/src/protocol.js` — pure, dependency-free parsing of the
  `metriq://auth-callback` URL and argv scanning. Deliberately separated from
  Electron APIs so it's unit-testable with plain `node --test` (see
  `desktop/test/protocol.test.js`) without spinning up a real window.
- `desktop/src/auth-store.js` — session persistence via `safeStorage`
  (OS keychain-backed encryption). The file on disk
  (`<userData>/credentials.enc`) holds only ciphertext, 0600 permissions.
- `desktop/src/project-cache.js` — local JSON cache of each linked project's
  file index (`<userData>/project-cache/<id>.json`) — not secret, plain JSON
  is fine here, unlike auth-store.
- `desktop/src/prefs.js` — small local-only prefs file (`<userData>/
  prefs.json`): active project selection, tool preference chips. Deliberately
  not synced via InsForge — see "Product phases" above for why.
- `desktop/src/insforge-client.js` — hand-rolled `fetch`-based client for
  InsForge's PostgREST-style database API (just the `linked_projects` table
  today), using the stored session's bearer token. Not `@insforge/sdk` — the
  desktop app only needs a handful of authenticated CRUD calls, and
  Electron's Node runtime has native `fetch`, so the full SDK isn't worth it
  yet. **Field names in requests/responses are real Postgres column names
  (`user_id`, `file_count`), not camelCased** — verified against the live
  API; don't assume the SDK's camelCase conventions carry over here.
- `desktop/src/preload.js` — the only bridge between renderer and main
  (`contextBridge`, `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true` on every `BrowserWindow`). Add new IPC surface here, not by
  loosening those settings.
- `desktop/renderer/` — plain HTML/CSS/JS, no build step, no framework.
  `index.html`/`renderer.js`/`styles.css` are the main window (login →
  logged-in home with projects + tools + capture button);
  `capture.html`/`capture.js`/`capture.css` are the floating prompt-capture
  window. Deliberately not the web app's React/Tailwind stack — Phase 2-4's
  UI needs didn't justify wiring that in; revisit if/when the desktop UI
  grows enough to want it.
- `desktop/src/main.js` imports `packages/core/scanner.js` and
  `packages/core/rewrite.js` directly by relative path (`../../packages/
  core/...`) — same "no package-name indirection" choice as the CLI, see
  "Hard rules" above.
- `linked_projects` (InsForge table, see `migrations/`): `user_id` defaults
  to `auth.uid()` server-side (added in a follow-up migration after the
  table was first created) — the client never sends or could spoof its own
  user id. RLS is per-user on all four operations, no `anon` policy at all.

## Deployment gotcha (important)

Vercel Git deploys are **BLOCKED** (`COMMIT_AUTHOR_REQUIRED`) unless the commit
author's email matches a Vercel team member. This repo's git email is set
locally to `kotharikhush0@gmail.com` (the Vercel account email) to satisfy this.
If a deploy comes back BLOCKED, check the commit author email first.

## Working preferences

- When changing analysis behavior, keep it deterministic and covered by tests
  in `test/core.test.js`.
- Match the surrounding code style (hand-rolled, commented, no new deps in
  `packages/core`/CLI; normal npm deps are fine in `web/` and will be fine in
  `desktop/`).
- Keep the CLI usable with no network and no config — it's a secondary
  interface now, but it still has to work standalone.
- Work the desktop-app pivot phase by phase; don't jump ahead to a phase
  that hasn't been reviewed, and don't start Phase 5 (screen/context
  awareness) implementation without an approved written proposal first.
- Desktop app changes should be verified with a real Electron launch, not
  just `node --check`. Playwright's `_electron` API can drive it headlessly
  (`electron.launch({ executablePath: require("desktop/node_modules/
  electron"), args: ["desktop"] })`); `main.js` has a
  `METRIQ_E2E_TEST=1`-gated `global.__metriqTest` hook exposing
  otherwise-inaccessible main-process functions to Playwright's
  `electronApplication.evaluate()`, which doesn't have this module's local
  `require`/closures. Note: calling an IPC method that closes the very
  window you called it from (e.g. `window.metriq.closeCapture()`) via
  `page.evaluate()` will always report a "context closed" error even though
  the call itself succeeds — trigger those from the main-process context
  (`app.evaluate()` + the test hook) instead.
