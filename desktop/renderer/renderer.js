(async function () {
  const viewLogin = document.getElementById("view-login");
  const viewHome = document.getElementById("view-home");
  const waitingMsg = document.getElementById("waiting-msg");
  const btnLogin = document.getElementById("btn-login");
  const btnSignup = document.getElementById("btn-signup");
  const btnLogout = document.getElementById("btn-logout");

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
