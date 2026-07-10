// Cursor local-transcript importer.
//
// Cursor (IDE agent + CLI) writes one JSONL transcript per chat under
//   ~/.cursor/projects/<flattened-project-path>/agent-transcripts/<chatId>/<chatId>.jsonl
// Each line is { role: "user"|"assistant", message: { content: [blocks] } },
// optionally with a top-level timestamp and message.model / message.usage
// (the same usage shape Claude Code logs use).
//
// Two fidelity levels, per line:
//   1. When an assistant line carries message.usage, those token counts are
//      used as-is (billing-grade, like the Claude importer).
//   2. Otherwise — the common case today — transcripts have no token
//      telemetry, so counts are ESTIMATED from the message text with the
//      same offline estimator the CLI uses (packages/core/tokenizer.js) and
//      the record is flagged { estimated: true } so the dashboard can say so.
//      Trends and proportions are meaningful; exact counts are not.

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { estimateTokens } from "../../../packages/core/tokenizer.js";

export function getCursorProjectsDir(env = process.env) {
  const base = env.CURSOR_HOME || join(homedir(), ".cursor");
  const dir = join(base, "projects");
  return existsSync(dir) ? dir : null;
}

// "Users-dev-Code-my-app" → "app" (same lossy last-segment labeling the
// Claude importer uses; the flattening is not reversible).
function projectLabel(dirName) {
  const parts = dirName.split("-").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : dirName;
}

// User messages embed timestamps in either machine or human form:
//   <timestamp>2026-01-15T11:59:00.000Z</timestamp>
//   <timestamp>Tuesday, Jul 7, 2026, 1:20 PM (UTC-7)</timestamp>
const TAG_RE = /<timestamp>\s*([\s\S]*?)\s*<\/timestamp>/i;
const HUMAN_RE =
  /^\w+,\s*(\w{3})\w*\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(UTC([+-]\d{1,2})(?::(\d{2}))?\)$/i;

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseEmbeddedTimestamp(text) {
  const tag = TAG_RE.exec(text);
  if (!tag) return null;
  const inner = tag[1];

  const m = HUMAN_RE.exec(inner);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month == null) return null;
    let hour = parseInt(m[4], 10) % 12;
    if (m[6].toUpperCase() === "PM") hour += 12;
    const offsetH = parseInt(m[7], 10);
    const offsetM = (offsetH < 0 ? -1 : 1) * parseInt(m[8] || "0", 10);
    // Wall-clock at UTC+offset → UTC epoch.
    const utc = Date.UTC(parseInt(m[3], 10), month, parseInt(m[2], 10), hour, parseInt(m[5], 10));
    return new Date(utc - (offsetH * 60 + offsetM) * 60_000).toISOString();
  }

  const parsed = new Date(inner);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function textOfBlocks(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

// The human-typed prompt lives inside <user_query>…</user_query>; the rest of
// a user line is injected context (system reminders, attached files) that the
// user didn't write.
function extractPrompt(text) {
  const m = /<user_query>([\s\S]*?)<\/user_query>/i.exec(text);
  const raw = (m ? m[1] : text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, "")).trim();
  if (!raw || raw.startsWith("<")) return "";
  return raw;
}

/**
 * Parse one Cursor transcript into per-turn estimated usage records.
 * @param {string} filePath transcript .jsonl path
 * @param {string} project readable project label
 */
function parseTranscript(filePath, project) {
  let text;
  let mtimeIso;
  try {
    text = readFileSync(filePath, "utf8");
    mtimeIso = statSync(filePath).mtime.toISOString();
  } catch {
    return [];
  }
  const sessionId = filePath.split(/[\\/]/).pop().replace(/\.jsonl$/, "");

  const records = [];
  let turn = null;
  let lastTs = null;

  const flush = () => {
    if (!turn) return;
    const base = {
      source: "cursor",
      sessionId,
      project,
      timestamp: turn.timestamp || lastTs || mtimeIso,
      prompt: turn.prompt || null,
    };
    if (turn.usage) {
      // Real telemetry was present on this turn — use it verbatim.
      records.push({ ...base, ...turn.usage });
    } else if (turn.inputTokens + turn.outputTokens > 0) {
      records.push({
        ...base,
        model: "cursor-agent",
        // No model metadata → pricing is marked approximate.
        modelIsFallback: true,
        estimated: true,
        inputTokens: turn.inputTokens,
        outputTokens: turn.outputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      });
    }
    turn = null;
  };

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // partial/corrupt line
    }
    const message = entry.message || {};
    const blockText = textOfBlocks(message.content);

    if (entry.role === "user") {
      flush();
      const ts = parseEmbeddedTimestamp(blockText);
      if (ts) lastTs = ts;
      const prompt = extractPrompt(blockText);
      turn = {
        prompt: prompt ? prompt.slice(0, 500) : null,
        timestamp: ts,
        inputTokens: prompt ? estimateTokens(prompt) : 0,
        outputTokens: 0,
        usage: null,
      };
    } else if (entry.role === "assistant" && turn) {
      if (entry.timestamp) {
        lastTs = entry.timestamp;
        if (!turn.timestamp) turn.timestamp = entry.timestamp;
      }
      const usage = message.usage;
      if (usage) {
        // Same usage shape Claude Code logs use.
        if (!turn.usage) {
          turn.usage = {
            model: message.model || "cursor-agent",
            modelIsFallback: message.model ? undefined : true,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          };
        }
        turn.usage.inputTokens += usage.input_tokens || 0;
        turn.usage.outputTokens += usage.output_tokens || 0;
        turn.usage.cacheCreationTokens += usage.cache_creation_input_tokens || 0;
        turn.usage.cacheReadTokens += usage.cache_read_input_tokens || 0;
      } else {
        turn.outputTokens += estimateTokens(blockText);
      }
    }
  }
  flush();
  return records;
}

/**
 * Load all Cursor usage records (estimated) from local transcripts.
 * @param {object} [options]
 * @param {string} [options.dir] override projects dir (for tests)
 * @param {Date}   [options.since] skip files not modified since this date
 * @returns {Array<object>} normalized usage records
 */
export function loadCursorRecords(options = {}) {
  const root = options.dir !== undefined ? options.dir : getCursorProjectsDir();
  const since = options.since ? options.since.getTime() : 0;
  const records = [];
  if (!root || !existsSync(root)) return records;

  let projects;
  try {
    projects = readdirSync(root, { withFileTypes: true });
  } catch {
    return records;
  }
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const transcriptsDir = join(root, proj.name, "agent-transcripts");
    if (!existsSync(transcriptsDir)) continue;
    const label = projectLabel(proj.name);

    let chats;
    try {
      chats = readdirSync(transcriptsDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const chat of chats) {
      if (!chat.isDirectory()) continue;
      const chatDir = join(transcriptsDir, chat.name);
      let files;
      try {
        files = readdirSync(chatDir);
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        const filePath = join(chatDir, file);
        if (since) {
          try {
            if (statSync(filePath).mtimeMs < since) continue;
          } catch {
            continue;
          }
        }
        records.push(...parseTranscript(filePath, label));
      }
    }
  }
  return records;
}
