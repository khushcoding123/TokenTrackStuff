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

module.exports = { saveFileIndex, loadFileIndex, removeFileIndex };
