# Metriq — Prompt Optimizer (Chrome extension)

Rewrites the prompt you're about to send in **any AI chatbot** — ChatGPT, Claude,
Gemini, Grok, Kimi, DeepSeek, Perplexity, Copilot, and new ones — into a focused
one, so the AI wastes fewer tokens and you hit usage limits less often.

It reuses Metriq's prompt analyzer (`packages/core`) and runs **entirely in the
page** — your prompt never leaves the browser. No account, no network calls.

**Why it asks to run on all sites:** so it can detect *any* AI chatbot (a known
AI domain, or any page with a chat-style composer) instead of a fixed list. It
stays completely dormant on non-chat pages — no button, no reading, nothing — and
never sends data anywhere. The ✦ button only appears once it detects a chat.

## Install (developer / unpacked)

1. Open **`chrome://extensions`** in Chrome (or Edge).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this **`extension/`** folder.
4. Metriq now activates automatically on any AI chatbot you open.

## Use it

1. Go to e.g. **chatgpt.com** or **claude.ai** and type a prompt in the chat box.
2. Click the floating **✦** button (bottom-right of the page).
3. A panel shows your prompt's breadth score, the issues it found, an **improved
   prompt**, and the projected token savings.
4. Click **Use this prompt** to drop it straight into the chat box (or **Copy**),
   then review and send.

## What it does to a prompt

It keeps your intent and layers on what vague prompts miss — specificity, a
scope guard, and a "ask one clarifying question before writing a long answer"
instruction (the biggest saver: it stops the model from generating a long, wrong
response). Example:

> *"fix the dashboard"* → *"Fix the dashboard. Be specific: name the exact file,
> function, feature, page, or error involved… Make the smallest change necessary
> and don't touch unrelated parts. If anything is ambiguous, ask one short
> clarifying question before writing a long answer."*

## Notes

- `engine/` mirrors `packages/core` (`analyzer.js`, `rewrite.js`, `tokenizer.js`,
  `config.js`) — the same analysis engine as the CLI, web `/optimize`, and the
  desktop app. Keep them in sync if the core scoring changes.
- Site DOMs change often; input detection is defensive with a generic fallback,
  but if the ✦ panel says it can't find the box, click into the box once and
  retry.
