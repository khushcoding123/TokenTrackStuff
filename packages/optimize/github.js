// GitHub service — connect a repo by URL and fetch its (filtered) file tree.
//
// A user connects a repo once and Metriq reuses its file structure for every
// future prompt optimization (web and desktop), instead of re-uploading a
// folder. It reads only the tree (paths), never file contents, so it's cheap.
//
// Auth: unauthenticated works for public repos (~60 req/hr/IP). Set GITHUB_TOKEN
// to raise the limit and reach private repos the token can see.
//
// This module is allowed to do network I/O — that's why it lives in
// @metriq/optimize and NOT @metriq/core (which is deliberately offline).

/**
 * @typedef {{ owner:string, repo:string, branch?:string }} RepoRef
 * @typedef {{ owner:string, repo:string, branch:string, files:string[], truncated:boolean, fetchedAt:number }} RepoTree
 */

const API = "https://api.github.com";
const MAX_FILE_BYTES = 500 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { at:number, data:RepoTree }>} */
const cache = new Map();

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage",
  ".turbo", ".cache", ".vercel", ".idea", ".vscode", "vendor", ".venv",
  "__pycache__", "target", ".output", ".svelte-kit", "bower_components",
]);

const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json",
  "bun.lockb", ".ds_store", "thumbs.db",
]);

const IGNORE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp", ".avif", ".tiff",
  ".mp4", ".mov", ".webm", ".avi", ".mkv", ".mp3", ".wav", ".ogg", ".flac",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".tar", ".gz", ".rar", ".7z", ".pdf", ".exe", ".dll", ".so",
  ".dylib", ".wasm", ".node", ".bin", ".class", ".jar",
  ".map", ".lock", ".log", ".snap",
]);

function extname(path) {
  const base = path.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

function keepFile(path, size) {
  const segments = path.toLowerCase().split("/");
  const base = segments[segments.length - 1];
  if (IGNORE_FILES.has(base)) return false;
  if (base.endsWith(".min.js") || base.endsWith(".min.css")) return false;
  if (segments.slice(0, -1).some((seg) => IGNORE_DIRS.has(seg))) return false;
  if (IGNORE_EXTS.has(extname(path))) return false;
  if (typeof size === "number" && size > MAX_FILE_BYTES) return false;
  return true;
}

/**
 * Parse many GitHub URL shapes into { owner, repo, branch? }.
 * @param {string} input
 * @returns {RepoRef}
 */
export function parseRepoUrl(input) {
  let s = String(input || "").trim();
  if (!s) throw httpError(400, "Enter a GitHub repository URL.");

  s = s.replace(/^git@github\.com:/i, "https://github.com/");
  s = s.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "");
  s = s.replace(/\.git($|\/)/i, "$1");

  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) throw httpError(400, 'Use the form "https://github.com/owner/repo".');
  const [owner, repo] = parts;
  const branch = parts[2] === "tree" && parts[3] ? parts[3] : undefined;
  return { owner, repo, branch };
}

function ghHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "metriq-app",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (typeof process !== "undefined" && process.env && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function ghGet(path) {
  const res = await fetch(`${API}${path}`, { headers: ghHeaders() });
  if (res.ok) return res.json();
  if (res.status === 404) throw httpError(404, "Repository not found (or it's private and needs a GITHUB_TOKEN).");
  if (res.status === 401) throw httpError(401, "GITHUB_TOKEN is invalid or expired.");
  if (res.status === 403) {
    if (res.headers.get("x-ratelimit-remaining") === "0") {
      throw httpError(429, "GitHub API rate limit reached. Set GITHUB_TOKEN to raise it, then try again.");
    }
    throw httpError(403, "GitHub denied the request (forbidden).");
  }
  throw httpError(502, `GitHub request failed (${res.status}).`);
}

/**
 * Fetch and filter a repo's file tree.
 * @param {RepoRef} ref
 * @returns {Promise<RepoTree>}
 */
export async function fetchRepoTree(ref) {
  let branch = ref.branch;
  if (!branch) {
    const info = await ghGet(`/repos/${ref.owner}/${ref.repo}`);
    branch = info.default_branch || "main";
  }
  const data = await ghGet(
    `/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  const files = (data.tree || [])
    .filter((n) => n.type === "blob" && keepFile(n.path, n.size))
    .map((n) => n.path)
    .slice(0, 8000);

  return { owner: ref.owner, repo: ref.repo, branch, files, truncated: Boolean(data.truncated), fetchedAt: Date.now() };
}

/**
 * Connect-or-reuse: return the cached tree if warm, else fetch and cache it.
 * @param {string} repoUrl
 * @returns {Promise<RepoTree>}
 */
export async function getRepoTree(repoUrl) {
  const ref = parseRepoUrl(repoUrl);
  const key = `${ref.owner}/${ref.repo}@${ref.branch || "default"}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const tree = await fetchRepoTree(ref);
  cache.set(key, { at: Date.now(), data: tree });
  return tree;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
