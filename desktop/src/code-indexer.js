// Phase 2 — project source-code indexing into Typesense's metriq_code_chunks.
//
// This is ORCHESTRATION, deliberately in desktop/src (not packages/core): it
// reuses the engine's offline scanner (listSourceFiles + its ignore rules) to
// enumerate files, then layers Typesense-specific concerns on top — extra
// secret/generated excludes, chunking, symbol extraction, content hashing for
// incremental re-indexing, and stale-document cleanup. packages/core stays
// zero-dep and offline; nothing here leaks back into it.
//
// The pure helpers (shouldExcludeFile / chunkContent / extractSymbols /
// hashContent / buildChunkDoc / diffFiles) touch no network and no Electron,
// so they're unit-tested directly (test/code-indexer.test.js). indexProject()
// is the networked orchestrator.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const svc = require("./typesense-service");

const COLLECTION = svc.SCHEMAS.code_chunks.name;

const MAX_FILE_BYTES = 256 * 1024; // skip anything bigger — not useful context
const MAX_CHUNK_CHARS = 1500; // ~350-450 tokens per chunk
const MAX_CHUNKS_PER_FILE = 40; // bound runaway files
const MAX_SYMBOLS_PER_FILE = 40;
const IMPORT_BATCH = 100;

// Files that pass the scanner's source-extension filter but must never be
// indexed: secrets, keys, lockfiles, and generated/minified artifacts.
const EXCLUDE_BASENAMES = new Set([
  ".env",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "npm-shrinkwrap.json",
  "cargo.lock",
  "poetry.lock",
  "composer.lock",
  "gemfile.lock",
]);

const EXCLUDE_EXTS = new Set([
  ".pem", ".key", ".crt", ".cer", ".der", ".p12", ".pfx", ".keystore",
  ".map", ".lock",
]);

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

// Decide whether a file (already past the scanner's ext/ignore-dir filter)
// should still be excluded from the index. `relPath` is forward-slash relative.
function shouldExcludeFile(relPath, sizeBytes) {
  const base = path.basename(relPath).toLowerCase();
  const ext = path.extname(base);
  if (base.startsWith(".env")) return true; // .env, .env.local, .env.production
  if (EXCLUDE_BASENAMES.has(base)) return true;
  if (EXCLUDE_EXTS.has(ext)) return true;
  if (/\.min\.(js|css)$/.test(base)) return true;
  if (/(^|[.\-])id_rsa($|\.)/.test(base) || base === "id_rsa" || base === "id_ed25519") return true;
  if (typeof sizeBytes === "number" && sizeBytes > MAX_FILE_BYTES) return true;
  return false;
}

// Heuristic binary sniff: NUL byte in the first slice means "not text".
function looksBinary(content) {
  // A NUL byte means the file is not UTF-8 text worth indexing.
  return content.indexOf(String.fromCharCode(0)) !== -1;
}

// Split content into line-boundary-respecting chunks of ~MAX_CHUNK_CHARS.
function chunkContent(content, maxChars = MAX_CHUNK_CHARS) {
  const lines = content.split("\n");
  const chunks = [];
  let buf = "";
  for (const line of lines) {
    if (buf && buf.length + line.length + 1 > maxChars) {
      chunks.push(buf);
      buf = "";
      if (chunks.length >= MAX_CHUNKS_PER_FILE) break;
    }
    buf += (buf ? "\n" : "") + line;
  }
  if (buf && chunks.length < MAX_CHUNKS_PER_FILE) chunks.push(buf);
  return chunks;
}

