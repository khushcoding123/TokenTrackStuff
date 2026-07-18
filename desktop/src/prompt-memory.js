// Phase 4 — searchable prompt memory (metriq_prompt_runs).
//
// After each completed analysis we upsert a document so Prompt Studio can
// surface "Similar previous tasks." Pure helpers (buildRunDoc / runsToSimilar)
// are unit-tested without a server; network ops degrade gracefully like the
// rest of the Typesense layer.

const crypto = require("node:crypto");
const svc = require("./typesense-service");

const COLLECTION = svc.SCHEMAS.prompt_runs.name;

// Stable id from user + project + prompt text so debounced re-analysis of the
// same prompt upserts one document instead of flooding the collection.
function runId(userId, projectId, originalPrompt) {
  const normalized = String(originalPrompt || "").trim().replace(/\s+/g, " ").toLowerCase();
  return crypto
    .createHash("sha1")
    .update(`${userId || ""}|${projectId || ""}|${normalized}`)
    .digest("hex")
    .slice(0, 24);
}

function buildRunDoc({
  userId,
  projectId,
  originalPrompt,
  optimizedPrompt,
  tool,
  breadthScore,
  projectedTokens,
  estimatedTokensSaved,
  relevantFiles,
  used,
  timestamp,
}) {
  const ts = timestamp || Date.now();
  const original = String(originalPrompt || "");
  return {
    id: runId(userId, projectId, original),
    user_id: userId || "local",
    project_id: projectId || "none",
    original_prompt: original,
    optimized_prompt: String(optimizedPrompt || ""),
    tool: tool || undefined,
    breadth_score: Number(breadthScore) || 0,
    projected_tokens: Math.round(Number(projectedTokens) || 0),
    estimated_tokens_saved: Math.round(Number(estimatedTokensSaved) || 0),
    relevant_files: Array.isArray(relevantFiles) ? relevantFiles.slice(0, 20) : [],
    used: Boolean(used),
    timestamp: ts,
  };
}

// Pure: map a Typesense search response into the UI-facing "similar" shape.
function runsToSimilar(response, limit = 5) {
  const hits = Array.isArray(response?.hits) ? response.hits : [];
  return hits.slice(0, limit).map((hit) => {
    const doc = hit.document || {};
    return {
      id: doc.id,
      originalPrompt: doc.original_prompt || "",
      optimizedPrompt: doc.optimized_prompt || "",
      estimatedTokensSaved: doc.estimated_tokens_saved || 0,
      projectedTokens: doc.projected_tokens || 0,
      breadthScore: doc.breadth_score || 0,
      relevantFiles: Array.isArray(doc.relevant_files) ? doc.relevant_files : [],
      tool: doc.tool || null,
      used: Boolean(doc.used),
      timestamp: doc.timestamp || 0,
      score: hit.text_match || 0,
    };
  });
}

/**
 * Index one completed analysis. Never throws into the analyze path.
 * @returns {Promise<{ok:boolean, id?:string, disabled?:boolean, error?:string}>}
 */
async function indexPromptRun(args) {
  const original = String(args.originalPrompt || "").trim();
  if (original.length < 12) {
    return { ok: false, error: "prompt too short" };
  }
  const config = args.config || svc.getConfig();
  const health = await svc.health(config);
  if (!health.ok) {
    return { ok: false, disabled: health.disabled, error: health.error || "Typesense unavailable" };
  }
  try {
    await svc.ensureAllCollections(config);
    const doc = buildRunDoc(args);
    await svc.upsertDocument(config, COLLECTION, doc);
    return { ok: true, id: doc.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Mark a prompt run as used (user copied / applied the rewrite).
 */
async function markUsed(id, config = svc.getConfig()) {
  if (!id) return { ok: false };
  const health = await svc.health(config);
  if (!health.ok) return { ok: false, disabled: health.disabled };
  try {
    await svc.updateDocument(config, COLLECTION, id, { used: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Find similar previous prompt runs for the active project.
 * @returns {Promise<Array>} empty on any failure
 */
async function findSimilar({
  config = svc.getConfig(),
  userId,
  projectId,
  prompt,
  limit = 5,
} = {}) {
  if (!prompt || !String(prompt).trim()) return [];
  const health = await svc.health(config);
  if (!health.ok) return [];

  try {
    const response = await svc.search(config, COLLECTION, {
      q: String(prompt).trim(),
      query_by: "original_prompt,optimized_prompt,relevant_files",
      query_by_weights: "5,3,2",
      filters: {
        ...(projectId ? { project_id: projectId } : {}),
        ...(userId ? { user_id: userId } : {}),
      },
      per_page: limit,
      sort_by: "_text_match:desc,timestamp:desc",
    });
    return runsToSimilar(response, limit);
  } catch {
    return [];
  }
}

module.exports = {
  COLLECTION,
  runId,
  buildRunDoc,
  runsToSimilar,
  indexPromptRun,
  markUsed,
  findSimilar,
};
