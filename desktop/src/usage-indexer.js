// Phase 5 — index normalized usage sessions into metriq_usage_sessions.
//
// Reuses the existing local usage pipeline (aggregate sessions). Typesense only
// improves discovery/filtering; it never replaces deterministic aggregation.
// Pure helpers are unit-tested without a server.

const crypto = require("node:crypto");
const svc = require("./typesense-service");

const COLLECTION = svc.SCHEMAS.usage_sessions.name;

const EXPENSIVE_COST_USD = 1.0;
const HIGH_INPUT_TOKENS = 50000;
const LOW_CACHE_HIT = 0.25;

function sessionDocId(userId, source, sessionId) {
  return crypto
    .createHash("sha1")
    .update(`${userId || ""}|${source || ""}|${sessionId || ""}`)
    .digest("hex")
    .slice(0, 24);
}

function cacheHitRate(session) {
  const context =
    (session.inputTokens || 0) +
    (session.cacheCreationTokens || 0) +
    (session.cacheReadTokens || 0);
  if (!context) return 0;
  return (session.cacheReadTokens || 0) / context;
}

/** Derive facet/search labels from session metrics (pure). */
function deriveLabels(session) {
  const labels = [];
  const rate = cacheHitRate(session);
  if ((session.costUSD || 0) >= EXPENSIVE_COST_USD) labels.push("expensive");
  if ((session.inputTokens || 0) >= HIGH_INPUT_TOKENS) labels.push("high_input");
  if (rate > 0 && rate < LOW_CACHE_HIT) labels.push("low_cache");
  if ((session.inputTokens || 0) > (session.outputTokens || 0) * 4) labels.push("input_heavy");
  if ((session.totalTokens || 0) >= 100000) labels.push("large");
  return labels;
}

/**
 * Build searchable text: project, models, tool, labels, and optional prompt
 * snippets from the session's underlying records.
 */
function buildSearchText(session, promptSnippets = []) {
  const parts = [
    session.project || "",
    session.source || "",
    session.sessionId || "",
    ...(session.models || []),
    ...deriveLabels(session),
    ...promptSnippets.slice(0, 8),
  ];
  if ((session.costUSD || 0) >= EXPENSIVE_COST_USD) parts.push("expensive session high cost");
  if ((session.inputTokens || 0) >= HIGH_INPUT_TOKENS) {
    parts.push("more than 50k input tokens high input");
  }
  if (cacheHitRate(session) > 0 && cacheHitRate(session) < LOW_CACHE_HIT) {
    parts.push("low cache usage poor cache hit rate");
  }
  return parts.filter(Boolean).join(" ").slice(0, 4000);
}

function buildSessionDoc({ userId, session, promptSnippets = [], indexedAt = Date.now() }) {
  const started = new Date(session.startedAt).getTime() || 0;
  const ended = new Date(session.endedAt).getTime() || started;
  const labels = deriveLabels(session);
  return {
    id: sessionDocId(userId, session.source, session.sessionId),
    user_id: userId || "local",
    project_id: session.projectId || session.project || "none",
    session_id: String(session.sessionId || ""),
    project: session.project || "",
    tool: session.source || "unknown",
    models: Array.isArray(session.models) ? session.models.slice(0, 12) : [],
    search_text: buildSearchText(session, promptSnippets),
    labels,
    input_tokens: Math.round(session.inputTokens || 0),
    output_tokens: Math.round(session.outputTokens || 0),
    cache_read_tokens: Math.round(session.cacheReadTokens || 0),
    total_tokens: Math.round(session.totalTokens || 0),
    cost_usd: Number(session.costUSD) || 0,
    cache_hit_rate: Math.round(cacheHitRate(session) * 1000) / 1000,
    requests: Math.round(session.requests || 0),
    started_at: started,
    ended_at: ended,
    indexed_at: indexedAt,
  };
}

/** Group prompt snippets from flat usage records by source:sessionId. */
function promptsBySession(records = []) {
  const map = new Map();
  for (const r of records) {
    if (!r?.sessionId || !r.prompt) continue;
    const key = `${r.source}:${r.sessionId}`;
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (list.length < 6) list.push(String(r.prompt).slice(0, 200));
  }
  return map;
}

