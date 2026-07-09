// Codex CLI local-log importer.
//
// Codex writes one JSONL "rollout" file per session under
//   $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<stamp>-<uuid>.jsonl
// (CODEX_HOME defaults to ~/.codex). Relevant line types:
//   - session_meta:  payload.cwd → project, payload.session_id
//   - turn_context:  payload.model → model for subsequent turns
//   - event_msg with payload.type === "token_count":
//       payload.info.last_token_usage   → tokens for the request that just ran
//       payload.info.total_token_usage  → cumulative session totals
//       payload.rate_limits             → live 5h/weekly window utilization
//
// Note on cache semantics: Codex's cached_input_tokens is a *subset* of
// input_tokens (unlike Claude, where cache reads are reported separately),
// so normalized inputTokens = input - cached and cacheReadTokens = cached.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

export function getCodexSessionsDir(env = process.env) {
  const base = env.CODEX_HOME || join(homedir(), ".codex");
  const dir = join(base, "sessions");
  return existsSync(dir) ? dir : null;
}

// When early builds omitted turn_context model metadata, fall back to the
// model family so usage still shows up (pricing marked approximate).
const FALLBACK_MODEL = "gpt-5";

function usageFromInfo(u) {
  const rawInput = u.input_tokens || 0;
  const cached = u.cached_input_tokens || 0;
  return {
    inputTokens: Math.max(0, rawInput - cached),
    outputTokens: u.output_tokens || 0,
    cacheCreationTokens: 0,
    cacheReadTokens: cached,
  };
}

function totalOf(u) {
  return (u.input_tokens || 0) + (u.output_tokens || 0);
}

/**
 * Parse one rollout file.
 * @returns {{ records: Array<object>, rateLimits: object|null }}
 */
function parseRolloutFile(filePath) {
  const records = [];
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return { records, rateLimits: null };
  }

  let sessionId = filePath.split(/[\\/]/).pop().replace(/\.jsonl$/, "");
  let project = "unknown";
  let model = null;
  let modelIsFallback = true;
  let prevTotal = 0;
  let rateLimits = null;
  // The user prompt that started the turn currently in flight; each
  // token_count that follows is attributed to it (intent/waste breakdowns).
  let currentPrompt = null;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const payload = entry.payload || {};

    if (entry.type === "session_meta") {
      if (payload.session_id) sessionId = payload.session_id;
      if (payload.cwd) {
        const parts = String(payload.cwd).replace(/\\/g, "/").split("/");
        project = parts.filter(Boolean).pop() || "unknown";
      }
      continue;
    }

    if (entry.type === "turn_context") {
      if (payload.model) {
        model = payload.model;
        modelIsFallback = false;
      }
      continue;
    }

    if (entry.type === "event_msg" && payload.type === "user_message") {
      const text_ = typeof payload.message === "string" ? payload.message.trim() : "";
      // Skip injected context blocks (environment/system wrappers), keep
      // genuinely typed prompts.
      if (text_ && !text_.startsWith("<") && !text_.startsWith("#")) {
        currentPrompt = text_.slice(0, 500);
      }
      continue;
    }

    if (entry.type !== "event_msg" || payload.type !== "token_count") continue;
    const info = payload.info;
    if (payload.rate_limits) {
      rateLimits = { ...payload.rate_limits, observedAt: entry.timestamp };
    }
    if (!info || !entry.timestamp) continue;

    // Prefer the per-request usage; fall back to the cumulative delta for
    // older logs that only carried total_token_usage.
    let usage = null;
    if (info.last_token_usage) {
      usage = usageFromInfo(info.last_token_usage);
    } else if (info.total_token_usage) {
      const total = totalOf(info.total_token_usage);
      if (total > prevTotal) {
        const scale = (total - prevTotal) / Math.max(total, 1);
        const full = usageFromInfo(info.total_token_usage);
        usage = {
          inputTokens: Math.round(full.inputTokens * scale),
          outputTokens: Math.round(full.outputTokens * scale),
          cacheCreationTokens: 0,
          cacheReadTokens: Math.round(full.cacheReadTokens * scale),
        };
      }
    }
    if (info.total_token_usage) prevTotal = totalOf(info.total_token_usage);
    if (!usage) continue;

    const totalTokens =
      usage.inputTokens + usage.outputTokens + usage.cacheReadTokens;
    if (totalTokens === 0) continue;

    records.push({
      source: "codex",
      sessionId,
      project,
      timestamp: entry.timestamp,
      model: model || FALLBACK_MODEL,
      modelIsFallback: model ? undefined : true,
      prompt: currentPrompt,
      ...usage,
    });
  }

  return { records, rateLimits };
}

/**
 * Load all Codex usage records (plus the latest rate-limit snapshot) from
 * local rollout logs.
 * @param {object} [options]
 * @param {string} [options.dir] override sessions dir (for tests)
 * @param {Date}   [options.since] skip files not modified since this date
 * @returns {{ records: Array<object>, rateLimits: object|null }}
 */
export function loadCodexUsage(options = {}) {
  const root = options.dir !== undefined ? options.dir : getCodexSessionsDir();
  const since = options.since ? options.since.getTime() : 0;
  const records = [];
  let rateLimits = null;

  if (!root || !existsSync(root)) return { records, rateLimits };

  // sessions/YYYY/MM/DD/rollout-*.jsonl — walk depth-first, sorted so the
  // newest file's rate-limit snapshot wins.
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.name.startsWith("rollout-") && ent.name.endsWith(".jsonl")) {
        if (since) {
          try {
            if (statSync(full).mtimeMs < since) continue;
          } catch {
            continue;
          }
        }
        const parsed = parseRolloutFile(full);
        records.push(...parsed.records);
        if (
          parsed.rateLimits &&
          (!rateLimits ||
            new Date(parsed.rateLimits.observedAt) > new Date(rateLimits.observedAt))
        ) {
          rateLimits = parsed.rateLimits;
        }
      }
    }
  };
  walk(root);

  return { records, rateLimits };
}

/** Convenience wrapper matching loadClaudeRecords' shape. */
export function loadCodexRecords(options = {}) {
  return loadCodexUsage(options).records;
}
