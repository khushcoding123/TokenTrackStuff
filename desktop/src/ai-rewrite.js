// Calls the real Claude API to tailor a capture-popup rewrite to whatever the
// user actually typed, instead of the offline template from
// packages/optimize/generator.js. Ported from extension/background.js's
// rewriteDirect() — same system prompt, same request/response shape — so the
// desktop app and the browser extension behave identically. Runs only in the
// main process (Node's native fetch, no browser CSP/Origin concerns), never
// inside packages/core, which stays offline-only.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-8";

const MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 — most capable (default)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — balanced" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest & cheapest" },
];

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

async function rewriteWithClaude(prompt, { apiKey, model } = {}) {
  const p = String(prompt || "").trim();
  if (!p) return { ok: false, code: "empty-input", error: "Nothing to rewrite." };
  if (!apiKey) return { ok: false, code: "no-key", error: "No Claude API key set." };

  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: p }],
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

module.exports = { rewriteWithClaude, MODELS, DEFAULT_MODEL };
