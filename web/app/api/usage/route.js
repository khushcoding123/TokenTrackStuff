// GET /api/usage?days=30
//
// Reads Claude Code / Codex local session logs from this machine, aggregates
// them, and returns the dashboard payload. This only produces real data when
// the app runs on the developer's machine (npm run dev / next start); on a
// deployed host there are no logs and it returns { available: false } so the
// UI can fall back to demo mode.

import { getClaudeDirs, loadClaudeRecords } from "../../../../src/core/usage/claude.js";
import { getCodexSessionsDir, loadCodexUsage } from "../../../../src/core/usage/codex.js";
import { getCursorProjectsDir, loadCursorRecords } from "../../../../src/core/usage/cursor.js";
import { aggregate } from "../../../../src/core/usage/aggregate.js";
import { generateInsights } from "../../../../src/core/usage/insights.js";
import { analyzeCurrentSession } from "../../../../src/core/usage/behavior.js";

// Reading logs is a per-request filesystem scan; never pre-render.
export const dynamic = "force-dynamic";

const VALID_DAYS = new Set([7, 30, 90]);

// Parsed-log cache so the UI can poll without re-scanning every JSONL file.
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // days -> { at, payload }

function detectSources() {
  const sources = [];
  if (getClaudeDirs().length) sources.push("claude-code");
  if (getCodexSessionsDir()) sources.push("codex");
  if (getCursorProjectsDir()) sources.push("cursor");
  return sources;
}

function filterSelected(records, selectedSource) {
  if (selectedSource === "all") return records;
  return records.filter((r) => r.source === selectedSource);
}

function buildPayload(days, selectedSource = "claude-code") {
  const detectedSources = detectSources();

  if (!detectedSources.length) {
    return { available: false, sources: [], detectedSources: [], selectedSource };
  }

  // Parse a little beyond the window so 5h blocks straddling the cutoff
  // are complete; mtime pre-filter keeps this cheap.
  const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);

  const records = [];
  let rateLimits = null;
  if (detectedSources.includes("claude-code")) {
    records.push(...loadClaudeRecords({ since }));
  }
  if (detectedSources.includes("codex")) {
    const codex = loadCodexUsage({ since });
    records.push(...codex.records);
    rateLimits = codex.rateLimits;
  }
  if (detectedSources.includes("cursor")) {
    records.push(...loadCursorRecords({ since }));
  }

  const scopedRecords = filterSelected(records, selectedSource);
  const telemetrySources = [...new Set(scopedRecords.map((r) => r.source))];

  if (!scopedRecords.length) {
    return {
      available: false,
      sources: [],
      detectedSources,
      selectedSource,
      hasAnyTelemetry: records.length > 0,
    };
  }

  const agg = aggregate(scopedRecords, { days });
  return {
    available: true,
    sources: telemetrySources,
    detectedSources,
    days,
    selectedSource,
    generatedAt: new Date().toISOString(),
    rateLimits: selectedSource === "all" || selectedSource === "codex" ? rateLimits : null,
    insights: generateInsights(agg, rateLimits),
    currentSession: analyzeCurrentSession(scopedRecords, { rateLimits }),
    ...agg,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let days = parseInt(searchParams.get("days") || "30", 10);
  if (!VALID_DAYS.has(days)) days = 30;
  const selectedSource = searchParams.get("source") || "claude-code";

  const cacheKey = `${days}:${selectedSource}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json(hit.payload);
  }

  let payload;
  try {
    payload = buildPayload(days, selectedSource);
  } catch {
    payload = { available: false, sources: [], detectedSources: [], selectedSource };
  }
  cache.set(cacheKey, { at: Date.now(), payload });
  return Response.json(payload);
}
