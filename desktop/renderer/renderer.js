(async function () {
  const viewLogin = document.getElementById("view-login");
  const viewHome = document.getElementById("view-home");
  const waitingMsg = document.getElementById("waiting-msg");
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");
  const btnLinkProject = document.getElementById("btn-link-project");
  const projectsList = document.getElementById("projects-list");
  const projectsEmpty = document.getElementById("projects-empty");
  const projectsError = document.getElementById("projects-error");

  function showLoggedOut() {
    viewHome.classList.add("hidden");
    viewLogin.classList.remove("hidden");
    waitingMsg.classList.add("hidden");
  }

  function showLoggedIn(session) {
    const displayName = session.name || session.email || "there";
    document.getElementById("identity-name").textContent = session.name || session.email;
    document.getElementById("identity-email").textContent = session.email || "";
    document.getElementById("avatar-initial").textContent = displayName.charAt(0).toUpperCase();
    viewLogin.classList.add("hidden");
    viewHome.classList.remove("hidden");
    refreshProjects();
  }

  function showProjectsError(message) {
    projectsError.textContent = message;
    projectsError.classList.remove("hidden");
  }

  function clearProjectsError() {
    projectsError.classList.add("hidden");
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
        await window.metriq.setActiveProject(project.id);
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
      const [projects, activeId] = await Promise.all([
        window.metriq.listProjects(),
        window.metriq.getActiveProjectId(),
      ]);
      clearProjectsError();
      renderProjects(projects || [], activeId);
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

  btnLinkProject.addEventListener("click", async () => {
    const folderPath = await window.metriq.pickFolder();
    if (!folderPath) return;
    btnLinkProject.textContent = "Linking…";
    btnLinkProject.disabled = true;
    try {
      await window.metriq.linkProject(folderPath);
      clearProjectsError();
    } catch (err) {
      showProjectsError(err.message || "Couldn't link that folder.");
    }
    btnLinkProject.textContent = "+ Link a project";
    btnLinkProject.disabled = false;
    refreshProjects();
  });

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
