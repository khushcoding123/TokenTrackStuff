// Phase 6 — federated Metriq search across code, prompts, and usage sessions.
// Uses Typesense multi_search when available; returns empty groups otherwise.

const svc = require("./typesense-service");
const { expandQuery } = require("./hybrid-query");

/**
 * Pure mapper from a multi_search response into grouped UI results.
 */
function mapMultiSearchResults(response, { limitPerGroup = 6 } = {}) {
  const results = Array.isArray(response?.results) ? response.results : [];
  const [codeRes, promptRes, usageRes] = results;

  const code = (codeRes?.hits || []).slice(0, limitPerGroup).map((hit) => {
    const d = hit.document || {};
    const symbolHl = (hit.highlights || []).find((h) => h.field === "symbols");
    return {
      kind: "code",
      id: d.id,
      title: d.file_path || d.file_name || "File",
      subtitle: symbolHl?.matched_tokens?.[0] || (d.symbols && d.symbols[0]) || d.directory || "",
      filePath: d.file_path || "",
      symbol: symbolHl?.matched_tokens?.[0] || null,
      snippet: (hit.highlights || []).find((h) => h.field === "content")?.snippet || null,
      score: hit.text_match || 0,
    };
  });

  // Dedupe code by file_path keeping best score
  const seenFiles = new Set();
  const codeUnique = [];
  for (const item of code) {
    if (!item.filePath || seenFiles.has(item.filePath)) continue;
    seenFiles.add(item.filePath);
    codeUnique.push(item);
  }

  const prompts = (promptRes?.hits || []).slice(0, limitPerGroup).map((hit) => {
    const d = hit.document || {};
    const original = d.original_prompt || "";
    return {
      kind: "prompt",
      id: d.id,
      title: original.length > 90 ? original.slice(0, 90) + "…" : original,
      subtitle:
        (d.estimated_tokens_saved || 0) > 0
          ? `Saved ~${Number(d.estimated_tokens_saved).toLocaleString()} tokens`
          : "Previous prompt",
      originalPrompt: d.original_prompt || "",
      optimizedPrompt: d.optimized_prompt || "",
      relevantFiles: d.relevant_files || [],
      estimatedTokensSaved: d.estimated_tokens_saved || 0,
      score: hit.text_match || 0,
    };
  });

  const usage = (usageRes?.hits || []).slice(0, limitPerGroup).map((hit) => {
    const d = hit.document || {};
    return {
      kind: "usage",
      id: d.id,
      title: d.project || d.session_id || "Session",
      subtitle: [
        d.tool,
        d.total_tokens ? `${Number(d.total_tokens).toLocaleString()} tokens` : null,
        d.cost_usd != null ? `$${Number(d.cost_usd).toFixed(2)}` : null,
        (d.labels || []).includes("expensive") ? "expensive" : null,
        (d.labels || []).includes("low_cache") ? "low cache" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      sessionId: d.session_id,
      project: d.project,
      tool: d.tool,
      totalTokens: d.total_tokens,
      costUSD: d.cost_usd,
      startedAt: d.started_at,
      score: hit.text_match || 0,
    };
  });

  return { code: codeUnique, prompts, usage };
}

/**
 * Federated search. Never throws — returns empty groups when Typesense is down.
 */
async function globalSearch({
  config = svc.getConfig(),
  userId,
  projectId,
  q,
  limitPerGroup = 6,
} = {}) {
  const empty = { code: [], prompts: [], usage: [], hybrid: false, source: "none" };
  const raw = String(q || "").trim();
  if (!raw) return empty;

  const health = await svc.health(config);
  if (!health.ok) return { ...empty, source: "offline" };

  const expanded = expandQuery(raw, { hybridSearch: config.hybridSearch });
  // For global search keep some of the user's words; hybrid q is already
  // keyword+synonym sized when hybridSearch is on.
  const query = config.hybridSearch && expanded.expanded.length ? expanded.q : raw;
  const isolation = {
    ...(userId ? { user_id: userId } : {}),
  };
  const codeFilters = {
    ...isolation,
    ...(projectId ? { project_id: projectId } : {}),
  };
  const promptFilters = {
    ...isolation,
    ...(projectId ? { project_id: projectId } : {}),
  };

  try {
    const response = await svc.multiSearch(config, [
      {
        collection: svc.SCHEMAS.code_chunks.name,
        q: query,
        query_by: "symbols,file_name,file_path,content",
        query_by_weights: "6,5,5,1",
        filters: codeFilters,
        per_page: limitPerGroup * 3,
        highlight_full_fields: "content,symbols",
      },
      {
        collection: svc.SCHEMAS.prompt_runs.name,
        q: query,
        query_by: "original_prompt,optimized_prompt,relevant_files",
        query_by_weights: "5,3,2",
        filters: promptFilters,
        per_page: limitPerGroup,
      },
      {
        collection: svc.SCHEMAS.usage_sessions.name,
        q: query,
        query_by: "search_text,project,models,labels,tool",
        query_by_weights: "5,4,3,3,2",
        filters: isolation,
        per_page: limitPerGroup,
      },
    ]);

    const mapped = mapMultiSearchResults(response, { limitPerGroup });
    return {
      ...mapped,
      hybrid: expanded.hybrid && expanded.expanded.length > 0,
      expandedTerms: expanded.expanded,
      source: "typesense",
      query,
    };
  } catch {
    return { ...empty, source: "error" };
  }
}

module.exports = {
  mapMultiSearchResults,
  globalSearch,
};
