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

**Product direction (post-pivot, current state):** the **desktop app**
(Electron) is now the whole product — prompt checking, project linking,
token/usage tracking, and account settings all live there. The **web app**
has been reduced to a marketing landing page plus the auth-handoff
infrastructure the desktop app needs (login/signup/OAuth-callback pages a
user is never expected to browse to directly — the app opens them in the
system browser and gets redirected straight back). Every other web route
that used to exist (`/prompt-studio`, `/sessions`, `/sustainability`,
`/settings`, `/account`, `/usage`) has been deleted — each was either mock
data, or fully superseded by a real-data equivalent already built in the
desktop app. The CLI remains a secondary interface. See "Product phases"
below for what's actually built vs. planned.

This repo contains three deliverables:

| Path | What it is |
| --- | --- |
| `packages/core/` | The **shared engine** (analyze → scan → rewrite) — zero runtime deps, used by the CLI and the desktop app |
| `bin/`, `src/` | The **CLI** — published to npm as `metriq`; secondary interface |
| `web/` | The **web app** — Next.js 14, deployed to Vercel. Just the marketing landing page (`/`) plus auth-handoff infrastructure (`/login`, `/signup`, `/desktop-connected`, `/api/auth/*`) the desktop app depends on. No visible dashboard pages anymore |
| `desktop/` | The **desktop app** (Electron) — the actual product: Overview, Prompt Studio, Projects, Tools, Usage, Impact, Settings (with a full accessibility system) |

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
  prompt example, "how it works", download CTAs for macOS/Windows/Linux —
  now full buttons of equal weight, all pointing at GitHub Releases,
  placeholder until real builds exist). CLI is mentioned as a secondary
  option (`npx metriq analyze "..."`). No "Live demo"/"Log in" links on the
  landing page anymore — see the later "web scope reduction" phase below.
  `/login`, `/signup` (InsForge-backed auth) are unchanged — the desktop app
  reuses this exact auth flow.
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
  real path — same engine and output as the CLI and the in-app Prompt
  Studio page (see below) — on a
  debounced keystroke, with one-click copy to clipboard. No screen/window
  reading of other apps.
