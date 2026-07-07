# AGENTS.md

Context for AI assistants working in this repo. Read this first — it replaces
having to re-explain the project each session.

## What this is

**TokenPilot** — a terminal-first AI assistant for "vibecoders." It sits between
a developer and their AI coding tool (Codex, Cursor, Codex, Gemini CLI,
etc.). Before a prompt is sent, TokenPilot analyzes it, flags whether it's too
broad, estimates its token cost, and rewrites vague prompts into focused ones
that keep the AI on the right files instead of searching the whole codebase.

Tagline: *"Grammarly for AI coding prompts, built for the terminal."*

This repo contains two deliverables:

| Path | What it is |
| --- | --- |
| `bin/`, `src/`, `test/` | The **CLI** — published to npm as `@kkothari/tokenpilot` |
| `web/` | The **landing page** — Next.js 14, deployed to Vercel |

## Live locations

- **npm:** https://www.npmjs.com/package/@kkothari/tokenpilot (`@kkothari/tokenpilot`)
- **Landing page:** https://tokenpilot-mocha.vercel.app
- **GitHub:** https://github.com/khushcoding123/TokenTrackStuff
- **Vercel project:** `tokenpilot` (team `khush-kotharis-projects`), root directory `web`, auto-deploys on push to `main`.

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
- `src/core/session.js` — local session log at `~/.tokenpilot/session.json`
  (best-effort; never blocks the user). Powers `stats`/`history`.
- `src/ui/colors.js` — hand-rolled ANSI colors; auto-disabled when not a TTY or
  when `NO_COLOR`/`TOKENPILOT_NO_COLOR` is set.
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

- Next.js 14 App Router, plain JS (no TypeScript), single marketing page.
- `web/app/page.js` — all sections (hero, stats, before/after demo, how-it-works,
  features, tools, pricing, footer).
- `web/app/InstallCommand.js` + `web/app/BeforeAfter.js` — the only client
  components (copy button; before/after terminal toggle).
- `web/app/globals.css` — all styling; dark developer aesthetic, cyan/green
  palette matching the CLI. Design tokens are CSS vars in `:root`.
- **Note:** the Pro/Team pricing tiers and their features (cloud dashboard,
  AI rewrites, sync) are aspirational copy from the product vision — they are
  NOT built yet. Don't describe them as shipped.

## Deployment gotcha (important)

Vercel Git deploys are **BLOCKED** (`COMMIT_AUTHOR_REQUIRED`) unless the commit
author's email matches a Vercel team member. This repo's git email is set
locally to `kotharikhush0@gmail.com` (the Vercel account email) to satisfy this.
If a deploy comes back BLOCKED, check the commit author email first.

## Roadmap / not-yet-built

Per the product vision, these are planned but absent: browser auth
(GitHub/Google) + terminal↔account linking, dashboard + web analytics, session
sync backend, optional AI-powered rewrites (hybrid: heuristics for detection, an
LLM call via the Vercel AI Gateway for the rewrite), and `npx tokenpilot install`.

## Working preferences

- When changing analysis behavior, keep it deterministic and covered by tests.
- Match the surrounding code style (hand-rolled, commented, no new deps).
- Keep the CLI usable with no network and no config.
