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
| `desktop/` | The **desktop app** (Electron) — not yet scaffolded; see "Product phases" |

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
- ⏳ **Phase 2 (not started):** Electron app shell (`desktop/`) — window, tray
  icon, app menu, and login via browser handoff (opens the web `/login`,
  gets a session back through a custom `metriq://` protocol handler, stored
  via Electron `safeStorage`).
- ⏳ **Phase 3 (not started):** Repo linking (local folder picker, optionally
  GitHub OAuth) — runs `packages/core/scanner.js` against the linked
  folder, persists linked projects via InsForge keyed to the account.
- ⏳ **Phase 4 (not started):** Tool-preference setting + a global-hotkey
  floating capture window that runs analyze → scan → rewrite against the
  linked repo and gives a one-click "copy improved prompt."
- ⏳ **Phase 5 (research first, not approved):** Live screen/context
  awareness (accessibility APIs, possibly a companion browser extension for
  web-based tools). Explicitly gated behind a written feasibility proposal —
  do not build against this until that proposal is reviewed and approved.

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
    **The desktop app reuses this exact web auth flow** (browser handoff),
    so don't change its shape without checking the desktop-app phase plan.
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
