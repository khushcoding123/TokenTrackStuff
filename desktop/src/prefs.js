// Small local-only preferences file (currently just which linked project is
// "active" on this device). Deliberately not synced via InsForge — the set
// of linked projects syncs across devices, but which one you're focused on
// right now is a per-device concern, same as which window/workspace is
// focused in most multi-project tools.

const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function prefsPath() {
  return path.join(app.getPath("userData"), "prefs.json");
}

function loadPrefs() {
  const p = prefsPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...patch };
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = { loadPrefs, savePrefs };