/**
 * Upsert a batch of aggregated sessions into Typesense.
 * @returns {Promise<{ok:boolean, imported?:number, disabled?:boolean, error?:string}>}
 */
async function indexUsageSessions({
  config = svc.getConfig(),
  userId,
  sessions = [],
  records = [],
} = {}) {
  const health = await svc.health(config);
  if (!health.ok) {
    return { ok: false, disabled: health.disabled, error: health.error || "Typesense unavailable" };
  }
  if (!sessions.length) return { ok: true, imported: 0 };

  try {
    await svc.ensureAllCollections(config);
    const promptMap = promptsBySession(records);
    const indexedAt = Date.now();
    const docs = sessions.map((session) =>
      buildSessionDoc({
        userId,
        session,
        promptSnippets: promptMap.get(`${session.source}:${session.sessionId}`) || [],
        indexedAt,
      })
    );
    // Upsert in batches of 100
    let imported = 0;
    for (let i = 0; i < docs.length; i += 100) {
      const batch = docs.slice(i, i + 100);
      const res = await svc.importDocuments(config, COLLECTION, batch);
      imported += res.imported || 0;
    }
    return { ok: true, imported };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Search usage sessions. Supports natural-language q plus structured filters.
 * Falls back to [] when Typesense is down.
 */
async function searchUsageSessions({
  config = svc.getConfig(),
  userId,
  q = "*",
  filters = {},
  ranges = {},
  limit = 25,
} = {}) {
  const health = await svc.health(config);
  if (!health.ok) return [];

  // Lightweight NL → filter/label hints before the Typesense query.
  let query = String(q || "").trim() || "*";
  const labelHints = [];
  const rangeHints = { ...ranges };
  if (/expensive/i.test(query)) labelHints.push("expensive");
  if (/low\s*cache|poor\s*cache/i.test(query)) labelHints.push("low_cache");
  if (/50k|50000|high\s*input/i.test(query)) {
    labelHints.push("high_input");
    if (!rangeHints.input_tokens) rangeHints.input_tokens = { gte: HIGH_INPUT_TOKENS };
  }

  const mergedFilters = {
    ...(userId ? { user_id: userId } : {}),
    ...filters,
  };
  if (labelHints.length) {
    mergedFilters.labels = [...new Set([...(filters.labels || []), ...labelHints])];
  }

  try {
    const response = await svc.search(config, COLLECTION, {
      q: query,
      query_by: "search_text,project,models,labels,session_id,tool",
      query_by_weights: "5,4,3,3,2,2",
      filters: mergedFilters,
      ranges: rangeHints,
      per_page: limit,
      sort_by: query === "*" ? "started_at:desc" : "_text_match:desc,started_at:desc",
      facet_by: "project,tool,models,labels",
    });
    return (response.hits || []).map((hit) => {
      const d = hit.document || {};
      return {
        id: d.id,
        sessionId: d.session_id,
        project: d.project,
        tool: d.tool,
        models: d.models || [],
        labels: d.labels || [],
        inputTokens: d.input_tokens,
        outputTokens: d.output_tokens,
        cacheReadTokens: d.cache_read_tokens,
        totalTokens: d.total_tokens,
        costUSD: d.cost_usd,
        cacheHitRate: d.cache_hit_rate,
        requests: d.requests,
        startedAt: d.started_at,
        endedAt: d.ended_at,
        score: hit.text_match || 0,
        facets: response.facet_counts || [],
      };
    });
  } catch {
    return [];
  }
}

module.exports = {
  COLLECTION,
  EXPENSIVE_COST_USD,
  HIGH_INPUT_TOKENS,
  LOW_CACHE_HIT,
  sessionDocId,
  cacheHitRate,
  deriveLabels,
  buildSearchText,
  buildSessionDoc,
  promptsBySession,
  indexUsageSessions,
  searchUsageSessions,
};
