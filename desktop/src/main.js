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
const { recommend } = require("../../packages/optimize/index.js");
const permissions = require("./permissions");
const { PromptWatcher, looksLikePrompt } = require("./prompt-watcher");

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
let promptWatcher = null;
// When auto-capture detects a draft prompt, we stash it here and open the
// capture window; the window's renderer pulls it via "capture:get-seeded".
let seededPrompt = null;
// The last improved prompt we put on the clipboard — so copying our own output
// doesn't re-trigger the popup in a loop.
let lastAppliedText = "";

// Auto-capture "source": watch the clipboard for prompt-like text. We can't read
// another app's input box directly (see prompt-watcher.js / the UIA probe), so
// the trigger is you copying your prompt (Ctrl+C). Only your clipboard is read,
// and only locally — nothing is sent anywhere.
function clipboardPromptSource() {
  const text = clipboard.readText();
  if (!text || text === lastAppliedText) return "";
  return looksLikePrompt(text) ? text : "";
}

// Lazily create the background watcher and route detected prompts into the
// side popup. Enabling auto-capture starts it (see settings:set-autocapture).
function getWatcher() {
  if (!promptWatcher) {
    promptWatcher = new PromptWatcher({ source: clipboardPromptSource, intervalMs: 1200 });
    promptWatcher.on("prompt", (prompt) => {
      seededPrompt = prompt;
      if (!captureWindow) {
        createCaptureWindow({ focus: false }); // passive side popup, doesn't steal focus
      } else {
        // Popup already open — push the new prompt into it and re-run.
        captureWindow.webContents.send("capture:seed", prompt);
      }
    });
  }
  return promptWatcher;
}

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

