// `metriq trace` — run in any project and token tracking begins.
//
// Reads the local Claude Code + Codex + Cursor session logs on this machine,
// prices and aggregates them with the shared usage engine (src/core/usage —
// the exact same code behind the web /usage dashboard), and serves a live
// localhost dashboard. This is the local counterpart to the hosted dashboard:
// same numbers, but it can actually see your machine's logs (a deployed
// server can't).

import crypto from "node:crypto";
import { watch } from "node:fs";
import { spawn } from "node:child_process";

import { getClaudeDirs, loadClaudeRecords } from "../core/usage/claude.js";
import { getCodexSessionsDir, loadCodexUsage } from "../core/usage/codex.js";
import { getCursorProjectsDir, loadCursorRecords } from "../core/usage/cursor.js";
import { aggregate } from "../core/usage/aggregate.js";
import { generateInsights } from "../core/usage/insights.js";
import { analyzeCurrentSession } from "../core/usage/behavior.js";
import { createTraceServer } from "./trace-server.js";
import { colors } from "../ui/colors.js";

const VALID_DAYS = new Set([7, 30, 90]);

// Build the dashboard payload — mirrors web/app/api/usage/route.js so the CLI
// and the web dashboard render identical data.
function buildPayload(days) {
  const sources = [];
  if (getClaudeDirs().length) sources.push("claude-code");
  if (getCodexSessionsDir()) sources.push("codex");
  if (getCursorProjectsDir()) sources.push("cursor");
  if (!sources.length) return { available: false, sources: [] };

  const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);
  const records = [];
  let rateLimits = null;
  if (sources.includes("claude-code")) records.push(...loadClaudeRecords({ since }));
  if (sources.includes("codex")) {
    const codex = loadCodexUsage({ since });
    records.push(...codex.records);
    rateLimits = codex.rateLimits;
  }
  if (sources.includes("cursor")) records.push(...loadCursorRecords({ since }));
  if (!records.length) return { available: false, sources };

  const agg = aggregate(records, { days });
  return {
    available: true,
    sources,
    days,
    generatedAt: new Date().toISOString(),
    rateLimits,
    insights: generateInsights(agg, rateLimits),
    currentSession: analyzeCurrentSession(records, { rateLimits }),
    ...agg,
  };
}

const fmtTok = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n));

// Open a URL in the default browser without any dependencies. Best-effort:
// if it fails the printed URL still works.
function openInBrowser(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
    return true;
  } catch {
    return false;
  }
}

export async function runTrace(flags = {}) {
  let defaultDays = parseInt(flags.days, 10);
  if (!VALID_DAYS.has(defaultDays)) defaultDays = 30;

  // Short cache so rapid polls don't rescan every JSONL file; the watcher
  // clears it the moment an agent writes new activity.
  const cache = new Map(); // days -> { at, payload }
  const TTL_MS = 2500;
  let dirty = false;

  const getData = (days = defaultDays) => {
    if (!VALID_DAYS.has(days)) days = defaultDays;
    const hit = cache.get(days);
    if (hit && !dirty && Date.now() - hit.at < TTL_MS) return hit.payload;
    const payload = buildPayload(days);
    cache.set(days, { at: Date.now(), payload });
    if (days === defaultDays) dirty = false;
    return payload;
  };

  const c = colors;
  const first = getData(defaultDays);
  if (!first.available) {
    console.log(
      `\n  ${c.bold("◇ metriq trace")}\n` +
        `  No Claude Code or Codex logs found on this machine yet.\n` +
        `  Use an AI coding agent (Claude Code / Codex), then run this again.\n`
    );
    return 1;
  }

  const token = crypto.randomBytes(16).toString("hex");
  const server = createTraceServer({ getData, token });
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  const port = server.address().port;
  const url = `http://localhost:${port}/?t=${token}`;

  // Live: watch every source dir and invalidate the cache on any write.
  const watchDirs = [...getClaudeDirs()];
  const codexDir = getCodexSessionsDir();
  if (codexDir) watchDirs.push(codexDir);
  const cursorDir = getCursorProjectsDir();
  if (cursorDir) watchDirs.push(cursorDir);
  let watching = 0;
  const onChange = () => {
    dirty = true;
    cache.clear();
    const p = buildPayload(defaultDays);
    cache.set(defaultDays, { at: Date.now(), payload: p });
    dirty = false;
    process.stdout.write(
      "\r\x1b[K  " +
        c.gray(`live · ${fmtTok(p.totals.totalTokens)} tokens · $${p.totals.costUSD.toFixed(2)} · ${(p.sessions || []).length} sessions`)
    );
  };
  for (const d of watchDirs) {
    try {
      watch(d, { recursive: true }, () => onChange());
      watching++;
    } catch {
      /* recursive watch unsupported here — dashboard still polls-and-rescans */
    }
  }

  console.log(`\n  ${c.bold("◇ metriq trace")}  ${c.gray("· token tracking is live")}`);
  console.log(`  ${c.green("✓")} sources: ${first.sources.join(", ")}`);
  console.log(
    `  ${c.green("✓")} ${fmtTok(first.totals.totalTokens)} tokens · $${first.totals.costUSD.toFixed(2)} · ${(first.sessions || []).length} sessions (last ${defaultDays}d)`
  );
  if (!watching) console.log(`  ${c.gray("! live file-watch unavailable — dashboard rescans on refresh")}`);
  console.log(`\n  → dashboard: ${c.cyan(url)}`);
  console.log(`    ${c.gray("localhost only · token-guarded · press Ctrl-C to stop")}\n`);

  // Auto-open the dashboard so starting the app IS opening the dashboard.
  // --no-open skips it (e.g. when scripting or already have a tab).
  if (flags.open !== false) openInBrowser(url);

  process.on("SIGINT", () => {
    console.log("\n  stopped.\n");
    try {
      server.close();
    } catch {}
    process.exit(0);
  });

  return new Promise(() => {}); // keep the process alive
}
