// Phase 3 — Typesense-powered prompt file discovery.
//
// Before Metriq rewrites a prompt, search the project's indexed code chunks for
// the files/symbols the prompt is really about, and hand them to the EXISTING
// analyzer/rewrite engine as its `projectContext` input (packages/core is not
// modified — see rewrite.js#buildFocusedPrompt, which already accepts
// { files, confidence, subsystem, candidates }).
//
// Discovery order the caller enforces (rules 5 + 6):
//   1. Typesense project-context search (this module)
//   2. existing scanner findRelevantFiles / scanProjectContext fallback
//   3. existing normal rewrite behavior
//
// symbols and file paths are weighted above raw content, and every query is
// isolated by project_id (+ user_id). The pure hitsToContext() mapper is
// unit-tested without a server.

const svc = require("./typesense-service");
const { keywordsFromPrompt } = require("../../packages/core/scanner.js");
const { expandQuery } = require("./hybrid-query");

const COLLECTION = svc.SCHEMAS.code_chunks.name;
const DEFAULT_LIMIT = 4;

// Derive a coarse "subsystem" label from a file path, skipping generic
// container dirs — mirrors the scanner's own subsystem heuristic so the
// rewrite reads consistently whichever discovery path produced it.
const GENERIC_DIRS = new Set([
  "src", "app", "lib", "components", "pages", "routes", "api", "server",
  "client", "shared", "utils", "helpers", "common", "index", "desktop",
  "renderer", "core", "packages",
]);

function subsystemFromPath(filePath) {
  const tokens = String(filePath)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !GENERIC_DIRS.has(t));
  return tokens[0] || "";
}

// Pure: turn a Typesense (grouped) search response into the projectContext
// shape rewrite.js expects, plus richer `matches` for the "Why these files?"
// UI. Handles both grouped_hits (group_by=file_path) and flat hits.
function hitsToContext(response, limit = DEFAULT_LIMIT) {
  const groups = response?.grouped_hits;
  const flat = response?.hits;
  const topHitPerFile = [];

  if (Array.isArray(groups)) {
    for (const g of groups) {
      if (g.hits && g.hits[0]) topHitPerFile.push(g.hits[0]);
    }
  } else if (Array.isArray(flat)) {
    const seen = new Set();
    for (const h of flat) {
      const fp = h.document?.file_path;
      if (!fp || seen.has(fp)) continue;
      seen.add(fp);
      topHitPerFile.push(h);
    }
  }

  const matches = topHitPerFile.slice(0, limit).map((hit) => {
    const doc = hit.document || {};
    const highlights = hit.highlights || [];
    const matchedFields = highlights.map((h) => h.field);
    // Best snippet: prefer a content highlight, else file_path.
    const contentHl = highlights.find((h) => h.field === "content");
    const snippet = contentHl?.snippet || null;
    // Matched symbol: a highlight on the symbols field, if any.
    const symbolHl = highlights.find((h) => h.field === "symbols");
    const matchedSymbol =
      (symbolHl && (symbolHl.matched_tokens?.[0] || null)) ||
      (Array.isArray(doc.symbols) && matchedFields.includes("symbols") ? doc.symbols[0] : null);

    const reasons = [];
    if (matchedFields.includes("file_name")) reasons.push(`filename matches "${doc.file_name}"`);
    if (matchedFields.includes("symbols") && matchedSymbol) reasons.push(`defines "${matchedSymbol}"`);
    if (matchedFields.includes("file_path")) reasons.push("path is relevant");
    if (matchedFields.includes("content")) reasons.push("code mentions the terms");
    if (!reasons.length) reasons.push("relevant to the prompt");

    return {
      file: doc.file_path,
      symbol: matchedSymbol,
      snippet,
      score: hit.text_match || 0,
      matchedFields,
      reasons: reasons.slice(0, 2),
    };
  });

  const files = matches.map((m) => m.file).filter(Boolean);
  // Confidence: a strong filename/symbol hit is "high"; any hit is at least
  // "medium"; no hits "low" (caller then falls back to the scanner).
  let confidence = "low";
  if (matches.length) {
    const strong = matches[0].matchedFields.some((f) => f === "file_name" || f === "symbols");
    confidence = strong ? "high" : "medium";
  }
  const subsystem = confidence === "low" ? "" : subsystemFromPath(files[0] || "");

  return {
    projectContext: {
      files: confidence === "low" ? [] : files,
      candidates: matches.map((m) => ({
        file: m.file,
        score: m.score,
        reasons: m.reasons,
        subsystem: subsystemFromPath(m.file || ""),
        matchedKeywords: [],
      })),
      confidence,
      subsystem,
    },
    matches,
  };
}

/**
 * Search the indexed project for files relevant to a prompt. Returns null when
 * Typesense is disabled/unreachable or nothing is indexed, so the caller falls
 * back to the offline scanner. Never throws into the analyze path.
 *
 * @returns {Promise<null | { projectContext, matches, source:'typesense' }>}
 */
async function findRelevantFiles({ config = svc.getConfig(), userId, projectId, prompt, limit = DEFAULT_LIMIT }) {
  if (!projectId) return null;
  const health = await svc.health(config);
  if (!health.ok) return null;

  const keywords = keywordsFromPrompt(prompt);
  const baseQ = keywords.length ? keywords.join(" ") : String(prompt || "").trim();
  if (!baseQ) return null;

  // Phase 7: optional conceptual expansion when hybridSearch is enabled.
  // Uses keyword tokens + synonyms (not the full sentence) for ranking.
  const expanded = expandQuery(String(prompt || ""), {
    hybridSearch: config.hybridSearch,
    keywords,
  });
  const q = config.hybridSearch && expanded.expanded.length ? expanded.q : baseQ;

  try {
    // Dedupe by file_path in hitsToContext rather than group_by — older
    // collections may not have file_path as a facet (Typesense 400s otherwise).
    // Prefer path/name/symbol hits; when hybrid, search those first so synonym
    // matches on directories (e.g. src/core/usage/) beat incidental content hits
    // in files that merely list the synonym strings.
    const filters = { project_id: projectId, ...(userId ? { user_id: userId } : {}) };
    const common = {
      q,
      filters,
      per_page: Math.max(limit * 6, 24),
      highlight_full_fields: "content,file_path,symbols",
      highlight_affix_num_tokens: 8,
    };
    let response = await svc.search(config, COLLECTION, {
      ...common,
      query_by: "symbols,file_name,file_path,directory",
      query_by_weights: "6,5,5,4",
    });
    let found = (response.hits || []).length;
    if (found < limit) {
      const contentRes = await svc.search(config, COLLECTION, {
        ...common,
        query_by: "symbols,file_name,file_path,content",
        query_by_weights: "6,5,5,1",
      });
      const seen = new Set((response.hits || []).map((h) => h.document?.file_path));
      const merged = [...(response.hits || [])];
      for (const h of contentRes.hits || []) {
        const fp = h.document?.file_path;
        if (!fp || seen.has(fp)) continue;
        seen.add(fp);
        merged.push(h);
      }
      response = { ...contentRes, hits: merged };
      found = merged.length;
    }
    if (!found) return null;
    const { projectContext, matches } = hitsToContext(response, limit);
    if (!projectContext.files.length) return null;
    return {
      projectContext,
      matches,
      source: "typesense",
      hybrid: Boolean(expanded.hybrid && expanded.expanded.length),
      expandedTerms: expanded.expanded,
    };
  } catch {
    return null; // any failure -> scanner fallback
  }
}

module.exports = {
  hitsToContext,
  subsystemFromPath,
  findRelevantFiles,
  COLLECTION,
};
