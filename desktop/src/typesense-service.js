// Typesense adapter for the Electron main process.
//
// Hand-rolled over native `fetch` (same reasoning as insforge-client.js): the
// app needs health / ensure-collections / import / upsert / delete / search
// against a few collections, Electron's Node runtime has fetch, and the
// renderer's CSP (`default-src 'self'`) can't reach a Typesense host anyway —
// so ALL Typesense I/O lives here in main, behind IPC. No `typesense-js`
// dependency, keeping the desktop app's install lean and the network surface
// auditable in one file.
//
// Design guarantees:
//   * Typesense is a SEARCH INDEX, never the source of truth — the local agent
//     logs and the on-disk project files remain authoritative. Reindexing is
//     always a safe upsert-rebuild.
//   * Every network op degrades gracefully: if the mode is "off", the server
//     is unreachable, or config is missing, calls resolve to a benign result
//     ({ ok:false, ... }) instead of throwing — so normal Metriq prompt
//     analysis (Phase 3 fallback) never breaks because Typesense is down.
//   * The admin API key is resolved and held HERE only. It is never returned
//     through any function that feeds IPC/preload/the renderer.
//
// The pure helpers at the top (resolveConfig / buildFilterBy / buildSearchQs /
// the schema definitions) touch neither the network nor Electron, so they're
// unit-tested directly (test/typesense-service.test.js).

// ---------------------------------------------------------------------------
// Collection schemas
// ---------------------------------------------------------------------------

// Project source-code chunks. `content` is the searchable text; symbols /
// file_name / file_path are the high-signal fields Phase 3 weights above raw
// content. user_id + project_id are the isolation keys every query filters on.
// An `embedding` field is intentionally omitted until Phase 7 (hybrid search).
const CODE_CHUNKS_SCHEMA = {
  name: "metriq_code_chunks",
  fields: [
    { name: "user_id", type: "string", facet: true },
    { name: "project_id", type: "string", facet: true },
    // file_path is faceted so group_by=file_path works in Typesense searches.
    { name: "file_path", type: "string", facet: true },
    { name: "file_name", type: "string", facet: true },
    { name: "extension", type: "string", facet: true },
    { name: "directory", type: "string", facet: true },
    { name: "symbols", type: "string[]", facet: true, optional: true },
    { name: "content", type: "string" },
    { name: "chunk_number", type: "int32" },
    { name: "content_hash", type: "string" },
    { name: "modified_at", type: "int64" },
    { name: "indexed_at", type: "int64" },
  ],
  default_sorting_field: "modified_at",
};

// One row per completed prompt analysis — the searchable "prompt memory"
// behind Phase 4's "Similar previous tasks".
const PROMPT_RUNS_SCHEMA = {
  name: "metriq_prompt_runs",
  fields: [
    { name: "user_id", type: "string", facet: true },
    { name: "project_id", type: "string", facet: true },
    { name: "original_prompt", type: "string" },
    { name: "optimized_prompt", type: "string" },
    { name: "tool", type: "string", facet: true, optional: true },
    { name: "breadth_score", type: "float" },
    { name: "projected_tokens", type: "int64" },
    { name: "estimated_tokens_saved", type: "int64" },
    { name: "relevant_files", type: "string[]", optional: true },
    { name: "used", type: "bool", optional: true },
    { name: "timestamp", type: "int64" },
  ],
  default_sorting_field: "timestamp",
};

