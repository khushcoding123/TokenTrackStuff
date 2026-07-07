# metriq

**Live demo:** https://tokenpilot-mocha.vercel.app · **npm:** [`metriq`](https://www.npmjs.com/package/metriq)

**Terminal-first AI assistant for vibecoders.** metriq sits between you and
your AI coding tool (Claude Code, Cursor, Codex, Gemini CLI, …). Before a prompt
is sent, it estimates how expensive the prompt will be, flags whether it's too
broad, and rewrites it into a focused version that keeps the AI working on the
right part of your project instead of searching the whole codebase.

> Like Grammarly for AI coding prompts — but built for the terminal.

This repo is the **CLI core** (MVP). Analysis, token estimation, prompt
rewriting, and session tracking all run **locally, offline, with no API key.**

---

## Quick start

No install needed to try it (zero runtime dependencies, Node ≥ 18):

```bash
node bin/tokenpilot.js analyze "Fix the dashboard bug"
```

Or link it globally so `metriq` is on your PATH:

```bash
npm link          # from this directory
metriq start
```

---

## What you get

```
$ metriq analyze "Fix the dashboard bug related to token usage"

⚠ BROAD  breadth 68/100
  ████████████████░░░░░░░░

  Projected cost  ~30,867 tokens  (prompt 11 + exploration 30,856)  ≈ $0.19

  Issues
  ✕ Broad scope ("the dashboard") — likely to trigger a full-project search.
  ✕ Vague instruction ("fix") with no specific target.
  ! No file, path, or symbol referenced — the assistant must go find it.

  Likely-relevant files
  ▫ src/Dashboard.tsx
  ▫ src/tokenCalc.ts
  ▫ src/usageApi.ts

  ────────────────────────────────────────────────────────────
  Suggested prompt   saves ~25,801 tokens (84%)

  Fix the dashboard bug related to token usage. Begin by checking
  `src/Dashboard.tsx`, `src/tokenCalc.ts`, `src/usageApi.ts`. Do not
  redesign the UI or refactor unrelated components. Make the smallest
  change necessary. Briefly explain which files you modified and why.
```

---

## Commands

| Command | What it does |
| --- | --- |
| `metriq start` | Interactive REPL — analyzes every prompt before you send it, tracks running savings. The primary experience. |
| `metriq analyze "<prompt>"` | Analyze one prompt and print a focused rewrite. |
| `metriq stats` | Session analytics: tokens projected, saved, $ saved, most expensive prompts. |
| `metriq history` | Every prompt analyzed this session. |
| `metriq reset` | Start a fresh session. |
| `metriq help` | Full help. |

### Options

| Flag | Meaning |
| --- | --- |
| `--provider <id>` | Pricing model for `$` estimates: `claude-opus`, `claude-sonnet` (default), `claude-haiku`, `gpt-4o`, `gemini-pro`. |
| `--json` | Machine-readable output (for `analyze`). |
| `--no-scan` | Skip the project file scan. |
| `--no-track` | Don't record the prompt in the session. |

In the `start` REPL: `:stats`, `:clear`, `:quit`.

---

## How it works

Everything is local, deterministic, and dependency-free.

- **`src/core/tokenizer.js`** — offline token estimator (blends chars/4 and
  words/0.75, with a punctuation bump). Within ~10–15% of real BPE counts.
- **`src/core/analyzer.js`** — the heuristic engine. Detects vague verbs, broad
  scope, heavy-change verbs, missing file references, over-short/over-long
  prompts, missing scope guards, and near-duplicate prompts. Produces a 0–100
  **breadth score** and projects total token cost. A concrete file reference and
  an explicit scope guard each measurably lower the projected exploration cost —
  because those are what actually bound how far the AI wanders.
- **`src/core/scanner.js`** — scans the working directory for source files whose
  names/paths match your prompt keywords, so rewrites can name real files.
- **`src/core/rewrite.js`** — turns intent + missing pieces into a focused
  prompt: original intent → concrete starting point → scope guard → report-back.
- **`src/core/session.js`** — local session log at `~/.metriq/session.json`.

---

## Roadmap

The MVP CLI is here. Still to come, per the product vision:

- Browser-based account auth (GitHub / Google) and terminal ↔ account linking
- Dashboard sync + web analytics
- Optional AI-powered rewrites (hybrid: heuristics for detection, an LLM call
  for the rewrite) via the Vercel AI Gateway
- Landing page and `npx metriq install`

---

## Development

```bash
npm test        # run the unit test suite (node --test)
```

MIT.
