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

  // --- Terminal agent capture (Phase 5b, metriq-wrap sessions) ------------

  const btnTerminalWrap = document.getElementById("btn-terminalwrap");
  const terminalWrapLabel = document.getElementById("terminalwrap-label");

  function renderTerminalWrap(state) {
    const on = Boolean(state.enabled);
    terminalWrapLabel.textContent = on ? "On" : "Off";
    btnTerminalWrap.setAttribute("aria-checked", String(on));
  }

  async function initTerminalWrap() {
    if (!btnTerminalWrap) return;
    renderTerminalWrap(await window.metriq.getTerminalWrap());

    btnTerminalWrap.addEventListener("click", async () => {
      const current = btnTerminalWrap.getAttribute("aria-checked") === "true";
      const result = await window.metriq.setTerminalWrap(!current);
      renderTerminalWrap(result);
    });
  }

  initTerminalWrap();

  // --- GUI editor capture (Phase 5a, Cursor/VS Code, macOS only) ----------

  const btnEditorCapture = document.getElementById("btn-editorcapture");
  const editorCaptureLabel = document.getElementById("editorcapture-label");

  function renderEditorCapture(state) {
    if (!state.available) {
      editorCaptureLabel.textContent = "macOS only";
      btnEditorCapture.setAttribute("aria-checked", "false");
      btnEditorCapture.disabled = true;
      return;
    }
    const on = Boolean(state.enabled);
    editorCaptureLabel.textContent = on ? "On" : "Off";
    btnEditorCapture.setAttribute("aria-checked", String(on));
  }

  async function initEditorCapture() {
    if (!btnEditorCapture) return;
    renderEditorCapture(await window.metriq.getEditorCapture());

    btnEditorCapture.addEventListener("click", async () => {
      const current = btnEditorCapture.getAttribute("aria-checked") === "true";
      const result = await window.metriq.setEditorCapture(!current);
      if (result.ok) {
        renderEditorCapture(await window.metriq.getEditorCapture());
      } else if (result.permission) {
        renderEditorCapture({ available: true, enabled: false });
        await window.metriq.openPermissionSettings("accessibility");
      }
    });
  }

  initEditorCapture();

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

  // Benchmark-equivalent avoided impact based on Google's measured median
  // Gemini Apps text prompt (0.03g CO2e/request, May 2025). The saved-token
  // percentage estimates what share of those prompt equivalents was avoided.
  function formatCO2Estimate(captures, averageSavedPct) {
    const grams = (Number(captures) || 0) * (Math.max(0, Number(averageSavedPct) || 0) / 100) * 0.03;
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
    document.getElementById("sustain-co2-saved").textContent = formatCO2Estimate(
      summary.totalCaptures,
      summary.avgSavedPct
    );
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

  // --- Usage (same data model as localhost /usage, rendered with desktop theming)

  const usageTitle = document.getElementById("usage-title");
  const usageSourceTabs = document.getElementById("usage-source-tabs");
  const usageEmpty = document.getElementById("usage-empty");
  const usageEmptyTitle = document.getElementById("usage-empty-title");
  const usageEmptyBody = document.getElementById("usage-empty-body");
  const usageDetectedSources = document.getElementById("usage-detected-sources");
  const usageContent = document.getElementById("usage-content");
  const usageBanners = document.getElementById("usage-banners");
  const usageTiles = document.getElementById("usage-tiles");
  const usageDailyChart = document.getElementById("usage-daily-chart");
  const usageDailyLabels = document.getElementById("usage-daily-labels");
  const usageChartLegend = document.getElementById("usage-chart-legend");
  const usageChartInspector = document.getElementById("usage-chart-inspector");
  const usageLimits = document.getElementById("usage-limits");
  const usageCurrentSession = document.getElementById("usage-current-session");
  const usageCurrentSessionBody = document.getElementById("usage-current-session-body");
  const usageImpactBody = document.getElementById("usage-impact-body");
  const usageInsights = document.getElementById("usage-insights");
  const usageModels = document.getElementById("usage-models");
  const usageSessions = document.getElementById("usage-sessions");
  const usageSessionsEmpty = document.getElementById("usage-sessions-empty");
  const usageSearch = document.getElementById("usage-search");
  const usageSessionsSummary = document.getElementById("usage-sessions-summary");
  const usagePageInfo = document.getElementById("usage-page-info");
  const usagePagePrev = document.getElementById("usage-page-prev");
  const usagePageNext = document.getElementById("usage-page-next");
  const usageMeta = document.getElementById("usage-meta");
  const usageRangeButtons = document.querySelectorAll(".usage-range-btn");
  const btnRefreshUsage = document.getElementById("btn-refresh-usage");

  let usageDays = 30;
  let selectedUsageSource = "claude-code";
  let usageQuery = "";
  let usagePage = 1;
  let latestUsageData = null;

  const USG_ICON_PATHS = {
    token: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 12h6"/>',
    dollar: '<path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"/>',
    zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    warning: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    flame: '<path d="M12 22c4-1 7-4 7-8.5 0-3-1.5-5-3-7 0 2-1 3.5-2.5 3.5C14.5 7 14 4 11 2c.5 3-1 5-3 7.5-1 1.3-2 3-2 4.5C6 18 8 21 12 22Z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    robot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    hourglass: '<path d="M7 3h10M7 21h10"/><path d="M8 3c0 4 4 4.5 4 9s-4 5-4 9M16 3c0 4-4 4.5-4 9s4 5 4 9"/>',
  };
  const USG_SEVERITY_ICON = { high: "warning", medium: "flame", info: "check" };
  const USG_SOURCE_META = {
    "claude-code": { label: "Claude", logo: "claude.png" },
    codex: { label: "Codex", logo: "chatgpt.webp" },
    cursor: { label: "Cursor", logo: "cursor.png" },
  };
  const USG_DAILY_STACK = [
    { key: "usefulTokens", label: "Useful", className: "is-useful" },
    { key: "wastedTokens", label: "Wasted", className: "is-waste" },
  ];
  const USG_INTENT_COLORS = {
    bugfix: "#ff5d73",
    feature: "#3b82f6",
    refactor: "#a78bfa",
    testing: "#22c55e",
    question: "#f6c344",
    other: "#94a3b8",
  };
  const USG_WASTE_COLORS = {
    rework: "#ff5d73",
    retries: "#fb7185",
    uncachedContext: "#ff8a1f",
    vagueExploration: "#f6c344",
  };
  const USG_PAGE_SIZE = 6;

  function fmtTok(n) {
    if (n == null) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n || 0));
  }

  function usd(n) {
    if (n == null) return "—";
    return "$" + Number(n || 0).toFixed(2);
  }

  function fmtShortDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function fmtSessionDate(iso) {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function fmtDuration(ms) {
    if (!ms || ms < 60_000) return "<1m";
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function fmtImpact(value, unit, largerUnit, scale) {
    const amount = Math.max(0, Number(value) || 0);
    if (amount === 0) return `0 ${unit}`;
    if (scale && amount >= scale) {
      const converted = amount / scale;
      return `~${converted < 10 ? converted.toFixed(2) : converted.toFixed(1)} ${largerUnit}`;
    }
    if (amount < 0.1) return `<0.1 ${unit}`;
    return `~${amount < 10 ? amount.toFixed(2) : amount.toFixed(1)} ${unit}`;
  }

  function fmtWater(ml) {
    return fmtImpact(ml, "mL", "L", 1000);
  }

  function fmtEnergy(wh) {
    return fmtImpact(wh, "Wh", "kWh", 1000);
  }

  function fmtCarbon(grams) {
    return fmtImpact(grams, "g CO2e", "kg CO2e", 1000);
  }

  function sourceLabel(source) {
    return USG_SOURCE_META[source]?.label || source;
  }

  function renderSourceIcon(container, source) {
    container.innerHTML = "";
    const logo = USG_SOURCE_META[source]?.logo;
    if (!logo) {
      container.innerHTML = svgIcon(USG_ICON_PATHS.robot, "icon-sm");
      return;
    }
    const img = document.createElement("img");
    img.className = "usg-model-logo";
    img.src = `assets/logos/${logo}`;
    img.alt = "";
    img.addEventListener("error", () => {
      container.innerHTML = svgIcon(USG_ICON_PATHS.robot, "icon-sm");
    }, { once: true });
    container.append(img);
  }

  function renderSourceBadge(source) {
    const badge = document.createElement("span");
    badge.className = `usg-source-badge usg-source-${source}`;
    badge.textContent = sourceLabel(source);
    return badge;
  }

  function emptyStateMessage(source, detectedSources) {
    const installed = detectedSources.includes(source);
    if (source === "claude-code") {
      return installed
        ? "Claude Code is installed, but no session logs were found in this date range. Try 90 days or run a Claude Code session, then refresh."
        : "Claude Code wasn't found on this machine. Install it and run a session — Metriq checks ~/.config/claude/projects/ and ~/.claude/projects/ automatically.";
    }
    if (source === "codex") {
      return installed
        ? "Codex is installed, but no session logs were found in this date range. Try a wider range or run Codex in a project, then refresh."
        : "Codex wasn't found on this machine. Install the Codex CLI and run a session — Metriq reads ~/.codex/sessions/ automatically.";
    }
    if (source === "cursor") {
      return installed
        ? "Cursor is installed, but no agent transcripts were found in this date range. Use the Cursor agent in a project, then refresh."
        : "Cursor wasn't found on this machine. Install Cursor and use the agent in a project — Metriq reads ~/.cursor/projects/*/agent-transcripts/ automatically.";
    }
    return "No usage data for this agent in the selected range.";
  }

  function renderUsageSourceTabs(detectedSources) {
    usageSourceTabs.innerHTML = "";
    ["claude-code", "codex", "cursor"].forEach((source) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `usg-source-tab${selectedUsageSource === source ? " is-active" : ""}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", selectedUsageSource === source ? "true" : "false");
      btn.innerHTML = `<span>${sourceLabel(source)}</span>${detectedSources.includes(source) ? "" : '<span class="usg-source-tab-note">not found</span>'}`;
      btn.addEventListener("click", () => {
        if (selectedUsageSource === source) return;
        selectedUsageSource = source;
        usagePage = 1;
        refreshUsage();
      });
      usageSourceTabs.append(btn);
    });
  }

  function renderUsageTile(label, value, note, accent = false) {
    const card = document.createElement("div");
    card.className = "usg-metric";
    const l = document.createElement("span");
    l.className = "usg-metric-label";
    l.textContent = label;
    const v = document.createElement("span");
    v.className = `usg-metric-value${accent ? " is-accent" : ""}`;
    v.textContent = value;
    const s = document.createElement("span");
    s.className = "usg-metric-sub";
    s.textContent = note;
    card.append(l, v, s);
    return card;
  }

  function renderUsageBanners(data) {
    usageBanners.innerHTML = "";
    if (data.selectedSource === "cursor") {
      const banner = document.createElement("div");
      banner.className = "usg-banner";
      banner.innerHTML =
        "<strong>Estimated numbers.</strong> Cursor's local transcripts don't record exact token usage, so these figures are estimated from message text with Metriq's offline tokenizer.";
      usageBanners.append(banner);
    }
  }

  function renderUsageHeadline(data) {
    const t = data.totals;
    usageTiles.innerHTML = "";
    usageTiles.append(
      renderUsageTile("Total tokens", fmtTok(t.totalTokens), `${fmtTok(t.inputTokens + t.cacheCreationTokens)} fresh input`, true),
      renderUsageTile("Est. cost", usd(t.costUSD), "API-equivalent pricing"),
      renderUsageTile("Saved by caching", usd(t.cacheSavingsUSD), `${fmtTok(t.cacheReadTokens)} cached reads`, true),
      renderUsageTile("Sessions", String((data.sessions || []).length), `last ${data.days} days`)
    );
  }

  function renderUsageChart(data) {
    const daily = (data.daily || []).length > 45 ? data.daily.filter((_, index) => index % 2 === 0) : (data.daily || []);
    const chartMax = Math.max(1, ...daily.map((day) => day.totalTokens || 0));
    usageChartLegend.innerHTML = "";
    USG_DAILY_STACK.forEach((segment) => {
      const item = document.createElement("span");
      item.className = "usg-chart-key";
      item.innerHTML = `<span class="usg-chart-dot ${segment.className}"></span>${segment.label}`;
      usageChartLegend.append(item);
    });

    function setInspector(day) {
      if (!day) {
        usageChartInspector.innerHTML = "";
        return;
      }
      const topUseful = day.behavior?.usefulBreakdown?.[0];
      const topWaste = day.behavior?.wasteBreakdown?.[0];
      usageChartInspector.innerHTML = `
        <div class="usg-chart-inspector-card">
          <strong>${fmtShortDate(day.date)}</strong>
          <span>${fmtTok(day.totalTokens)} total tokens</span>
          <span>${day.behavior?.usefulPct ?? 0}% useful${topUseful ? ` · mostly ${topUseful.label.toLowerCase()}` : ""}</span>
          <span>${day.behavior?.wastedPct ?? 0}% wasted${topWaste ? ` · mostly ${topWaste.label.toLowerCase()}` : ""}</span>
        </div>
      `;
    }

    let tooltip = document.getElementById("usage-chart-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "usage-chart-tooltip";
      tooltip.className = "usg-cursor-tooltip";
      tooltip.setAttribute("role", "tooltip");
      document.body.append(tooltip);
    }

    function setTooltipContent(day) {
      const usefulPct = day.behavior?.usefulPct ?? 0;
      const wastedPct = day.behavior?.wastedPct ?? 0;
      const usefulRows = (day.behavior?.usefulBreakdown || [])
        .map((intent) => `
          <div class="usg-tooltip-detail-row">
            <span><i style="background:${USG_INTENT_COLORS[intent.key] || USG_INTENT_COLORS.other}"></i>${intent.label}</span>
            <strong>${fmtTok(intent.tokens)} · ${intent.pctOfUseful}%</strong>
          </div>
        `)
        .join("") || '<p class="usg-tooltip-empty">No productive activity was classified.</p>';
      const wasteRows = (day.behavior?.wasteBreakdown || [])
        .map((waste) => `
          <div class="usg-tooltip-detail-row">
            <span><i style="background:${USG_WASTE_COLORS[waste.key] || "#ff8a1f"}"></i>${waste.label}</span>
            <strong>${fmtTok(waste.tokens)} · ${waste.pctOfWaste}%</strong>
          </div>
        `)
        .join("") || '<p class="usg-tooltip-empty">No avoidable waste was detected.</p>';
      tooltip.innerHTML = `
        <div class="usg-tooltip-header">
          <strong>${fmtShortDate(day.date)}</strong>
          <span>${fmtTok(day.totalTokens)} total tokens</span>
        </div>
        <div class="usg-tooltip-split">
          <div class="is-useful">
            <span>Useful</span>
            <strong>${usefulPct}%</strong>
            <small>${fmtTok(day.behavior?.usefulTokens || 0)} tokens</small>
          </div>
          <div class="is-waste">
            <span>Wasted</span>
            <strong>${wastedPct}%</strong>
            <small>${fmtTok(day.behavior?.wastedTokens || 0)} tokens</small>
          </div>
        </div>
        <div class="usg-tooltip-section">
          <h4>Useful tokens went to</h4>
          ${usefulRows}
        </div>
        <div class="usg-tooltip-section is-waste">
          <h4>Wasted tokens went to</h4>
          ${wasteRows}
        </div>
      `;
    }

    function placeTooltip(clientX, clientY) {
      const gap = 16;
      const width = tooltip.offsetWidth || 210;
      const height = tooltip.offsetHeight || 120;
      let left = clientX + gap;
      let top = clientY - height - gap;
      if (left + width > window.innerWidth - 12) left = clientX - width - gap;
      if (top < 12) top = clientY + gap;
      if (top + height > window.innerHeight - 12) top = window.innerHeight - height - 12;
      tooltip.style.left = `${Math.max(12, left)}px`;
      tooltip.style.top = `${Math.max(12, top)}px`;
    }

    function showTooltip(day, clientX, clientY) {
      setTooltipContent(day);
      tooltip.classList.add("is-visible");
      placeTooltip(clientX, clientY);
    }

    function hideTooltip() {
      tooltip.classList.remove("is-visible");
    }

    usageDailyChart.innerHTML = "";
    daily.forEach((day) => {
      const usefulPct = day.behavior?.usefulPct ?? 0;
      const wastedPct = day.behavior?.wastedPct ?? 0;
      const bar = document.createElement("div");
      bar.className = "usage-bar";
      bar.classList.toggle("is-empty", !day.totalTokens);
      bar.tabIndex = 0;
      const barPct = day.totalTokens > 0 ? Math.max(Math.sqrt(day.totalTokens / chartMax) * 100, 12) : 0;
      bar.style.height = `${barPct}%`;
      const tip = [
        `${day.date} · ${usd(day.costUSD)}`,
        `Total tokens: ${fmtTok(day.totalTokens)}`,
        `Useful: ${usefulPct}% · ${fmtTok(day.behavior?.usefulTokens || 0)}`,
        `Wasted: ${wastedPct}% · ${fmtTok(day.behavior?.wastedTokens || 0)}`,
      ];
      if (day.sources && Object.keys(day.sources).length) {
        tip.push(...Object.entries(day.sources).map(([source, totals]) => `${sourceLabel(source)}: ${fmtTok(totals.totalTokens)}`));
      }
      bar.setAttribute("aria-label", tip.join(". "));
      bar.addEventListener("mouseenter", (event) => {
        setInspector(day);
        showTooltip(day, event.clientX, event.clientY);
      });
      bar.addEventListener("mousemove", (event) => placeTooltip(event.clientX, event.clientY));
      bar.addEventListener("mouseleave", hideTooltip);
      bar.addEventListener("focus", () => {
        setInspector(day);
        const rect = bar.getBoundingClientRect();
        showTooltip(day, rect.left + rect.width / 2, rect.top);
      });
      bar.addEventListener("blur", hideTooltip);
      USG_DAILY_STACK.slice().reverse().forEach((segment) => {
        const part = document.createElement("div");
        part.className = `usage-bar-segment ${segment.className}`;
        const value = day.behavior?.[segment.key] || 0;
        part.style.height = `${(value / Math.max(day.totalTokens, 1)) * 100 || 0}%`;
        bar.append(part);
      });
      usageDailyChart.append(bar);
    });
    setInspector(daily[daily.length - 1] || null);

    usageDailyLabels.innerHTML = "";
    if (daily.length) {
      const first = document.createElement("span");
      const last = document.createElement("span");
      first.textContent = daily[0].date;
      last.textContent = daily[daily.length - 1].date;
      usageDailyLabels.append(first, last);
    }
  }

  function renderUsageLimits(data) {
    const rateLimits = data.rateLimits;
    const activeBlock = (data.blocks || []).find((block) => block.active) || null;
    const recentBlocks = (data.blocks || []).filter((block) => !block.active).slice(0, 5);
    usageLimits.innerHTML = "";

    if (rateLimits?.primary) {
      const primary = rateLimits.primary;
      const wrap = document.createElement("div");
      wrap.className = "usg-limit-stack";
      wrap.innerHTML = `
        <div class="usg-limit-summary">
          <div class="usg-limit-stat"><span class="usg-limit-label">Used</span><strong>${Math.round(primary.used_percent || 0)}%</strong></div>
          <div class="usg-limit-stat"><span class="usg-limit-label">Remaining</span><strong>${Math.max(0, 100 - Math.round(primary.used_percent || 0))}%</strong></div>
        </div>
        <div class="usg-progress"><span style="width:${Math.round(primary.used_percent || 0)}%"></span></div>
        <p class="muted">Reported by your last Codex session${rateLimits.observedAt ? ` (${fmtSessionDate(rateLimits.observedAt)})` : ""}${rateLimits.plan_type ? ` — ${rateLimits.plan_type} plan` : ""}.</p>
      `;
      usageLimits.append(wrap);
      if (rateLimits.secondary) {
        const weekly = document.createElement("div");
        weekly.className = "usg-limit-secondary";
        weekly.innerHTML = `
          <div class="usg-limit-row"><span>Weekly window</span><span>${Math.round(rateLimits.secondary.used_percent || 0)}% used</span></div>
          <div class="usg-progress is-secondary"><span style="width:${Math.round(rateLimits.secondary.used_percent || 0)}%"></span></div>
        `;
        usageLimits.append(weekly);
      }
    } else {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent =
        data.selectedSource === "codex"
          ? "No live limit telemetry in these logs, so an exact percent of your plan limit is unavailable. Showing activity per 5-hour window instead."
          : data.selectedSource === "claude-code"
            ? "Claude Code doesn't report live session-limit percentages in its local logs. Showing activity per 5-hour window instead."
            : "Cursor doesn't report session limits in its local transcripts. Showing activity per 5-hour window instead.";
      usageLimits.append(p);
    }

    if (activeBlock) {
      const active = document.createElement("div");
      active.className = "usg-window-card";
      active.innerHTML = `<div class="usg-limit-row"><strong>Current window</strong><span>${fmtTok(activeBlock.totalTokens)} · ${usd(activeBlock.costUSD)}</span></div><p class="muted">Window started ${fmtSessionDate(activeBlock.start)} · resets ${fmtSessionDate(activeBlock.end)}</p>`;
      usageLimits.append(active);
    }

    if (recentBlocks.length) {
      const list = document.createElement("div");
      list.className = "usg-window-list";
      recentBlocks.forEach((block) => {
        const row = document.createElement("div");
        row.className = "usg-window-row";
        row.innerHTML = `<span>${fmtSessionDate(block.start)}</span><span>${fmtTok(block.totalTokens)}</span>`;
        list.append(row);
      });
      usageLimits.append(list);
    }
  }

  function renderCurrentSession(data) {
    const session = data.currentSession;
    usageCurrentSession.classList.toggle("hidden", !session);
    if (!session) {
      usageCurrentSessionBody.innerHTML = "";
      return;
    }
    const primaryIntent = (session.intents || []).reduce(
      (largest, intent) => (!largest || intent.pctOfSession > largest.pctOfSession ? intent : largest),
      null
    );
    let donutCursor = 0;
    const donutStops = (session.intents || []).map((intent) => {
      const start = donutCursor;
      donutCursor += (intent.tokens / Math.max(session.sessionTokens, 1)) * 100;
      return `${USG_INTENT_COLORS[intent.key] || USG_INTENT_COLORS.other} ${start}% ${donutCursor}%`;
    });
    if (donutCursor < 100) donutStops.push(`${USG_INTENT_COLORS.other} ${donutCursor}% 100%`);
    const donutStyle = donutStops.length
      ? `background: conic-gradient(${donutStops.join(", ")})`
      : "background: var(--surface-1)";
    const intentRows = (session.intents || [])
      .map((intent) => {
        return `
          <div class="usg-intent-row">
            <div class="usg-mini-row">
              <span class="usg-mini-row-label"><span class="usg-intent-dot" style="background:${USG_INTENT_COLORS[intent.key] || USG_INTENT_COLORS.other}"></span>${intent.label}</span>
              <strong>${intent.pctOfSession}%</strong>
            </div>
            <div class="usg-intent-meta">${fmtTok(intent.tokens)} tokens · ${intent.turns} turn${intent.turns === 1 ? "" : "s"}${intent.pctOfLimit != null ? ` · ${intent.pctOfLimit}% of limit` : ""}</div>
          </div>
        `;
      })
      .join("");
    const wasteRows = (session.waste || [])
      .map((waste) => {
        const width = Math.max(6, (waste.tokens / Math.max(session.wastedTokens, 1)) * 100);
        return `<div class="usg-waste-row"><div class="usg-mini-row"><span>${waste.label}</span><span>${fmtTok(waste.tokens)} · ${waste.turns} turn${waste.turns === 1 ? "" : "s"}</span></div><div class="usg-progress is-waste"><span style="width:${width}%"></span></div><p class="muted usg-waste-hint">${waste.hint}</p></div>`;
      })
      .join("") || '<p class="muted">No wasted tokens detected in this session.</p>';
    usageCurrentSessionBody.innerHTML = `
      <div class="usg-current-grid">
        <div class="usg-current-card">
          <h3>How this session used tokens</h3>
          <p class="muted">${session.project} · ${sourceLabel(session.source)} · ${session.turns} turns since ${fmtSessionDate(session.startedAt)}</p>
          <div class="usg-session-breakdown">
            <div class="usg-session-donut" style="${donutStyle}" role="img" aria-label="Session activity breakdown">
              <div class="usg-session-donut-center">
                <strong>${fmtTok(session.sessionTokens)}</strong>
                <span>tokens</span>
              </div>
            </div>
            <div class="usg-session-legend">
              <p>Each color is a separate kind of work. The percentages add up to your full session.</p>
              <div class="usg-mini-list">${intentRows}</div>
            </div>
          </div>
          <div class="usg-session-highlight">
            <span class="usg-session-highlight-label">Main activity</span>
            <span>${primaryIntent ? `${primaryIntent.label} (${primaryIntent.pctOfSession}% of session)` : "No activity breakdown yet"}</span>
          </div>
        </div>
        <div class="usg-current-card">
          <h3>Where tokens were wasted</h3>
          <p class="muted">${fmtTok(session.wastedTokens)} wasted · ${session.wastedPct}% of this session · ${fmtTok(Math.max(0, session.sessionTokens - session.wastedTokens))} useful</p>
          <div class="usg-progress is-useful-split">
            <span class="is-useful" style="width:${Math.max(0, 100 - session.wastedPct)}%"></span>
            <span class="is-waste" style="width:${session.wastedPct}%"></span>
          </div>
          <div class="usg-mini-list">${wasteRows}</div>
        </div>
      </div>
    `;
  }

  function renderUsageImpact(data) {
    const impact = data.impact;
    if (!impact?.available) {
      usageImpactBody.innerHTML = `
        <div class="usg-impact-empty">
          <strong>Not enough request data yet</strong>
          <span>Run an agent session and refresh to estimate its benchmark-equivalent footprint.</span>
        </div>
      `;
      return;
    }

    const wasteCauses = new Map();
    (data.daily || []).forEach((day) => {
      (day.behavior?.wasteBreakdown || []).forEach((waste) => {
        const current = wasteCauses.get(waste.key) || { ...waste, tokens: 0, turns: 0 };
        current.tokens += waste.tokens;
        current.turns += waste.turns;
        wasteCauses.set(waste.key, current);
      });
    });
    const topWaste = [...wasteCauses.values()].sort((a, b) => b.tokens - a.tokens)[0] || null;
    const wastePct = Math.round(impact.wastedShare * 1000) / 10;
    const usefulTokens = Math.max(0, impact.totalTokens - impact.wastedTokens);
    const savingText = (formattedValue) => impact.wastedTokens > 0
      ? `<b>${formattedValue}</b> potentially avoidable`
      : "<b>None</b> avoidable waste detected";

    usageImpactBody.innerHTML = `
      <div class="usg-impact-hero">
        <div class="usg-impact-score" style="--impact-score:${impact.efficiencyPct * 3.6}deg">
          <div>
            <strong>${impact.efficiencyPct}%</strong>
            <span>useful share</span>
          </div>
        </div>
        <div class="usg-impact-story">
          <span class="usg-impact-kicker">Last ${data.days} days · ${impact.requests.toLocaleString()} model requests</span>
          <h3>${fmtTok(usefulTokens)} tokens were classified as useful</h3>
          <p>${fmtTok(impact.wastedTokens)} tokens (${wastePct}%) were flagged as potentially avoidable. Reducing that waste could lower the estimated inference footprint by roughly the same share.</p>
          <div class="usg-impact-share" aria-label="${impact.efficiencyPct}% useful and ${wastePct}% potentially avoidable">
            <span class="is-useful" style="width:${impact.efficiencyPct}%"></span>
            <span class="is-waste" style="width:${wastePct}%"></span>
          </div>
          <div class="usg-impact-share-labels"><span>Useful ${impact.efficiencyPct}%</span><span>Potential waste ${wastePct}%</span></div>
        </div>
      </div>

      <div class="usg-impact-metrics">
        <article class="usg-impact-metric is-water">
          <div class="usg-impact-metric-head">
            <span class="usg-impact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z"/></svg></span>
            <span>Water</span>
          </div>
          <strong>${fmtWater(impact.estimated.waterMl)}</strong>
          <span class="usg-impact-metric-note">benchmark-equivalent use</span>
          <div class="usg-impact-saving">${savingText(fmtWater(impact.potentiallyAvoidable.waterMl))}</div>
        </article>
        <article class="usg-impact-metric is-energy">
          <div class="usg-impact-metric-head">
            <span class="usg-impact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m13 2-9 12h7l-1 8 10-13h-7V2Z"/></svg></span>
            <span>Electricity</span>
          </div>
          <strong>${fmtEnergy(impact.estimated.energyWh)}</strong>
          <span class="usg-impact-metric-note">benchmark-equivalent use</span>
          <div class="usg-impact-saving">${savingText(fmtEnergy(impact.potentiallyAvoidable.energyWh))}</div>
        </article>
        <article class="usg-impact-metric is-carbon">
          <div class="usg-impact-metric-head">
            <span class="usg-impact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a7 7 0 0 1-14 0c0-4 3-7 8-9 0 4 2 5 4 6 1 .6 2 1.5 2 3Z"/><path d="M8 20c2-3 4-5 8-7"/></svg></span>
            <span>Carbon</span>
          </div>
          <strong>${fmtCarbon(impact.estimated.carbonG)}</strong>
          <span class="usg-impact-metric-note">benchmark-equivalent emissions</span>
          <div class="usg-impact-saving">${savingText(fmtCarbon(impact.potentiallyAvoidable.carbonG))}</div>
        </article>
      </div>

      <div class="usg-impact-details">
        <div class="usg-impact-detail-card">
          <span class="usg-impact-detail-label">What changes the footprint</span>
          <h3>Model, reasoning depth, hardware, cooling, and the electric grid</h3>
          <p>Long agent runs and reasoning models can use far more energy than a median text prompt. Water also changes with cooling design, climate, and how electricity is generated.</p>
        </div>
        <div class="usg-impact-detail-card is-action">
          <span class="usg-impact-detail-label">Best next step</span>
          <h3>${topWaste ? topWaste.label : "Keep the useful share high"}</h3>
          <p>${topWaste ? `${topWaste.hint} Addressing this category could remove up to ${fmtTok(topWaste.tokens)} wasted tokens in this range.` : "Metriq did not detect a recurring waste category in this range. Keep prompts scoped and preserve reusable context."}</p>
        </div>
      </div>

      <p class="usg-impact-method">
        Method: ${impact.benchmark.name}, measured at ${impact.benchmark.energyWhPerRequest} Wh, ${impact.benchmark.waterMlPerRequest} mL water, and ${impact.benchmark.carbonGPerRequest} g CO2e per request, scaled by your request count. This is an orientation benchmark, not a provider-specific measurement. Berkeley Lab reports that workload-level water use can vary by more than 10,000x.
      </p>
    `;
  }

  function renderUsageInsights(data) {
    const insights = data.insights || [];
    usageInsights.innerHTML = "";
    if (!insights.length) {
      const p = document.createElement("p");
      p.className = "muted empty-note";
      p.textContent = "Not enough usage in this window to generate insights yet.";
      usageInsights.append(p);
      return;
    }
    insights.forEach((insight) => {
      const div = document.createElement("div");
      div.className = `usage-insight ${insight.severity}`;
      div.innerHTML = `<div class="usage-insight-head"><span class="usage-insight-icon">${svgIcon(USG_ICON_PATHS[USG_SEVERITY_ICON[insight.severity]] || USG_ICON_PATHS.flame, "icon-sm")}</span><h3>${insight.title}</h3></div><p>${insight.evidence}</p><p class="usage-insight-action">${insight.action}</p>`;
      usageInsights.append(div);
    });
  }

  function renderUsageModels(data) {
    usageModels.innerHTML = "";
    (data.models || []).forEach((model) => {
      const card = document.createElement("div");
      card.className = "usg-model-card";
      const top = document.createElement("div");
      top.className = "usg-model-card-top";
      const name = document.createElement("span");
      name.className = "usg-model-name";
      name.textContent = model.label;
      const badge = renderSourceBadge(model.source);
      top.append(name, badge);
      const modelId = document.createElement("div");
      modelId.className = "muted usg-model-id";
      modelId.textContent = model.model;
      const stats = document.createElement("div");
      stats.className = "usg-model-card-stats";
      stats.innerHTML = `<strong>${fmtTok(model.totalTokens)}</strong><span>${usd(model.costUSD)}${model.approximatePricing ? " (approx.)" : ""}</span>`;
      const meta = document.createElement("div");
      meta.className = "muted usg-model-card-meta";
      meta.textContent = `${model.requests} requests · Cache efficiency ${Math.round((model.cacheHitRate || 0) * 100)}%`;
      card.append(top, modelId, stats, meta);
      usageModels.append(card);
    });
  }

  function getFilteredUsageSessions() {
    const sessions = latestUsageData?.sessions || [];
    const q = usageQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) =>
      session.sessionId.toLowerCase().includes(q) ||
      String(session.project || "").toLowerCase().includes(q) ||
      (session.models || []).some((model) => model.toLowerCase().includes(q))
    );
  }

  function renderUsageSessions() {
    const filtered = getFilteredUsageSessions();
    const totalPages = Math.max(1, Math.ceil(filtered.length / USG_PAGE_SIZE));
    usagePage = Math.min(usagePage, totalPages);
    const paged = filtered.slice((usagePage - 1) * USG_PAGE_SIZE, usagePage * USG_PAGE_SIZE);

    usageSessions.innerHTML = "";
    usageSessionsEmpty.classList.toggle("hidden", paged.length > 0);

    paged.forEach((session) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="usg-session-project">${session.project || "No project"}</div>
          <div class="muted usg-session-sub">${sourceLabel(session.source)} · ${session.sessionId.slice(0, 8)}…</div>
        </td>
        <td>${fmtSessionDate(session.startedAt)}</td>
        <td class="usg-cell-num">${fmtDuration(session.durationMs)}</td>
        <td class="usg-cell-num">${fmtTok(session.inputTokens)} / ${fmtTok(session.outputTokens)} / ${fmtTok(session.cacheReadTokens)}</td>
        <td class="usg-cell-num usg-cell-cost">${usd(session.costUSD)}</td>
        <td class="muted">${(session.models || []).join(", ")}</td>
      `;
      usageSessions.append(tr);
    });

    const from = filtered.length ? (usagePage - 1) * USG_PAGE_SIZE + 1 : 0;
    const to = Math.min(usagePage * USG_PAGE_SIZE, filtered.length);
    usageSessionsSummary.textContent = `Showing ${from} to ${to} of ${filtered.length} sessions`;
    usagePageInfo.textContent = `${usagePage} / ${totalPages}`;
    usagePagePrev.disabled = usagePage <= 1;
    usagePageNext.disabled = usagePage >= totalPages;
  }

  function renderUsageEmpty(data) {
    const detectedSources = data.detectedSources || [];
    usageEmptyTitle.textContent = `No ${sourceLabel(selectedUsageSource)} usage in this range`;
    usageEmptyBody.textContent = emptyStateMessage(selectedUsageSource, detectedSources);
    usageDetectedSources.innerHTML = "";
    usageDetectedSources.classList.toggle("hidden", detectedSources.length === 0);
    detectedSources.forEach((source) => usageDetectedSources.append(renderSourceBadge(source)));
  }

  function renderUsageMeta(data) {
    usageMeta.textContent = `Imported from local ${(data.sources || []).map((source) => sourceLabel(source)).join(" and ")} logs at ${fmtSessionDate(data.generatedAt)}. All parsing happens on this machine — nothing is uploaded.`;
  }

  function applyUsageData(data) {
    const available = Boolean(data && data.available);
    usageTitle.textContent = `${sourceLabel(selectedUsageSource)} Usage`;
    renderUsageSourceTabs(data.detectedSources || []);
    usageEmpty.classList.toggle("hidden", available);
    usageContent.classList.toggle("hidden", !available);
    if (!available) {
      renderUsageEmpty(data || {});
      latestUsageData = null;
      return;
    }
    latestUsageData = data;
    renderUsageBanners(data);
    renderUsageHeadline(data);
    renderUsageChart(data);
    renderUsageLimits(data);
    renderCurrentSession(data);
    renderUsageImpact(data);
    renderUsageInsights(data);
    renderUsageModels(data);
    renderUsageSessions();
    renderUsageMeta(data);
  }

  async function refreshUsage() {
    const data = await window.metriq.getUsage(usageDays, selectedUsageSource);
    applyUsageData(data);
  }

  for (const btn of usageRangeButtons) {
    btn.addEventListener("click", () => {
      usageDays = parseInt(btn.dataset.days, 10);
      for (const b of usageRangeButtons) b.classList.toggle("is-active", b === btn);
      usagePage = 1;
      refreshUsage();
    });
  }

  usageSearch?.addEventListener("input", (event) => {
    usageQuery = event.target.value;
    usagePage = 1;
    renderUsageSessions();
  });
  usagePagePrev?.addEventListener("click", () => {
    usagePage = Math.max(1, usagePage - 1);
    renderUsageSessions();
  });
  usagePageNext?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredUsageSessions().length / USG_PAGE_SIZE));
    usagePage = Math.min(totalPages, usagePage + 1);
    renderUsageSessions();
  });
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