// Normalized Claude Code / Codex / Cursor usage sessions (Phase 5). Discovery
// only — the deterministic aggregate() pipeline remains the source of truth.
const USAGE_SESSIONS_SCHEMA = {
  name: "metriq_usage_sessions",
  fields: [
    { name: "user_id", type: "string", facet: true },
    { name: "project_id", type: "string", facet: true, optional: true },
    { name: "session_id", type: "string" },
    { name: "project", type: "string", facet: true, optional: true },
    { name: "tool", type: "string", facet: true },
    { name: "models", type: "string[]", facet: true, optional: true },
    { name: "search_text", type: "string" },
    { name: "labels", type: "string[]", facet: true, optional: true },
    { name: "input_tokens", type: "int64" },
    { name: "output_tokens", type: "int64" },
    { name: "cache_read_tokens", type: "int64" },
    { name: "total_tokens", type: "int64" },
    { name: "cost_usd", type: "float" },
    { name: "cache_hit_rate", type: "float" },
    { name: "requests", type: "int32" },
    { name: "started_at", type: "int64" },
    { name: "ended_at", type: "int64" },
    { name: "indexed_at", type: "int64" },
  ],
  default_sorting_field: "started_at",
};

const SCHEMAS = {
  code_chunks: CODE_CHUNKS_SCHEMA,
  prompt_runs: PROMPT_RUNS_SCHEMA,
  usage_sessions: USAGE_SESSIONS_SCHEMA,
};

const DEFAULTS = {
  mode: "local", // off | local | cloud — local is the recommended full-code mode
  protocol: "http",
  host: "localhost",
  port: "8108",
  apiKey: "metriq-local",
};

const HEALTH_TIMEOUT_MS = 1500;
const OP_TIMEOUT_MS = 20000;
// Cache health results briefly so a down server doesn't add ~1.5s to every
// debounced Prompt Studio keystroke. Cleared implicitly when baseUrl/key change.
let healthCache = { key: "", at: 0, result: null };
const HEALTH_CACHE_MS = 4000;

// ---------------------------------------------------------------------------
// Pure config / query helpers (unit-tested)
// ---------------------------------------------------------------------------

// Merge env vars, saved prefs, and defaults into one resolved config. Env wins
// over prefs wins over defaults, per field. `prefs.apiKey` is expected to be
// already-decrypted by the caller (getConfig does the safeStorage read); this
// stays pure so it's testable. Never logs or returns the key anywhere except
// the returned object, which stays inside main.
function resolveConfig(env = {}, prefs = {}) {
  const pick = (envKey, prefsKey, def) => {
    const e = env[envKey];
    if (e !== undefined && e !== null && e !== "") return String(e);
    const p = prefs[prefsKey];
    if (p !== undefined && p !== null && p !== "") return String(p);
    return def;
  };
  const mode = pick("TYPESENSE_MODE", "mode", DEFAULTS.mode);
  const protocol = pick("TYPESENSE_PROTOCOL", "protocol", DEFAULTS.protocol);
  const host = pick("TYPESENSE_HOST", "host", DEFAULTS.host);
  const port = pick("TYPESENSE_PORT", "port", DEFAULTS.port);
  const apiKey = pick("TYPESENSE_API_KEY", "apiKey", DEFAULTS.apiKey);
  const hybridRaw = pick("TYPESENSE_HYBRID", "hybridSearch", "");
  const hybridSearch =
    hybridRaw === "1" ||
    hybridRaw === "true" ||
    prefs.hybridSearch === true;

  return {
    mode: ["off", "local", "cloud"].includes(mode) ? mode : DEFAULTS.mode,
    protocol,
    host,
    port,
    apiKey,
    baseUrl: `${protocol}://${host}:${port}`.replace(/\/+$/, ""),
    enabled: mode !== "off",
    // Cloud mode indexes source-code `content` only after explicit consent;
    // this flag is surfaced so callers can enforce metadata-only indexing.
    indexesCode: mode === "local" || (mode === "cloud" && prefs.cloudCodeConsent === true),
    // Phase 7: conceptual keyword expansion (not vector embeddings yet).
    hybridSearch,
  };
}

