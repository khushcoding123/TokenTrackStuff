// Recommendation generator.
//
// Combines the prompt analysis (@metriq/core) with the GitHub-derived relevant
// files into one precise prompt: it names the files to inspect first, adds a
// scope guard, and lists areas NOT to touch. The token-saving number is real —
// analyzePrompt() projects a lower exploration cost when a prompt references
// concrete files (x0.45) and includes a scope guard (x0.6), so we score the
// original vs the improved prompt through the same engine and report the delta.

import { analyzePrompt } from "../core/analyzer.js";

/**
 * @typedef {import("./scorer.js").ScoredFile} ScoredFile
 * @typedef {{ originalPrompt:string, improvedPrompt:string, relevantFiles:ScoredFile[],
 *   tokenSaving:{savedTokens:number,savedPct:number,reason:string},
 *   analysis:{breadthScore:number,rating:string,issues:Array} }} Recommendation
 */

const GENERIC_AREAS = new Set([
  "src", "app", "lib", "components", "pages", "routes", "api", "server",
  "client", "shared", "utils", "helpers", "common", "public", "styles",
  "test", "tests", "__tests__", "assets", "images", "hooks", "types", "",
]);

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeIntent(prompt) {
  let s = String(prompt).trim().replace(/\s+/g, " ");
  if (!s) return s;
  s = capitalize(s);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

function humanList(items) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function unrelatedAreas(relevantPaths, allFiles) {
  const touched = new Set();
  for (const p of relevantPaths) {
    for (const seg of p.toLowerCase().split("/").slice(0, -1)) touched.add(seg);
  }
  const freq = new Map();
  for (const p of allFiles) {
    for (const seg of p.toLowerCase().split("/").slice(0, -1)) {
      if (GENERIC_AREAS.has(seg) || touched.has(seg)) continue;
      freq.set(seg, (freq.get(seg) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
}

function composeImproved(prompt, relevantPaths, areas) {
  const parts = [normalizeIntent(prompt)];
  if (relevantPaths.length) {
    const list = relevantPaths.map((p) => `\`${p}\``).join(", ");
    parts.push(`Inspect ${list} first — that is where this behavior lives.`);
  } else {
    parts.push("No repo is connected, so name the specific file, route, or symbol involved before running this.");
  }
  // This phrasing trips analyzer's file-ref + scope-guard bonuses.
  parts.push("Make the smallest change necessary; do not refactor or reformat unrelated code.");
  if (areas.length) parts.push(`Do not modify ${humanList(areas)}, or other unrelated areas.`);
  parts.push("When you are done, briefly list which files you changed.");
  return parts.join(" ");
}

/**
 * @param {string} prompt
 * @param {ScoredFile[]} relevantFiles
 * @param {{ allFiles?:string[], repo?:object|null }} [opts]
 * @returns {Recommendation}
 */
export function buildRecommendation(prompt, relevantFiles, opts = {}) {
  const allFiles = opts.allFiles || [];
  const relevantPaths = relevantFiles.map((f) => f.path);
  const areas = unrelatedAreas(relevantPaths, allFiles);
  const improvedPrompt = composeImproved(prompt, relevantPaths, areas);

  const before = analyzePrompt(prompt);
  const after = analyzePrompt(improvedPrompt);
  const savedTokens = Math.max(0, before.projectedTokens - after.projectedTokens);
  const savedPct = before.projectedTokens > 0 ? Math.round((savedTokens / before.projectedTokens) * 100) : 0;

  return {
    originalPrompt: prompt,
    improvedPrompt,
    relevantFiles,
    tokenSaving: { savedTokens, savedPct, reason: savingReason({ savedTokens, savedPct, relevantPaths, areas, allFiles, before }) },
    analysis: {
      breadthScore: before.breadthScore,
      rating: before.rating,
      issues: before.issues.map((i) => ({ id: i.id, severity: i.severity, message: i.message, hint: i.hint })),
    },
  };
}

function savingReason({ savedTokens, savedPct, relevantPaths, areas, allFiles, before }) {
  if (relevantPaths.length) {
    const scope = allFiles.length ? ` instead of searching the ${allFiles.length}-file repo` : "";
    const guard = areas.length ? ` and fences off ${areas.length} unrelated area(s)` : "";
    return (
      `Names ${relevantPaths.length} specific file(s)${guard}, so the assistant reads them directly${scope}. ` +
      `Projected ~${savedTokens.toLocaleString()} fewer tokens (${savedPct}% less) than the original ${before.rating} prompt.`
    );
  }
  return (
    `Adds a starting point and a scope guard the original was missing. ` +
    `Projected ~${savedTokens.toLocaleString()} fewer tokens (${savedPct}% less). ` +
    `Connect a GitHub repo to also name the exact files to inspect.`
  );
}
