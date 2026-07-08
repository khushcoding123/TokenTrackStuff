// GET /api/usage?days=30
//
// Reads Claude Code / Codex local session logs from this machine, aggregates
// them, and returns the dashboard payload. This only produces real data when
// the app runs on the developer's machine (npm run dev / next start); on a
// deployed host there are no logs and it returns { available: false } so the
// UI can fall back to demo mode.

import { getClaudeDirs, loadClaudeRecords } from "../../../../src/core/usage/claude.js";
import { getCodexSessionsDir, loadCodexUsage } from "../../../../src/core/usage/codex.js";
import { aggregate } from "../../../../src/core/usage/aggregate.js";
import { generateInsights } from "../../../../src/core/usage/insights.js";

// Reading logs is a per-request filesystem scan; never pre-render.
export const dynamic = "force-dynamic";

const VALID_DAYS = new Set([7, 30, 90]);

// Parsed-log cache so the UI can poll without re-scanning every JSONL file.
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // days -> { at, payload }

function buildPayload(days) {
  const sources = [];
  if (getClaudeDirs().length) sources.push("claude-code");
  if (getCodexSessionsDir()) sources.push("codex");

  if (!sources.length) {
    return { available: false, sources: [] };
  }

  // Parse a little beyond the window so 5h blocks straddling the cutoff
  // are complete; mtime pre-filter keeps this cheap.
  const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);

  const records = [];
  let rateLimits = null;
  if (sources.includes("claude-code")) {
    records.push(...loadClaudeRecords({ since }));
  }
  if (sources.includes("codex")) {
    const codex = loadCodexUsage({ since });
    records.push(...codex.records);
    rateLimits = codex.rateLimits;
  }

  if (!records.length) {
    return { available: false, sources };
  }

  const agg = aggregate(records, { days });
  return {
    available: true,
    sources,
    days,
    generatedAt: new Date().toISOString(),
    rateLimits,
    insights: generateInsights(agg, rateLimits),
    ...agg,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let days = parseInt(searchParams.get("days") || "30", 10);
  if (!VALID_DAYS.has(days)) days = 30;

  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json(hit.payload);
  }

  let payload;
  try {
    payload = buildPayload(days);
  } catch {
    payload = { available: false, sources: [] };
  }
  cache.set(days, { at: Date.now(), payload });
  return Response.json(payload);
}