// Append numeric/date range clauses Typesense understands, e.g.
// { input_tokens: { gte: 50000 } } → "input_tokens:>=50000".
function buildRangeFilter(ranges = {}) {
  const clauses = [];
  for (const [field, spec] of Object.entries(ranges)) {
    if (!spec || typeof spec !== "object") continue;
    if (spec.gte !== undefined && spec.gte !== null && spec.gte !== "") {
      clauses.push(`${field}:>=${Number(spec.gte)}`);
    }
    if (spec.lte !== undefined && spec.lte !== null && spec.lte !== "") {
      clauses.push(`${field}:<=${Number(spec.lte)}`);
    }
    if (spec.gt !== undefined && spec.gt !== null && spec.gt !== "") {
      clauses.push(`${field}:>${Number(spec.gt)}`);
    }
    if (spec.lt !== undefined && spec.lt !== null && spec.lt !== "") {
      clauses.push(`${field}:<${Number(spec.lt)}`);
    }
  }
  return clauses.join(" && ");
}

// Turn a { field: value } object into a Typesense `filter_by` clause. Skips
// empty / "all" values. Backtick-wraps values so paths / ids with spaces or
// punctuation parse correctly. Array values become `field:=[a,b]`.
function buildFilterBy(filters = {}) {
  const clauses = [];
  for (const [field, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      const list = value.map((v) => `\`${String(v).replace(/`/g, "")}\``).join(", ");
      clauses.push(`${field}:=[${list}]`);
    } else {
      clauses.push(`${field}:=\`${String(value).replace(/`/g, "")}\``);
    }
  }
  return clauses.join(" && ");
}

// Build a documents/search query string from a params object. `filters` is
// lifted into filter_by; `ranges` add numeric comparisons; an explicit
// `filter_by` string (if provided) is AND-merged last.
function buildSearchQs(params = {}) {
  const { filters, ranges, filter_by: extraFilter, ...rest } = params;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null) continue;
    qs.set(k, String(v));
  }
  const parts = [buildFilterBy(filters), buildRangeFilter(ranges), extraFilter].filter(Boolean);
  if (parts.length) qs.set("filter_by", parts.join(" && "));
  return qs.toString();
}

// ---------------------------------------------------------------------------
// Config accessor (reads Electron prefs + safeStorage; kept out of the pure
// section so unit tests don't need Electron)
// ---------------------------------------------------------------------------

// Lazy so `require("./typesense-service")` works under plain `node --test`.
function readPrefsConfig() {
  try {
    const { loadPrefs } = require("./prefs");
    const prefs = loadPrefs() || {};
    const ts = prefs.typesense || {};
    // Decrypt the stored API key, if any, via the same safeStorage path
    // auth-store uses. The decrypted key never leaves main.
    let apiKey = ts.apiKey;
    if (ts.apiKeyEnc) {
      try {
        const { safeStorage } = require("electron");
        if (safeStorage.isEncryptionAvailable()) {
          apiKey = safeStorage.decryptString(Buffer.from(ts.apiKeyEnc, "base64"));
        }
      } catch {
        /* fall through to whatever plaintext/default applies */
      }
    }
    return { ...ts, apiKey };
  } catch {
    return {};
  }
}

