// Local session tracking.
//
// metriq keeps a lightweight record of the prompts analyzed this session in
// a JSON file under the user's home directory. This powers `metriq stats`
// and, later, dashboard sync. Everything is local and append-only within a
// session; `reset` starts a fresh one.

import { homedir } from "node:os";
import { join } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dollarsFor, DEFAULT_PROVIDER } from "../../packages/core/config.js";

const DIR = join(homedir(), ".metriq");
const FILE = join(DIR, "session.json");

function emptySession() {
  return {
    id: `sess_${Date.now().toString(36)}`,
    startedAt: new Date().toISOString(),
    provider: DEFAULT_PROVIDER,
    prompts: [],
  };
}

export function load() {
  try {
    if (!existsSync(FILE)) return emptySession();
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    if (!data || !Array.isArray(data.prompts)) return emptySession();
    return data;
  } catch {
    return emptySession();
  }
}

export function save(session) {
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(session, null, 2), "utf8");
    return true;
  } catch {
    return false; // tracking is best-effort; never block the user
  }
}

export function reset() {
  const fresh = emptySession();
  save(fresh);
  return fresh;
}

/**
 * Record one analyzed prompt into the current session.
 * @param {object} entry { prompt, breadthScore, rating, projectedTokens,
 *                          optimizedTokens, savedTokens }
 */
export function record(entry) {
  const session = load();
  session.prompts.push({
    at: new Date().toISOString(),
    prompt: entry.prompt,
    breadthScore: entry.breadthScore,
    rating: entry.rating,
    projectedTokens: entry.projectedTokens,
    optimizedTokens: entry.optimizedTokens,
    savedTokens: entry.savedTokens,
  });
  save(session);
  return session;
}

export function summarize(session = load(), provider = session.provider) {
  const prompts = session.prompts || [];
  const total = prompts.length;
  const projected = prompts.reduce((s, p) => s + (p.projectedTokens || 0), 0);
  const optimized = prompts.reduce((s, p) => s + (p.optimizedTokens || 0), 0);
  const saved = prompts.reduce((s, p) => s + (p.savedTokens || 0), 0);
  const broad = prompts.filter((p) => p.rating === "broad").length;

  const mostExpensive = [...prompts]
    .sort((a, b) => (b.projectedTokens || 0) - (a.projectedTokens || 0))
    .slice(0, 3);
  const biggestSavers = [...prompts]
    .sort((a, b) => (b.savedTokens || 0) - (a.savedTokens || 0))
    .slice(0, 3);

  return {
    id: session.id,
    startedAt: session.startedAt,
    provider,
    total,
    broad,
    projectedTokens: projected,
    optimizedTokens: optimized,
    savedTokens: saved,
    savedPct: projected > 0 ? Math.round((saved / projected) * 100) : 0,
    dollarsSaved: dollarsFor(saved, provider),
    mostExpensive,
    biggestSavers,
  };
}

export const SESSION_FILE = FILE;
