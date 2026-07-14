(async function () {
  const viewLogin = document.getElementById("view-login");
  const viewHome = document.getElementById("view-home");
  const waitingMsg = document.getElementById("waiting-msg");
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");
  const btnLinkProject = document.getElementById("btn-link-project");
  const btnLinkGithub = document.getElementById("btn-link-github");
  const githubLinkForm = document.getElementById("github-link-form");
  const githubUrlInput = document.getElementById("github-url-input");
  const btnGithubCancel = document.getElementById("btn-github-cancel");
  const btnGotoProjects = document.getElementById("btn-goto-projects");
  const projectsList = document.getElementById("projects-list");
  const projectsEmpty = document.getElementById("projects-empty");
  const projectsError = document.getElementById("projects-error");
  const btnOpenCapture = document.getElementById("btn-open-capture");
  const captureHotkeyLabel = document.getElementById("capture-hotkey-label");
  const settingsHotkeyLabel = document.getElementById("settings-hotkey-label");
  const toolsList = document.getElementById("tools-list");
  const accessibilityList = document.getElementById("accessibility-list");
  const overviewActiveProject = document.getElementById("overview-active-project");
  const recentActivityList = document.getElementById("recent-activity-list");
  const recentActivityEmpty = document.getElementById("recent-activity-empty");
  const ovDate = document.getElementById("ov-date");
  const ovHeroName = document.getElementById("ov-hero-name");
  const ovStatAvgPct = document.getElementById("ov-stat-avg-pct");
  const ovStatProjects = document.getElementById("ov-stat-projects");
  const ovInsights = document.getElementById("ov-insights");
  const btnGotoStudio = document.getElementById("btn-goto-studio");
  const btnOvFirstPrompt = document.getElementById("btn-ov-first-prompt");
  const ovToolsQuick = document.getElementById("ov-tools-quick");
  const btnGotoTools = document.getElementById("btn-goto-tools");

  // status: "supported" (a named platform Metriq's copy explicitly targets)
  // or "generic" (the catch-all bucket) — an honest two-way split, not a
  // fabricated maturity tier. All five toggles are identically implemented
  // today (local preference only, see the page subtitle); there's no real
  // per-tool Beta/Preview distinction to report.
  const AVAILABLE_TOOLS = [
    {
      id: "claude",
      label: "Claude",
      icon: "sparkle",
      logoFile: "claude.png",
      description: "Best for long-context reasoning and document-heavy work.",
      status: "supported",
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      icon: "knot",
      logoFile: "chatgpt.webp",
      description: "Broad general-purpose assistant across OpenAI's models.",
      status: "supported",
    },
    {
      id: "vscode",
      label: "VS Code",
      icon: "brackets",
      logoFile: "vscode.svg",
      description: "Coding assistants and extensions inside your editor.",
      status: "supported",
    },
    {
      id: "cursor",
      label: "Cursor",
      icon: "cursor",
      logoFile: "cursor.png",
      description: "AI-native editor built around in-context coding.",
      status: "supported",
    },
    {
      id: "other",
      label: "Other / terminal",
      icon: "terminal",
      // No logoFile — this is a generic catch-all, not a real brand.
      description: "Any other AI tool, including CLI-based assistants.",
      status: "generic",
    },
  ];

  // Purely informational — not toggleable, nothing persisted. Honest
  // "not built yet" placeholders rather than inert copies of the real
  // toggles above.
  const FUTURE_TOOLS = [
    {
      label: "Windsurf",
      icon: "wave",
      logoFile: "windsurf.jpeg",
      description: "Agentic in-editor AI coding, similar footprint to Cursor.",
    },
    {
      label: "Gemini",
      icon: "gemini",
      logoFile: "gemini.png",
      description: "Google's multimodal model family, built into Workspace and Search.",
    },
    {
      label: "GitHub Copilot Chat",
      icon: "octo",
      logoFile: "github-copilot.png",
      description: "In-IDE chat layered on top of Copilot completions.",
    },
    {
      label: "Perplexity",
      icon: "perplexity",
      logoFile: "perplexity.webp",
      description: "AI answer engine with cited, live web search.",
    },
  ];

  // Fallback glyphs — stylized single-color marks used until a real logo
  // file (see desktop/renderer/assets/logos/README.md) exists for that
  // tool, and permanently for "Other / terminal" (no real brand). Not
  // literal logo reproductions: distinct from each other and from generic
  // chat/app iconography.
  const TOOL_ICONS = {
    sparkle:
      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    knot: '<circle cx="12" cy="7.5" r="3"/><circle cx="7" cy="15.5" r="3"/><circle cx="17" cy="15.5" r="3"/>',
    brackets: '<path d="m8 4-6 8 6 8M16 4l6 8-6 8"/>',
    cursor: '<path d="m4 4 7 17 2.5-7.5L21 11 4 4Z"/>',
    wave: '<path d="M3 15c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
    octo: '<circle cx="12" cy="9" r="5"/><path d="M7 13v3a2 2 0 0 0 2 2M17 13v3a2 2 0 0 1-2 2M9 9h.01M15 9h.01M6 20l1.5-2M18 20l-1.5-2"/>',
    gemini: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
    perplexity: '<circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    terminal: '<path d="m5 7 5 5-5 5M12 17h7"/>',
  };

  function svgIcon(pathMarkup, extraClass = "") {
    return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
  }

  // Renders a tool's real logo file if one exists (see assets/logos/
  // README.md); silently falls back to the hand-drawn glyph if the file is
  // missing (a normal 404 while logos are added one at a time, not an
  // error worth surfacing) or the tool has none (e.g. "Other / terminal").
  function renderToolIcon(container, tool) {
    container.innerHTML = "";
    if (!tool.logoFile) {
      container.innerHTML = svgIcon(TOOL_ICONS[tool.icon] || "");
      return;
    }
    const img = document.createElement("img");
    img.className = "itg-tool-logo";
    img.src = `assets/logos/${tool.logoFile}`;
    img.alt = "";
    img.addEventListener(
      "error",
      () => {
        container.innerHTML = svgIcon(TOOL_ICONS[tool.icon] || "");
      },
      { once: true }
    );
    container.append(img);
  }

  // --- Overview (home) -----------------------------------------------------
  // The redesigned front-door page: hero greeting, metric row with a one-time
  // count-up, active-project summary, activity timeline, and a suggestions
  // panel derived deterministically from local state (no network, no LLM).

  const OV_ICON_PATHS = {
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    folderPlus:
      '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 10v6M9 13h6"/>',
    lightbulb:
      '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 3.4 10.9c-.5.4-.9 1.1-1.1 2.1H9.7c-.2-1-.6-1.7-1.1-2.1A6 6 0 0 1 12 3Z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>',
    trendingUp: '<path d="m3 17 6-6 4 4 7-7"/><path d="M14 8h6v6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
  };

  if (ovDate) {
    ovDate.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  // Insights need both the capture summary and the projects list; each
  // refresh path stores its half here and re-renders.
  let ovSummary = null;
  let ovProjectCount = null;

  // One-time count-up per metric element on first paint; later refreshes set
  // the value directly (re-animating on every sync reads as glitchy, not
  // polished). Respects both the OS reduced-motion preference and the app's
  // own Reduce Motion setting — the CSS blanket guard can't reach JS loops.
  const ovAnimatedEls = new WeakSet();
  const ovMetricAnims = new WeakMap();

  function setMetricValue(el, value, format) {
    if (!el) return;
    const prev = ovMetricAnims.get(el);
    if (prev) prev.cancelled = true;

    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("reduce-motion");
    const firstPaint = !ovAnimatedEls.has(el);
    ovAnimatedEls.add(el);

    if (!firstPaint || reduceMotion || !(value > 0)) {
      el.textContent = format(value);
      return;
    }

    const state = { cancelled: false };
    ovMetricAnims.set(el, state);
    const duration = 600;
    const start = performance.now();
    function tick(now) {
      if (state.cancelled) return;
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = format(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderOverviewInsights() {
    if (!ovInsights) return;
    const suggestions = [];

    if (ovProjectCount === 0) {
      suggestions.push({
        icon: "folderPlus",
        title: "Connect a project",
        desc: "Link a local folder so prompt checks can point at real files instead of guessing.",
        go: () => showPage("projects"),
      });
    }
    if (ovSummary && ovSummary.totalCaptures === 0) {
      suggestions.push({
        icon: "zap",
        title: "Analyze your first prompt",
        desc: "Run a prompt through Metriq before sending it to Claude, ChatGPT, or Cursor.",
        go: () => window.metriq.openCapture(),
      });
    }
    if (ovSummary && ovSummary.totalCaptures > 0 && ovSummary.avgSavedPct > 0) {
      suggestions.push({
        icon: "trendingUp",
        title: `Saving ~${ovSummary.avgSavedPct}% per prompt`,
        desc: "Focused rewrites are trimming your exploration cost. Keep it up.",
        positive: true,
      });
    }
    suggestions.push(
      {
        icon: "lightbulb",
        title: "Name real files in prompts",
        desc: "A concrete file reference bounds how far the AI explores. It's the single biggest token saver.",
      },
      {
        icon: "shield",
        title: "Add a scope guard",
        desc: 'Saying what not to touch ("only change X") keeps the model from wandering the repo.',
      }
    );

    ovInsights.innerHTML = "";
    for (const s of suggestions.slice(0, 4)) {
      const row = document.createElement(s.go ? "button" : "div");
      row.className = "ov-insight" + (s.positive ? " is-positive" : "");
      if (s.go) row.type = "button";

      const iconWrap = document.createElement("span");
      iconWrap.className = "ov-insight-icon";
      iconWrap.innerHTML = svgIcon(OV_ICON_PATHS[s.icon] || OV_ICON_PATHS.lightbulb);

      const text = document.createElement("span");
      text.className = "ov-insight-text";
      const title = document.createElement("span");
      title.className = "ov-insight-title";
      title.textContent = s.title;
      const desc = document.createElement("span");
      desc.className = "ov-insight-desc";
      desc.textContent = s.desc;
      text.append(title, desc);

      row.append(iconWrap, text);
      if (s.go) {
        const chevron = document.createElement("span");
        chevron.className = "ov-insight-chevron";
        chevron.innerHTML = svgIcon(OV_ICON_PATHS.chevronRight);
        row.append(chevron);
        row.addEventListener("click", s.go);
      }
      ovInsights.append(row);
    }
  }

  // Read-only glance at the Tools page's saved preference chips — fills the
  // rest of the side column below Suggestions with real (already-persisted)
  // data instead of stretching Suggestions itself to an arbitrary height.
  async function renderOverviewTools() {
    if (!ovToolsQuick) return;
    const selected = await window.metriq.getTools();
    ovToolsQuick.innerHTML = "";

    if (!selected || selected.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ov-empty";
      empty.innerHTML = `
        <div class="ov-empty-icon">${svgIcon(OV_ICON_PATHS.lightbulb)}</div>
        <p class="ov-empty-title">No tools set yet</p>
        <p class="ov-empty-desc">Pick the coding tools you use so feedback and suggestions can be framed for them.</p>
      `;
      const chooseBtn = document.createElement("button");
      chooseBtn.type = "button";
      chooseBtn.className = "ov-btn-secondary";
      chooseBtn.textContent = "Choose your tools";
      chooseBtn.addEventListener("click", () => showPage("tools"));
      empty.append(chooseBtn);
      ovToolsQuick.append(empty);
      return;
    }

    const row = document.createElement("div");
    row.className = "ov-tools-quick";
    for (const id of selected) {
      const tool = AVAILABLE_TOOLS.find((t) => t.id === id);
      if (!tool) continue;
      const chip = document.createElement("span");
      chip.className = "ov-tool-chip";
      const iconWrap = document.createElement("span");
      iconWrap.className = "ov-tool-chip-icon";
      iconWrap.innerHTML = svgIcon(TOOL_ICONS[tool.icon] || "");
      const label = document.createElement("span");
      label.textContent = tool.label;
      chip.append(iconWrap, label);
      row.append(chip);
    }
    ovToolsQuick.append(row);
  }

  // --- Semantic alert (replaces raw error-text paragraphs) -----------------
  // Reusable across Projects' load/link/rescan/remove errors and the
  // Settings display-name form — one visual component, driven by a
  // data-variant attribute, per desktop/DESIGN.md §8.

  const ALERT_ICON_PATHS = {
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    warning: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    success: '<path d="M20 7 9 18l-5-5"/>',
  };

  function setAlert(container, message, variant = "error") {
    if (!container) return;
    if (!message) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }
    container.dataset.variant = variant;
    container.classList.remove("hidden");
    container.innerHTML =
      svgIcon(ALERT_ICON_PATHS[variant] || ALERT_ICON_PATHS.error, "alert-icon icon-sm") +
      `<p class="alert-message"></p>`;
    container.querySelector(".alert-message").textContent = message;
  }

  // --- Theme toggle -----------------------------------------------------
  // The View Transitions API is the primary path (clip-path wipe reveals
  // the new theme top-to-bottom, old snapshot just sits still underneath);
  // a scaling curtain div is the fallback for a Chromium build without it.

  const SUN_PATH =
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const MOON_PATH = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>';

  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const themeToggleIcon = document.getElementById("theme-toggle-icon");
  const themeToggleLabel = document.getElementById("theme-toggle-label");
  const btnToggleThemeRail = document.getElementById("btn-toggle-theme-rail");
  const themeToggleIconRail = document.getElementById("theme-toggle-icon-rail");

  let curtainActive = false;

  function applyTheme(theme) {
    document.documentElement.classList.toggle("light", theme === "light");
    const iconMarkup = theme === "light" ? SUN_PATH : MOON_PATH;
    if (themeToggleIcon) themeToggleIcon.innerHTML = iconMarkup;
    if (themeToggleIconRail) themeToggleIconRail.innerHTML = iconMarkup;
    if (themeToggleLabel) themeToggleLabel.textContent = theme === "light" ? "Light" : "Dark";
  }

  function playCurtainFallback(applyFn) {
    if (curtainActive) return applyFn();
    curtainActive = true;
    const curtain = document.createElement("div");
    curtain.className = "theme-wipe-curtain";
    document.body.append(curtain);

    requestAnimationFrame(() => curtain.classList.add("is-active"));

    let applied = false;
    const finish = () => {
      if (applied) return;
      applied = true;
      applyFn();
      curtain.remove();
      curtainActive = false;
    };
    curtain.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 700); // safety net if transitionend doesn't fire
  }

  function toggleTheme() {
    const next = document.documentElement.classList.contains("light") ? "dark" : "light";
    const flip = () => {
      applyTheme(next);
      window.metriq.setTheme(next);
    };

    if (typeof document.startViewTransition === "function") {
      const vt = document.startViewTransition(flip);
      vt.finished.catch(() => {});
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flip();
      return;
    }
    playCurtainFallback(flip);
  }

  btnToggleTheme?.addEventListener("click", toggleTheme);
  btnToggleThemeRail?.addEventListener("click", toggleTheme);

  window.metriq.getTheme().then((theme) => applyTheme(theme));

  // --- Prompt Studio ----------------------------------------------------
  // Reuses the exact same IPC surface as the ⌘⇧M capture window
  // (getCaptureContext/analyzePrompt/copyToClipboard — see main.js's
  // capture:* handlers) against the real active project, just as a full
  // page with the complete issue list, relevant-files list, and a
  // session-only revision history instead of the capture window's compact
  // single-result view. Ported from the web app's /prompt-studio, which
  // had a fake "model response" panel — this version has none, since
  // every number here already comes from the real engine.

  const psContext = document.getElementById("ps-context");
  const psInput = document.getElementById("ps-input");
  const psStatusBanner = document.getElementById("ps-status-banner");
  const psHeaderBadge = document.getElementById("ps-header-badge");
  const psCharCount = document.getElementById("ps-char-count");
  const psTokenEstimate = document.getElementById("ps-token-estimate");
  const psBtnClear = document.getElementById("ps-btn-clear");
  const psResults = document.getElementById("ps-results");
  const psRating = document.getElementById("ps-rating");
  const psScore = document.getElementById("ps-score");
  const psSavings = document.getElementById("ps-savings");
  const psIssuesBlock = document.getElementById("ps-issues-block");
  const psIssues = document.getElementById("ps-issues");
  const psFilesBlock = document.getElementById("ps-files-block");
  const psFiles = document.getElementById("ps-files");
  const psFocused = document.getElementById("ps-focused");
  const psBtnCopy = document.getElementById("ps-btn-copy");
  const psBtnSnapshot = document.getElementById("ps-btn-snapshot");
  const psBtnSnapshotEmpty = document.getElementById("ps-btn-snapshot-empty");
  const psHistoryList = document.getElementById("ps-history-list");
  const psHistoryEmpty = document.getElementById("ps-history-empty");

  let psInitialized = false;
  let psDebounceTimer = null;
  let psLatestResult = null;
  let psVersionCounter = 0;
  const psHistory = []; // session-only: { version, timestamp, prompt, result }

  const PS_FOLDER_ICON = '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>';
  const PS_FOLDER_PLUS_ICON =
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 10v6M9 13h6"/>';

  function psRenderContext(activeProject) {
    psContext.classList.toggle("is-linked", Boolean(activeProject));
    psContext.classList.toggle("is-warning", !activeProject);
    psContext.innerHTML = "";

    const icon = document.createElement("span");
    icon.className = "ps-context-icon";
    icon.innerHTML = svgIcon(activeProject ? PS_FOLDER_ICON : PS_FOLDER_PLUS_ICON, "icon-sm");

    const text = document.createElement("span");
    text.className = "ps-context-text";
    if (activeProject) {
      text.innerHTML = `Checking against <strong></strong>`;
      text.querySelector("strong").textContent = activeProject.name;
      psContext.append(icon, text);
      return;
    }

    text.textContent = "No project linked. Analysis won't be file-aware.";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "ps-context-action";
    action.textContent = "Link a project";
    action.addEventListener("click", () => showPage("projects"));
    psContext.append(icon, text, action);
  }

  function psUpdateToolbar() {
    const len = psInput.value.length;
    psCharCount.textContent = `${len.toLocaleString()} character${len === 1 ? "" : "s"}`;
    psTokenEstimate.textContent = psLatestResult
      ? `~${psLatestResult.promptTokens.toLocaleString()} tokens`
      : "0 tokens";
  }

  function psRenderResult(result) {
    psResults.classList.remove("hidden");
    psStatusBanner.classList.add("hidden");
    psHeaderBadge.textContent = "Live analysis";
    psHeaderBadge.classList.remove("ps-header-badge-idle");

    psRating.textContent = result.rating;
    psRating.className = `capture-badge rating-${result.rating}`;
    psScore.textContent = `breadth ${result.breadthScore}/100`;
    psSavings.textContent =
      result.savedTokens > 0 ? `saves ~${result.savedTokens} tokens (${result.savedPct}%)` : "";

    const issues = result.issues || [];
    psIssuesBlock.classList.toggle("hidden", issues.length === 0);
    psIssues.innerHTML = "";
    for (const issue of issues) {
      const li = document.createElement("li");
      li.textContent = issue.message;
      psIssues.append(li);
    }

    const files = result.relevantFiles || [];
    psFilesBlock.classList.toggle("hidden", files.length === 0);
    psFiles.innerHTML = "";
    for (const file of files) {
      const span = document.createElement("span");
      span.textContent = file;
      psFiles.append(span);
    }

    psFocused.textContent = result.focusedPrompt;
    psLatestResult = result;
    psUpdateToolbar();
  }

  function psClearResult() {
    psResults.classList.add("hidden");
    psStatusBanner.classList.remove("hidden");
    psHeaderBadge.textContent = "Ready";
    psHeaderBadge.classList.add("ps-header-badge-idle");
    psLatestResult = null;
    psUpdateToolbar();
  }

  // Shared by the results panel's button and the empty revision-history
  // panel's button — with nothing analyzed yet, "saving" has nothing to
  // capture, so it focuses the editor instead of pretending to save.
  function psSaveSnapshot(triggerBtn) {
    if (!psLatestResult) {
      psInput.focus();
      return;
    }
    psHistory.push({
      version: ++psVersionCounter,
      timestamp: new Date().toISOString(),
      prompt: psInput.value.trim(),
      result: psLatestResult,
    });
    psRefreshHistory();
    const original = triggerBtn.textContent;
    triggerBtn.textContent = "Saved!";
    setTimeout(() => {
      triggerBtn.textContent = original;
    }, 1200);
  }

  const PS_RESTORE_ICON = '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>';

  function psRenderHistoryRow(entry) {
    const li = document.createElement("li");
    li.className = "ps-history-item";

    const marker = document.createElement("span");
    marker.className = "ps-history-version";
    marker.textContent = `v${entry.version}`;

    const body = document.createElement("div");
    body.className = "ps-history-body";

    const prompt = document.createElement("p");
    prompt.className = "ps-history-prompt";
    prompt.textContent = entry.prompt.length > 90 ? entry.prompt.slice(0, 90) + "…" : entry.prompt;

    const meta = document.createElement("div");
    meta.className = "ps-history-meta";
    const time = document.createElement("span");
    time.textContent = timeAgo(entry.timestamp);
    const changes = document.createElement("span");
    changes.className = "ps-history-changes";
    changes.textContent =
      entry.result.savedTokens > 0
        ? `${entry.result.rating} · saved ${entry.result.savedTokens} tokens`
        : entry.result.rating;
    meta.append(time, changes);

    body.append(prompt, meta);

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "ps-history-restore";
    restoreBtn.innerHTML = svgIcon(PS_RESTORE_ICON, "icon-sm") + "<span>Restore</span>";
    restoreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      psInput.value = entry.prompt;
      psRenderResult(entry.result);
      psInput.focus();
    });

    li.append(marker, body, restoreBtn);
    li.addEventListener("click", () => restoreBtn.click());
    return li;
  }

  function psRefreshHistory() {
    psHistoryList.innerHTML = "";
    psHistoryEmpty.classList.toggle("hidden", psHistory.length > 0);
    for (const entry of [...psHistory].reverse()) {
      psHistoryList.append(psRenderHistoryRow(entry));
    }
  }

  // Re-fetched every time the page is shown (not just on first load) so the
  // context row stays accurate if the user links a project, comes back via
  // the "Link a project" action above, then returns here.
  async function psRefreshContext() {
    const { activeProject } = await window.metriq.getCaptureContext();
    psRenderContext(activeProject);
  }

  async function initPromptStudio() {
    if (psInitialized) return;
    psInitialized = true;

    await psRefreshContext();

    psInput.addEventListener("input", () => {
      psUpdateToolbar();
      clearTimeout(psDebounceTimer);
      const prompt = psInput.value.trim();
      if (!prompt) {
        psClearResult();
        return;
      }
      psDebounceTimer = setTimeout(async () => {
        const result = await window.metriq.analyzePrompt(prompt);
        psRenderResult(result);
      }, 350);
    });

    psBtnClear.addEventListener("click", () => {
      psInput.value = "";
      psClearResult();
      psInput.focus();
    });

    psBtnCopy.addEventListener("click", async () => {
      if (!psLatestResult) return;
      await window.metriq.copyToClipboard(psLatestResult.focusedPrompt, {
        promptTokens: psLatestResult.promptTokens,
        projectedTokens: psLatestResult.projectedTokens,
        savedTokens: psLatestResult.savedTokens,
        savedPct: psLatestResult.savedPct,
        rating: psLatestResult.rating,
      });
      refreshStats(); // same real capture stats Overview/Impact read — keep them in sync
      const original = psBtnCopy.textContent;
      psBtnCopy.textContent = "Copied!";
      setTimeout(() => {
        psBtnCopy.textContent = original;
      }, 1200);
    });

    psBtnSnapshot.addEventListener("click", () => psSaveSnapshot(psBtnSnapshot));
    psBtnSnapshotEmpty.addEventListener("click", () => psSaveSnapshot(psBtnSnapshotEmpty));

    psUpdateToolbar();
    psRefreshHistory();
  }

  // --- Page navigation ------------------------------------------------------

  const navButtons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".page");

  function showPage(pageName) {
    for (const page of pages) {
      page.classList.toggle("hidden", page.id !== `page-${pageName}`);
    }
    for (const btn of navButtons) {
      btn.classList.toggle("is-active", btn.dataset.page === pageName);
    }
    document.querySelector(".page-content")?.scrollTo({ top: 0 });
  }

  for (const btn of navButtons) {
    btn.addEventListener("click", () => {
      showPage(btn.dataset.page);
      if (btn.dataset.page === "usage") refreshUsage();
      if (btn.dataset.page === "prompt-studio") {
        initPromptStudio();
        psRefreshContext();
      }
    });
  }

  btnGotoProjects?.addEventListener("click", () => showPage("projects"));

  btnGotoStudio?.addEventListener("click", () => {
    showPage("prompt-studio");
    initPromptStudio();
    psRefreshContext();
  });

  btnOvFirstPrompt?.addEventListener("click", () => window.metriq.openCapture());

  btnGotoTools?.addEventListener("click", () => showPage("tools"));

  document.getElementById("btn-sidebar-avatar")?.addEventListener("click", () => showPage("settings"));

  // --- Auth views -----------------------------------------------------------

  function showLoggedOut() {
    viewHome.classList.add("hidden");
    viewLogin.classList.remove("hidden");
    waitingMsg.classList.add("hidden");
  }

  function applyIdentity(session) {
    const displayName = session.name || session.email || "there";
    if (ovHeroName) {
      // First name if we have one, else the email's local part — ", Malhar"
      const first = (session.name || "").trim().split(/\s+/)[0] || (session.email || "").split("@")[0];
      ovHeroName.textContent = first ? `, ${first}` : "";
    }
    document.getElementById("avatar-initial").textContent = displayName.charAt(0).toUpperCase();
    const sidebarAvatar = document.getElementById("btn-sidebar-avatar");
    if (sidebarAvatar) sidebarAvatar.title = `Signed in as ${displayName}`;
    document.getElementById("settings-identity-name").textContent = session.name || session.email;
    document.getElementById("settings-identity-email").textContent = session.email || "";
    document.getElementById("settings-avatar-initial").textContent = displayName.charAt(0).toUpperCase();
  }

  function showLoggedIn(session) {
    applyIdentity(session);

    viewLogin.classList.add("hidden");
    viewHome.classList.remove("hidden");
    showPage("overview");
    refreshProjects();
    initTools();
    initFutureIntegrations();
    initPresets();
    renderOverviewTools();
    initAccessibility();
    refreshStats();
  }

  // --- Display name editing -------------------------------------------------

  const settingsNameDisplay = document.getElementById("settings-name-display");
  const settingsNameForm = document.getElementById("settings-name-form");
  const settingsNameInput = document.getElementById("settings-name-input");
  const settingsNameError = document.getElementById("settings-name-error");
  const btnEditName = document.getElementById("btn-edit-name");
  const btnCancelName = document.getElementById("btn-cancel-name");

  function openNameForm() {
    setAlert(settingsNameError, "");
    settingsNameInput.value = document.getElementById("settings-identity-name").textContent;
    settingsNameDisplay.classList.add("hidden");
    settingsNameForm.classList.remove("hidden");
    settingsNameInput.focus();
    settingsNameInput.select();
  }

  function closeNameForm() {
    settingsNameForm.classList.add("hidden");
    settingsNameDisplay.classList.remove("hidden");
    setAlert(settingsNameError, "");
  }

  btnEditName?.addEventListener("click", openNameForm);
  btnCancelName?.addEventListener("click", closeNameForm);

  settingsNameForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = settingsNameInput.value.trim();
    if (!name) {
      setAlert(settingsNameError, "Name can't be empty.", "error");
      return;
    }
    const saveBtn = settingsNameForm.querySelector("button[type=submit]");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const updatedSession = await window.metriq.updateDisplayName(name);
      applyIdentity(updatedSession);
      closeNameForm();
    } catch (err) {
      setAlert(settingsNameError, err.message || "Couldn't update your name.", "error");
    }
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  });

  function formatHotkey(accelerator) {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    return accelerator
      .replace("CommandOrControl", isMac ? "⌘" : "Ctrl")
      .replace("Shift", isMac ? "⇧" : "Shift")
      .split("+")
      .join(isMac ? "" : "+");
  }

  // --- Tools (Integration Hub) --------------------------------------------

  const itgHeaderBadge = document.getElementById("itg-header-badge");
  const itgFutureGrid = document.getElementById("itg-future-grid");

  const ITG_STATUS_LABEL = { supported: "Supported", generic: "Generic" };

  async function initTools() {
    if (itgHeaderBadge) itgHeaderBadge.textContent = `${AVAILABLE_TOOLS.length} platforms`;

    const selected = new Set(await window.metriq.getTools());
    toolsList.innerHTML = "";
    for (const tool of AVAILABLE_TOOLS) {
      const isChecked = selected.has(tool.id);
      const card = document.createElement("label");
      card.className = "itg-tool-card" + (isChecked ? " is-checked" : "");

      const top = document.createElement("div");
      top.className = "itg-tool-card-top";

      const iconWrap = document.createElement("span");
      iconWrap.className = "itg-tool-icon";
      renderToolIcon(iconWrap, tool);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "tool-row-input";
      checkbox.checked = isChecked;
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) selected.add(tool.id);
        else selected.delete(tool.id);
        card.classList.toggle("is-checked", checkbox.checked);
        await window.metriq.setTools([...selected]);
        renderOverviewTools();
        renderPresetStates(selected); // a manual toggle can match/break a preset's exact combo
      });

      const toggle = document.createElement("span");
      toggle.className = "tool-row-toggle itg-tool-toggle";

      top.append(iconWrap, checkbox, toggle);

      const name = document.createElement("div");
      name.className = "itg-tool-name";
      name.textContent = tool.label;

      const desc = document.createElement("p");
      desc.className = "itg-tool-desc";
      desc.textContent = tool.description;

      const badge = document.createElement("span");
      badge.className = `itg-badge itg-badge-${tool.status}`;
      badge.textContent = ITG_STATUS_LABEL[tool.status] || tool.status;

      card.append(top, name, desc, badge);
      toolsList.append(card);
    }
  }

  function initFutureIntegrations() {
    if (!itgFutureGrid) return;
    itgFutureGrid.innerHTML = "";
    for (const tool of FUTURE_TOOLS) {
      const card = document.createElement("div");
      card.className = "itg-tool-card itg-tool-card-future";

      const top = document.createElement("div");
      top.className = "itg-tool-card-top";
      const iconWrap = document.createElement("span");
      iconWrap.className = "itg-tool-icon";
      renderToolIcon(iconWrap, tool);
      top.append(iconWrap);

      const name = document.createElement("div");
      name.className = "itg-tool-name";
      name.textContent = tool.label;

      const desc = document.createElement("p");
      desc.className = "itg-tool-desc";
      desc.textContent = tool.description;

      const badge = document.createElement("span");
      badge.className = "itg-badge itg-badge-soon";
      badge.textContent = "Coming soon";

      card.append(top, name, desc, badge);
      itgFutureGrid.append(card);
    }
  }

  // --- Recommended setups --------------------------------------------------
  // One-click presets over the real tool toggles above — Apply calls the
  // exact same window.metriq.setTools() the cards themselves use, so this
  // is a shortcut, not a preview: whatever isn't in the preset gets turned
  // off, matching the "enable matching, disable the rest" spec.

  const itgPresetGrid = document.getElementById("itg-preset-grid");

  const ITG_PRESET_ICONS = {
    laptop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20"/>',
    flask: '<path d="M9 3h6M10 3v5.5L4.8 18a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14 8.5V3"/>',
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12.5V17c0 1.1 2.7 3 6 3s6-1.9 6-3v-4.5"/>',
    checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  };

  const PRESETS = [
    {
      id: "engineer",
      label: "Software Engineer",
      icon: "laptop",
      description: "Builds applications and writes code daily.",
      tools: ["chatgpt", "vscode", "cursor"],
    },
    {
      id: "researcher",
      label: "AI Researcher",
      icon: "flask",
      description: "Optimized for experimentation, reasoning, and long-context prompts.",
      tools: ["claude", "chatgpt"],
    },
    {
      id: "student",
      label: "Student",
      icon: "cap",
      description: "General learning, homework, and research assistance.",
      tools: ["chatgpt", "claude"],
    },
    {
      id: "productivity",
      label: "General Productivity",
      icon: "checklist",
      description: "Everyday AI assistance for writing and organization.",
      tools: ["chatgpt"],
    },
  ];

  // A preset is "applied" when the current selection is exactly its tool
  // set — not a superset/subset, an exact match — so the button's state
  // always reflects reality instead of a self-timing "Applied!" flash that
  // could go stale the moment something else changes the selection.
  function presetIsActive(preset, selected) {
    return preset.tools.length === selected.size && preset.tools.every((id) => selected.has(id));
  }

  function renderPresetStates(selected) {
    if (!itgPresetGrid) return;
    itgPresetGrid.innerHTML = "";
    for (const preset of PRESETS) {
      const isActive = presetIsActive(preset, selected);

      const card = document.createElement("div");
      card.className = "itg-preset-card" + (isActive ? " is-applied" : "");

      const iconWrap = document.createElement("span");
      iconWrap.className = "itg-preset-icon";
      iconWrap.innerHTML = svgIcon(ITG_PRESET_ICONS[preset.icon] || "");

      const name = document.createElement("div");
      name.className = "itg-preset-name";
      name.textContent = preset.label;

      const desc = document.createElement("p");
      desc.className = "itg-preset-desc";
      desc.textContent = preset.description;

      const chips = document.createElement("div");
      chips.className = "itg-preset-chips";
      for (const toolId of preset.tools) {
        const tool = AVAILABLE_TOOLS.find((t) => t.id === toolId);
        if (!tool) continue;
        const chip = document.createElement("span");
        chip.className = "itg-preset-chip";
        chip.textContent = tool.label;
        chips.append(chip);
      }

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "itg-preset-apply" + (isActive ? " is-remove" : "");
      applyBtn.textContent = isActive ? "Remove setup" : "Apply setup";
      applyBtn.addEventListener("click", async () => {
        applyBtn.disabled = true;
        // Remove clears back to nothing selected rather than guessing at a
        // "previous" state — same predictable behavior as unchecking every
        // card by hand.
        const nextTools = isActive ? [] : [...preset.tools];
        await window.metriq.setTools(nextTools);
        await initTools();
        renderOverviewTools();
        renderPresetStates(new Set(nextTools));
      });

      card.append(iconWrap, name, desc, chips, applyBtn);
      itgPresetGrid.append(card);
    }
  }

  async function initPresets() {
    if (!itgPresetGrid) return;
    renderPresetStates(new Set(await window.metriq.getTools()));
  }

  // --- Accessibility ------------------------------------------------------
  // Same reusable toggle-row primitive as Tools (.tool-row / .tool-row-icon /
  // .tool-row-input / .tool-row-toggle), extended with a title+description
  // pair instead of a single label — see desktop/DESIGN.md for the toggle
  // spec these rows follow. Each option maps 1:1 to a class applied to
  // <html> (see styles.css and theme-init.js, which applies the saved
  // values before first paint to avoid a flash on launch).

  const ACCESSIBILITY_OPTIONS = [
    {
      id: "highContrast",
      className: "high-contrast",
      icon: "contrast",
      label: "High contrast",
      description: "A dedicated high-contrast palette with stronger separation between text, surfaces, borders, and controls. Defaults to your system setting until you choose explicitly.",
    },
    {
      id: "reduceMotion",
      className: "reduce-motion",
      icon: "motion",
      label: "Reduce motion",
      description: "Turns off animations, transitions, and hover effects everywhere. Defaults to your system setting until you choose explicitly.",
    },
    {
      id: "dyslexiaFont",
      className: "dyslexia-font",
      icon: "font",
      label: "Dyslexia-friendly font",
      description: "Switches interface text to OpenDyslexic. Code, token counts, and other monospace values are unaffected.",
    },
    {
      id: "colorblind",
      className: "colorblind",
      icon: "eye",
      label: "Colorblind-friendly mode",
      description: "Shifts status colors to a palette distinguishable across common color vision deficiencies.",
    },
  ];

  const A11Y_ICON_PATHS = {
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18Z" fill="currentColor" stroke="none"/>',
    motion: '<path d="M4 6h11M4 12h16M4 18h8"/><path d="m17 15 3-3-3-3"/>',
    font: '<path d="M5 19 10.5 5h2L18 19M8 14h7"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  };

  async function initAccessibility() {
    const saved = (await window.metriq.getAccessibility()) || {};
    const canMatchMedia = typeof window.matchMedia === "function";
    // Same OS-default pattern for both: respected only when the user has
    // never explicitly touched the toggle in-app (see theme-init.js, which
    // applies this identical logic before first paint).
    const osDefaults = {
      highContrast: canMatchMedia && window.matchMedia("(prefers-contrast: more)").matches,
      reduceMotion: canMatchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };

    accessibilityList.innerHTML = "";
    for (const opt of ACCESSIBILITY_OPTIONS) {
      const explicit = saved[opt.id];
      const isOn = explicit === true || (explicit === undefined && Boolean(osDefaults[opt.id]));

      const row = document.createElement("label");
      row.className = "tool-row a11y-row" + (isOn ? " is-checked" : "");

      const iconWrap = document.createElement("span");
      iconWrap.className = "tool-row-icon";
      iconWrap.innerHTML = svgIcon(A11Y_ICON_PATHS[opt.icon] || "");

      const textWrap = document.createElement("span");
      textWrap.className = "tool-row-text";
      const title = document.createElement("span");
      title.className = "tool-row-title";
      title.textContent = opt.label;
      const desc = document.createElement("span");
      desc.className = "tool-row-desc";
      desc.textContent = opt.description;
      textWrap.append(title, desc);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "tool-row-input";
      checkbox.checked = isOn;
      checkbox.addEventListener("change", async () => {
        row.classList.toggle("is-checked", checkbox.checked);
        document.documentElement.classList.toggle(opt.className, checkbox.checked);
        await window.metriq.setAccessibility({ [opt.id]: checkbox.checked });
      });

      const toggle = document.createElement("span");
      toggle.className = "tool-row-toggle";

      row.append(iconWrap, textWrap, checkbox, toggle);
      accessibilityList.append(row);
    }
  }

  // --- Projects -----------------------------------------------------------

  function showProjectsError(message) {
    setAlert(projectsError, message, "error");
  }

  function clearProjectsError() {
    setAlert(projectsError, "");
  }

  function renderOverviewActiveProject(activeProject, projects = []) {
    if (!overviewActiveProject) return;
    overviewActiveProject.innerHTML = "";

    if (!activeProject) {
      const empty = document.createElement("div");
      empty.className = "ov-empty";
      empty.innerHTML = `
        <div class="ov-empty-icon">${svgIcon(OV_ICON_PATHS.folderPlus)}</div>
        <p class="ov-empty-title">No project connected</p>
        <p class="ov-empty-desc">Link a local folder and Metriq will check every prompt against your real files.</p>
      `;
      const connectBtn = document.createElement("button");
      connectBtn.type = "button";
      connectBtn.className = "ov-btn-secondary";
      connectBtn.textContent = "Connect a project";
      connectBtn.addEventListener("click", () => linkProjectFlow(connectBtn));
      empty.append(connectBtn);
      overviewActiveProject.append(empty);
      return;
    }

    // The active-project pref stores only {id, name, path}; file count and
    // scan time live on the full record in the projects list.
    const record = projects.find((p) => p.id === activeProject.id);

    const card = document.createElement("div");
    card.className = "ov-project";

    const iconWrap = document.createElement("span");
    iconWrap.className = "ov-project-icon";
    iconWrap.innerHTML = svgIcon(OV_ICON_PATHS.folder);

    const info = document.createElement("div");
    info.className = "ov-project-info";
    const name = document.createElement("div");
    name.className = "ov-project-name";
    name.textContent = activeProject.name;
    const pathEl = document.createElement("div");
    pathEl.className = "ov-project-path";
    pathEl.textContent = activeProject.path;
    info.append(name, pathEl);

    const meta = document.createElement("div");
    meta.className = "ov-project-meta";
    const activeChip = document.createElement("span");
    activeChip.className = "ov-chip ov-chip-accent";
    activeChip.textContent = "Active";
    meta.append(activeChip);
    if (record) {
      const count = record.file_count ?? 0;
      const filesChip = document.createElement("span");
      filesChip.className = "ov-chip";
      filesChip.textContent = `${count.toLocaleString()} file${count === 1 ? "" : "s"} indexed`;
      meta.append(filesChip);
      if (record.last_scanned_at) {
        const scannedChip = document.createElement("span");
        scannedChip.className = "ov-chip";
        scannedChip.textContent = `scanned ${timeAgo(record.last_scanned_at)}`;
        meta.append(scannedChip);
      }
    }
    info.append(meta);

    card.append(iconWrap, info);
    overviewActiveProject.append(card);
  }

  function renderProjects(projects, activeId) {
    projectsList.innerHTML = "";
    projectsEmpty.classList.toggle("hidden", projects.length > 0);

    for (const project of projects) {
      const li = document.createElement("li");
      li.className = "project-item" + (project.id === activeId ? " is-active" : "");

      const top = document.createElement("div");
      top.className = "project-item-top";
      const nameCol = document.createElement("div");
      const nameRow = document.createElement("div");
      nameRow.className = "project-name-row";
      const name = document.createElement("div");
      name.className = "project-name";
      name.textContent = project.name;
      nameRow.append(name);
      if (project.kind === "github") {
        const badge = document.createElement("span");
        badge.className = "project-kind-badge";
        badge.textContent = "GitHub";
        nameRow.append(badge);
      }
      const pathEl = document.createElement("div");
      pathEl.className = "project-path";
      // A github project's real "path" is a Metriq-managed local clone
      // directory — not meaningful to show the user; the repo it came from
      // is what they'd recognize (name is always "owner/repo" for these).
      pathEl.textContent = project.kind === "github" ? `github.com/${project.name}` : project.path;
      nameCol.append(nameRow, pathEl);
      top.append(nameCol);
      li.append(top);

      const meta = document.createElement("div");
      meta.className = "project-meta";
      const count = project.file_count ?? 0;
      const scanned = project.last_scanned_at
        ? new Date(project.last_scanned_at).toLocaleString()
        : "not yet rescanned";
      meta.textContent = `${count} file${count === 1 ? "" : "s"} indexed · ${scanned}`;
      li.append(meta);

      const actions = document.createElement("div");
      actions.className = "project-actions";

      const activeBtn = document.createElement("button");
      activeBtn.textContent = project.id === activeId ? "Active" : "Set active";
      if (project.id === activeId) activeBtn.classList.add("is-active-btn");
      activeBtn.addEventListener("click", async () => {
        await window.metriq.setActiveProject(project);
        refreshProjects();
      });

      const rescanBtn = document.createElement("button");
      rescanBtn.textContent = "Rescan";
      rescanBtn.addEventListener("click", async () => {
        rescanBtn.textContent = "Scanning…";
        rescanBtn.disabled = true;
        try {
          await window.metriq.rescanProject(project);
          clearProjectsError();
          refreshProjects(); // only on success — refreshProjects()'s own
          // clearProjectsError() would otherwise wipe out the error below
        } catch (err) {
          showProjectsError(err.message || "Rescan failed.");
        }
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        try {
          await window.metriq.removeProject(project);
          clearProjectsError();
          refreshProjects();
        } catch (err) {
          showProjectsError(err.message || "Remove failed.");
        }
      });

      actions.append(activeBtn, rescanBtn, removeBtn);
      li.append(actions);
      projectsList.append(li);
    }
  }

  async function refreshProjects() {
    // Active-project selection is a local pref and can't realistically fail —
    // resolve it first so the Overview panel renders even when the synced
    // projects list below can't be fetched (offline, expired token, …).
    const [activeId, activeProject] = await Promise.all([
      window.metriq.getActiveProjectId(),
      window.metriq.getActiveProject(),
    ]);

    let projects = [];
    try {
      projects = (await window.metriq.listProjects()) || [];
      clearProjectsError();
      renderProjects(projects, activeId);
      ovProjectCount = projects.length;
      setMetricValue(ovStatProjects, ovProjectCount, (n) => String(n));
    } catch (err) {
      showProjectsError(err.message || "Couldn't load projects.");
      // ovProjectCount stays null: unknown, so insights don't claim "none".
    }

    renderOverviewActiveProject(activeProject, projects);
    renderOverviewInsights();
  }

  btnLogin.addEventListener("click", async () => {
    waitingMsg.classList.remove("hidden");
    await window.metriq.openLogin();
  });

  btnSignup.addEventListener("click", async () => {
    waitingMsg.classList.remove("hidden");
    await window.metriq.openSignup();
  });

  btnLogout.addEventListener("click", async () => {
    await window.metriq.logout();
    showLoggedOut();
  });

  btnOpenCapture.addEventListener("click", () => window.metriq.openCapture());

  window.metriq.getCaptureHotkey().then((hotkey) => {
    const formatted = formatHotkey(hotkey);
    captureHotkeyLabel.textContent = formatted;
    settingsHotkeyLabel.textContent = formatted;
  });

  // --- Auto-capture (background prompt watching) --------------------------

  const btnAutoCapture = document.getElementById("btn-autocapture");
  const autoCaptureLabel = document.getElementById("autocapture-label");
  const autoCapturePermission = document.getElementById("autocapture-permission");
  const captureRepoInput = document.getElementById("capture-repo-input");
  const captureRepoStatus = document.getElementById("capture-repo-status");
  const btnSaveRepo = document.getElementById("btn-save-repo");

  function renderAutoCapture(state) {
    const on = Boolean(state.enabled);
    autoCaptureLabel.textContent = on ? "On" : "Off";
    btnAutoCapture.setAttribute("aria-checked", String(on));
    const access = state.permission?.accessibility;
    autoCapturePermission.textContent =
      access === "granted"
        ? "Accessibility granted"
        : access === "not-required"
          ? "Not required on this OS"
          : access === "denied"
            ? "Accessibility needed. Click to grant"
            : access || "unknown";
  }

  async function initAutoCapture() {
    if (!btnAutoCapture) return;
    renderAutoCapture(await window.metriq.getAutoCapture());
    captureRepoInput.value = await window.metriq.getCaptureRepoUrl();

    btnAutoCapture.addEventListener("click", async () => {
      const current = btnAutoCapture.getAttribute("aria-checked") === "true";
      const result = await window.metriq.setAutoCapture(!current);
      if (result.ok) {
        renderAutoCapture(await window.metriq.getAutoCapture());
      } else {
        // Permission denied on enable — reflect it and open OS Settings so the
        // user can grant Accessibility, then toggle again.
        renderAutoCapture({ enabled: false, permission: result.permission });
        await window.metriq.openPermissionSettings("accessibility");
      }
    });

    autoCapturePermission.addEventListener("click", () =>
      window.metriq.openPermissionSettings("accessibility")
    );

    btnSaveRepo.addEventListener("click", async () => {
      const url = captureRepoInput.value.trim();
      await window.metriq.setCaptureRepoUrl(url);
      btnSaveRepo.textContent = "Saved";
      captureRepoStatus.textContent = url
        ? "Suggestions will name files from this repository."
        : "No repository connected. Suggestions add scope guards only.";
      setTimeout(() => (btnSaveRepo.textContent = "Save"), 1200);
    });
  }

  initAutoCapture();

  // Shared by the Projects page's "Link a project" button and the Overview
  // empty state's "Connect a project" CTA. Errors render in the Projects
  // page's alert, so a failure from Overview also navigates there — the
  // message would otherwise be invisible.
  async function linkProjectFlow(button) {
    const folderPath = await window.metriq.pickFolder();
    if (!folderPath) return;
    const originalLabel = button.innerHTML;
    button.textContent = "Linking…";
    button.disabled = true;
    try {
      await window.metriq.linkProject(folderPath);
      clearProjectsError();
      refreshProjects(); // only on success — see the rescan/remove handlers
      // for why this can't run unconditionally after both branches
    } catch (err) {
      showProjectsError(err.message || "Couldn't link that folder.");
      if (button !== btnLinkProject) showPage("projects");
    }
    button.innerHTML = originalLabel;
    button.disabled = false;
  }

  btnLinkProject.addEventListener("click", () => {
    githubLinkForm.classList.add("hidden");
    linkProjectFlow(btnLinkProject);
  });

  // --- Link a GitHub repo (Projects page) -----------------------------------
  // A real clone, not a stub: main.js shallow-clones the repo to a local,
  // Metriq-managed directory and scans it exactly like a picked folder —
  // see projects:link-github in desktop/src/main.js.

  btnLinkGithub?.addEventListener("click", () => {
    const opening = githubLinkForm.classList.contains("hidden");
    githubLinkForm.classList.toggle("hidden", !opening);
    if (opening) githubUrlInput.focus();
  });

  // The empty-state hero card's CTAs are the same actions as the header
  // buttons, just re-triggered from a second location — not a second
  // implementation of "link a project."
  document.getElementById("btn-link-project-empty")?.addEventListener("click", (e) => {
    githubLinkForm.classList.add("hidden");
    linkProjectFlow(e.currentTarget);
  });
  document.getElementById("btn-link-github-empty")?.addEventListener("click", () => btnLinkGithub.click());

  document.getElementById("btn-open-docs")?.addEventListener("click", () => window.metriq.openRepoDocs());
  document.getElementById("btn-settings-docs")?.addEventListener("click", () => window.metriq.openRepoDocs());

  btnGithubCancel?.addEventListener("click", () => {
    githubLinkForm.classList.add("hidden");
    githubUrlInput.value = "";
    clearProjectsError();
  });

  githubLinkForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = githubUrlInput.value.trim();
    if (!url) return;
    const submitBtn = document.getElementById("btn-github-submit");
    const original = submitBtn.textContent;
    submitBtn.textContent = "Linking…";
    submitBtn.disabled = true;
    try {
      await window.metriq.linkGithubProject(url);
      clearProjectsError();
      githubLinkForm.classList.add("hidden");
      githubUrlInput.value = "";
      refreshProjects(); // only on success — see the rescan/remove handlers
      // for why this can't run unconditionally after both branches
    } catch (err) {
      showProjectsError(err.message || "Couldn't link that repository.");
    }
    submitBtn.textContent = original;
    submitBtn.disabled = false;
  });

  // --- Usage stats (Overview / Sustainability) -----------------------------

  function timeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  // Rough, clearly-labeled illustrative estimate (not a precise/audited
  // measurement) derived from real tokens-saved data — ~0.4g CO2 per 1,000
  // tokens, a conservative ballpark for LLM inference energy use. Shown with
  // a "~" and an "illustrative" sub-label in the UI so it never reads as a
  // scientifically precise figure.
  function formatCO2Estimate(savedTokens) {
    const grams = savedTokens * 0.0004;
    if (grams < 0.1) return "<0.1g";
    if (grams < 1000) return `~${grams < 10 ? grams.toFixed(1) : Math.round(grams)}g`;
    return `~${(grams / 1000).toFixed(1)}kg`;
  }

  document.getElementById("sus-btn-analyze")?.addEventListener("click", () => window.metriq.openCapture());
  document.getElementById("sus-link-learn")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("sus-learn")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function renderActivityRow(entry) {
    const li = document.createElement("li");
    li.className = "activity-item";
    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = entry.projectName || "No project";
    const time = document.createElement("div");
    time.className = "activity-time muted";
    time.textContent = timeAgo(entry.timestamp);
    left.append(title, time);

    const right = document.createElement("div");
    right.className = "activity-savings";
    right.textContent = entry.savedTokens > 0 ? `−${entry.savedTokens} tokens` : "N/A";

    li.append(left, right);
    return li;
  }

  // Overview's timeline row — icon node + action + timestamp, joined by the
  // CSS connector line. Distinct from the flat .activity-item rows the
  // Impact/Usage/Prompt Studio lists keep using (renderActivityRow below).
  function renderOverviewActivityRow(entry) {
    const li = document.createElement("li");
    li.className = "ov-timeline-item";

    const node = document.createElement("span");
    node.className = "ov-timeline-node";
    node.innerHTML = svgIcon(OV_ICON_PATHS.zap);

    const body = document.createElement("div");
    body.className = "ov-timeline-body";
    const title = document.createElement("div");
    title.className = "ov-timeline-title";
    title.textContent = entry.projectName ? `Checked a prompt · ${entry.projectName}` : "Checked a prompt";
    const time = document.createElement("div");
    time.className = "ov-timeline-time";
    time.textContent = timeAgo(entry.timestamp);
    body.append(title, time);

    const savings = document.createElement("span");
    savings.className = "ov-timeline-savings";
    if (entry.savedTokens > 0) {
      savings.textContent = `−${entry.savedTokens.toLocaleString()} tokens`;
    } else {
      savings.textContent = "N/A";
      savings.classList.add("is-flat");
    }

    li.append(node, body, savings);
    return li;
  }

  async function refreshStats() {
    const summary = await window.metriq.getStatsSummary();

    setMetricValue(document.getElementById("stat-captures"), summary.totalCaptures, (n) => String(n));
    setMetricValue(document.getElementById("stat-tokens-saved"), summary.totalSavedTokens, (n) =>
      n.toLocaleString()
    );
    setMetricValue(ovStatAvgPct, summary.avgSavedPct, (n) => `${n}%`);
    document.getElementById("sustain-captures").textContent = summary.totalCaptures;
    document.getElementById("sustain-tokens-saved").textContent = summary.totalSavedTokens.toLocaleString();
    document.getElementById("sustain-avg-pct").textContent = `${summary.avgSavedPct}%`;
    document.getElementById("sustain-co2-saved").textContent = formatCO2Estimate(summary.totalSavedTokens);
    document.getElementById("sus-summary-text").textContent =
      summary.totalCaptures > 0
        ? `You've optimized ${summary.totalCaptures} prompt${summary.totalCaptures === 1 ? "" : "s"} on this ` +
          `device, saving ${summary.totalSavedTokens.toLocaleString()} tokens. That's an average ` +
          `${summary.avgSavedPct}% reduction in exploration cost per prompt.`
        : "Check your first prompt to start building your efficiency story.";

    recentActivityList.innerHTML = "";
    const hasHistory = summary.recent.length > 0;
    recentActivityEmpty.classList.toggle("hidden", hasHistory);
    for (const entry of summary.recent.slice(0, 5)) {
      recentActivityList.append(renderOverviewActivityRow(entry));
    }

    ovSummary = summary;
    renderOverviewInsights();

    const sustainEmpty = document.getElementById("sustain-empty");
    const sustainHistoryBlock = document.getElementById("sustain-history-block");
    const sustainHistoryList = document.getElementById("sustain-history-list");
    sustainEmpty.classList.toggle("hidden", hasHistory);
    sustainHistoryBlock.classList.toggle("hidden", !hasHistory);
    sustainHistoryList.innerHTML = "";
    for (const entry of summary.recent) {
      sustainHistoryList.append(renderActivityRow(entry));
    }
  }

  // --- Usage (real token tracking from local Claude Code / Codex logs) ------

  const usageEmpty = document.getElementById("usage-empty");
  const usageContent = document.getElementById("usage-content");
  const usageTiles = document.getElementById("usage-tiles");
  const usageDailyChart = document.getElementById("usage-daily-chart");
  const usageDailyLabels = document.getElementById("usage-daily-labels");
  const usageDailyPeak = document.getElementById("usage-daily-peak");
  const usageDailyAvg = document.getElementById("usage-daily-avg");
  const usageDailyToday = document.getElementById("usage-daily-today");
  const usageInsights = document.getElementById("usage-insights");
  const usageModels = document.getElementById("usage-models");
  const usageSessions = document.getElementById("usage-sessions");
  const usageMeta = document.getElementById("usage-meta");
  const usageRangeButtons = document.querySelectorAll(".usage-range-btn");
  const usgChartTabs = document.querySelectorAll(".usg-chart-tab");
  const usgDonut = document.getElementById("usg-donut");
  const usgDonutLegend = document.getElementById("usg-donut-legend");
  const btnRefreshUsage = document.getElementById("btn-refresh-usage");

  let usageDays = 30;
  let usageChartSeries = "totalTokens";
  let usageChartFormat = "tok";
  let latestUsageData = null;

  const USG_ICON_PATHS = {
    token: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 12h6"/>',
    dollar: '<path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"/>',
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    upload: '<path d="M12 20V8M7 12l5-5 5 5"/><path d="M4 20h16"/>',
    warning: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    flame: '<path d="M12 22c4-1 7-4 7-8.5 0-3-1.5-5-3-7 0 2-1 3.5-2.5 3.5C14.5 7 14 4 11 2c.5 3-1 5-3 7.5-1 1.3-2 3-2 4.5C6 18 8 21 12 22Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    robot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v6h-6"/>',
  };

  const USG_SEVERITY_ICON = { high: "warning", medium: "flame", info: "check" };

  function fmtTok(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n || 0));
  }

  function fmtShortDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function usd(n) {
    return "$" + (n || 0).toFixed(2);
  }

  function fmtDuration(ms) {
    if (!ms || ms < 60_000) return "<1m";
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
  }

  function fmtSessionDate(iso) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  // A lightweight, honest "trend" — no separate prior-period fetch exists,
  // so this compares the second half of the already-fetched range against
  // the first half (same data, no new IPC call) rather than inventing a
  // number. A first-half-vs-second-half "trend %" was tried and dropped —
  // this kind of usage is inherently bursty (a few heavy coding days, near-
  // zero otherwise), so any two-window average comparison keeps producing
  // meaningless swings (e.g. "+3650%") no matter how the threshold is
  // tuned. Rather than paper over that with more heuristics, the card just
  // shows the real total and its real supporting stat.
  function renderUsageTile(icon, label, value, sub) {
    const card = document.createElement("div");
    card.className = "usg-metric";
    const top = document.createElement("div");
    top.className = "usg-metric-top";
    const iconWrap = document.createElement("span");
    iconWrap.className = "usg-metric-icon";
    iconWrap.innerHTML = svgIcon(USG_ICON_PATHS[icon] || "");
    const l = document.createElement("span");
    l.className = "usg-metric-label";
    l.textContent = label;
    top.append(iconWrap, l);
    const v = document.createElement("span");
    v.className = "usg-metric-value";
    v.textContent = value;
    card.append(top, v);
    if (sub) {
      const s = document.createElement("span");
      s.className = "usg-metric-sub";
      s.textContent = sub;
      card.append(s);
    }
    return card;
  }

  function renderUsageInsight(insight) {
    const div = document.createElement("div");
    div.className = `usage-insight ${insight.severity}`;
    const head = document.createElement("div");
    head.className = "usage-insight-head";
    const iconWrap = document.createElement("span");
    iconWrap.className = "usage-insight-icon";
    iconWrap.innerHTML = svgIcon(USG_ICON_PATHS[USG_SEVERITY_ICON[insight.severity]] || USG_ICON_PATHS.flame, "icon-sm");
    const h = document.createElement("h3");
    h.textContent = insight.title;
    head.append(iconWrap, h);
    const evidence = document.createElement("p");
    evidence.textContent = insight.evidence;
    const action = document.createElement("p");
    action.className = "usage-insight-action";
    action.textContent = `→ ${insight.action}`;
    div.append(head, evidence, action);
    return div;
  }

  // Reuses the same bundled logo assets as the Tools/Integration Hub page
  // (assets/logos/) — real files, not fabricated model art. Falls back to
  // the generic robot outline for any other source.
  const USG_MODEL_LOGO = { "claude-code": "claude.png", codex: "chatgpt.webp" };

  function renderModelIcon(container, source) {
    const logoFile = USG_MODEL_LOGO[source];
    if (!logoFile) {
      container.innerHTML = svgIcon(USG_ICON_PATHS.robot, "icon-sm");
      return;
    }
    const img = document.createElement("img");
    img.className = "usg-model-logo";
    img.src = `assets/logos/${logoFile}`;
    img.alt = "";
    img.addEventListener("error", () => { container.innerHTML = svgIcon(USG_ICON_PATHS.robot, "icon-sm"); }, { once: true });
    container.append(img);
  }

  function renderUsageModelRow(model, totalCost) {
    const row = document.createElement("div");
    row.className = "usage-model-row";

    const label = document.createElement("div");
    label.className = "usage-model-label";
    const iconWrap = document.createElement("span");
    iconWrap.className = "usg-model-icon";
    renderModelIcon(iconWrap, model.source);
    const name = document.createElement("span");
    name.className = "usg-model-name";
    name.textContent = model.label;
    const pct = document.createElement("span");
    pct.className = "usg-model-pct muted";
    pct.textContent = totalCost > 0 ? `${Math.round((model.costUSD / totalCost) * 100)}%` : "N/A";
    const cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = usd(model.costUSD);
    label.append(iconWrap, name, pct, cost);

    const meta = document.createElement("div");
    meta.className = "usg-model-meta muted";
    meta.textContent = `${model.requests} requests · ${fmtTok(model.totalTokens)} tokens`;

    const track = document.createElement("div");
    track.className = "usage-model-bar-track";
    const fill = document.createElement("div");
    fill.className = "usage-model-bar-fill";
    fill.style.width = "0%";
    track.append(fill);
    requestAnimationFrame(() => {
      fill.style.width = `${totalCost > 0 ? (model.costUSD / totalCost) * 100 : 0}%`;
    });

    row.append(label, meta, track);
    return row;
  }

  const USG_DONUT_COLORS = [
    "var(--accent-primary)",
    "var(--accent-secondary)",
    "color-mix(in srgb, var(--accent-primary) 55%, var(--surface-2))",
    "color-mix(in srgb, var(--accent-secondary) 55%, var(--surface-2))",
    "var(--surface-2)",
  ];

  function renderUsageDonut(models, totalCost) {
    usgDonutLegend.innerHTML = "";
    if (!totalCost || !models.length) {
      usgDonut.style.background = "var(--surface-2)";
      return;
    }
    let cursor = 0;
    const stops = [];
    models.forEach((model, i) => {
      const color = USG_DONUT_COLORS[Math.min(i, USG_DONUT_COLORS.length - 1)];
      const share = (model.costUSD / totalCost) * 100;
      const start = cursor;
      const end = cursor + share;
      stops.push(`${color} ${start}% ${end}%`);
      cursor = end;

      const li = document.createElement("li");
      const swatch = document.createElement("span");
      swatch.className = "usg-donut-swatch";
      swatch.style.background = color;
      const text = document.createElement("span");
      text.textContent = `${model.label} · ${Math.round(share)}%`;
      li.append(swatch, text);
      usgDonutLegend.append(li);
    });
    usgDonut.style.background = `conic-gradient(${stops.join(", ")})`;
  }

  function renderUsageSessionRow(session) {
    const tr = document.createElement("tr");

    const projectCell = document.createElement("td");
    projectCell.className = "usg-cell-project";
    const iconWrap = document.createElement("span");
    iconWrap.className = "usg-row-icon";
    iconWrap.innerHTML = svgIcon(USG_ICON_PATHS.folder, "icon-sm");
    const name = document.createElement("span");
    name.textContent = session.project || "No project";
    projectCell.append(iconWrap, name);

    const dateCell = document.createElement("td");
    dateCell.textContent = fmtSessionDate(session.startedAt);

    const reqCell = document.createElement("td");
    reqCell.className = "usg-cell-num";
    reqCell.textContent = session.requests;

    const tokCell = document.createElement("td");
    tokCell.className = "usg-cell-num";
    tokCell.textContent = fmtTok(session.totalTokens);

    const durCell = document.createElement("td");
    durCell.className = "usg-cell-num";
    durCell.textContent = fmtDuration(session.durationMs);

    const costCell = document.createElement("td");
    costCell.className = "usg-cell-num usg-cell-cost";
    costCell.textContent = usd(session.costUSD);

    const sourceCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `usg-source-badge usg-source-${session.source}`;
    badge.textContent = session.source === "codex" ? "Codex" : "Claude Code";
    sourceCell.append(badge);

    tr.append(projectCell, dateCell, reqCell, tokCell, durCell, costCell, sourceCell);
    return tr;
  }

  function renderUsageChart() {
    const daily = (latestUsageData && latestUsageData.daily) || [];
    const format = usageChartFormat === "usd" ? usd : fmtTok;
    const dmax = Math.max(...daily.map((d) => d[usageChartSeries] || 0), 1);

    usageDailyChart.innerHTML = "";
    daily.forEach((d, i) => {
      const bar = document.createElement("div");
      bar.className = "usage-bar";
      if (i === daily.length - 1) bar.classList.add("is-today");
      const val = d[usageChartSeries] || 0;
      bar.style.height = `${Math.max((val / dmax) * 100, 1)}%`;
      bar.title = `${fmtShortDate(d.date)} · ${format(val)}`;
      usageDailyChart.append(bar);
    });

    usageDailyLabels.innerHTML = "";
    if (daily.length) {
      const tickIdxs = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
      for (const i of tickIdxs) {
        const span = document.createElement("span");
        span.textContent = fmtShortDate(daily[i].date);
        usageDailyLabels.append(span);
      }
    }

    const peakDay = daily.reduce(
      (max, d) => (!max || (d[usageChartSeries] || 0) > (max[usageChartSeries] || 0) ? d : max),
      null
    );
    usageDailyPeak.textContent =
      peakDay && peakDay[usageChartSeries] > 0 ? `Peak ${format(peakDay[usageChartSeries])} · ${fmtShortDate(peakDay.date)}` : "";

    const total = daily.reduce((s, d) => s + (d[usageChartSeries] || 0), 0);
    usageDailyAvg.textContent = daily.length ? `Avg ${format(total / daily.length)}/day` : "";

    const today = daily[daily.length - 1];
    usageDailyToday.textContent = today ? `Today ${format(today[usageChartSeries] || 0)}` : "";
  }

  for (const tab of usgChartTabs) {
    tab.addEventListener("click", () => {
      usageChartSeries = tab.dataset.series;
      usageChartFormat = tab.dataset.format;
      for (const t of usgChartTabs) t.classList.toggle("is-active", t === tab);
      renderUsageChart();
    });
  }

  async function refreshUsage() {
    const data = await window.metriq.getUsage(usageDays);
    const available = Boolean(data && data.available);
    usageEmpty.classList.toggle("hidden", available);
    usageContent.classList.toggle("hidden", !available);
    if (!available) return;

    latestUsageData = data;
    const t = data.totals;
    const reqs = (data.models || []).reduce((sum, m) => sum + m.requests, 0);
    const contextTokens = t.inputTokens + t.cacheCreationTokens + t.cacheReadTokens;
    const cacheHitRate = contextTokens > 0 ? t.cacheReadTokens / contextTokens : 0;

    usageTiles.innerHTML = "";
    usageTiles.append(
      renderUsageTile("token", "Total tokens", fmtTok(t.totalTokens), `${reqs} requests`),
      renderUsageTile("dollar", "Estimated cost", usd(t.costUSD), "API-equivalent"),
      renderUsageTile("zap", "Cache savings", usd(t.cacheSavingsUSD), `${Math.round(cacheHitRate * 100)}% cache hit`),
      renderUsageTile("upload", "Output tokens", fmtTok(t.outputTokens), `${fmtTok(t.inputTokens)} input`)
    );

    renderUsageChart();

    const insights = data.insights || [];
    usageInsights.innerHTML = "";
    if (!insights.length) {
      const p = document.createElement("p");
      p.className = "muted empty-note";
      p.textContent = "No issues flagged. Usage looks healthy.";
      usageInsights.append(p);
    } else {
      for (const insight of insights) usageInsights.append(renderUsageInsight(insight));
    }

    const models = data.models || [];
    usageModels.innerHTML = "";
    for (const model of models) usageModels.append(renderUsageModelRow(model, t.costUSD));
    renderUsageDonut(models, t.costUSD);

    usageSessions.innerHTML = "";
    for (const session of (data.sessions || []).slice(0, 10)) {
      usageSessions.append(renderUsageSessionRow(session));
    }

    usageMeta.textContent = `sources: ${(data.sources || []).join(", ")} · last ${data.days}d · updated ${new Date().toLocaleTimeString()}`;
  }

  for (const btn of usageRangeButtons) {
    btn.addEventListener("click", () => {
      usageDays = parseInt(btn.dataset.days, 10);
      for (const b of usageRangeButtons) b.classList.toggle("is-active", b === btn);
      refreshUsage();
    });
  }

  btnRefreshUsage?.addEventListener("click", () => refreshUsage());

  window.metriq.onAuthSuccess((session) => {
    if (session) showLoggedIn(session);
  });

  window.metriq.onLoggedOut(() => {
    showLoggedOut();
  });

  const existingSession = await window.metriq.getSession();
  if (existingSession) {
    showLoggedIn(existingSession);
  } else {
    showLoggedOut();
  }
})();
