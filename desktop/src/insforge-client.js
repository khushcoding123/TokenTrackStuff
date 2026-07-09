// Minimal fetch-based client for InsForge's PostgREST-style database API,
// scoped to the linked_projects table. Deliberately hand-rolled rather than
// pulling in @insforge/sdk here — the desktop app only needs a handful of
// authenticated CRUD calls against one table, and Electron's Node runtime
// has a native fetch, so a full SDK dependency isn't worth it yet.
//
// Field names below are real Postgres column names (user_id, file_count,
// ...), not camelCase — the REST layer does NOT convert casing, it expects
// the actual DB columns as-is (verified against the live API; some
// InsForge doc examples showing createdAt/updatedAt are just tables that
// happen to have literally-camelCase columns, not a general conversion).

const INSFORGE_BASE_URL = process.env.METRIQ_INSFORGE_URL || "https://v36dqchj.us-east.insforge.app";
const TABLE = "linked_projects";

async function request(method, pathAndQuery, { token, body, extraHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${INSFORGE_BASE_URL}${pathAndQuery}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`InsForge ${method} ${pathAndQuery} failed (${res.status}): ${text}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function listLinkedProjects(token) {
  return request("GET", `/api/database/records/${TABLE}?order=created_at.desc`, { token });
}

async function createLinkedProject(token, { name, path, kind = "local", fileCount }) {
  // user_id is intentionally omitted — the column defaults to auth.uid(),
  // derived server-side from the bearer token, so the client never needs
  // to know (or could spoof) its own user id.
  const rows = await request("POST", `/api/database/records/${TABLE}`, {
    token,
    body: [{ name, path, kind, file_count: fileCount }],
    extraHeaders: { Prefer: "return=representation" },
  });
  return rows?.[0] ?? null;
}

async function updateLinkedProject(token, id, patch) {
  const rows = await request("PATCH", `/api/database/records/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    token,
    body: patch,
    extraHeaders: { Prefer: "return=representation" },
  });
  return rows?.[0] ?? null;
}

function deleteLinkedProject(token, id) {
  return request("DELETE", `/api/database/records/${TABLE}?id=eq.${encodeURIComponent(id)}`, { token });
}

// Account profile — separate from the linked_projects table above, hits
// InsForge's auth API (not the PostgREST-style database API). Per InsForge's
// schema, PATCH /api/auth/profiles/current expects a wrapped
// { profile: {...} } body and returns { id, profile }. Only `name` is
// editable from the desktop app today — InsForge has no endpoint for
// changing account email, and password change requires the email-OTP reset
// flow (needs SMTP configured server-side first, not yet done for this
// project).
async function updateProfile(token, profile) {
  return request("PATCH", "/api/auth/profiles/current", {
    token,
    body: { profile },
  });
}

// The desktop app holds a bearer token (not the cookie session the web app's
// @insforge/sdk middleware auto-refreshes), so it has to exchange the stored
// refresh token itself once the access token expires. Mirrors the SDK's own
// bearer-token refresh path: POST /api/auth/refresh?client_type=mobile with
// { refreshToken } in the body, no Authorization header needed.
function refreshSession(refreshToken) {
  return request("POST", "/api/auth/refresh?client_type=mobile", {
    body: { refreshToken },
  });
}

module.exports = {
  listLinkedProjects,
  createLinkedProject,
  updateLinkedProject,
  deleteLinkedProject,
  updateProfile,
  refreshSession,
};
