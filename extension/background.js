// Metriq background service worker.
//
// Owns the one thing a content script can't do from inside a page with a strict
// CSP (ChatGPT, Claude, etc. block cross-origin fetch from injected scripts):
// call an LLM. Content scripts post { type: "metriq-rewrite", prompt } and get
// back { ok: true, text } or { ok: false, error, code }.
//
// Key sourcing is deliberately pluggable so a hosted proxy can be dropped in
// later without changing the message shape the content script speaks:
//   mode "direct" -> user's own key, straight to api.anthropic.com  (shipping now)
//   mode "proxy"  -> your backend holds one shared key              (future, stubbed)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-8";

// The whole fix lives here: a domain-agnostic optimizer prompt. It tailors the
// rewrite to whatever the user actually asked about instead of bolting on
// code-review scaffolding, which is what made a biology prompt come back asking
// the model to "name the file, function, or error".
const SYSTEM_PROMPT = [
  "You rewrite a user's prompt so the AI assistant they're about to send it to",
  "gives a sharper, more useful answer while wasting fewer tokens. The prompt",
  "can be about anything — coding, biology, writing, cooking, math, business.",
  "",
  "Rules:",
  "- Preserve the original intent, topic, and domain exactly. Never change the subject.",
  "- Make the request specific and unambiguous. Add precise scope, the level of detail",
  "  wanted, and a useful output format ONLY when it genuinely fits this prompt.",
  "- Tailor every addition to THIS prompt's actual subject. Never bolt on instructions",
  "  that don't fit the topic (e.g. never tell a biology question to \"name the file,",
  "  function, page, or error\").",
  "- If the prompt is already clear and focused, make only small improvements.",
  "- Do NOT answer the prompt. Do NOT add preamble, commentary, quotes, or explanations.",
  "- Output ONLY the rewritten prompt text, nothing else.",
].join("\n");

async function getSettings() {
  const d = await chrome.storage.local.get([
    "apiKey",
    "model",
    "mode",
    "proxyUrl",
    "aiEnabled",
  ]);
  return {
    apiKey: (d.apiKey || "").trim(),
    model: d.model || DEFAULT_MODEL,
    mode: d.mode || "direct",
    proxyUrl: (d.proxyUrl || "").trim(),
    aiEnabled: d.aiEnabled !== false, // default on
  };
}

// A model may wrap its answer in quotes even when told not to; peel one layer.
function stripWrappingQuotes(t) {
  const m = t.match(/^"([\s\S]+)"$/) || t.match(/^'([\s\S]+)'$/);
  return m ? m[1].trim() : t;
}

function textFromMessage(data) {
  return (data?.content || [])
    .filter((b) => b && b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Phase 1: user's own key, direct to Anthropic. The dangerous-direct-browser
// header is required for any browser-origin request (the extension service
// worker still carries an Origin); the key never leaves the user's machine
// except in this request they authorized.
async function rewriteDirect(prompt, s) {
  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": s.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: s.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return { ok: false, code: "network", error: "Couldn't reach the Claude API." };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    return { ok: false, code: res.status, error: msg };
  }
  const text = textFromMessage(data);
  if (!text) return { ok: false, code: "empty", error: "Empty response from the model." };
  return { ok: true, text: stripWrappingQuotes(text) };
}

// Phase 2 placeholder — same return shape as rewriteDirect. Point proxyUrl at a
// backend endpoint that holds the shared key; flip mode to "proxy" in settings.
// Nothing else in the extension has to change.
async function rewriteViaProxy(prompt, s) {
  let res;
  try {
    res = await fetch(s.proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt, model: s.model }),
    });
  } catch (e) {
    return { ok: false, code: "network", error: "Couldn't reach the rewrite service." };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, code: res.status, error: data?.error || `HTTP ${res.status}` };
  }
  const text = (data?.text || "").trim();
  return text
    ? { ok: true, text: stripWrappingQuotes(text) }
    : { ok: false, code: "empty", error: "Empty response from the service." };
}

async function handleRewrite(prompt) {
  const p = String(prompt || "").trim();
  if (!p) return { ok: false, code: "empty-input", error: "Nothing to rewrite." };

  const s = await getSettings();
  if (!s.aiEnabled) {
    return { ok: false, code: "disabled", error: "AI rewrite is turned off in settings." };
  }
  if (s.mode === "proxy" && s.proxyUrl) return rewriteViaProxy(p, s);
  if (!s.apiKey) return { ok: false, code: "no-key", error: "No Claude API key set." };
  return rewriteDirect(p, s);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;

  if (msg.type === "metriq-rewrite") {
    handleRewrite(msg.prompt)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true; // keep the channel open for the async response
  }

  // Settings page uses this to validate a key without leaking model output.
  if (msg.type === "metriq-test-key") {
    handleRewrite("Say the single word: ok")
      .then((r) => sendResponse(r.ok ? { ok: true } : r))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }

  if (msg.type === "metriq-open-options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

// Clicking the toolbar icon opens settings (there is no popup).
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
