# AGENTS.md

Context for AI assistants working in this repo. Read this first — it replaces
having to re-explain the project each session.

## What this is

**metriq** — a terminal-first AI assistant for "vibecoders." It sits between
a developer and their AI coding tool (Codex, Cursor, Codex, Gemini CLI,
etc.). Before a prompt is sent, metriq analyzes it, flags whether it's too
broad, estimates its token cost, and rewrites vague prompts into focused ones
that keep the AI on the right files instead of searching the whole codebase.

Tagline: *"Grammarly for AI coding prompts, built for the terminal."*

This repo contains two deliverables:

| Path | What it is |
| --- | --- |
| `bin/`, `src/`, `test/` | The **CLI** — published to npm as `metriq` |
| `web/` | The **landing page** — Next.js 14, deployed to Vercel |

## Live locations

- **npm:** https://www.npmjs.com/package/metriq (`metriq`)
- **Landing page:** https://tokenpilot-mocha.vercel.app
- **GitHub:** https://github.com/khushcoding123/TokenTrackStuff
- **Vercel project:** `tokenpilot` (team `khush-kotharis-projects`), root directory `web`, auto-deploys on push to `main`.

Note: the repo, GitHub URL, Vercel project, and `bin/tokenpilot.js` filename
still carry the old "tokenpilot" name — only the product branding (package
name, CLI command, page copy) was renamed to metriq. Don't "fix" these to
match; they're intentionally unchanged infrastructure identifiers.

## Hard rules / conventions

- **The CLI has ZERO runtime dependencies.** This is deliberate — it must run
  instantly via `npx` with no install step. Do not add dependencies to the root
  `package.json` without a very good reason. ANSI colors, arg parsing, and the
  tokenizer are all hand-rolled to keep it dependency-free.
- **The CLI is offline-only right now.** No network calls, no API keys. All
  analysis is local heuristics. (An optional AI-powered rewrite is on the
  roadmap but not built — see below.)
- **ES Modules** everywhere (`"type": "module"`). Use `import`/`export`.
- **Node ≥ 18.** Target that baseline.
- **Windows dev environment.** Paths use backslashes locally; when generating
  file paths that go *into prompts*, normalize to forward slashes (the scanner
  already does this).

## CLI architecture (`src/`)

Data flows: **cli → command → core (analyze → scan → rewrite) → ui (format)**,
with `session` recording results.

- `bin/tokenpilot.js` — entry point (shebang), calls `src/cli.js`.
- `src/cli.js` — arg parsing + command dispatch + `--help`.
- `src/config.js` — provider pricing table + exploration-token constants.
- `src/core/tokenizer.js` — offline token estimator (blends chars/4 and
  words/0.75, plus a punctuation bump). No real BPE tokenizer.
- `src/core/analyzer.js` — **the heart.** Heuristic engine. Detects vague verbs,
  broad scope, heavy-change verbs, missing file refs, too-short/long prompts,
  missing scope guards, and near-duplicates. Produces a 0–100 `breadthScore` and
  projects total token cost. Key model detail: a concrete file reference (×0.45)
  and an explicit scope guard (×0.6) each *reduce* projected exploration cost —
  because those are what actually bound how far the AI wanders. If you change
  scoring, update `test/core.test.js`.
- `src/core/scanner.js` — scans the working dir for source files whose
  names/paths match prompt keywords, so rewrites can name real files. Ignores
  `node_modules`, `.git`, build dirs, etc. Returns forward-slash paths.
- `src/core/rewrite.js` — turns analysis + scanned files into a focused prompt:
  intent → starting point → scope guard → report-back. `optimize()` is the
  convenience entry that analyzes, rewrites, and computes savings.
- `src/core/session.js` — local session log at `~/.metriq/session.json`
  (best-effort; never blocks the user). Powers `stats`/`history`.
- `src/ui/colors.js` — hand-rolled ANSI colors; auto-disabled when not a TTY or
  when `NO_COLOR`/`TOKENPILOT_NO_COLOR` is set (env var name kept as-is, unrenamed).
- `src/ui/format.js` — renders the analysis report, bars, boxes, stats tables.
- `src/commands/` — `analyze.js`, `start.js` (interactive REPL — the primary UX),
  `stats.js` (also `history`, `reset`).

