# Usage Dashboard

This document explains how the usage dashboard works end to end: where the data
comes from, how it is normalized, how the API responds, and what the frontend
renders.

## Overview

The usage dashboard is a local-only analytics feature for `metriq`.

It reads usage logs produced by:

- Claude Code
- Codex

It then:

1. Parses those logs into one shared record format
2. Prices the records with approximate per-model token rates
3. Aggregates them into daily, session, model, and 5-hour window views
4. Generates deterministic insights
5. Serves the result through `GET /api/usage`
6. Renders the dashboard in `/usage`

If no local logs are available, the UI falls back to demo data.

## Data Sources

### Claude Code logs

Claude Code usage is loaded by [src/core/usage/claude.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/src/core/usage/claude.js:1).

It looks for JSONL session files in:

- `~/.config/claude/projects/...`
- `~/.claude/projects/...`

Or, if present, it honors `CLAUDE_CONFIG_DIR`.

Each assistant message line may include:

- `timestamp`
- `message.model`
- `message.usage`

The loader:

- skips unreadable files
- skips corrupt or partial lines
- skips synthetic error placeholders
- dedupes retried responses using `message.id + requestId`

It outputs normalized records like:

```js
{
  source: "claude-code",
  sessionId,
  project,
  timestamp,
  model,
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
}
```

### Codex logs

Codex usage is loaded by [src/core/usage/codex.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/src/core/usage/codex.js:1).

It scans:

- `$CODEX_HOME/sessions/...`
- defaulting to `~/.codex/sessions/...`

It reads rollout JSONL files and uses:

- `session_meta` for project/session metadata
- `turn_context` for model metadata
- `event_msg` with `payload.type === "token_count"` for usage

Important detail:

- Codex reports `cached_input_tokens` as a subset of input
- the loader converts that into:
  - `inputTokens = input - cached`
  - `cacheReadTokens = cached`

It also captures the latest available Codex rate-limit snapshot so the UI can
show 5-hour and weekly pressure.

## Pricing

Pricing lives in [src/core/usage/pricing.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/src/core/usage/pricing.js:1).

This is intentionally approximate. The dashboard is meant to show:

- relative cost
- model mix
- caching impact
- trend direction

It is not meant to be billing-grade accounting.

The pricing module provides:

- `pricingFor(modelId)` for model lookup
- `costForRecord(record)` for estimated API-equivalent spend
- `cacheSavingsForRecord(record)` for estimated savings from cached reads

## Aggregation

Aggregation happens in [src/core/usage/aggregate.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/src/core/usage/aggregate.js:1).

It takes normalized records and produces the dashboard payload.

### Output groups

- `totals`
  - total input, output, cache write, cache read, total tokens, estimated cost, cache savings
- `bySource`
  - totals split by Claude Code vs Codex
- `daily`
  - one bucket per day, including zero-activity days so charts do not have gaps
- `sessions`
  - grouped by `source + sessionId`, with request counts, model list, duration, and totals
- `models`
  - grouped by model id, including request counts and cache hit rate
- `blocks`
  - 5-hour windows, used to reflect subscription/session-limit pressure

### 5-hour blocks

The block system is important to the feature.

Blocks are created from the first activity after a gap, then span 5 hours. That
makes it possible to show:

- active current window
- recent heavy windows
- relative intensity across time

This matches the product goal of helping users understand when usage patterns
start hitting practical session limits.

## Insights

Insights are generated in [src/core/usage/insights.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/src/core/usage/insights.js:1).

They are deterministic heuristics, not AI-generated summaries.

Current insight types include:

- low cache efficiency
- healthy cache efficiency
- high input-to-output ratio
- expensive outlier sessions
- premium-model-heavy spend
- 5-hour block pressure
- Codex live rate-limit pressure

Each insight includes:

- `id`
- `severity`
- `title`
- `evidence`
- `action`
- optional `link`

The design goal is that the same logs always produce the same advice.

## API Route

The API route is [web/app/api/usage/route.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/web/app/api/usage/route.js:1).

Route:

- `GET /api/usage?days=7|30|90`

Behavior:

- forces dynamic execution
- scans local Claude/Codex logs on the machine running the app
- caches parsed payloads in memory for 60 seconds
- returns `{ available: false }` when no logs are found

The route only produces real data when the app runs on the same machine where
Claude Code or Codex usage logs exist.

That means:

- local dev works
- deployed hosting usually falls back to demo mode

## Frontend

The usage page entry is [web/app/usage/page.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/web/app/usage/page.js:1).

The main client implementation is [web/app/usage/UsageClient.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/web/app/usage/UsageClient.js:1).

### What the client does

- fetches `/api/usage`
- falls back to demo data when the API says real logs are unavailable
- supports 7/30/90-day ranges
- refreshes automatically every 60 seconds
- supports manual refresh
- supports CSV export of session rows
- shows daily stacked-token charts
- shows sessions, model mix, active 5-hour block, recent blocks, and insights

### Demo mode

Demo data lives in [web/app/usage/demoData.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/web/app/usage/demoData.js:1).

It mirrors the real API payload shape so the UI can render identically in both
cases. The page explicitly labels demo mode so users know the numbers are not
their real usage.

## Navigation

The usage page is linked from [web/app/components/Sidebar.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/web/app/components/Sidebar.js:1) using:

- label: `Usage`
- href: `/usage`

## Tests

Test coverage for this feature lives in [test/usage.test.js](/Users/ayaanoberoi/Code/Divergent%20nats/TokenTrackStuff/test/usage.test.js:1).

The fixtures live in [test/fixtures](</Users/ayaanoberoi/Code/Divergent nats/TokenTrackStuff/test/fixtures>).

The tests cover:

- Claude log parsing
- Codex log parsing
- retry dedupe
- corrupt/synthetic line handling
- fallback model handling
- pricing resolution
- cost and cache-savings math
- aggregation behavior
- 5-hour block behavior
- deterministic insight generation

## Mental Model

The simplest way to think about the feature is:

- import raw local AI-tool logs
- normalize them into one common shape
- compute useful usage and cost summaries
- surface concrete insights in the web dashboard

It is a local analytics pipeline, not a remote telemetry system.
