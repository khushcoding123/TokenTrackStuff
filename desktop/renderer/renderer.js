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
  const overviewActiveProject = document.getElementById("overview-active-project");
  const recentActivityList = document.getElementById("recent-activity-list");
  const recentActivityEmpty = document.getElementById("recent-activity-empty");

  const AVAILABLE_TOOLS = [
    { id: "claude", label: "Claude", icon: "sparkle" },
    { id: "chatgpt", label: "ChatGPT", icon: "bubble" },
    { id: "vscode", label: "VS Code", icon: "brackets" },
    { id: "cursor", label: "Cursor", icon: "cursor" },
    { id: "other", label: "Other / terminal", icon: "terminal" },
  ];

  const TOOL_ICONS = {
    sparkle:
      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    bubble: '<path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-4-1L3 20l1-4a8.4 8.4 0 0 1-1-4 8.5 8.5 0 0 1 8.5-8.5H12a8.5 8.5 0 0 1 9 7.5Z"/>',
    brackets: '<path d="m8 4-6 8 6 8M16 4l6 8-6 8"/>',
    cursor: '<path d="m4 4 7 17 2.5-7.5L21 11 4 4Z"/>',
    terminal: '<path d="m5 7 5 5-5 5M12 17h7"/>',
  };

  function svgIcon(pathMarkup, extraClass = "") {
    return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${pathMarkup}</svg>`;
  }

  // --- Theme toggle -----------------------------------------------------
  // Adapted from the web app's ThemeProvider curtain-wipe transition: the
  // View Transitions API is the primary path (clip-path wipe reveals the
  // new theme top-to-bottom, old snapshot just sits still underneath); a
  // scaling curtain div is the fallback for a Chromium build without it.

  const SUN_PATH =
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const MOON_PATH = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>';

  const btnToggleTheme = document.getElementById("btn-toggle-theme");
  const themeToggleIcon = document.getElementById("theme-toggle-icon");
  const themeToggleLabel = document.getElementById("theme-toggle-label");

  let curtainActive = false;

  function applyTheme(theme) {
    document.documentElement.classList.toggle("light", theme === "light");
    if (themeToggleIcon) themeToggleIcon.innerHTML = theme === "light" ? SUN_PATH : MOON_PATH;
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
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  }

  btnGotoProjects?.addEventListener("click", () => showPage("projects"));

  // --- Auth views -----------------------------------------------------------

  function showLoggedOut() {
    viewHome.classList.add("hidden");
    viewLogin.classList.remove("hidden");
    waitingMsg.classList.add("hidden");
  }

  function applyIdentity(session) {
    const displayName = session.name || session.email || "there";
    document.getElementById("identity-name").textContent = displayName;
    document.getElementById("avatar-initial").textContent = displayName.charAt(0).toUpperCase();
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
    settingsNameError.classList.add("hidden");
    settingsNameInput.value = document.getElementById("settings-identity-name").textContent;
    settingsNameDisplay.classList.add("hidden");
    settingsNameForm.classList.remove("hidden");
    settingsNameInput.focus();
    settingsNameInput.select();
  }

  function closeNameForm() {
    settingsNameForm.classList.add("hidden");
    settingsNameDisplay.classList.remove("hidden");
    settingsNameError.classList.add("hidden");
  }

  btnEditName?.addEventListener("click", openNameForm);
  btnCancelName?.addEventListener("click", closeNameForm);

  settingsNameForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = settingsNameInput.value.trim();
    if (!name) {
      settingsNameError.textContent = "Name can't be empty.";
      settingsNameError.classList.remove("hidden");
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
      settingsNameError.textContent = err.message || "Couldn't update your name.";
      settingsNameError.classList.remove("hidden");
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

  // --- Projects -----------------------------------------------------------

  function showProjectsError(message) {
    projectsError.textContent = message;
    projectsError.classList.remove("hidden");
  }

  function clearProjectsError() {
    projectsError.classList.add("hidden");
  }

  function renderOverviewActiveProject(activeProject) {
    if (!activeProject) {
      overviewActiveProject.innerHTML = `<p class="muted empty-note">No project linked yet.</p>`;
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