## Commands (how to run / test / ship)

```bash
# Run the CLI locally
node bin/tokenpilot.js analyze "Fix the dashboard bug"
node bin/tokenpilot.js start

# Test the analysis core
npm test                      # node --test

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

- Next.js 14 App Router, plain JS (no TypeScript), **multi-page dashboard app**
  (not a single marketing page — this replaced the old landing page).
- Styled with real Tailwind CSS (build-time, via `tailwind.config.js` +
  `postcss.config.js` + `@tailwind` directives in `globals.css` — not the
  Tailwind CDN `<script>` some prototypes use). Dark-only theme (`<html
  className="dark">`), glass-card aesthetic, green/blue accent palette, Geist /
  Inter / JetBrains Mono fonts loaded via `<link>` tags in `layout.js` (Next.js
  hoists them into `<head>` automatically), Material Symbols Outlined for icons.
- Routes: `/` (Overview — hero, headline metrics, compression chart, live log
  feed), `/prompt-studio` (real prompt analysis — see below), `/sessions`
  (searchable/filterable/paginated session history with CSV export and a logs
  modal), `/sustainability` (environmental-impact metric cards, pipeline
  diagram, optimization log table with CSV export), `/settings` (persisted
  preferences).
- `web/app/components/Sidebar.js` + `TopBar.js` — shared nav shell used by every
  page. `Sidebar` takes an `active` prop to highlight the current route
  (including `/settings`, which lives in the footer group). `TopBar` is a
  client component with a working notifications dropdown, a "local-only"
  status popover, and a profile menu.
- `web/app/components/ToastProvider.js` — wraps the whole app in `layout.js`;
  `useToast()` gives any client component a `notify(message)` snackbar.
- **`/prompt-studio` runs the real CLI engine, not mock data.**
  `PromptStudioClient.js` imports `analyzePrompt`/`optimize` directly from
  `../../../src/core/analyzer.js` / `rewrite.js` (and pricing from
  `src/config.js`) — those modules are pure JS with no Node built-ins, so they
  run fine in the browser. Typing in the editor live-recomputes breadth score,
  token savings, and reasoning; the magic-wand button actually calls
  `optimize()` and replaces the prompt text; "Run Evaluation" snapshots a
  revision history you can restore from. If you change scoring in
  `analyzer.js`, this page's numbers change too — same source of truth as the
  CLI and `test/core.test.js`.
- **Sessions, Sustainability, and Overview still use static/hard-coded mock
  data** (no backend, no wiring to the CLI's real `~/.metriq/session.json`) —
  but the interactions around that data (search, project filter, pagination,
  CSV export via `web/app/lib/csv.js`, per-row log modal, copy-to-clipboard)
  are fully functional, they just operate on illustrative rows, not real
  session history. Don't present the numbers themselves as live data.
- `/settings` persists to `localStorage` (`metriq:provider`,
  `metriq:reducedMotion`) — no account/backend. The pricing-provider choice
  is read by Prompt Studio's $-savings estimate; reduced-motion sets
  `data-reduced-motion` on `<html>`, which `globals.css` uses to kill
  animations/transitions site-wide.
- Avatars are plain icon-in-circle divs, not `<img>` tags — earlier drafts
  hotlinked AI-generated placeholder images from a Google-hosted preview
  bucket; those were deliberately replaced since we don't control that URL's
  lifetime.

## Deployment gotcha (important)

Vercel Git deploys are **BLOCKED** (`COMMIT_AUTHOR_REQUIRED`) unless the commit
author's email matches a Vercel team member. This repo's git email is set
locally to `kotharikhush0@gmail.com` (the Vercel account email) to satisfy this.
If a deploy comes back BLOCKED, check the commit author email first.

## Roadmap / not-yet-built

Per the product vision, these are planned but absent: browser auth
(GitHub/Google) + terminal↔account linking, dashboard + web analytics, session
sync backend, optional AI-powered rewrites (hybrid: heuristics for detection, an
LLM call via the Vercel AI Gateway for the rewrite), and `npx metriq install`.

## Working preferences

- When changing analysis behavior, keep it deterministic and covered by tests.
- Match the surrounding code style (hand-rolled, commented, no new deps).
- Keep the CLI usable with no network and no config.

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **Hackathon** (API base `https://v36dqchj.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->
