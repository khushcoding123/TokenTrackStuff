// Local log of prompt-capture outcomes, so the Overview/Sustainability pages
// can show real numbers instead of placeholder stats. Recorded once per
// "Copy improved prompt" click (a real usage signal), not per keystroke —
// see capture.js. Plain JSON, capped at HISTORY_LIMIT entries; not synced,
// same reasoning as prefs.js.

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const HISTORY_LIMIT = 500;

function statsPath() {
  return path.join(app.getPath("userData"), "usage-stats.json");
}

function loadHistory() {
  const p = statsPath();
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordCapture(entry) {
  const history = loadHistory();
  history.push({
    timestamp: new Date().toISOString(),
    projectName: entry.projectName ?? null,
    promptTokens: entry.promptTokens ?? 0,
    projectedTokens: entry.projectedTokens ?? 0,
    savedTokens: entry.savedTokens ?? 0,
    savedPct: entry.savedPct ?? 0,
    rating: entry.rating ?? null,
  });
  const trimmed = history.slice(-HISTORY_LIMIT);
  fs.writeFileSync(statsPath(), JSON.stringify(trimmed), "utf8");
  return trimmed;
}

function getSummary() {
  const history = loadHistory();
  const totalCaptures = history.length;
  const totalSavedTokens = history.reduce((sum, e) => sum + (e.savedTokens || 0), 0);
  const totalPromptTokens = history.reduce((sum, e) => sum + (e.promptTokens || 0), 0);
  const avgSavedPct = totalCaptures
    ? Math.round(history.reduce((sum, e) => sum + (e.savedPct || 0), 0) / totalCaptures)
    : 0;

  return {
    totalCaptures,
    totalSavedTokens,
    totalPromptTokens,
    avgSavedPct,
    recent: history.slice(-10).reverse(),
  };
}

module.exports = { recordCapture, getSummary };
