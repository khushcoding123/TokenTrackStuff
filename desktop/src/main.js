const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, dialog, globalShortcut, clipboard, screen } = require("electron");
const path = require("node:path");
const { saveSession, loadSession, clearSession } = require("./auth-store");
const { PROTOCOL, findProtocolUrlInArgv, parseAuthCallbackUrl } = require("./protocol");
const { saveFileIndex, loadFileIndex, removeFileIndex } = require("./project-cache");
const { loadPrefs, savePrefs } = require("./prefs");
const { recordCapture, getSummary } = require("./usage-stats");
const insforge = require("./insforge-client");
const { listSourceFiles, findRelevantFiles } = require("../../packages/core/scanner.js");
const { optimize } = require("../../packages/core/rewrite.js");
// Same usage engine behind the web /usage dashboard and `metriq trace` — reads
// this machine's real Claude Code + Codex logs (not the local capture-copy
// stats in usage-stats.js above, which only track this app's own CTA clicks).
const { getClaudeDirs, loadClaudeRecords } = require("../../src/core/usage/claude.js");
const { getCodexSessionsDir, loadCodexUsage } = require("../../src/core/usage/codex.js");
const { aggregate } = require("../../src/core/usage/aggregate.js");
const { generateInsights } = require("../../src/core/usage/insights.js");

const WEB_BASE_URL = process.env.METRIQ_WEB_URL || "https://tokenpilot-mocha.vercel.app";
const CAPTURE_HOTKEY = process.env.METRIQ_CAPTURE_HOTKEY || "CommandOrControl+Shift+M";

// Test-only hook: Playwright's electronApplication.evaluate() runs in the
// main process's global scope, which doesn't have this module's local
// `require`/closures — so expose exactly what the E2E suite needs here,
// and only when explicitly opted into. Never set in a real user's launch.
if (process.env.METRIQ_E2E_TEST === "1") {
  const { credentialsPath } = require("./auth-store");
  const fs = require("node:fs");
  global.__metriqTest = {
    saveSession,
    loadSession,
    clearSession,
    parseAuthCallbackUrl,
    inspectCredentialsFile() {
      const p = credentialsPath();
      if (!fs.existsSync(p)) return { exists: false };
      const raw = fs.readFileSync(p);
      const stat = fs.statSync(p);
      return {
        exists: true,
        mode: (stat.mode & 0o777).toString(8),
        rawUtf8Preview: raw.toString("utf8"),
        byteLength: raw.length,
      };
    },
    readClipboardText: () => clipboard.readText(),
  };
}

let mainWindow = null;
let captureWindow = null;
let tray = null;

// --- Protocol registration ---------------------------------------------

function registerProtocolHandler() {
  if (process.defaultApp) {
    // Running unpackaged (`electron .`) — Windows/Linux need the exact
    // invocation spelled out so the OS launches this app the same way when
    // a metriq:// link is clicked, instead of trying to launch `electron`
    // itself with no arguments.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

// --- Window / tray / menu ------------------------------------------------

function createWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 480,
    height: 760,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: "#0B0F14",
    title: "Metriq",
    icon: path.join(__dirname, "..", "renderer", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

// The floating prompt-capture window — small, always-on-top, positioned
// near the cursor so it feels like a quick-entry palette rather than a
// full app window. Toggled by the global hotkey or a button in the main
// window; a second trigger while it's open just hides it again.
function createCaptureWindow() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 480;
  const height = 420;

  captureWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(display.workArea.x + (display.workArea.width - width) / 2),
    y: Math.round(display.workArea.y + (display.workArea.height - height) / 3),
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    frame: true,
    title: "Metriq — Capture",
    backgroundColor: "#0B0F14",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Newly created/shown windows can receive a spurious initial blur before
  // OS focus genuinely settles on them (window-manager-dependent). Ignore
  // blur events for a brief grace period right after showing so the window
  // can't vanish before the user gets a chance to use it; genuine "click
  // away" dismissal past that point still works immediately.
  let shownAt = 0;
  const BLUR_GRACE_MS = 400;

  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureWindow.loadFile(path.join(__dirname, "..", "renderer", "capture.html"));
  captureWindow.once("ready-to-show", () => {
    captureWindow.show();
    shownAt = Date.now();
  });
  captureWindow.on("closed", () => {
    captureWindow = null;
  });
  captureWindow.on("blur", () => {
    // Quick-palette feel: clicking away dismisses it, like Spotlight.
    if (Date.now() - shownAt < BLUR_GRACE_MS) return;
    captureWindow?.close();
  });

  return captureWindow;
}

function toggleCaptureWindow() {
  if (captureWindow) {
    captureWindow.close();
    return;
  }
  createCaptureWindow();
}

if (process.env.METRIQ_E2E_TEST === "1") {
  // Closing the capture window is normally triggered from inside its own
  // renderer via IPC — but calling that through Playwright's
  // page.evaluate() always reports a "context closed" error, since the
  // call's own side effect (closing the window) destroys the JS context
  // evaluate needs to resolve its result. Closing it from here (the main
  // process's own persistent context) avoids that self-inflicted race.
  global.__metriqTest.closeCaptureWindow = () => captureWindow?.close();
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "renderer", "assets", "tray-icon.png");
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("Metriq");
  updateTrayMenu();
  tray.on("click", () => createWindow());
}

function updateTrayMenu() {
  if (!tray) return;
  const session = loadSession();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Metriq", click: () => createWindow() },
      { type: "separator" },
      {
        label: session ? `Signed in as ${session.email}` : "Not signed in",
        enabled: false,
      },
      session
        ? {
            label: "Log out",
            click: () => {
              clearSession();
              updateTrayMenu();
              mainWindow?.webContents.send("auth:logged-out");
            },
          }
        : null,
      { type: "separator" },
      { label: "Quit Metriq", role: "quit" },
    ].filter(Boolean))
  );
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Auth callback handling -----------------------------------------------

