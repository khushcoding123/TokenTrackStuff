// Project-aware scanner.
//
// Given a prompt, inspect the local project and identify likely ownership files
// for the requested behavior. This stays offline and heuristic-based, but uses
// path names, exported symbols, and a small file-content sample so rewrites can
// point at believable files instead of guessing from filenames alone.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename, extname, sep } from "node:path";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  "vendor",
  ".venv",
  "__pycache__",
]);

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".rb", ".php",
  ".vue", ".svelte", ".css", ".scss", ".html",
]);

// Words too generic to be useful as file-matching signal.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
  "fix", "add", "make", "update", "change", "improve", "better", "please",
  "bug", "issue", "error", "problem", "code", "file", "files", "app", "this",
  "that", "it", "my", "our", "some", "any", "all", "new", "old", "use", "using",
  "look", "into", "work", "project", "system", "feature", "screen", "page",
]);

const GENERIC_PATH_TOKENS = new Set([
  "src", "app", "lib", "components", "pages", "routes", "api", "server",
  "client", "shared", "utils", "helpers", "common", "index",
]);

const CONTENT_BYTES = 6000;

function walk(dir, root, files, depth) {
  if (depth > 6) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full, root, files, depth + 1);
    } else if (entry.isFile()) {
      if (SOURCE_EXTS.has(extname(entry.name))) {
        files.push(relative(root, full).split(sep).join("/"));
        if (files.length > 4000) return;
      }
    }
  }
}

// Returns the raw list of source files under `root` (same walk/ignore/
// extension rules scanProjectContext uses internally), with no prompt or
// keyword filtering. Used to build a file index when a project is linked —
// before there's any prompt yet to score files against.
export function listSourceFiles(root = process.cwd()) {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];

  const files = [];
  walk(root, root, files, 0);
  return files;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function keywordsFromPrompt(prompt) {
  return [
    ...new Set(
      tokenize(prompt).filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    ),
  ];
}

function readSnippet(root, file) {
  try {
    return readFileSync(join(root, file), "utf8").slice(0, CONTENT_BYTES);
  } catch {
    return "";
  }
}

function exportedNames(snippet) {
  const names = new Set();
  const patterns = [
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_]+)/g,
    /(?:function|class)\s+([A-Za-z][A-Za-z0-9_]+)/g,
    /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]+)\s*=/g,
  ];
  for (const pattern of patterns) {
    for (const match of snippet.matchAll(pattern)) {
      if (match[1]) names.add(match[1]);
    }
  }
  return [...names];
}

function subsystemFromPath(file) {
  const tokens = tokenize(file).filter(
    (token) => !GENERIC_PATH_TOKENS.has(token) && token.length >= 3
  );
  return tokens[0] || "";
}

function classifyConfidence(candidates) {
  if (!candidates.length) return "low";
  const [top] = candidates;
  if (
    top.score >= 18 &&
    top.matchedKeywords.size >= 2
  ) {
    return "high";
  }
  if (top.score >= 12 && top.matchedKeywords.size >= 2) return "medium";
  return "low";
}

function scoreCandidate(file, root, keywords) {
  const lowerPath = file.toLowerCase();
  const base = basename(lowerPath, extname(lowerPath));
  const pathTokens = tokenize(lowerPath);
  const snippet = readSnippet(root, file);
  const lowerSnippet = snippet.toLowerCase();
  const names = exportedNames(snippet);
  const reasons = [];
  const matchedKeywords = new Set();
  let score = 0;

  const addReason = (message) => {
    if (!reasons.includes(message) && reasons.length < 2) reasons.push(message);
  };

  for (const kw of keywords) {
    if (base === kw) {
      score += 12;
      matchedKeywords.add(kw);
      addReason(`matches filename "${kw}"`);
    } else if (base.includes(kw)) {
      score += 7;
      matchedKeywords.add(kw);
      addReason(`filename mentions "${kw}"`);
    }

    if (pathTokens.includes(kw)) {
      score += 4;
      matchedKeywords.add(kw);
      addReason(`path points to "${kw}"`);
    }

    if (new RegExp(`\\b${kw}\\b`, "i").test(lowerSnippet)) {
      score += 3;
      matchedKeywords.add(kw);
      addReason(`code mentions "${kw}"`);
    }

    for (const name of names) {
      const lowerName = name.toLowerCase();
      if (lowerName === kw) {
        score += 8;
        matchedKeywords.add(kw);
        addReason(`exports "${name}"`);
      } else if (lowerName.includes(kw)) {
        score += 5;
        matchedKeywords.add(kw);
        addReason(`defines "${name}"`);
      }
    }
  }

  if (score === 0) return null;

  let penalty = lowerPath.split("/").length * 0.25;
  if (/(^|\/)(test|tests|__tests__)(\/|$)|\.test\./.test(lowerPath)) {
    penalty += 5;
  }

  return {
    file,
    score: score - penalty,
    reasons,
    matchedKeywords,
    subsystem: subsystemFromPath(file),
  };
}

function dominantSubsystem(candidates) {
  const counts = new Map();
  for (const candidate of candidates.slice(0, 3)) {
    if (!candidate.subsystem) continue;
    counts.set(
      candidate.subsystem,
      (counts.get(candidate.subsystem) || 0) + candidate.score
    );
  }
  let best = "";
  let bestScore = 0;
  for (const [name, score] of counts) {
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

export function scanProjectContext(prompt, root = process.cwd(), limit = 4) {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return { files: [], candidates: [], confidence: "low", subsystem: "" };
  }
  if (!stat.isDirectory()) {
    return { files: [], candidates: [], confidence: "low", subsystem: "" };
  }

  const files = [];
  walk(root, root, files, 0);
  const keywords = keywordsFromPrompt(prompt);
  if (files.length === 0 || keywords.length === 0) {
    return { files: [], candidates: [], confidence: "low", subsystem: "" };
  }

  const candidates = [];
  for (const file of files) {
    const candidate = scoreCandidate(file, root, keywords);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, limit);
  const confidence = classifyConfidence(top);

  return {
    files: confidence === "low" ? [] : top.map((candidate) => candidate.file),
    candidates: top.map((candidate) => ({
      file: candidate.file,
      score: candidate.score,
      reasons: candidate.reasons,
      subsystem: candidate.subsystem,
      matchedKeywords: [...candidate.matchedKeywords],
    })),
    confidence,
    subsystem: confidence === "low" ? "" : dominantSubsystem(top),
  };
}

// Backwards-compatible helper for callers that only need file paths.
export function findRelevantFiles(prompt, root = process.cwd(), limit = 4) {
  return scanProjectContext(prompt, root, limit).files;
}
