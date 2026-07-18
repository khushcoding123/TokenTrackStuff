// Claude API key persistence via Electron's safeStorage — same OS-keychain
// guarantee as auth-store.js. The file on disk holds only ciphertext, never
// the plaintext key, and is never sent back to the renderer once saved
// (settings:get-ai-rewrite only ever returns a masked preview).

const { app, safeStorage } = require("electron");
const { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } = require("node:fs");
const { join, dirname } = require("node:path");

function keyPath() {
  return join(app.getPath("userData"), "ai-key.enc");
}

function saveApiKey(key) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "OS-level secure storage isn't available on this machine, so the API key can't be stored safely."
    );
  }
  const path = keyPath();
  mkdirSync(dirname(path), { recursive: true });
  const encrypted = safeStorage.encryptString(key);
  writeFileSync(path, encrypted, { mode: 0o600 });
}

function loadApiKey() {
  const path = keyPath();
  if (!existsSync(path)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = readFileSync(path);
    return safeStorage.decryptString(encrypted);
  } catch {
    // Corrupt file, or encrypted under a since-rotated OS key — treat as
    // absent rather than crashing.
    return null;
  }
}

function clearApiKey() {
  const path = keyPath();
  if (existsSync(path)) unlinkSync(path);
}

function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

module.exports = { saveApiKey, loadApiKey, clearApiKey, maskApiKey, keyPath };