- **Phase 5 (screen/context awareness):** see
  `docs/phase5-screen-awareness-proposal.md` (v2). Split into two
  independent pieces with different approval status:
  - ✅ **5b (terminal agents, approved + built):** `metriq-wrap` — an opt-in
    shell wrapper (`desktop/bin/metriq-wrap.js` → `desktop/src/pty-wrapper.js`,
    `node-pty`-based) around `claude`/`codex` that tracks the current input
    line and can insert an approved rewrite directly back into the terminal.
    No OS accessibility permission needed — the wrapper is a process the
    user explicitly launches, not a cross-app screen read. Talks to the
    desktop app over a local socket at `~/.metriq/wrap.sock`
    (`desktop/src/wrap-server.js`, wire protocol in
    `desktop/src/wrap-protocol.js`) using the same capture-popup seeding
    path as the clipboard watcher (`seedSource: "wrap"` in `main.js` is what
    makes `capture:apply` eligible to insert-back instead of clipboard-only).
    Verify-before-write: an insert is dropped if the user kept typing after
    the draft was analyzed. See `desktop/README.md` for setup. **Explicitly
    out of scope even for 5b:** auto-submitting (Enter is never sent), and
    anything beyond `claude`/`codex`.
  - ✅ **5a (VS Code/Cursor, macOS only, approved + built, read + write-back):**
    `desktop/src/mac-ax.js` — `osascript`/`AXFocusedUIElement` reads whatever
    text field is currently focused in Cursor/VS Code (no manual AX-tree
    traversal needed; that attribute already resolves to "the field the user
    is typing into right now"). Polled by `macEditorPromptSource()` /
    `getEditorWatcher()` in `main.js` (`seedSource: "editor"`), same
    capture-popup seeding path as 5b/clipboard. Write-back on approval was
    explicitly accepted as a real, reduced-not-eliminated risk (the original
    proposal's selection-race concern): Metriq doesn't own the editor's
    input stream the way 5b's terminal wrapper does, so an insert is a
    simulated select-all+paste into whatever's currently focused. Two
    mitigations, not a full guarantee — `mac-ax.js` checks the focused
    element's AXRole is actually text-input-like, and re-reads its value
    immediately before writing to confirm it still matches what was
    analyzed (`writeBack()`'s verify-before-write, aborts on mismatch). Gated
    behind the same macOS Accessibility permission auto-capture already
    uses (`permissions.js`). See `desktop/README.md` for setup/risk
    disclosure shown to users.
  - Still out of scope entirely: Claude.ai/ChatGPT browser capture (a
    separate companion-extension project) and OCR (rejected in the
    proposal on accuracy grounds).
- ✅ **Usage/insights tracking:** `src/core/usage/` (aggregate, claude, codex,
  pricing, insights) reads local Claude Code + Codex session logs and
  prices/aggregates them — shared by `metriq trace` (CLI) and the desktop
  app's Usage tab. Deterministic insight heuristics (low cache hit rate,
  input≫output ratio, expensive outlier sessions, etc.), same
  same-input-same-output determinism guarantee as the prompt analyzer.
- ✅ **Desktop visual redesign:** see `desktop/DESIGN.md` — full design-token
  system (layered dark surfaces, JetBrains Mono for every number, tightened
  radius/motion scale), left icon-rail sidebar replacing the old bottom tab
  bar, and a from-scratch Settings/Projects/Tools/Impact pass. Light/dark
  theme toggle was briefly retired then explicitly restored at request —
  don't re-remove it without checking history first.
- ✅ **Accessibility system:** Settings → Accessibility — High Contrast (own
  palette, not an inversion; respects `prefers-contrast: more` by default),
  Reduce Motion (respects `prefers-reduced-motion` by default), Dyslexia-
  friendly font (bundled OpenDyslexic, `desktop/renderer/assets/fonts/`,
  since the CSP blocks loading it remotely), and Colorblind-friendly mode
  (Okabe–Ito-derived semantic palette). All four are token-layer overrides
  on `<html>` (`.high-contrast`/`.reduce-motion`/`.dyslexia-font`/
  `.colorblind` classes), applied pre-paint by `desktop/renderer/theme-
  init.js` (a blocking external script — the CSP has no `'unsafe-inline'`
  for script-src) to avoid a flash of the wrong theme on launch. Every color
  in `styles.css`/`capture.css` is token-driven (`color-mix()` for alpha
  variants) specifically so these modes reach every component with no
  per-component work — don't reintroduce a hardcoded `rgba(...)` accent
  color without converting it.
- ✅ **Web scope reduction:** the web app's dashboard-ish pages
  (`/prompt-studio`, `/sessions`, `/sustainability`, `/settings`,
  `/account`, `/usage`, and their API route `/api/usage`) have all been
  **deleted**. Each was either mock data (`/sessions`, `/sustainability`),
  redundant with a real desktop equivalent (`/account`, `/settings`,
  `/usage`), or fully ported into the desktop app as a richer real-data
  page (`/prompt-studio` → desktop's Prompt Studio tab, reusing the exact
  same `capture:*` IPC surface as the `Cmd/Ctrl+Shift+M` capture window).
  Post-login/signup redirects that used to target `/usage` or `/account`
  now go to `/` (the landing page), since there's no in-browser destination
  left. `Sidebar.js`/`TopBar.js`/`ThemeToggle.js`/`lib/csv.js` were deleted
  as now-orphaned shared components. **The web app's only remaining job is
  the landing page plus the auth-handoff infrastructure** (`/login`,
  `/signup`, `/desktop-connected`, `/api/auth/*`) — don't add new
  dashboard-style pages there; build them in the desktop app instead.

## Hard rules / conventions

- **`packages/core` has ZERO runtime dependencies**, same rule that used to
  apply to the whole CLI. This is deliberate — the CLI must still run
  instantly via `npx` with no install step, and the engine must stay
  embeddable directly in the Electron renderer with no bundler (the desktop
  app's Prompt Studio page and capture window both import it by relative
  path). Do not add dependencies there without a very good reason.
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
  `node:fs`/`node:path`, so it's CLI/Electron-only.
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

Deliberately small now — see "Web scope reduction" above. Two jobs only:
the landing page, and auth infrastructure the desktop app depends on.

- Next.js 14 App Router, plain JS (no TypeScript). Styled with real Tailwind
  CSS (build-time, via `tailwind.config.js` + `postcss.config.js` +
  `@tailwind` directives in `globals.css`). `ThemeProvider.js` still wraps
  the whole app (in `layout.js`) so dark/light class-switching keeps
  working; there's just no visible toggle UI left on any remaining page
  (`ThemeToggle.js` was deleted along with the dashboard chrome that used
  it). Glass-card aesthetic, green/blue accent palette, Geist / Inter /
  JetBrains Mono fonts, Material Symbols Outlined for icons.
- **Routes:**
  - `/` — marketing landing page (hero, before/after prompt example, "how it
    works", download CTAs). Static, no dashboard chrome. No "Live demo" or
    "Log in" links — those flows live entirely in the desktop app now.
  - `/login`, `/signup` — auth, backed by **InsForge** (`@insforge/sdk`),
    not a hand-rolled Prisma/JWT stack (an earlier Prisma-based
    implementation was fully superseded — don't resurrect it). Email +
    Google OAuth (PKCE, via InsForge's shared OAuth callback), session
    refreshed by `web/middleware.js`. See `AGENTS.md` for the InsForge
    project details and which InsForge skills to use for backend changes.
    **A user is never expected to browse to these directly** — the desktop
    app opens them via `shell.openExternal` with `?desktop=1`, which makes
    the login/signup API routes return a bearer `token`/`refreshToken`
    (normally cookie-only) and land on `/desktop-connected` instead of a
    now-deleted `/account`. Without `?desktop=1` (the rare case of someone
    visiting directly), successful auth now redirects to `/` — there's no
    other page left to send them to. Don't change this shape without
    checking `desktop/src/protocol.js` and `desktop/README.md`.
  - `/desktop-connected` — reconstructs a `metriq://auth-callback?token=...`
    URL from its own query params and navigates to it, handing the session
    to the desktop app. Infra only, not a page anyone browses to.
  - `/api/auth/*` — login/signup/logout/refresh/google/callback route
    handlers, all InsForge-backed. Infra only.
- **Deleted** (do not resurrect without re-confirming the "web is landing +
  auth only" decision): `/prompt-studio`, `/sessions`, `/sustainability`,
  `/settings`, `/account`, `/usage`, `/api/usage`,
  `components/Sidebar.js`, `components/TopBar.js`, `components/ThemeToggle.js`,
  `lib/csv.js`. Real-data functionality from these (prompt analysis, usage
  tracking, account settings) now lives in the desktop app instead — see
  "Web scope reduction" in Product phases above for the reasoning per page.
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
  prefs.json`): active project selection, tool preference chips, theme, and
  the `accessibility` object (`highContrast`/`reduceMotion`/`dyslexiaFont`/
  `colorblind` — each `true`/`false`/absent; absent means "no explicit
  choice," letting the OS-default fallbacks in `theme-init.js` apply).
  Deliberately not synced via InsForge — see "Product phases" above for why.
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
  sidebar-nav'd home: Overview, Prompt Studio, Projects, Tools, Usage,
  Impact, Settings); `capture.html`/`capture.js`/`capture.css` are the
  floating prompt-capture window. Deliberately not the web app's
  React/Tailwind stack — Phase 2-4's UI needs didn't justify wiring that
  in; revisit if/when the desktop UI grows enough to want it. Full design
  system (colors, type, spacing, motion, component patterns) is documented
  in `desktop/DESIGN.md` — read it before changing visual styling.
  `desktop/renderer/theme-init.js` is a small external script (referenced
  from both `index.html` and `capture.html`'s `<head>`) that applies the
  saved theme/accessibility classes to `<html>` before first paint —
  external rather than inline because the CSP has no `'unsafe-inline'` for
  script-src.
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
  that hasn't been reviewed. Phase 5b (terminal-agent capture via
  `metriq-wrap`) and Phase 5a (VS Code/Cursor GUI capture + write-back,
  macOS only) are both approved and built — see "Product phases" above.
  Still out of scope without a fresh explicit approval: Claude.ai/ChatGPT
  browser capture, Windows/Linux AX hardening beyond basic support, and OCR.
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