function handleAuthCallbackUrl(url) {
  const callback = parseAuthCallbackUrl(url);
  if (!callback) return;

  saveSession({
    token: callback.token,
    refreshToken: callback.refreshToken,
    email: callback.email,
    name: callback.name,
    savedAt: new Date().toISOString(),
  });
  updateTrayMenu();

  const win = createWindow();
  const send = () => win.webContents.send("auth:success", loadSession());
  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", send);
  } else {
    send();
  }
  win.show();
  win.focus();
}

function maybeHandleArgv(argv) {
  const url = findProtocolUrlInArgv(argv);
  if (url) handleAuthCallbackUrl(url);
}

// --- App lifecycle ----------------------------------------------------

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  // Another instance already holds the lock — it will receive our argv via
  // the "second-instance" event below. Nothing more to do here.
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    maybeHandleArgv(argv);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // macOS delivers metriq:// links via this event instead of argv, both on
  // cold start (queued until whenReady) and while already running.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) {
      handleAuthCallbackUrl(url);
    } else {
      app.whenReady().then(() => handleAuthCallbackUrl(url));
    }
  });

  app.whenReady().then(() => {
    registerProtocolHandler();
    buildAppMenu();
    createTray();
    createWindow();

    const registered = globalShortcut.register(CAPTURE_HOTKEY, toggleCaptureWindow);
    if (!registered) {
      // Another app already owns this combo — not fatal, the in-app button
      // still opens the capture window.
      console.warn(`Could not register global hotkey ${CAPTURE_HOTKEY} (already in use?)`);
    }

    // Windows/Linux cold start via protocol link: the URL is a plain argv
    // entry on this very first launch.
    maybeHandleArgv(process.argv);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    // Keep running in the tray on all platforms — this is a background
    // companion app, not a document window.
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  ipcMain.handle("app:get-capture-hotkey", () => CAPTURE_HOTKEY);

  ipcMain.handle("auth:get-session", () => loadSession());

  ipcMain.handle("auth:open-login", () => {
    shell.openExternal(`${WEB_BASE_URL}/login?desktop=1`);
  });

  ipcMain.handle("auth:open-signup", () => {
    shell.openExternal(`${WEB_BASE_URL}/signup?desktop=1`);
  });

  ipcMain.handle("auth:logout", () => {
    clearSession();
    updateTrayMenu();
    return true;
  });

  // Display name is the only account field editable from the desktop app:
  // InsForge has no endpoint for changing account email, and password
  // change needs the email-OTP reset flow (requires SMTP configured
  // server-side, not yet set up for this project). See insforge-client.js.
  ipcMain.handle("account:update-name", async (_event, name) => {
    await withAuthRetry((token) => insforge.updateProfile(token, { name }));
    const updated = { ...loadSession(), name };
    saveSession(updated);
    updateTrayMenu();
    return updated;
  });

  // --- Project linking --------------------------------------------------

  // The stored access token is short-lived; InsForge calls 401 with
  // "Invalid token" once it expires. Refresh via the stored refresh token
  // and retry exactly once, mirroring @insforge/sdk's own bearer-refresh
  // path (the web app gets this for free from its cookie-based SDK
  // middleware — the desktop app has to do it by hand since it holds a
  // bearer token instead).
  // On any failure that means "this session can no longer be trusted"
  // (expired access token with no way to refresh it, or a refresh attempt
  // that itself gets rejected), clear it and tell the renderer to drop back
  // to the logged-out screen — instead of leaving the user staring at a
  // signed-in-looking shell with a raw error banner and no way forward
  // except quitting the app.
  function forceLogout() {
    clearSession();
    updateTrayMenu();
    mainWindow?.webContents.send("auth:logged-out");
    const err = new Error("Your session expired — please sign in again.");
    err.code = "NOT_AUTHENTICATED";
    return err;
  }

  async function withAuthRetry(fn) {
    const session = loadSession();
    if (!session?.token) {
      const err = new Error("Not logged in.");
      err.code = "NOT_AUTHENTICATED";
      throw err;
    }
    try {
      return await fn(session.token);
    } catch (err) {
      if (err.status !== 401) throw err;
      // Sessions saved before refresh-token support existed have no
      // refreshToken to fall back on — that's not a bug to surface as a raw
      // 401, it just means this session can only be fixed by logging in
      // again (which will store one going forward).
      if (!session.refreshToken) throw forceLogout();
      let refreshed;
      try {
        refreshed = await insforge.refreshSession(session.refreshToken);
      } catch {
        throw forceLogout();
      }
      const updated = {
        ...session,
        token: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || session.refreshToken,
      };
      saveSession(updated);
      return fn(updated.token);
    }
  }

  function scanFolder(folderPath) {
    const files = listSourceFiles(folderPath);
    return { files, scannedAt: new Date().toISOString() };
  }

  ipcMain.handle("projects:pick-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("projects:link", async (_event, folderPath) => {
    const { files, scannedAt } = scanFolder(folderPath);
    const name = path.basename(folderPath);

    const project = await withAuthRetry((token) =>
      insforge.createLinkedProject(token, {
        name,
        path: folderPath,
        kind: "local",
        fileCount: files.length,
      })
    );

    saveFileIndex(project.id, { files, scannedAt });
    savePrefs({ activeProject: { id: project.id, name: project.name, path: project.path } });
    return project;
  });

  ipcMain.handle("projects:list", async () => {
    return withAuthRetry((token) => insforge.listLinkedProjects(token));
  });

  ipcMain.handle("projects:rescan", async (_event, project) => {
    const { files, scannedAt } = scanFolder(project.path);
    saveFileIndex(project.id, { files, scannedAt });
    return withAuthRetry((token) =>
      insforge.updateLinkedProject(token, project.id, {
        file_count: files.length,
        last_scanned_at: scannedAt,
      })
    );
  });

  ipcMain.handle("projects:remove", async (_event, projectId) => {
    await withAuthRetry((token) => insforge.deleteLinkedProject(token, projectId));
    removeFileIndex(projectId);
    const prefs = loadPrefs();
    if (prefs.activeProject?.id === projectId) {
      savePrefs({ activeProject: null });
    }
    return true;
  });

  ipcMain.handle("projects:set-active", (_event, project) => {
    savePrefs({ activeProject: { id: project.id, name: project.name, path: project.path } });
    return true;
  });

  ipcMain.handle("projects:get-active-id", () => loadPrefs().activeProject?.id ?? null);

  ipcMain.handle("projects:get-active-project", () => loadPrefs().activeProject ?? null);

  ipcMain.handle("projects:get-file-index", (_event, projectId) => loadFileIndex(projectId));

  // --- Tool preferences ---------------------------------------------------

  ipcMain.handle("prefs:get-tools", () => loadPrefs().tools ?? []);

  ipcMain.handle("prefs:set-tools", (_event, tools) => {
    savePrefs({ tools });
    return true;
  });

  // --- Theme preference ---------------------------------------------------

  ipcMain.handle("prefs:get-theme", () => loadPrefs().theme ?? "dark");

  ipcMain.handle("prefs:set-theme", (_event, theme) => {
    savePrefs({ theme });
    return true;
  });

  // --- Accessibility preferences -------------------------------------------
  // { highContrast, reduceMotion, dyslexiaFont, colorblind } — each a plain
  // boolean, or absent if the user has never touched that toggle (renderer.js
  // treats "absent" as "no explicit preference" rather than "off", so it can
  // fall back to the OS prefers-reduced-motion signal only for that one).

  ipcMain.handle("prefs:get-accessibility", () => loadPrefs().accessibility ?? {});

  ipcMain.handle("prefs:set-accessibility", (_event, patch) => {
    const merged = { ...(loadPrefs().accessibility ?? {}), ...patch };
    savePrefs({ accessibility: merged });
    return merged;
  });

  // Synchronous, read at preload time (see preload.js) so the renderer can
  // apply the saved theme/accessibility classes to <html> in a blocking
  // <head> script before the page paints — avoids a flash of the default
  // (wrong) theme/contrast/motion on every launch. ipcMain.handle/invoke is
  // inherently async and can't be used for this; sendSync blocks the
  // renderer until this returns, which is fine for a tiny local JSON read.
  ipcMain.on("prefs:get-initial-sync", (event) => {
    const prefs = loadPrefs();
    event.returnValue = {
      theme: prefs.theme ?? "dark",
      accessibility: prefs.accessibility ?? {},
    };
  });

  // --- Prompt capture window ----------------------------------------------

  ipcMain.handle("capture:open", () => {
    if (!captureWindow) createCaptureWindow();
  });

  ipcMain.handle("capture:close", () => {
    captureWindow?.close();
  });

  ipcMain.handle("capture:get-context", () => ({
    activeProject: loadPrefs().activeProject ?? null,
    tools: loadPrefs().tools ?? [],
  }));

  ipcMain.handle("capture:analyze", (_event, prompt) => {
    const activeProject = loadPrefs().activeProject;
    const relevantFiles = activeProject ? findRelevantFiles(prompt, activeProject.path) : [];
    const result = optimize(prompt, { relevantFiles });
    return {
      breadthScore: result.analysis.breadthScore,
      rating: result.analysis.rating,
      issues: result.analysis.issues,
      promptTokens: result.analysis.promptTokens,
      projectedTokens: result.analysis.projectedTokens,
      relevantFiles,
      focusedPrompt: result.focused.text,
      savedTokens: result.savedTokens,
      savedPct: result.savedPct,
    };
  });

  ipcMain.handle("capture:copy", (_event, text, stats) => {
    clipboard.writeText(text);
    if (stats) {
      const activeProject = loadPrefs().activeProject;
      recordCapture({ ...stats, projectName: activeProject?.name ?? null });
    }
    return true;
  });

  // --- Usage stats (Overview / Sustainability pages) ---------------------

  ipcMain.handle("stats:get-summary", () => getSummary());

  // --- Real token usage (Usage page) --------------------------------------
  // Mirrors web/app/api/usage/route.js and src/commands/trace.js's
  // buildPayload exactly, so the numbers agree across web, CLI, and desktop.

  const USAGE_VALID_DAYS = new Set([7, 30, 90]);

  function buildUsagePayload(days) {
    const sources = [];
    if (getClaudeDirs().length) sources.push("claude-code");
    if (getCodexSessionsDir()) sources.push("codex");
    if (!sources.length) return { available: false, sources: [] };

    const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);
    const records = [];
    let rateLimits = null;
    if (sources.includes("claude-code")) records.push(...loadClaudeRecords({ since }));
    if (sources.includes("codex")) {
      const codex = loadCodexUsage({ since });
      records.push(...codex.records);
      rateLimits = codex.rateLimits;
    }
    if (!records.length) return { available: false, sources };

    const agg = aggregate(records, { days });
    return {
      available: true,
      sources,
      days,
      generatedAt: new Date().toISOString(),
      rateLimits,
      insights: generateInsights(agg, rateLimits),
      ...agg,
    };
  }

  ipcMain.handle("usage:get", (_event, days) => {
    const d = USAGE_VALID_DAYS.has(days) ? days : 30;
    return buildUsagePayload(d);
  });
}
