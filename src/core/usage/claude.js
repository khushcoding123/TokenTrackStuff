// Claude Code local-log importer.
//
// Claude Code writes one JSONL file per session under
//   ~/.config/claude/projects/<encoded-project>/<sessionId>.jsonl  (v1.0.30+)
//   ~/.claude/projects/<encoded-project>/<sessionId>.jsonl          (legacy)
// Each assistant line carries message.model, timestamp and message.usage with
// the full token breakdown. Retries can write the same API response twice, so
// entries are deduped by message.id + requestId.
//
// Zero dependencies: plain fs walking + line-by-line JSON parsing.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

/**
 * Directories that may contain Claude Code project logs.
 * CLAUDE_CONFIG_DIR (colon-separated) overrides the defaults, matching
 * Claude Code's own resolution order.
 */
export function getClaudeDirs(env = process.env) {
  const dirs = [];
  if (env.CLAUDE_CONFIG_DIR) {
    for (const base of env.CLAUDE_CONFIG_DIR.split(":")) {
      if (base.trim()) dirs.push(join(base.trim(), "projects"));
    }
  } else {
    dirs.push(join(homedir(), ".config", "claude", "projects"));
    dirs.push(join(homedir(), ".claude", "projects"));
  }
  return dirs.filter((d) => existsSync(d));
}

// The project dir name is the project path with separators flattened to "-".
// That mapping is lossy, so we just present it as a readable label.
function projectLabel(dirName) {
  const cleaned = dirName.replace(/^-+/, "");
  const parts = cleaned.split("-").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : dirName;
}

// Pull the human-typed text out of a user message's content, which is either
// a plain string or an array of typed blocks. Tool results, command output
// and slash-command noise are not prompts, so they return "".
function extractUserText(content) {
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((block) => block && block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n");
  }
  text = text.trim();
  // Skip system-generated user entries: interrupts, command wrappers, etc.
  if (!text || text.startsWith("<") || text.startsWith("Caveat:")) return "";
  return text;
}

/**
 * Parse one session JSONL file into normalized usage records.
 * @param {string} filePath absolute path to <sessionId>.jsonl
 * @param {string} project readable project label
 * @param {Set<string>} seen cross-file dedupe set (message.id:requestId)
 */
function parseSessionFile(filePath, project, seen) {
  const sessionId = filePath.split(/[\\/]/).pop().replace(/\.jsonl$/, "");
  const records = [];
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return records; // unreadable file: skip, never throw
  }

  // The user prompt that started the turn currently being parsed; every
  // assistant record that follows is attributed to it (for the intent /
  // waste breakdowns on the dashboard).
  let currentPrompt = null;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // partial/corrupt line (e.g. mid-write)
    }

    const message = entry.message;

    // Real user prompts start a new turn. Skip meta entries and tool
    // results (arrays whose blocks are tool_result, not typed text).
    if (entry.type === "user" && message && message.role === "user" && !entry.isMeta) {
      const text_ = extractUserText(message.content);
      if (text_) currentPrompt = text_.slice(0, 500);
      continue;
    }

    const usage = message && message.usage;
    if (!usage || !entry.timestamp) continue;

    // Synthetic entries (API error placeholders) carry no real usage.
    if (message.model === "<synthetic>") continue;

    // Dedupe retried responses: same message id + request id.
    if (message.id && entry.requestId) {
      const key = `${message.id}:${entry.requestId}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }

    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    const cacheCreate = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    if (input + output + cacheCreate + cacheRead === 0) continue;

    records.push({
      source: "claude-code",
      sessionId,
      project,
      timestamp: entry.timestamp,
      model: message.model || "unknown",
      inputTokens: input,
      outputTokens: output,
      cacheCreationTokens: cacheCreate,
      cacheReadTokens: cacheRead,
      prompt: currentPrompt,
    });
  }
  return records;
}

/**
 * Load all Claude Code usage records from local logs.
 * @param {object} [options]
 * @param {string[]} [options.dirs] override data dirs (for tests)
 * @param {Date}     [options.since] skip files not modified since this date
 * @returns {Array<object>} normalized usage records
 */
export function loadClaudeRecords(options = {}) {
  const dirs = options.dirs || getClaudeDirs();
  const since = options.since ? options.since.getTime() : 0;
  const seen = new Set();
  const records = [];

  for (const dir of dirs) {
    let projects;
    try {
      projects = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const proj of projects) {
      if (!proj.isDirectory()) continue;
      const projDir = join(dir, proj.name);
      const label = projectLabel(proj.name);
      let files;
      try {
        files = readdirSync(projDir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const filePath = join(projDir, file);
        if (since) {
          // mtime pre-filter keeps rescans cheap for old sessions.
          try {
            if (statSync(filePath).mtimeMs < since) continue;
          } catch {
            continue;
          }
        }
        records.push(...parseSessionFile(filePath, label, seen));
      }
    }
  }
  return records;
}
