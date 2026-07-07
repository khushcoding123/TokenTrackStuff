// Lightweight project scanner.
//
// Given a prompt, we try to point the coding assistant at the files it most
// likely needs — so its rewritten prompt can say "start by checking X, Y"
// instead of triggering a full-project search. This is pure filename/path
// heuristics: fast, offline, and good enough to seed a focused prompt.

import { readdirSync, statSync } from "node:fs";
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
]);

function walk(dir, root, files, depth) {
  if (depth > 6) return; // keep scans shallow and fast
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
        // Normalize to forward slashes — these paths go into prompts.
        files.push(relative(root, full).split(sep).join("/"));
        if (files.length > 4000) return; // safety cap for huge repos
      }
    }
  }
}

export function keywordsFromPrompt(prompt) {
  return [
    ...new Set(
      String(prompt)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    ),
  ];
}

// Returns up to `limit` files most relevant to the prompt keywords, each with a
// score. Returns [] when there's no project on disk or nothing matches.
export function findRelevantFiles(prompt, root = process.cwd(), limit = 4) {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];

  const files = [];
  walk(root, root, files, 0);
  if (files.length === 0) return [];

  const keywords = keywordsFromPrompt(prompt);
  if (keywords.length === 0) return [];

  const scored = [];
  for (const file of files) {
    const lowerPath = file.toLowerCase();
    const base = basename(lowerPath, extname(lowerPath));
    let score = 0;
    for (const kw of keywords) {
      if (base === kw) score += 10; // exact filename match
      else if (base.includes(kw)) score += 5; // filename contains keyword
      else if (lowerPath.includes(kw)) score += 2; // somewhere in the path
    }
    if (score > 0) {
      // Prefer shallower files; deep paths are usually less central.
      const depthPenalty = lowerPath.split("/").length * 0.25;
      scored.push({ file, score: score - depthPenalty });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.file);
}
