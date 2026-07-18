// Local cache of each linked project's file index, so re-opening the app
// (or re-selecting a project) doesn't require re-walking the filesystem
// just to show "how many files are indexed." Plain JSON is fine here —
// unlike auth-store.js, this holds file paths, not secrets.

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function cacheDir() {
  const dir = path.join(app.getPath("userData"), "project-cache");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cacheFilePath(projectId) {
  return path.join(cacheDir(), `${projectId}.json`);
}

function saveFileIndex(projectId, { files, scannedAt }) {
  fs.writeFileSync(cacheFilePath(projectId), JSON.stringify({ files, scannedAt }), "utf8");
}

function loadFileIndex(projectId) {
  const p = cacheFilePath(projectId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function removeFileIndex(projectId) {
  const p = cacheFilePath(projectId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// --- Typesense index metadata (Phase 2) -----------------------------------
// Separate from the file index above: holds per-file content hashes (for
// incremental re-indexing) plus the last index run's counts/status. Plain
// JSON — file paths + hashes, no secrets. Kept in its own file so a plain
// file-index read stays cheap and a large hash map doesn't bloat it.

function indexMetaPath(projectId) {
  return path.join(cacheDir(), `${projectId}.index.json`);
}

function saveIndexMeta(projectId, meta) {
  fs.writeFileSync(indexMetaPath(projectId), JSON.stringify(meta), "utf8");
}

function loadIndexMeta(projectId) {
  const p = indexMetaPath(projectId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function removeIndexMeta(projectId) {
  const p = indexMetaPath(projectId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = {
  saveFileIndex,
  loadFileIndex,
  removeFileIndex,
  saveIndexMeta,
  loadIndexMeta,
  removeIndexMeta,
};
