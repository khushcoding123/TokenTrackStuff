// Metriq prompt optimizer — content script.
//
// Runs on every site but stays dormant unless it detects an AI chatbot — either
// a known AI domain, or any page with a chat-style composer (a large text box
// low on the page with an AI-ish placeholder or a send button beside it). That
// way it works on ChatGPT, Claude, Gemini, Grok, Kimi, DeepSeek, Perplexity, and
// new ones, without a hardcoded list.
//
// When it detects one, it adds a floating ✦ button. Click it: it reads the
// prompt you're drafting, analyzes it with Metriq's engine (loaded from the
// extension, runs entirely in the page — your prompt never leaves the browser),
// and offers a focused rewrite you can drop back into the box. Tighter prompts
// burn fewer tokens, so you hit usage limits less often.

(() => {
  if (window.__metriqInjected) return;
  window.__metriqInjected = true;

  // --- engine (lazy, cached) -------------------------------------------------
  let enginePromise = null;
  function engine() {
    return (enginePromise ||= import(chrome.runtime.getURL("engine/analyzer.js")));
  }

  // --- AI-chatbot detection --------------------------------------------------
  // Known AI chat domains — a fast positive so we don't depend on the DOM
  // heuristic for the big ones. The heuristic below catches everything else.
  const AI_HOSTS = [
    "chatgpt.com", "chat.openai.com", "claude.ai", "gemini.google.com", "aistudio.google.com",
    "perplexity.ai", "grok.com", "x.ai", "x.com", "twitter.com", "kimi.com", "kimi.moonshot.cn",
    "deepseek.com", "chat.deepseek.com", "copilot.microsoft.com", "m365.cloud.microsoft",
    "bing.com", "poe.com", "mistral.ai", "chat.mistral.ai", "huggingface.co", "meta.ai",
    "you.com", "pi.ai", "character.ai", "qwen.ai", "tongyi.aliyun.com", "doubao.com",
    "chatglm.cn", "yiyan.baidu.com", "lmarena.ai", "t3.chat", "phind.com", "cohere.com",
    "coral.cohere.com", "groq.com", "together.ai", "openrouter.ai", "huggingface.co",
  ];
  function isKnownAIHost() {
    const h = location.hostname.replace(/^www\./, "");
    return AI_HOSTS.some((d) => h === d || h.endsWith("." + d));
  }

  const AI_HINT = /ask|message|prompt|chat|reply|talk to|how can i help|send a message|ask anything|type (a|your)|write (a|your)|message .*(ai|assistant|bot)/i;

  function isUsable(el) {
    const r = el.getBoundingClientRect();
    return (
      r.width > 120 && r.height > 12 && r.bottom > 0 && r.top < innerHeight &&
      !el.disabled && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null
    );
  }
  function attrsOf(el) {
    return [
      el.getAttribute("placeholder"), el.getAttribute("aria-label"),
      el.getAttribute("data-placeholder"), el.getAttribute("title"), el.getAttribute("name"),
    ].filter(Boolean).join(" ").toLowerCase();
  }
  // A send button sitting near the composer is a strong "this is a chat" signal.
  function hasSendButtonNear(el) {
    const form = el.closest("form") || el.parentElement?.parentElement || el.parentElement;
    if (!form) return false;
    const btns = [...form.querySelectorAll("button, [role='button']")];
    return btns.some((b) => {
      const t = (b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").toLowerCase();
      return /send|submit|ask/.test(t) || b.querySelector("svg");
    });
  }
  function looksChatty(el) {
    if (AI_HINT.test(attrsOf(el))) return true;
    const r = el.getBoundingClientRect();
    return r.top > innerHeight * 0.4 && r.width > 240 && hasSendButtonNear(el);
  }

  // --- prompt-input detection (used when the ✦ button is clicked) ------------
  const SELECTORS = {
    "chatgpt.com": ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    "chat.openai.com": ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    "claude.ai": ["div[contenteditable='true'].ProseMirror", "div[contenteditable='true']", "textarea"],
    "gemini.google.com": ["div.ql-editor[contenteditable='true']", "rich-textarea textarea", "div[contenteditable='true']", "textarea"],
    "perplexity.ai": ["textarea[placeholder]", "textarea", "div[contenteditable='true']"],
  };
  function pickBest(els) {
    return els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.top - ra.top || rb.width * rb.height - ra.width * ra.height;
    })[0];
  }
  function findInput() {
    const host = location.hostname.replace(/^www\./, "");
    const sels = SELECTORS[host];
    if (sels) {
      for (const sel of sels) {
        const els = [...document.querySelectorAll(sel)].filter(isUsable);
        if (els.length) return pickBest(els);
      }
    }
    const all = [...document.querySelectorAll("textarea, div[contenteditable='true']")].filter(isUsable);
    return all.length ? pickBest(all) : null;
  }
  // The composer used to decide whether to show the button on unknown sites.
  function findChatComposer() {
    const all = [...document.querySelectorAll("textarea, div[contenteditable='true']")].filter(isUsable);
    all.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.top - ra.top || rb.width * rb.height - ra.width * ra.height;
    });
    for (const node of all) if (looksChatty(node)) return node;
    return null;
  }
  function shouldEnable() {
    return isKnownAIHost() || Boolean(findChatComposer());
  }

  function getText(el) {
    return el.tagName === "TEXTAREA" || el.tagName === "INPUT" ? el.value : el.innerText;
  }
  function setText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      const ok = document.execCommand("insertText", false, text);
      if (!ok) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
    }
  }

  // --- the rewrite (browser-tailored, reuses the analyzer's signals) ---------
  function normalizeIntent(p) {
    let s = String(p).trim().replace(/\s+/g, " ");
    if (!s) return s;
    s = s[0].toUpperCase() + s.slice(1);
    if (!/[.!?]$/.test(s)) s += ".";
    return s;
  }
  function improve(prompt, a) {
    const has = (id) => a.issues.some((i) => i.id === id);
    const parts = [normalizeIntent(prompt)];
    if (!a.hasFileRef && (has("vague-verb") || has("no-file-ref") || has("broad-scope"))) {
      parts.push("Be specific: name the exact file, function, feature, page, or error involved, and the correct behavior you expect.");
    }
    if (has("broad-scope") || has("heavy-change") || has("vague-verb") || has("no-constraint")) {
      parts.push("Make the smallest change necessary and don't touch unrelated parts.");
    }
    if (has("excessive-context")) {
      parts.push("Keep the answer concise — don't restate context I already gave.");
    }
    parts.push("If anything is ambiguous, ask one short clarifying question before writing a long answer.");
    return parts.join(" ");
  }
  async function analyze(prompt) {
    const { analyzePrompt } = await engine();
    const before = analyzePrompt(prompt);
    const improved = improve(prompt, before);
    const after = analyzePrompt(improved);
    const saved = Math.max(0, before.projectedTokens - after.projectedTokens);
    const pct = before.projectedTokens > 0 ? Math.round((saved / before.projectedTokens) * 100) : 0;
    return { before, improved, saved, pct };
  }

  // --- UI --------------------------------------------------------------------
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const escapeHtml = (s) => String(s).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));

  let fab = null;
  let panel = null;
  const closePanel = () => { panel?.remove(); panel = null; };
  const openPanel = (content) => { closePanel(); panel = el("div", "metriq-panel"); panel.appendChild(content); document.body.appendChild(panel); };

  function tipPanel(msg) {
    const c = el("div", "metriq-body");
    c.appendChild(el("div", "metriq-head", "<span>✦ Metriq</span>"));
    c.appendChild(el("p", "metriq-tip", msg));
    const close = el("button", "metriq-btn metriq-btn-ghost", "Close");
    close.onclick = closePanel;
    const row = el("div", "metriq-actions");
    row.appendChild(close);
    c.appendChild(row);
    openPanel(c);
  }
  function resultPanel(input, res) {
    const { before, improved, pct, saved } = res;
    const c = el("div", "metriq-body");
    c.appendChild(el("div", "metriq-head",
      `<span>✦ Metriq</span><span class="metriq-badge metriq-${before.rating}">${before.rating} · ${before.breadthScore}/100</span>`));
    if (pct > 0) c.appendChild(el("div", "metriq-save", `↓ ~${pct}% fewer projected tokens (~${saved.toLocaleString()} saved)`));
    const issues = before.issues.slice(0, 2);
    if (issues.length) {
      const ul = el("ul", "metriq-issues");
      for (const i of issues) ul.appendChild(el("li", null, escapeHtml(i.message)));
      c.appendChild(ul);
    }
    c.appendChild(el("div", "metriq-label", "Improved prompt"));
    const box = el("div", "metriq-improved");
    box.textContent = improved;
    c.appendChild(box);
    const actions = el("div", "metriq-actions");
    const use = el("button", "metriq-btn metriq-btn-primary", "Use this prompt");
    use.onclick = () => { setText(input, improved); closePanel(); };
    const copy = el("button", "metriq-btn", "Copy");
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(improved); copy.textContent = "Copied!"; } catch { copy.textContent = "Copy failed"; }
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    };
    const close = el("button", "metriq-btn metriq-btn-ghost", "Close");
    close.onclick = closePanel;
    actions.append(use, copy, close);
    c.appendChild(actions);
    openPanel(c);
  }

  function onFabClick() {
    const input = findInput();
    if (!input) return tipPanel("Couldn't find the prompt box on this page. Click into it once, then try again.");
    const prompt = (getText(input) || "").trim();
    if (!prompt) return tipPanel("Type a prompt in the box first, then click ✦.");
    analyze(prompt).then((res) => resultPanel(input, res)).catch((e) => {
      tipPanel("Something went wrong analyzing that prompt.");
      console.error("[Metriq]", e);
    });
  }

  function injectFab() {
    if (fab) return;
    fab = el("button", "metriq-fab", "✦");
    fab.title = "Optimize this prompt with Metriq";
    fab.addEventListener("click", onFabClick);
    document.body.appendChild(fab);
    document.addEventListener("mousedown", (e) => {
      if (panel && !panel.contains(e.target) && e.target !== fab) closePanel();
    });
  }

  // Show the button only once we detect an AI chat. Known hosts show it right
  // away; unknown sites wait for a chat composer to appear (SPAs load late),
  // re-checking on DOM changes for up to 20s, then giving up.
  function maybeInject() {
    if (fab) return true;
    if (shouldEnable()) { injectFab(); return true; }
    return false;
  }
  if (!maybeInject()) {
    let t;
    const obs = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => { if (maybeInject()) obs.disconnect(); }, 400);
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 20000);
  }
})();
