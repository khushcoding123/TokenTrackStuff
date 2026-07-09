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
    });
  }

  btnGotoProjects?.addEventListener("click", () => showPage("projects"));

  document.getElementById("btn-sidebar-avatar")?.addEventListener("click", () => showPage("settings"));

  // --- Auth views -----------------------------------------------------------

  function showLoggedOut() {
    viewHome.classList.add("hidden");
    viewLogin.classList.remove("hidden");
    waitingMsg.classList.add("hidden");
  }

  function applyIdentity(session) {
    const displayName = session.name || session.email || "there";
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

  function renderOverviewActiveProject(activeProject) {
    if (!activeProject) {
      overviewActiveProject.innerHTML = `
        <div class="empty-state-compact">
          <div class="empty-state-icon-frame">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
            </svg>
          </div>
          <p class="muted">No project linked yet.</p>
        </div>
      `;
      return;
    }
    overviewActiveProject.innerHTML = "";
    const card = document.createElement("div");
    card.className = "mini-project-card";
    const name = document.createElement("div");
    name.className = "project-name";
    name.textContent = activeProject.name;
    const pathEl = document.createElement("div");
    pathEl.className = "project-path";
    pathEl.textContent = activeProject.path;
    card.append(name, pathEl);
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
    try {
      const [projects, activeId, activeProject] = await Promise.all([
        window.metriq.listProjects(),
        window.metriq.getActiveProjectId(),
        window.metriq.getActiveProject(),
      ]);
      clearProjectsError();
      renderProjects(projects || [], activeId);
      renderOverviewActiveProject(activeProject);
    } catch (err) {
      showProjectsError(err.message || "Couldn't load projects.");
    }
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

  btnLinkProject.addEventListener("click", async () => {
    const folderPath = await window.metriq.pickFolder();
    if (!folderPath) return;
    const originalLabel = btnLinkProject.innerHTML;
    btnLinkProject.textContent = "Linking…";
    btnLinkProject.disabled = true;
    try {
      await window.metriq.linkProject(folderPath);
      clearProjectsError();
    } catch (err) {
      showProjectsError(err.message || "Couldn't link that folder.");
    }
    btnLinkProject.innerHTML = originalLabel;
    btnLinkProject.disabled = false;
    refreshProjects();
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

  async function refreshStats() {
    const summary = await window.metriq.getStatsSummary();

    document.getElementById("stat-captures").textContent = summary.totalCaptures;
    document.getElementById("stat-tokens-saved").textContent = summary.totalSavedTokens.toLocaleString();
    document.getElementById("sustain-captures").textContent = summary.totalCaptures;
    document.getElementById("sustain-tokens-saved").textContent = summary.totalSavedTokens.toLocaleString();
    document.getElementById("sustain-avg-pct").textContent = `${summary.avgSavedPct}%`;

    recentActivityList.innerHTML = "";
    const hasHistory = summary.recent.length > 0;
    recentActivityEmpty.classList.toggle("hidden", hasHistory);
    for (const entry of summary.recent.slice(0, 5)) {
      recentActivityList.append(renderActivityRow(entry));
    }

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
