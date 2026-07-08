// Parsing for the metriq://auth-callback handoff URL. Kept dependency-free
// and Electron-free so it can be unit tested directly (see
// desktop/test/protocol.test.js) without spinning up a real app/window.

const PROTOCOL = "metriq";

// Windows/Linux hand the callback URL to us as a bare argv entry (either in
// process.argv on cold start, or in the second-instance event's
// commandLine array on warm start). Find it among the other flags Electron
// / the OS may have appended.
function findProtocolUrlInArgv(argv) {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`)) ?? null;
}

// Returns { token, refreshToken, email, name } or null if `url` isn't a
// recognized metriq://auth-callback link or is missing the required token.
function parseAuthCallbackUrl(url) {
  if (typeof url !== "string" || !url.startsWith(`${PROTOCOL}://`)) return null;

  let parsed;
  try {
    // metriq://auth-callback?token=... isn't a URL scheme the WHATWG URL
    // parser has built-in host/path rules for, but it still parses fine as
    // long as we just read searchParams off it.
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== "auth-callback") return null;

  const token = parsed.searchParams.get("token");
  if (!token) return null;

  return {
    token,
    refreshToken: parsed.searchParams.get("refresh_token") || null,
    email: parsed.searchParams.get("email") || null,
    name: parsed.searchParams.get("name") || null,
  };
}

module.exports = { PROTOCOL, findProtocolUrlInArgv, parseAuthCallbackUrl };
