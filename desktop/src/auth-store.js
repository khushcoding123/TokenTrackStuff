// Session persistence via Electron's safeStorage — backed by the OS keychain
// (macOS Keychain, Windows DPAPI, or a Freedesktop Secret Service /
// libsecret-derived key on Linux). The file on disk holds only the
// encrypted bytes safeStorage produces; it is never readable without going
// through this OS-level encryption, unlike a plain ~/.metriq-style JSON file.

const { app, safeStorage } = require("electron");
const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } = require("node:fs");
const { join, dirname } = require("node:path");

function credentialsPath() {
  return join(app.getPath("userData"), "credentials.enc");
}

function saveSession(session) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level secure storage isn't available on this machine, so the session can't be stored safely."
    );
  }
  const path = credentialsPath();
  mkdirSync(dirname(path), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify(session));
  writeFileSync(path, encrypted, { mode: 0o600 });
}

function loadSession() {
  const path = credentialsPath();
  if (!existsSync(path)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = readFileSync(path);
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch {
    // Corrupt file, or encrypted under a since-rotated OS key — treat as
    // logged out rather than crashing.
    return null;
  }
}

function clearSession() {
  const path = credentialsPath();
  if (existsSync(path)) unlinkSync(path);
}

module.exports = { saveSession, loadSession, clearSession, credentialsPath };