// The prompt-suggestion popup — a small, always-on-top window docked to the
// bottom-right so it reads as a side popup, not a full app window.
//   - Manual (hotkey / button): opens focused so you can type into it, and
//     dismisses when you click away (Spotlight-style).
//   - Auto (clipboard trigger): opens *inactive* so it doesn't steal focus
//     while you work, and stays until you copy or press Esc.
function createCaptureWindow(opts = {}) {
  const focusOnShow = opts.focus !== false;
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const width = 380;
  const height = 480;
  const margin = 24;

  captureWindow = new BrowserWindow({
    width,
    height,
    x: Math.round(display.workArea.x + display.workArea.width - width - margin),
    y: Math.round(display.workArea.y + display.workArea.height - height - margin),
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    frame: true,
    skipTaskbar: true,
    title: "Metriq — Suggestion",
    backgroundColor: "#0B0F14",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureWindow.loadFile(path.join(__dirname, "..", "renderer", "capture.html"));
  captureWindow.once("ready-to-show", () => {
    if (focusOnShow) captureWindow.show();
    else captureWindow.showInactive(); // side popup: appear without stealing focus
  });
  captureWindow.on("closed", () => {
    captureWindow = null;
  });
  // The popup is persistent — it stays until you close it (× or Esc), so you can
  // paste the result and keep working through several prompts. It does NOT
  // auto-dismiss when you click back into your editor.

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
  // Feed a prompt as if the background watcher's source produced it, so the
  // end-to-end auto-capture -> popup flow can be exercised without a real
  // cross-app reader.
  global.__metriqTest.feedPrompt = (prompt) => getWatcher().feed(prompt);
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

    // Resume background prompt-watching if the user left it on — but only if
    // the OS permission is still in place (they may have revoked it).
    if (loadPrefs().autoCapture) {
      const status = permissions.getPermissionStatus();
      if (status.accessibility === "granted" || status.accessibility === "not-required") {
        const w = getWatcher();
        w.prime(clipboard.readText()); // don't pop for whatever's already copied
        w.start();
      }
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
    const session = loadSession();
    if (!session?.token) {
      const err = new Error("Not logged in.");
      err.code = "NOT_AUTHENTICATED";
      throw err;
    }
    await insforge.updateProfile(session.token, { name });
    const updated = { ...session, name };
    saveSession(updated);
    updateTrayMenu();
    return updated;
  });

  // --- Project linking --------------------------------------------------

  function requireToken() {
    const session = loadSession();
    if (!session?.token) {
      const err = new Error("Not logged in.");
      err.code = "NOT_AUTHENTICATED";
      throw err;
    }
    return session.token;
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
    const token = requireToken();
    const { files, scannedAt } = scanFolder(folderPath);
    const name = path.basename(folderPath);

    const project = await insforge.createLinkedProject(token, {
      name,
      path: folderPath,
      kind: "local",
      fileCount: files.length,
    });

    saveFileIndex(project.id, { files, scannedAt });
    savePrefs({ activeProject: { id: project.id, name: project.name, path: project.path } });
    return project;
  });

  ipcMain.handle("projects:list", async () => {
    const token = requireToken();
    return insforge.listLinkedProjects(token);
  });

  ipcMain.handle("projects:rescan", async (_event, project) => {
    const token = requireToken();
    const { files, scannedAt } = scanFolder(project.path);
    saveFileIndex(project.id, { files, scannedAt });
    return insforge.updateLinkedProject(token, project.id, {
      file_count: files.length,
      last_scanned_at: scannedAt,
    });
  });

  ipcMain.handle("projects:remove", async (_event, projectId) => {
    const token = requireToken();
    await insforge.deleteLinkedProject(token, projectId);
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

  // --- Auto-capture (background prompt watching) + permissions -------------

  ipcMain.handle("permissions:status", () => permissions.getPermissionStatus());

  ipcMain.handle("permissions:open-settings", (_event, which) => {
    if (which === "screen") permissions.openScreenRecordingSettings();
    else permissions.openAccessibilitySettings();
    return true;
  });

  ipcMain.handle("settings:get-autocapture", () => ({
    enabled: loadPrefs().autoCapture ?? false,
    running: getWatcher().isRunning(),
    permission: permissions.getPermissionStatus(),
  }));

  // Turning it on requests the OS permission first; if denied, we don't enable
  // (and report back so the UI can guide the user to Settings). Off-by-default.
  ipcMain.handle("settings:set-autocapture", (_event, enabled) => {
    if (enabled) {
      const permission = permissions.ensureCapturePermission();
      if (!permission.ok) return { ok: false, enabled: false, permission };
      savePrefs({ autoCapture: true });
      const w = getWatcher();
      w.prime(clipboard.readText()); // don't pop for whatever's already copied
      w.start();
      return { ok: true, enabled: true, permission };
    }
    savePrefs({ autoCapture: false });
    getWatcher().stop();
    return { ok: true, enabled: false };
  });

  ipcMain.handle("settings:get-repo-url", () => loadPrefs().captureRepoUrl ?? "");

  ipcMain.handle("settings:set-repo-url", (_event, url) => {
    savePrefs({ captureRepoUrl: url ? String(url).trim() : null });
    return true;
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
    lastAppliedText = text; // don't let our own output re-trigger the popup
    if (stats) {
      const activeProject = loadPrefs().activeProject;
      recordCapture({ ...stats, projectName: activeProject?.name ?? null });
    }
    return true;
  });

  // GitHub-aware recommendation for the capture window: uses the connected repo
  // URL to name the exact files to inspect. Shares @metriq/optimize with the
  // web /optimize page, so the CLI-less desktop flow and the web give identical
  // improved prompts. Falls back to a prompt-only rewrite if the repo read fails.
  ipcMain.handle("capture:recommend", async (_event, prompt) => {
    const repoUrl = loadPrefs().captureRepoUrl || null;
    try {
      return await recommend(prompt, { repoUrl });
    } catch (e) {
      const fallback = await recommend(prompt, {});
      return { ...fallback, repoError: e.message };
    }
  });

  // The prompt the background watcher seeded the window with (one-shot).
  ipcMain.handle("capture:get-seeded", () => {
    const p = seededPrompt;
    seededPrompt = null;
    return p;
  });

  // Approve -> apply the improved prompt.
  // APPLY-BACK SEAM: writing text into the *other* app's chatbox needs OS-native
  // keystroke / accessibility injection (Phase 5, gated). Today we place it on
  // the clipboard for a one-keystroke paste and record the saving.
  ipcMain.handle("capture:apply", (_event, text, stats) => {
    clipboard.writeText(text);
    lastAppliedText = text; // don't let our own output re-trigger the popup
    if (stats) {
      const activeProject = loadPrefs().activeProject;
      recordCapture({ ...stats, projectName: activeProject?.name ?? null });
    }
    return { ok: true, applied: "clipboard" };
  });

  // --- Usage stats (Overview / Sustainability pages) ---------------------

  ipcMain.handle("stats:get-summary", () => getSummary());
}
