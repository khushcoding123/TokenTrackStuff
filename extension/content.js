// Metriq prompt optimizer — content script.
//
// Runs on ChatGPT / Claude / Gemini / Perplexity. Adds a floating ✦ button;
// when clicked it reads the prompt you're drafting in that site's input box,
// analyzes it with Metriq's engine (loaded from the extension, runs entirely in
// the page — your prompt never leaves the browser), and offers a focused
// rewrite you can drop straight back into the box. Tighter prompts mean the AI
// wastes fewer tokens, so you hit usage limits less often.

(() => {
  if (window.__metriqInjected) return; // guard against double-injection on SPA nav
  window.__metriqInjected = true;

  // --- engine (lazy, cached) -------------------------------------------------
  let enginePromise = null;
  function engine() {
    return (enginePromise ||= import(chrome.runtime.getURL("engine/analyzer.js")));
  }

  // --- prompt-input detection ------------------------------------------------
  // Per-site selectors, most-specific first, then a generic fallback. Looked up
  // on demand (at click time) so SPA re-renders never leave us with a stale ref.
  const SELECTORS = {
    "chatgpt.com": ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    "chat.openai.com": ["#prompt-textarea", "div[contenteditable='true']", "textarea"],
    "claude.ai": ["div[contenteditable='true'].ProseMirror", "div[contenteditable='true']", "textarea"],
    "gemini.google.com": ["div.ql-editor[contenteditable='true']", "rich-textarea textarea", "div[contenteditable='true']", "textarea"],
    "perplexity.ai": ["textarea[placeholder]", "textarea", "div[contenteditable='true']"],
  };

  function isUsable(el) {
    const r = el.getBoundingClientRect();
    return (
      r.width > 120 && r.height > 12 && r.bottom > 0 && r.top < innerHeight &&
      !el.disabled && el.getAttribute("aria-hidden") !== "true" && el.offsetParent !== null
    );
  }
  // Composers sit at the bottom of the page — prefer the lowest, then the largest.
  function pickBest(els) {
    return els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.top - ra.top || rb.width * rb.height - ra.width * ra.height;
    })[0];
  }
  function findInput() {
    const host = location.hostname.replace(/^www\./, "");
    const sels = SELECTORS[host] || ["div[contenteditable='true']", "textarea"];
    for (const sel of sels) {
      const els = [...document.querySelectorAll(sel)].filter(isUsable);
      if (els.length) return pickBest(els);
    }
    const all = [...document.querySelectorAll("textarea, div[contenteditable='true']")].filter(isUsable);
    return all.length ? pickBest(all) : null;
  }

  function getText(el) {
    return el.tagName === "TEXTAREA" || el.tagName === "INPUT" ? el.value : el.innerText;
  }

  // Write text so the site's framework (React/ProseMirror/Quill) actually
  // registers the change — a plain assignment gets overwritten on the next render.
  function setText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // contenteditable: select all, then insertText replaces it through the
      // normal input pipeline (fires beforeinput/input the editor listens for).
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
    // The biggest usage-limit saver: stop the model from generating a long, wrong
    // answer when the ask is unclear.
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

  const fab = el("button", "metriq-fab", "✦");
  fab.title = "Optimize this prompt with Metriq";
  document.body.appendChild(fab);

  let panel = null;
  function closePanel() {
    panel?.remove();
    panel = null;
  }

  function openPanel(content) {
    closePanel();
    panel = el("div", "metriq-panel");
    panel.appendChild(content);
    document.body.appendChild(panel);
  }

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

  function resultPanel(input, prompt, res) {
    const { before, improved, pct, saved } = res;
    const c = el("div", "metriq-body");

    c.appendChild(
      el(
        "div",
        "metriq-head",
        `<span>✦ Metriq</span><span class="metriq-badge metriq-${before.rating}">${before.rating} · ${before.breadthScore}/100</span>`
      )
    );

    if (pct > 0) {
      c.appendChild(el("div", "metriq-save", `↓ ~${pct}% fewer projected tokens (~${saved.toLocaleString()} saved)`));
    }

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
    use.onclick = () => {
      setText(input, improved);
      closePanel();
    };
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
  }

  fab.addEventListener("click", async () => {
    const input = findInput();
    if (!input) return tipPanel("Couldn't find the prompt box on this page. Click into it once, then try again.");
    const prompt = (getText(input) || "").trim();
    if (!prompt) return tipPanel("Type a prompt in the box first, then click ✦.");
    try {
      const res = await analyze(prompt);
      resultPanel(input, prompt, res);
    } catch (e) {
      tipPanel("Something went wrong analyzing that prompt.");
      console.error("[Metriq]", e);
    }
  });

  // Close the panel when clicking outside it (but not the FAB).
  document.addEventListener("mousedown", (e) => {
    if (panel && !panel.contains(e.target) && e.target !== fab) closePanel();
  });
})();