function getConfig() {
  return resolveConfig(process.env, readPrefsConfig());
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

async function request(config, method, pathAndQuery, { body, jsonl, timeoutMs } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || OP_TIMEOUT_MS);
  try {
    const headers = { "X-TYPESENSE-API-KEY": config.apiKey };
    if (body !== undefined) headers["Content-Type"] = jsonl ? "text/plain" : "application/json";
    const res = await fetch(`${config.baseUrl}${pathAndQuery}`, {
      method,
      headers,
      body: body === undefined ? undefined : jsonl ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      const err = new Error(`Typesense ${method} ${pathAndQuery} failed (${res.status})`);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    // Import responses are JSONL, not JSON — callers pass jsonl:true to opt out
    // of parsing and handle the raw text themselves.
    if (jsonl) return text;
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Operations (all graceful — never throw into the analyze path)
// ---------------------------------------------------------------------------

// Reachability + mode check. Returns { ok, disabled?, error? }. Fast timeout so
// a down server doesn't stall the UI. Results are cached briefly (see
// HEALTH_CACHE_MS) so repeated analyze calls while Typesense is down stay snappy.
async function health(config = getConfig()) {
  if (!config.enabled) return { ok: false, disabled: true };
  const key = `${config.baseUrl}|${config.apiKey || ""}`;
  const now = Date.now();
  if (healthCache.key === key && now - healthCache.at < HEALTH_CACHE_MS && healthCache.result) {
    return healthCache.result;
  }
  let result;
  try {
    const res = await request(config, "GET", "/health", { timeoutMs: HEALTH_TIMEOUT_MS });
    result = { ok: Boolean(res && res.ok) };
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  healthCache = { key, at: now, result };
  return result;
}

async function ensureCollection(config, schema) {
  try {
    await request(config, "POST", "/collections", { body: schema });
    return { created: true };
  } catch (err) {
    if (err.status === 409) return { created: false, existed: true };
    throw err;
  }
}

async function ensureAllCollections(config = getConfig()) {
  for (const schema of Object.values(SCHEMAS)) {
    await ensureCollection(config, schema);
  }
}

async function collectionInfo(config, name) {
  try {
    return await request(config, "GET", `/collections/${name}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function documentCount(config, name) {
  const info = await collectionInfo(config, name);
  return info?.num_documents ?? 0;
}

// Batch upsert. Typesense's import endpoint takes JSONL and replies JSONL
// (one result line per doc). Returns { imported, failed }.
async function importDocuments(config, name, docs, action = "upsert") {
  if (!docs.length) return { imported: 0, failed: 0 };
  const jsonl = docs.map((d) => JSON.stringify(d)).join("\n");
  const text = await request(
    config,
    "POST",
    `/collections/${name}/documents/import?action=${action}`,
    { body: jsonl, jsonl: true }
  );
  let imported = 0;
  let failed = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      if (JSON.parse(line).success) imported += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { imported, failed };
}

async function upsertDocument(config, name, doc) {
  return request(config, "POST", `/collections/${name}/documents?action=upsert`, { body: doc });
}

// Partial update of a single document by id (e.g. flipping `used` to true).
// Tolerates a 404 (document not indexed yet) by returning null.
async function updateDocument(config, name, id, patch) {
  try {
    return await request(config, "PATCH", `/collections/${name}/documents/${encodeURIComponent(id)}`, { body: patch });
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Delete every document matching a filter (e.g. a removed file's chunks, or a
// whole project on unlink). filterBy is a raw Typesense filter clause.
async function deleteByFilter(config, name, filterBy) {
  const qs = new URLSearchParams({ filter_by: filterBy }).toString();
  try {
    return await request(config, "DELETE", `/collections/${name}/documents?${qs}`);
  } catch (err) {
    if (err.status === 404) return { num_deleted: 0 };
    throw err;
  }
}

async function search(config, name, params) {
  const qs = buildSearchQs(params);
  return request(config, "GET", `/collections/${name}/documents/search?${qs}`);
}

// Federated search across collections in one round-trip (Phase 6 global
// search). `searches` is an array of { collection, ...params }.
async function multiSearch(config, searches) {
  const body = {
    searches: searches.map(({ collection, filters, ranges, filter_by: extraFilter, ...rest }) => {
      const entry = { collection, ...rest };
      const parts = [buildFilterBy(filters), buildRangeFilter(ranges), extraFilter].filter(Boolean);
      if (parts.length) entry.filter_by = parts.join(" && ");
      return entry;
    }),
  };
  return request(config, "POST", "/multi_search", { body });
}

async function dropCollection(config, name) {
  try {
    return await request(config, "DELETE", `/collections/${name}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

module.exports = {
  // pure helpers (exported for tests)
  resolveConfig,
  buildFilterBy,
  buildRangeFilter,
  buildSearchQs,
  SCHEMAS,
  DEFAULTS,
  // config
  getConfig,
  // ops
  health,
  ensureCollection,
  ensureAllCollections,
  collectionInfo,
  documentCount,
  importDocuments,
  upsertDocument,
  updateDocument,
  deleteByFilter,
  search,
  multiSearch,
  dropCollection,
};