// Extract likely symbol names: functions, classes, exported consts, React
// components (Capitalized const/function), and web routes. Regex-based and
// language-agnostic-ish; good enough to give search high-signal tokens.
function extractSymbols(content) {
  const names = new Set();
  const patterns = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:export\s+)?(?:def|fn|func)\s+([A-Za-z_$][\w$]*)/g, // py/rust/go
    /(?:app|router)\.(?:get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g, // routes
    /@(?:Get|Post|Put|Patch|Delete)\(\s*['"`]([^'"`]*)['"`]/g, // decorators
  ];
  for (const re of patterns) {
    for (const m of content.matchAll(re)) {
      if (m[1]) names.add(m[1]);
      if (names.size >= MAX_SYMBOLS_PER_FILE) break;
    }
  }
  return [...names].slice(0, MAX_SYMBOLS_PER_FILE);
}

function hashContent(str) {
  return crypto.createHash("sha1").update(str).digest("hex");
}

function chunkId(projectId, relPath, chunkNumber) {
  // Hash the natural key so ids stay filesystem/URL-safe and fixed-length.
  return crypto
    .createHash("sha1")
    .update(`${projectId}|${relPath}|${chunkNumber}`)
    .digest("hex")
    .slice(0, 24);
}

// Build one metriq_code_chunks document. When includeContent is false
// (metadata-only cloud mode) the source text is omitted — only paths, symbols,
// and metadata are indexed, never the code itself.
function buildChunkDoc({
  userId,
  projectId,
  relPath,
  chunkText,
  chunkNumber,
  contentHash,
  symbols,
  modifiedAt,
  indexedAt,
  includeContent = true,
}) {
  const fileName = path.basename(relPath);
  const directory = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
  return {
    id: chunkId(projectId, relPath, chunkNumber),
    user_id: userId,
    project_id: projectId,
    file_path: relPath,
    file_name: fileName,
    extension: path.extname(fileName),
    directory,
    symbols: symbols || [],
    content: includeContent ? chunkText : "",
    chunk_number: chunkNumber,
    content_hash: contentHash,
    modified_at: modifiedAt || 0,
    indexed_at: indexedAt || 0,
  };
}

// Given the previous index's { path: hash } map and the current file list with
// hashes, classify each file. Used for incremental indexing.
function diffFiles(previousHashes = {}, currentFiles = []) {
  const changed = [];
  const unchanged = [];
  const currentPaths = new Set();
  for (const { path: p, hash } of currentFiles) {
    currentPaths.add(p);
    if (previousHashes[p] === hash) unchanged.push(p);
    else changed.push(p);
  }
  const removed = Object.keys(previousHashes).filter((p) => !currentPaths.has(p));
  return { changed, unchanged, removed };
}

// ---------------------------------------------------------------------------
// Orchestrator (networked)
// ---------------------------------------------------------------------------

// Read a file safely; returns null if unreadable / binary / excluded.
function readIndexable(root, relPath) {
  const abs = path.join(root, relPath.split("/").join(path.sep));
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return null;
  }
  if (shouldExcludeFile(relPath, stat.size)) return null;
  let content;
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
  if (looksBinary(content)) return null;
  return { content, modifiedAt: Math.floor(stat.mtimeMs) };
}

/**
 * Incrementally index a project's source into Typesense.
 *
 * @param {object} args
 * @param {object} args.config      resolved Typesense config (svc.getConfig())
 * @param {string} args.userId
 * @param {string} args.projectId
 * @param {string} args.root        absolute project path
 * @param {string[]} args.files     forward-slash relative paths (listSourceFiles)
 * @param {object} [args.previousHashes] { relPath: contentHash } from last run
 * @param {(p:{processed:number,total:number,chunks:number})=>void} [args.onProgress]
 * @returns {Promise<{ok:boolean, fileCount:number, chunkCount:number, hashes:object, indexedAt:number, error?:string}>}
 */
async function indexProject(args) {
  const {
    config,
    userId,
    projectId,
    root,
    files,
    previousHashes = {},
    onProgress,
  } = args;

  const health = await svc.health(config);
  if (!health.ok) {
    return { ok: false, error: health.error || "Typesense unavailable", disabled: health.disabled };
  }
  await svc.ensureAllCollections(config);

  const includeContent = config.indexesCode;
  const indexedAt = Date.now();

  // First pass: read + hash indexable files so we can diff against last run.
  const current = [];
  const contentByPath = new Map();
  for (const relPath of files) {
    const read = readIndexable(root, relPath);
    if (!read) continue;
    const hash = hashContent(read.content);
    current.push({ path: relPath, hash });
    contentByPath.set(relPath, read);
  }

  const { changed, removed } = diffFiles(previousHashes, current);

  // Remove stale docs for deleted + changed files (changed get re-imported).
  for (const relPath of [...removed, ...changed]) {
    const filter = `project_id:=\`${projectId}\` && file_path:=\`${relPath.replace(/`/g, "")}\``;
    await svc.deleteByFilter(config, COLLECTION, filter).catch(() => {});
  }

  // Build + import chunks for changed/new files, batched.
  let batch = [];
  let chunkCount = 0;
  let processed = 0;
  const flush = async () => {
    if (!batch.length) return;
    await svc.importDocuments(config, COLLECTION, batch);
    batch = [];
  };

  for (const relPath of changed) {
    const read = contentByPath.get(relPath);
    if (!read) continue;
    const hash = current.find((c) => c.path === relPath)?.hash || hashContent(read.content);
    const symbols = extractSymbols(read.content);
    const chunks = chunkContent(read.content);
    chunks.forEach((chunkText, chunkNumber) => {
      batch.push(
        buildChunkDoc({
          userId,
          projectId,
          relPath,
          chunkText,
          chunkNumber,
          contentHash: hash,
          symbols,
          modifiedAt: read.modifiedAt,
          indexedAt,
          includeContent,
        })
      );
      chunkCount += 1;
    });
    processed += 1;
    if (onProgress) onProgress({ processed, total: changed.length, chunks: chunkCount });
    if (batch.length >= IMPORT_BATCH) await flush();
  }
  await flush();

  const hashes = {};
  for (const { path: p, hash } of current) hashes[p] = hash;

  return {
    ok: true,
    fileCount: current.length,
    changedCount: changed.length,
    removedCount: removed.length,
    chunkCount,
    hashes,
    indexedAt,
    documentCount: await svc.documentCount(config, COLLECTION).catch(() => null),
  };
}

// Remove every chunk belonging to a project (on unlink).
async function removeProjectIndex(config, projectId) {
  const health = await svc.health(config);
  if (!health.ok) return { ok: false };
  await svc
    .deleteByFilter(config, COLLECTION, `project_id:=\`${String(projectId).replace(/`/g, "")}\``)
    .catch(() => {});
  return { ok: true };
}

module.exports = {
  // pure helpers (exported for tests)
  shouldExcludeFile,
  looksBinary,
  chunkContent,
  extractSymbols,
  hashContent,
  chunkId,
  buildChunkDoc,
  diffFiles,
  // orchestration
  indexProject,
  removeProjectIndex,
  COLLECTION,
  MAX_FILE_BYTES,
  MAX_CHUNK_CHARS,
};
