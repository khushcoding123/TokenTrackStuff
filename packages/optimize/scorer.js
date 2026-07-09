// File relevance scorer — ranks a repo's file paths by relevance to a prompt.
//
// The GitHub-tree counterpart to @metriq/core's scoreCandidate(): that one reads
// file contents from disk; over the GitHub API we only have paths, so this scores
// on path + filename signal. Keyword weights mirror the on-disk scorer so the two
// behave consistently.

import { keywordsFromPrompt } from "../core/scanner.js";

/**
 * @typedef {{ path:string, score:number, reasons:string[], matched:string[] }} ScoredFile
 */

const ROLE_HINTS = [
  { test: /page|screen|view|dashboard|layout|ui|render|display/, kinds: ["page", "component", "layout"] },
  { test: /api|endpoint|route|request|fetch|server|backend/, kinds: ["route", "api", "server"] },
  { test: /style|css|theme|color|design/, kinds: ["css", "style"] },
];

function tokenize(text) {
  return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function baseName(path) {
  const file = path.split("/").pop() || "";
  const dot = file.lastIndexOf(".");
  return (dot > 0 ? file.slice(0, dot) : file).toLowerCase();
}

function scorePath(path, keywords, roleKinds) {
  const lower = path.toLowerCase();
  const base = baseName(path);
  const pathTokens = tokenize(lower);
  const reasons = [];
  const matched = new Set();
  let score = 0;

  const addReason = (msg) => {
    if (!reasons.includes(msg) && reasons.length < 3) reasons.push(msg);
  };

  for (const kw of keywords) {
    if (base === kw) {
      score += 12; matched.add(kw); addReason(`filename is "${kw}"`);
    } else if (base.includes(kw)) {
      score += 7; matched.add(kw); addReason(`filename mentions "${kw}"`);
    }
    if (pathTokens.includes(kw)) {
      score += 4; matched.add(kw); addReason(`path points to "${kw}"`);
    }
  }

  if (score === 0) return null;

  if (roleKinds.length) {
    const roleWord = base + " " + lower;
    if (roleKinds.some((k) => roleWord.includes(k))) {
      score += 2; addReason("role matches the task");
    }
  }

  let penalty = pathTokens.length * 0.2;
  if (/(^|\/)(test|tests|__tests__|__mocks__|e2e|spec)(\/|$)|\.(test|spec)\./.test(lower)) penalty += 5;
  if (/\.(config|d)\./.test(lower) || base.endsWith(".config")) penalty += 2;

  return { path, score: score - penalty, reasons, matched: [...matched] };
}

function roleKindsFor(prompt) {
  const kinds = new Set();
  for (const hint of ROLE_HINTS) {
    if (hint.test.test(prompt.toLowerCase())) hint.kinds.forEach((k) => kinds.add(k));
  }
  return [...kinds];
}

/**
 * Rank repo files by relevance to the prompt.
 * @param {string} prompt
 * @param {string[]} files
 * @param {number} [limit]
 * @returns {ScoredFile[]}
 */
export function scoreFiles(prompt, files, limit = 6) {
  const keywords = keywordsFromPrompt(prompt);
  if (!keywords.length || !files.length) return [];

  const roleKinds = roleKindsFor(prompt);
  const scored = [];
  for (const path of files) {
    const result = scorePath(path, keywords, roleKinds);
    if (result && result.score > 0) scored.push(result);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((f) => ({
    path: f.path,
    score: Math.round(f.score * 10) / 10,
    reasons: f.reasons,
    matched: f.matched,
  }));
}
