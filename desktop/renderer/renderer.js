(async function () {
  const viewLogin = document.getElementById("view-login");
  const viewHome = document.getElementById("view-home");
  const waitingMsg = document.getElementById("waiting-msg");
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");
  const btnLinkProject = document.getElementById("btn-link-project");
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

  const AVAILABLE_TOOLS = [
    { id: "claude", label: "Claude", icon: "sparkle" },
    { id: "chatgpt", label: "ChatGPT", icon: "knot" },
    { id: "vscode", label: "VS Code", icon: "brackets" },
    { id: "cursor", label: "Cursor", icon: "cursor" },
    { id: "other", label: "Other / terminal", icon: "terminal" },
  ];

  // Stylized single-color glyphs evoking each tool's mark — not literal
  // reproductions of trademarked logos (no bundled brand assets, and the
  // CSP blocks fetching real ones remotely), but distinct from each other
  // and from generic chat/app iconography.
  const TOOL_ICONS = {
    sparkle:
      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    knot: '<circle cx="12" cy="7.5" r="3"/><circle cx="7" cy="15.5" r="3"/><circle cx="17" cy="15.5" r="3"/>',
    brackets: '<path d="m8 4-6 8 6 8M16 4l6 8-6 8"/>',
    cursor: '<path d="m4 4 7 17 2.5-7.5L21 11 4 4Z"/>',
    terminal: '<path d="m5 7 5 5-5 5M12 17h7"/>',
  };

  function svgIcon(pathMarkup, extraClass = "") {
    return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
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
        desc: "Focused rewrites are trimming your exploration cost — keep it up.",
        positive: true,
      });
    }
    suggestions.push(
      {
        icon: "lightbulb",
        title: "Name real files in prompts",
        desc: "A concrete file reference bounds how far the AI explores — the single biggest token saver.",
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
  const psEmptyHint = document.getElementById("ps-empty-hint");
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
  const psHistoryList = document.getElementById("ps-history-list");
  const psHistoryEmpty = document.getElementById("ps-history-empty");

  let psInitialized = false;
  let psDebounceTimer = null;
  let psLatestResult = null;
  const psHistory = []; // session-only: { timestamp, prompt, result }

  function psRenderResult(result) {
    psResults.classList.remove("hidden");
    psEmptyHint.classList.add("hidden");

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
  }

  function psClearResult() {
    psResults.classList.add("hidden");
    psEmptyHint.classList.remove("hidden");
    psLatestResult = null;
  }

  function psRenderHistoryRow(entry) {
    const li = document.createElement("li");
    li.className = "activity-item";
    li.style.cursor = "pointer";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = entry.prompt.length > 60 ? entry.prompt.slice(0, 60) + "…" : entry.prompt;
    const time = document.createElement("div");
    time.className = "activity-time muted";
    time.textContent = `${entry.result.rating} · ${timeAgo(entry.timestamp)}`;
    left.append(title, time);

    const right = document.createElement("div");
    right.className = "activity-savings";
    right.textContent = entry.result.savedTokens > 0 ? `−${entry.result.savedTokens} tokens` : "—";

    li.append(left, right);
    li.addEventListener("click", () => {
      psInput.value = entry.prompt;
      psRenderResult(entry.result);
    });
    return li;
  }

  function psRefreshHistory() {
    psHistoryList.innerHTML = "";
    psHistoryEmpty.classList.toggle("hidden", psHistory.length > 0);
    for (const entry of [...psHistory].reverse()) {
      psHistoryList.append(psRenderHistoryRow(entry));
    }
  }

  async function initPromptStudio() {
    if (psInitialized) return;
    psInitialized = true;

    const { activeProject } = await window.metriq.getCaptureContext();
    psContext.textContent = activeProject
      ? `Checking against ${activeProject.name}`
      : "No project linked — link one from Projects for file-aware analysis.";

    psInput.addEventListener("input", () => {
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

    psBtnSnapshot.addEventListener("click", () => {
      if (!psLatestResult) return;
      psHistory.push({
        timestamp: new Date().toISOString(),
        prompt: psInput.value.trim(),
        result: psLatestResult,
      });
      psRefreshHistory();
      const original = psBtnSnapshot.textContent;
      psBtnSnapshot.textContent = "Saved!";
      setTimeout(() => {
        psBtnSnapshot.textContent = original;
      }, 1200);
    });

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
      if (btn.dataset.page === "prompt-studio") initPromptStudio();
    });
  }

  btnGotoProjects?.addEventListener("click", () => showPage("projects"));

  btnGotoStudio?.addEventListener("click", () => {
    showPage("prompt-studio");
    initPromptStudio();
  });

  btnOvFirstPrompt?.addEventListener("click", () => window.metriq.openCapture());

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

  // --- Tools ------------------------------------------------------------

  async function initTools() {
    const selected = new Set(await window.metriq.getTools());
    toolsList.innerHTML = "";
    for (const tool of AVAILABLE_TOOLS) {
      const row = document.createElement("label");
      row.className = "tool-row" + (selected.has(tool.id) ? " is-checked" : "");

      const iconWrap = document.createElement("span");
      iconWrap.className = "tool-row-icon";
      iconWrap.innerHTML = svgIcon(TOOL_ICONS[tool.icon] || "");

      const textWrap = document.createElement("span");
      textWrap.className = "tool-row-label";
      textWrap.textContent = tool.label;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "tool-row-input";
      checkbox.checked = selected.has(tool.id);
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) selected.add(tool.id);
        else selected.delete(tool.id);
        row.classList.toggle("is-checked", checkbox.checked);
        await window.metriq.setTools([...selected]);
      });

      const toggle = document.createElement("span");
      toggle.className = "tool-row-toggle";

      row.append(iconWrap, textWrap, checkbox, toggle);
      toolsList.append(row);
    }
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
      description: "A dedicated high-contrast palette — stronger separation between text, surfaces, borders, and controls. Defaults to your system setting until you choose explicitly.",
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
      const name = document.createElement("div");
      name.className = "project-name";
      name.textContent = project.name;
      const pathEl = document.createElement("div");
      pathEl.className = "project-path";
      pathEl.textContent = project.path;
      nameCol.append(name, pathEl);
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
        } catch (err) {
          showProjectsError(err.message || "Rescan failed.");
        }
        refreshProjects();
      });

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        try {
          await window.metriq.removeProject(project.id);
          clearProjectsError();
        } catch (err) {
          showProjectsError(err.message || "Remove failed.");
        }
        refreshProjects();
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
            ? "Accessibility needed — click to grant"
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
        ? "Suggestions will name files from this repo."
        : "No repo — suggestions add scope guards only.";
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
    } catch (err) {
      showProjectsError(err.message || "Couldn't link that folder.");
      if (button !== btnLinkProject) showPage("projects");
    }
    button.innerHTML = originalLabel;
    button.disabled = false;
    refreshProjects();
  }

  btnLinkProject.addEventListener("click", () => linkProjectFlow(btnLinkProject));

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
    right.textContent = entry.savedTokens > 0 ? `−${entry.savedTokens} tokens` : "—";

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
      savings.textContent = "—";
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
  const usageInsights = document.getElementById("usage-insights");
  const usageModels = document.getElementById("usage-models");
  const usageSessions = document.getElementById("usage-sessions");
  const usageMeta = document.getElementById("usage-meta");
  const usageRangeButtons = document.querySelectorAll(".usage-range-btn");
  const btnRefreshUsage = document.getElementById("btn-refresh-usage");

  let usageDays = 30;

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

  function renderUsageTile(label, value, sub) {
    const card = document.createElement("div");
    card.className = "stat-card";
    const v = document.createElement("span");
    v.className = "stat-value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "stat-label";
    l.textContent = label;
    card.append(v, l);
    if (sub) {
      const s = document.createElement("span");
      s.className = "activity-time muted";
      s.textContent = sub;
      card.append(s);
    }
    return card;
  }

  function renderUsageInsight(insight) {
    const div = document.createElement("div");
    div.className = `usage-insight ${insight.severity}`;
    const h = document.createElement("h3");
    h.textContent = insight.title;
    const evidence = document.createElement("p");
    evidence.textContent = insight.evidence;
    const action = document.createElement("p");
    action.className = "usage-insight-action";
    action.textContent = `→ ${insight.action}`;
    div.append(h, evidence, action);
    return div;
  }

  function renderUsageModelRow(model, maxCost) {
    const row = document.createElement("div");
    row.className = "usage-model-row";
    const label = document.createElement("div");
    label.className = "usage-model-label";
    const name = document.createElement("span");
    name.textContent = model.label;
    const cost = document.createElement("span");
    cost.className = "cost";
    cost.textContent = usd(model.costUSD);
    label.append(name, cost);
    const track = document.createElement("div");
    track.className = "usage-model-bar-track";
    const fill = document.createElement("div");
    fill.className = "usage-model-bar-fill";
    fill.style.width = `${maxCost > 0 ? (model.costUSD / maxCost) * 100 : 0}%`;
    track.append(fill);
    row.append(label, track);
    return row;
  }

  function renderUsageSessionRow(session) {
    const li = document.createElement("li");
    li.className = "activity-item";
    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = session.project;
    const time = document.createElement("div");
    time.className = "activity-time muted";
    time.textContent = `${session.requests} reqs · ${fmtTok(session.totalTokens)} tok`;
    left.append(title, time);
    const right = document.createElement("div");
    right.className = "activity-savings";
    right.textContent = usd(session.costUSD);
    li.append(left, right);
    return li;
  }

  async function refreshUsage() {
    const data = await window.metriq.getUsage(usageDays);
    const available = Boolean(data && data.available);
    usageEmpty.classList.toggle("hidden", available);
    usageContent.classList.toggle("hidden", !available);
    if (!available) return;

    const t = data.totals;
    const reqs = (data.models || []).reduce((sum, m) => sum + m.requests, 0);
    usageTiles.innerHTML = "";
    usageTiles.append(
      renderUsageTile("Total tokens", fmtTok(t.totalTokens), `${reqs} requests`),
      renderUsageTile("Total cost", usd(t.costUSD), "API-equivalent"),
      renderUsageTile("Saved by caching", usd(t.cacheSavingsUSD), `${fmtTok(t.cacheReadTokens)} cached`),
      renderUsageTile("Output tokens", fmtTok(t.outputTokens), `${fmtTok(t.inputTokens)} input`)
    );

    const daily = data.daily || [];
    const dmax = Math.max(...daily.map((d) => d.totalTokens), 1);
    usageDailyChart.innerHTML = "";
    for (const d of daily) {
      const bar = document.createElement("div");
      bar.className = "usage-bar";
      bar.style.height = `${Math.max((d.totalTokens / dmax) * 100, 1)}%`;
      bar.title = `${fmtShortDate(d.date)} · ${fmtTok(d.totalTokens)} tokens`;
      usageDailyChart.append(bar);
    }

    // A handful of date ticks under the bars (first/middle/last) so the
    // range has a reference point without crowding — exact value + date
    // for any single day is still available via the bar's hover tooltip.
    usageDailyLabels.innerHTML = "";
    if (daily.length) {
      const tickIdxs = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
      for (const i of tickIdxs) {
        const span = document.createElement("span");
        span.textContent = fmtShortDate(daily[i].date);
        usageDailyLabels.append(span);
      }
    }

    const peakDay = daily.reduce((max, d) => (!max || d.totalTokens > max.totalTokens ? d : max), null);
    usageDailyPeak.textContent =
      peakDay && peakDay.totalTokens > 0 ? `Peak: ${fmtTok(peakDay.totalTokens)} on ${fmtShortDate(peakDay.date)}` : "";

    const insights = data.insights || [];
    usageInsights.innerHTML = "";
    if (!insights.length) {
      const p = document.createElement("p");
      p.className = "muted empty-note";
      p.textContent = "No issues flagged — usage looks healthy.";
      usageInsights.append(p);
    } else {
      for (const insight of insights) usageInsights.append(renderUsageInsight(insight));
    }

    const models = data.models || [];
    const maxCost = Math.max(...models.map((m) => m.costUSD), 0);
    usageModels.innerHTML = "";
    for (const model of models) usageModels.append(renderUsageModelRow(model, maxCost));

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
