const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage, dialog, globalShortcut, clipboard, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { saveSession, loadSession, clearSession } = require("./auth-store");
const { PROTOCOL, findProtocolUrlInArgv, parseAuthCallbackUrl } = require("./protocol");
const { saveFileIndex, loadFileIndex, removeFileIndex, saveIndexMeta, loadIndexMeta, removeIndexMeta } = require("./project-cache");
const { loadPrefs, savePrefs } = require("./prefs");
const { recordCapture, getSummary } = require("./usage-stats");
const insforge = require("./insforge-client");
const { listSourceFiles, findRelevantFiles } = require("../../packages/core/scanner.js");
const { optimize } = require("../../packages/core/rewrite.js");
const { analyzePrompt } = require("../../packages/core/analyzer.js");
const typesense = require("./typesense-service");
const codeIndexer = require("./code-indexer");
const contextSearch = require("./context-search");
const promptMemory = require("./prompt-memory");
const usageIndexer = require("./usage-indexer");
const globalSearch = require("./global-search");
const { recommend } = require("../../packages/optimize/index.js");
const permissions = require("./permissions");
const { PromptWatcher, looksLikePrompt } = require("./prompt-watcher");
const { WrapServer } = require("./wrap-server");
const macAx = require("./mac-ax");
const aiKeyStore = require("./ai-key-store");
const aiRewrite = require("./ai-rewrite");
// Same usage engine behind the web /usage dashboard and `metriq trace` — reads
// this machine's real Claude Code + Codex logs (not the local capture-copy
// stats in usage-stats.js above, which only track this app's own CTA clicks).
const { getClaudeDirs, loadClaudeRecords } = require("../../src/core/usage/claude.js");
const { getCodexSessionsDir, loadCodexUsage } = require("../../src/core/usage/codex.js");
const { getCursorProjectsDir, loadCursorRecords } = require("../../src/core/usage/cursor.js");
const { aggregate } = require("../../src/core/usage/aggregate.js");
const { generateInsights } = require("../../src/core/usage/insights.js");
const { analyzeCurrentSession, analyzeSessionBehavior } = require("../../src/core/usage/behavior.js");
const { estimateUsageImpact } = require("../../src/core/usage/impact.js");

const WEB_BASE_URL = process.env.METRIQ_WEB_URL || "https://tokenpilot-mocha.vercel.app";
const CAPTURE_HOTKEY = process.env.METRIQ_CAPTURE_HOTKEY || "CommandOrControl+Shift+M";

// Test-only hook: Playwright's electronApplication.evaluate() runs in the
// main process's global scope, which doesn't have this module's local
// `require`/closures — so expose exactly what the E2E suite needs here,
// and only when explicitly opted into. Never set in a real user's launch.
if (process.env.METRIQ_E2E_TEST === "1") {
  const { credentialsPath } = require("./auth-store");
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
// Where the current seededPrompt came from — "wrap" is the only source
// eligible for insert-back (see capture:apply below); clipboard/manual
// sources stay clipboard-only, same as before Phase 5b.
let seedSource = "clipboard";
// The last improved prompt we put on the clipboard — so copying our own output
// doesn't re-trigger the popup in a loop.
let lastAppliedText = "";

// Auto-capture "source": watch the clipboard for prompt-like text COPIED FROM A
// CODING APP. We can't read another app's input box directly (see
// prompt-watcher.js / the UIA probe), so the trigger is you copying your prompt
// (Ctrl+C). Only your clipboard is read, and only locally — nothing is sent
// anywhere. The foreground-app check keeps it from popping when you copy text
// for non-coding reasons (a browser, a chat, notes, etc.).
let lastCheckedClipboard = "";

async function clipboardPromptSource() {
  const text = clipboard.readText();
  if (!text || text === lastAppliedText) return "";
  if (text === lastCheckedClipboard) return ""; // already evaluated this exact copy
  lastCheckedClipboard = text;
  if (!looksLikePrompt(text)) return "";
  const app = await getForegroundApp();
  return passesCodingGate(app) ? text : "";
}

// --- Foreground coding-app detection (Windows) --------------------------------
// Process names (lowercased) that count as "coding": editors, IDEs, and the
// terminals where CLI agents (Claude Code, Codex) run. Extend as needed.
const CODING_APPS = [
  "cursor", "code", "code - insiders", "vscodium", "windsurf", "zed", "fleet",
  "devenv", "sublime_text", "atom", "brackets", "notepad++",
  "idea64", "pycharm64", "webstorm64", "goland64", "clion64", "phpstorm64",
  "rubymine64", "rider64", "datagrip64", "android studio",
  "windowsterminal", "wt", "powershell", "pwsh", "cmd", "conhost",
  "alacritty", "wezterm", "hyper", "warp", "tabby", "mintty", "nvim", "vim",
];

function isCodingApp(name) {
  const n = String(name || "").toLowerCase();
  return CODING_APPS.some((a) => n.includes(a));
}

// Falsy app (couldn't determine) => fail OPEN so the feature still works; a real
// process name => it must be in the coding allowlist to trigger.
function passesCodingGate(app) {
  if (!app) return true;
  return isCodingApp(app);
}

// Inline PowerShell (no external file, so it also works in a packaged app) that
// returns the foreground window's process name. Add-Type compiles per call
// (~1s), but we only call it once per newly-copied clipboard value.
const FG_CMD =
  '$s=\'[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();' +
  '[DllImport("user32.dll")]public static extern int GetWindowThreadProcessId(IntPtr h,out int p);\';' +
  "$t=Add-Type -MemberDefinition $s -Name U -Namespace Fg -PassThru;" +
  "$h=$t::GetForegroundWindow();$p=0;$t::GetWindowThreadProcessId($h,[ref]$p)|Out-Null;" +
  "(Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName";

function getForegroundApp() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(null); // detection is Windows-only for now
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", FG_CMD],
      { timeout: 3000, windowsHide: true },
      (err, stdout) => resolve(err ? undefined : String(stdout).trim().toLowerCase())
    );
  });
}

// Lazily create the background watcher and route detected prompts into the
// side popup. Enabling auto-capture starts it (see settings:set-autocapture).
function getWatcher() {
  if (!promptWatcher) {
    promptWatcher = new PromptWatcher({ source: clipboardPromptSource, intervalMs: 1200 });
    promptWatcher.on("prompt", (prompt) => {
      seededPrompt = prompt;
      seedSource = "clipboard";
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

// --- Terminal-agent capture (Phase 5b): metriq-wrap sessions ---------------
// Draft prompts from a wrapped `claude`/`codex` session (see
// src/pty-wrapper.js) arrive via the local socket wrap-server.js owns and
// are routed into the exact same popup as the clipboard path — the only
// difference is that a "wrap"-sourced suggestion can be sent back to the
// terminal on approval (see capture:apply), instead of clipboard-only.
let wrapServer = null;

function getWrapServer() {
  if (!wrapServer) {
    wrapServer = new WrapServer();
    wrapServer.on("draft", ({ text }) => {
      seededPrompt = text;
      seedSource = "wrap";
      if (!captureWindow) {
        createCaptureWindow({ focus: false });
      } else {
        captureWindow.webContents.send("capture:seed", text);
      }
    });
  }
  return wrapServer;
}

// --- GUI editor capture (Phase 5a): Cursor / VS Code, macOS only -----------
// Polls the OS accessibility tree (via src/mac-ax.js) for the value of
// whatever text field is currently focused in Cursor or VS Code — this is
// how the popup can appear as you type a draft, with no manual copy step.
// Write-back on approval is real here (unlike Phase 5b's terminal wrapper,
// Metriq does NOT own the input stream for a GUI app — see mac-ax.js's
// writeBack() for the verify-before-write safety check this relies on, and
// docs/phase5-screen-awareness-proposal.md for why this is accepted as a
// real, if reduced, risk rather than eliminated).
let editorWatcher = null;
// Which process the current "editor"-sourced seed came from, and the exact
// text it was read as — both required to route a write-back to the right
// app and to let mac-ax.js's verify-before-write check do its job.
let editorAppProcess = null;
let editorDraftText = "";
let lastEditorValue = "";

async function macEditorPromptSource() {
  if (!macAx.isSupported()) return "";
  const frontmost = macAx.getFrontmostProcessName();
  if (!frontmost) return "";
  const isEditor = Object.values(macAx.EDITOR_PROCESSES).includes(frontmost);
  if (!isEditor) return "";

  const focused = macAx.readFocused(frontmost);
  if (!focused || !macAx.isTextRole(focused.role)) return "";
  if (focused.value === lastEditorValue) return ""; // unchanged since last poll
  lastEditorValue = focused.value;
  if (!looksLikePrompt(focused.value)) return "";

  editorAppProcess = frontmost;
  return focused.value;
}

function getEditorWatcher() {
  if (!editorWatcher) {
    editorWatcher = new PromptWatcher({ source: macEditorPromptSource, intervalMs: 1500 });
    editorWatcher.on("prompt", (prompt) => {
      seededPrompt = prompt;
      seedSource = "editor";
      editorDraftText = prompt;
      if (!captureWindow) {
        createCaptureWindow({ focus: false });
      } else {
        captureWindow.webContents.send("capture:seed", prompt);
      }
    });
  }
  return editorWatcher;
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
    title: "Metriq Suggestion",
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
  // Same idea for Phase 5b: simulate a metriq-wrap draft without a real PTY.
  global.__metriqTest.feedWrapDraft = (text) => getWrapServer().emit("draft", { text });
  // Same idea for Phase 5a: simulate a GUI-editor draft without real AX/osascript.
  global.__metriqTest.feedEditorDraft = (text, processName) => {
    editorAppProcess = processName || "Cursor";
    getEditorWatcher().emit("prompt", text);
  };
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

    // Resume the terminal-wrap socket if the user left it on. No OS
    // permission gate here — metriq-wrap is an explicitly-launched local
    // process, not a cross-app accessibility read.
    if (loadPrefs().terminalWrap) {
      getWrapServer().start();
    }

    // Resume GUI editor capture (Phase 5a, macOS only) if left on — same
    // Accessibility permission gate as auto-capture, since it's the same
    // OS API.
    if (loadPrefs().editorCapture && macAx.isSupported()) {
      const status = permissions.getPermissionStatus();
      if (status.accessibility === "granted") {
        getEditorWatcher().start();
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
    wrapServer?.stop();
    editorWatcher?.stop();
  });

  ipcMain.handle("app:get-capture-hotkey", () => CAPTURE_HOTKEY);

  // Hardcoded destination only (not a renderer-supplied URL) — same
  // shell.openExternal pattern as auth:open-login below, kept to a single
  // fixed target so the renderer can never direct this to an arbitrary URL.
  ipcMain.handle("app:open-repo-docs", () => {
    shell.openExternal("https://github.com/khushcoding123/TokenTrackStuff");
  });

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
    const err = new Error("Your session expired. Please sign in again.");
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

  // --- Typesense Project Intelligence helpers -----------------------------
  // Session has email/name but no InsForge user uuid in the auth-callback
  // payload today — email is a stable per-account isolation key for the
  // local/cloud index. Falls back to "local" when signed out (shouldn't
  // happen for linked projects, which require auth).
  function typesenseUserId() {
    const session = loadSession();
    return session?.email || session?.userId || "local";
  }

  // Sanitize config for the renderer — NEVER include the API key.
  function typesensePublicConfig(config = typesense.getConfig()) {
    const prefsTs = loadPrefs().typesense || {};
    return {
      mode: config.mode,
      enabled: config.enabled,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      indexesCode: config.indexesCode,
      hybridSearch: Boolean(config.hybridSearch),
      cloudCodeConsent: prefsTs.cloudCodeConsent === true,
      hasApiKey: Boolean(prefsTs.apiKeyEnc || prefsTs.apiKey || process.env.TYPESENSE_API_KEY),
    };
  }

  async function typesenseStatus(projectId = null) {
    const config = typesense.getConfig();
    const health = await typesense.health(config);
    const id = projectId || loadPrefs().activeProject?.id || null;
    const meta = id ? loadIndexMeta(id) : null;
    return {
      ...typesensePublicConfig(config),
      healthy: health.ok,
      disabled: Boolean(health.disabled),
      error: health.error || null,
      index: meta
        ? {
            projectId: id,
            fileCount: meta.fileCount ?? 0,
            chunkCount: meta.chunkCount ?? 0,
            indexedAt: meta.indexedAt || null,
            status: meta.status || "unknown",
            error: meta.error || null,
          }
        : null,
    };
  }

  function persistTypesensePrefs(patch) {
    const prev = loadPrefs().typesense || {};
    const next = { ...prev };
    if (patch.mode !== undefined) next.mode = patch.mode;
    if (patch.protocol !== undefined) next.protocol = patch.protocol;
    if (patch.host !== undefined) next.host = patch.host;
    if (patch.port !== undefined) next.port = String(patch.port);
    if (patch.cloudCodeConsent !== undefined) next.cloudCodeConsent = Boolean(patch.cloudCodeConsent);
    if (patch.hybridSearch !== undefined) next.hybridSearch = Boolean(patch.hybridSearch);
    if (patch.apiKey !== undefined && patch.apiKey !== "" && patch.apiKey !== null) {
      try {
        const { safeStorage } = require("electron");
        if (safeStorage.isEncryptionAvailable()) {
          next.apiKeyEnc = safeStorage.encryptString(String(patch.apiKey)).toString("base64");
          delete next.apiKey;
        } else {
          next.apiKey = String(patch.apiKey);
          delete next.apiKeyEnc;
        }
      } catch {
        next.apiKey = String(patch.apiKey);
      }
    }
    savePrefs({ typesense: next });
    return typesensePublicConfig();
  }

  // Index a project's source into Typesense. Progress events go to the
  // renderer; failures never throw into the link/rescan path.
  async function indexProjectFully(project, files, { force = false } = {}) {
    if (!project?.id || !project?.path) {
      return { ok: false, error: "No project" };
    }
    const config = typesense.getConfig();
    if (!config.enabled) {
      return { ok: false, disabled: true, error: "Typesense is off" };
    }
    const fileList = files || loadFileIndex(project.id)?.files || listSourceFiles(project.path);
    const previous = force ? {} : loadIndexMeta(project.id)?.hashes || {};
    const sendProgress = (payload) => {
      mainWindow?.webContents.send("typesense:index-progress", {
        projectId: project.id,
        ...payload,
      });
    };
    sendProgress({ status: "indexing", processed: 0, total: fileList.length });
    try {
      const result = await codeIndexer.indexProject({
        config,
        userId: typesenseUserId(),
        projectId: project.id,
        root: project.path,
        files: fileList,
        previousHashes: previous,
        onProgress: ({ processed, total, chunks }) => {
          sendProgress({ status: "indexing", processed, total, chunks });
        },
      });
      if (result.ok) {
        saveIndexMeta(project.id, {
          hashes: result.hashes,
          fileCount: result.fileCount,
          chunkCount: result.chunkCount,
          indexedAt: result.indexedAt,
          status: "ready",
        });
        sendProgress({
          status: "ready",
          done: true,
          fileCount: result.fileCount,
          chunkCount: result.chunkCount,
          indexedAt: result.indexedAt,
        });
      } else {
        saveIndexMeta(project.id, {
          ...(loadIndexMeta(project.id) || {}),
          status: result.disabled ? "disabled" : "error",
          error: result.error || "Index failed",
        });
        sendProgress({ status: "error", done: true, error: result.error });
      }
      return result;
    } catch (err) {
      saveIndexMeta(project.id, {
        ...(loadIndexMeta(project.id) || {}),
        status: "error",
        error: err.message,
      });
      sendProgress({ status: "error", done: true, error: err.message });
      return { ok: false, error: err.message };
    }
  }

  function indexProjectInBackground(project, files, opts) {
    indexProjectFully(project, files, opts).catch(() => {});
  }

  // Accepts a full GitHub URL (https://github.com/owner/repo, with or
  // without .git/trailing slash), an SSH remote (git@github.com:owner/repo),
  // or the bare "owner/repo" shorthand. Returns null (not a thrown error)
  // for anything that doesn't parse, so the caller can give one consistent
  // "that doesn't look like a GitHub repo" message.
  function parseGithubRepo(input) {
    const trimmed = String(input || "").trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/^git@github\.com:/, "github.com/").replace(/^https?:\/\//, "").replace(/^www\./, "");
    const withDomain = normalized.match(/^github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
    const shorthand = !withDomain && trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
    const match = withDomain || shorthand;
    if (!match) return null;
    const [, owner, repo] = match;
    return { owner, repo, cloneUrl: `https://github.com/${owner}/${repo}.git` };
  }

  function repoCloneDir(owner, repo) {
    return path.join(app.getPath("userData"), "repo-clones", `${owner}__${repo}`);
  }

  // Fresh shallow clone every time (link *and* rescan) rather than an
  // incremental `git pull` — avoids ever having to reconcile a diverged or
  // force-pushed local working tree, at the cost of always re-fetching. For
  // the shallow depth used here that's a small, predictable cost.
  function cloneGithubRepo(owner, repo) {
    const dir = repoCloneDir(owner, repo);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    return new Promise((resolve, reject) => {
      execFile(
        "git",
        ["clone", "--depth", "1", `https://github.com/${owner}/${repo}.git`, dir],
        { timeout: 60_000 },
        (err) => {
          if (!err) return resolve(dir);
          fs.rmSync(dir, { recursive: true, force: true });
          if (err.code === "ENOENT") {
            reject(new Error("Git isn't installed on this machine. It's needed to clone repositories."));
          } else {
            reject(new Error("Couldn't clone that repository. Check the URL and that it's public."));
          }
        }
      );
    });
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
    // Typesense indexing is opt-in via TYPESENSE_MODE (default local). When
    // the server is down this no-ops gracefully — scanner fallback still works.
    indexProjectInBackground(project, files);
    return project;
  });

  // Mirrors projects:link, but the "folder" is a fresh shallow clone of a
  // GitHub repo instead of a user-picked directory — everything downstream
  // (scanning, findRelevantFiles, rescan) treats it identically from here
  // on, since it's still just a real local directory on disk.
  ipcMain.handle("projects:link-github", async (_event, repoUrl) => {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
      throw new Error("That doesn't look like a GitHub repository URL. Try https://github.com/owner/repo.");
    }
    const { owner, repo } = parsed;
    const cloneDir = await cloneGithubRepo(owner, repo);
    const { files, scannedAt } = scanFolder(cloneDir);
    const name = `${owner}/${repo}`;

    let project;
    try {
      project = await withAuthRetry((token) =>
        insforge.createLinkedProject(token, {
          name,
          path: cloneDir,
          kind: "github",
          fileCount: files.length,
        })
      );
    } catch (err) {
      // Without a DB row nothing will ever reference this clone again —
      // clean it up rather than leaving a dangling directory behind.
      fs.rmSync(cloneDir, { recursive: true, force: true });
      throw err;
    }

    saveFileIndex(project.id, { files, scannedAt });
    savePrefs({ activeProject: { id: project.id, name: project.name, path: project.path } });
    indexProjectInBackground(project, files);
    return project;
  });

  ipcMain.handle("projects:list", async () => {
    return withAuthRetry((token) => insforge.listLinkedProjects(token));
  });

  ipcMain.handle("projects:rescan", async (_event, project) => {
    if (project.kind === "github") {
      const parsed = parseGithubRepo(project.name); // name is always "owner/repo" for github projects
      if (!parsed) throw new Error("Can't determine the source repo to rescan.");
      await cloneGithubRepo(parsed.owner, parsed.repo);
    }
    const { files, scannedAt } = scanFolder(project.path);
    saveFileIndex(project.id, { files, scannedAt });
    indexProjectInBackground(project, files);
    return withAuthRetry((token) =>
      insforge.updateLinkedProject(token, project.id, {
        file_count: files.length,
        last_scanned_at: scannedAt,
      })
    );
  });

  ipcMain.handle("projects:remove", async (_event, project) => {
    const projectId = project.id;
    await withAuthRetry((token) => insforge.deleteLinkedProject(token, projectId));
    removeFileIndex(projectId);
    removeIndexMeta(projectId);
    codeIndexer.removeProjectIndex(typesense.getConfig(), projectId).catch(() => {});
    // Only a github-kind project has a Metriq-managed clone on disk worth
    // cleaning up — a local-kind project's path is the user's own folder.
    if (project.kind === "github" && project.path) {
      fs.rmSync(project.path, { recursive: true, force: true });
    }
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

  // --- Terminal-agent capture (Phase 5b) -----------------------------------
  // No OS permission to gate — metriq-wrap is a process the user explicitly
  // launches (`metriq-wrap claude`), not a cross-app accessibility read.

  ipcMain.handle("settings:get-wrap", () => ({
    enabled: loadPrefs().terminalWrap ?? false,
    running: !!wrapServer?.server,
    socketPath: require("./wrap-protocol").socketPath(),
  }));

  ipcMain.handle("settings:set-wrap", (_event, enabled) => {
    savePrefs({ terminalWrap: !!enabled });
    if (enabled) getWrapServer().start();
    else wrapServer?.stop();
    return { ok: true, enabled: !!enabled };
  });

  // --- GUI editor capture (Phase 5a): Cursor / VS Code, macOS only ---------

  ipcMain.handle("settings:get-editor-capture", () => ({
    available: macAx.isSupported(),
    enabled: loadPrefs().editorCapture ?? false,
    running: editorWatcher?.isRunning() ?? false,
    permission: permissions.getPermissionStatus(),
  }));

  ipcMain.handle("settings:set-editor-capture", (_event, enabled) => {
    if (!macAx.isSupported()) return { ok: false, enabled: false, reason: "unsupported-platform" };
    if (enabled) {
      const permission = permissions.ensureCapturePermission();
      if (!permission.ok) return { ok: false, enabled: false, permission };
      savePrefs({ editorCapture: true });
      getEditorWatcher().start();
      return { ok: true, enabled: true, permission };
    }
    savePrefs({ editorCapture: false });
    editorWatcher?.stop();
    return { ok: true, enabled: false };
  });

  ipcMain.handle("settings:get-repo-url", () => loadPrefs().captureRepoUrl ?? "");

  ipcMain.handle("settings:set-repo-url", (_event, url) => {
    savePrefs({ captureRepoUrl: url ? String(url).trim() : null });
    return true;
  });

  // --- AI-tailored rewrite (Claude API key) --------------------------------
  // Off by default. The key itself is stored encrypted via ai-key-store.js
  // (safeStorage/OS keychain) and is never sent back to the renderer once
  // saved — settings:get-ai-rewrite only ever returns a masked preview.

  ipcMain.handle("settings:get-ai-rewrite", () => {
    const p = loadPrefs().aiRewrite ?? {};
    const key = aiKeyStore.loadApiKey();
    return {
      enabled: p.enabled ?? false,
      model: p.model ?? aiRewrite.DEFAULT_MODEL,
      models: aiRewrite.MODELS,
      hasKey: !!key,
      maskedKey: aiKeyStore.maskApiKey(key),
    };
  });

  ipcMain.handle("settings:set-ai-rewrite", (_event, patch = {}) => {
    if (typeof patch.apiKey === "string") {
      if (patch.apiKey.trim()) aiKeyStore.saveApiKey(patch.apiKey.trim());
      else aiKeyStore.clearApiKey();
    }
    const current = loadPrefs().aiRewrite ?? {};
    const merged = {
      enabled: patch.enabled ?? current.enabled ?? false,
      model: patch.model ?? current.model ?? aiRewrite.DEFAULT_MODEL,
    };
    savePrefs({ aiRewrite: merged });
    const key = aiKeyStore.loadApiKey();
    return { ...merged, hasKey: !!key, maskedKey: aiKeyStore.maskApiKey(key) };
  });

  ipcMain.handle("settings:test-ai-key", async () => {
    const apiKey = aiKeyStore.loadApiKey();
    if (!apiKey) return { ok: false, error: "No Claude API key set." };
    const { model } = loadPrefs().aiRewrite ?? {};
    const result = await aiRewrite.rewriteWithClaude("Say the single word: ok", {
      apiKey,
      model: model || aiRewrite.DEFAULT_MODEL,
    });
    return result.ok ? { ok: true } : result;
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

  // Shared Typesense → scanner → optimize path used by Prompt Studio and the
  // capture window. Typesense failures never break analysis.
  async function analyzeWithProjectContext(prompt) {
    const activeProject = loadPrefs().activeProject;
    const userId = typesenseUserId();
    let relevantFiles = [];
    let projectContext = null;
    let contextMatches = [];
    let contextSource = "none";
    let hybrid = false;
    let expandedTerms = [];

    if (activeProject) {
      const tsHit = await contextSearch.findRelevantFiles({
        userId,
        projectId: activeProject.id,
        prompt,
      });
      if (tsHit?.projectContext?.files?.length) {
        projectContext = tsHit.projectContext;
        relevantFiles = projectContext.files;
        contextMatches = tsHit.matches || [];
        contextSource = "typesense";
        hybrid = Boolean(tsHit.hybrid);
        expandedTerms = tsHit.expandedTerms || [];
      } else {
        relevantFiles = findRelevantFiles(prompt, activeProject.path);
        contextSource = relevantFiles.length ? "scanner" : "none";
      }
    }

    const result = optimize(prompt, { relevantFiles, projectContext });

    let promptRunId = null;
    const tools = loadPrefs().tools || [];
    const indexed = await promptMemory.indexPromptRun({
      userId,
      projectId: activeProject?.id || null,
      originalPrompt: prompt,
      optimizedPrompt: result.focused.text,
      tool: tools[0] || null,
      breadthScore: result.analysis.breadthScore,
      projectedTokens: result.analysis.projectedTokens,
      estimatedTokensSaved: result.savedTokens,
      relevantFiles,
      used: false,
    });
    if (indexed.ok) promptRunId = indexed.id;

    return {
      breadthScore: result.analysis.breadthScore,
      rating: result.analysis.rating,
      issues: result.analysis.issues,
      promptTokens: result.analysis.promptTokens,
      projectedTokens: result.analysis.projectedTokens,
      relevantFiles,
      contextMatches,
      contextSource,
      hybrid,
      expandedTerms,
      promptRunId,
      focusedPrompt: result.focused.text,
      savedTokens: result.savedTokens,
      savedPct: result.savedPct,
      activeProject: activeProject
        ? { id: activeProject.id, name: activeProject.name, path: activeProject.path }
        : null,
    };
  }

  ipcMain.handle("capture:analyze", async (_event, prompt) => {
    return analyzeWithProjectContext(prompt);
  });

  ipcMain.handle("capture:copy", (_event, text, stats) => {
    clipboard.writeText(text);
    lastAppliedText = text; // don't let our own output re-trigger the popup
    if (stats) {
      const activeProject = loadPrefs().activeProject;
      recordCapture({ ...stats, projectName: activeProject?.name ?? null });
      if (stats.promptRunId) {
        promptMemory.markUsed(stats.promptRunId).catch(() => {});
      }
    }
    return true;
  });

  // Capture window recommendation. Prefer the active project's Typesense →
  // scanner → optimize path (same as Prompt Studio). Fall back to the
  // GitHub-aware @metriq/optimize pipeline when no project is linked.
  // Optional AI-tailored rewrite then overlays improvedPrompt on either path.
  ipcMain.handle("capture:recommend", async (_event, prompt) => {
    const activeProject = loadPrefs().activeProject;
    let rec;
    if (activeProject?.path) {
      const local = await analyzeWithProjectContext(prompt);
      rec = {
        improvedPrompt: local.focusedPrompt,
        analysis: {
          rating: local.rating,
          breadthScore: local.breadthScore,
          issues: local.issues,
          promptTokens: local.promptTokens,
          projectedTokens: local.projectedTokens,
        },
        tokenSaving: {
          savedTokens: local.savedTokens,
          savedPct: local.savedPct,
        },
        relevantFiles: (local.relevantFiles || []).map((path, i) => ({
          path,
          reasons: local.contextMatches?.[i]?.reasons || [],
        })),
        contextSource: local.contextSource,
        contextMatches: local.contextMatches,
        promptRunId: local.promptRunId,
        hybrid: local.hybrid,
        activeProject: local.activeProject,
        source: "project",
        repo: null,
      };
    } else {
      const repoUrl = loadPrefs().captureRepoUrl || null;
      try {
        rec = await recommend(prompt, { repoUrl });
      } catch (e) {
        const fallback = await recommend(prompt, {});
        rec = { ...fallback, repoError: e.message };
      }
    }

    // Optional AI-tailored rewrite (see ai-rewrite.js): only ever overrides
    // improvedPrompt on success. `analysis` (breadthScore/rating/issues) still
    // describes the ORIGINAL prompt either way, so it stays valid regardless
    // of which rewrite is shown. But `tokenSaving` describes the delta between
    // the original and whatever is actually displayed as "Improved prompt" —
    // that has to be recomputed against the real AI output, not left pointing
    // at the (now-replaced, no-longer-shown) heuristic rewrite's numbers.
    const ai = loadPrefs().aiRewrite ?? {};
    if (ai.enabled) {
      const apiKey = aiKeyStore.loadApiKey();
      if (apiKey) {
        const result = await aiRewrite.rewriteWithClaude(prompt, {
          apiKey,
          model: ai.model || aiRewrite.DEFAULT_MODEL,
        });
        if (result.ok) {
          rec.improvedPrompt = result.text;
          rec.aiTailored = true;
          const before = analyzePrompt(prompt);
          const after = analyzePrompt(result.text);
          const savedTokens = Math.max(0, before.projectedTokens - after.projectedTokens);
          rec.tokenSaving = {
            savedTokens,
            savedPct: before.projectedTokens > 0 ? Math.round((savedTokens / before.projectedTokens) * 100) : 0,
          };
        } else {
          rec.aiError = result.error;
        }
      } else {
        rec.aiError = "No Claude API key set.";
      }
    }
    return rec;
  });

  // The prompt the background watcher seeded the window with (one-shot).
  ipcMain.handle("capture:get-seeded", () => {
    const p = seededPrompt;
    seededPrompt = null;
    return p;
  });

  // Approve -> apply the improved prompt.
  // APPLY-BACK: a "wrap"-sourced suggestion (Phase 5b, a metriq-wrap
  // terminal session — see wrap-server.js) inserts cleanly because Metriq
  // owns the actual input stream. A "editor"-sourced suggestion (Phase 5a,
  // Cursor/VS Code via the OS accessibility tree — see mac-ax.js) does NOT
  // have that guarantee: write-back there is a simulated select-all+paste
  // into whatever's currently focused, gated by mac-ax.js's
  // verify-before-write check (aborts if the field's value changed since
  // the draft was analyzed) but still a real, accepted risk — see
  // docs/phase5-screen-awareness-proposal.md. Both cases also always get
  // the clipboard fallback.
  ipcMain.handle("capture:apply", (_event, text, stats) => {
    clipboard.writeText(text);
    lastAppliedText = text; // don't let our own output re-trigger the popup
    let applied = "clipboard";
    if (seedSource === "wrap" && wrapServer?.sendInsertToActive(text)) {
      applied = "clipboard+terminal";
    } else if (seedSource === "editor" && editorAppProcess) {
      const result = macAx.writeBack(editorAppProcess, editorDraftText, text);
      if (result.ok) {
        applied = "clipboard+editor";
        lastEditorValue = text; // don't re-trigger the watcher on our own write
      }
    }
    if (stats) {
      const activeProject = loadPrefs().activeProject;
      recordCapture({ ...stats, projectName: activeProject?.name ?? null });
      if (stats.promptRunId) {
        promptMemory.markUsed(stats.promptRunId).catch(() => {});
      }
    }
    return { ok: true, applied };
  });

  // --- Usage stats (Overview / Sustainability pages) ---------------------

  ipcMain.handle("stats:get-summary", () => getSummary());

  // --- Real token usage (Usage page) --------------------------------------
  // Mirrors web/app/api/usage/route.js and src/commands/trace.js's
  // buildPayload exactly, so the numbers agree across web, CLI, and desktop.

  const USAGE_VALID_DAYS = new Set([7, 30, 90]);

  function detectUsageSources() {
    const sources = [];
    if (getClaudeDirs().length) sources.push("claude-code");
    if (getCodexSessionsDir()) sources.push("codex");
    if (getCursorProjectsDir()) sources.push("cursor");
    return sources;
  }

  function filterSelectedUsage(records, selectedSource) {
    if (selectedSource === "all") return records;
    return records.filter((record) => record.source === selectedSource);
  }

  function dayKey(timestamp) {
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function buildDailyBehavior(records, rateLimits = null) {
    const byDay = new Map();
    for (const record of records) {
      const key = dayKey(record.timestamp);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(record);
    }
    return Object.fromEntries(
      [...byDay.entries()].map(([key, dayRecords]) => {
        const bySession = new Map();
        for (const record of dayRecords) {
          const sessionKey = `${record.source}:${record.sessionId || "unknown"}`;
          if (!bySession.has(sessionKey)) bySession.set(sessionKey, []);
          bySession.get(sessionKey).push(record);
        }
        const behaviors = [...bySession.values()]
          .map((sessionRecords) => analyzeSessionBehavior(sessionRecords, { rateLimits }))
          .filter(Boolean);
        const sessionTokens = behaviors.reduce((sum, behavior) => sum + behavior.sessionTokens, 0);
        const wastedTokens = behaviors.reduce((sum, behavior) => sum + behavior.wastedTokens, 0);
        const usefulTokens = Math.max(0, sessionTokens - wastedTokens);
        const usefulByIntent = new Map();
        const wasteByCause = new Map();

        behaviors.forEach((behavior) => {
          behavior.usefulBreakdown.forEach((intent) => {
            const current = usefulByIntent.get(intent.key) || {
              key: intent.key,
              label: intent.label,
              tokens: 0,
              turns: 0,
            };
            current.tokens += intent.tokens;
            current.turns += intent.turns;
            usefulByIntent.set(intent.key, current);
          });
          behavior.waste.forEach((waste) => {
            const current = wasteByCause.get(waste.key) || {
              key: waste.key,
              label: waste.label,
              hint: waste.hint,
              tokens: 0,
              turns: 0,
            };
            current.tokens += waste.tokens;
            current.turns += waste.turns;
            wasteByCause.set(waste.key, current);
          });
        });

        const usefulBreakdown = [...usefulByIntent.values()]
          .map((intent) => ({
            ...intent,
            pctOfUseful: usefulTokens > 0
              ? Math.round((intent.tokens / usefulTokens) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.tokens - a.tokens);
        const wasteBreakdown = [...wasteByCause.values()]
          .map((waste) => ({
            ...waste,
            pctOfWaste: wastedTokens > 0
              ? Math.round((waste.tokens / wastedTokens) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.tokens - a.tokens);
        return [
          key,
          behaviors.length
            ? {
                wastedTokens,
                usefulTokens,
                wastedPct: sessionTokens > 0
                  ? Math.round((wastedTokens / sessionTokens) * 1000) / 10
                  : 0,
                usefulPct: sessionTokens > 0
                  ? Math.round((usefulTokens / sessionTokens) * 1000) / 10
                  : 0,
                usefulBreakdown,
                wasteBreakdown,
              }
            : {
                wastedTokens: 0,
                usefulTokens: 0,
                wastedPct: 0,
                usefulPct: 0,
                usefulBreakdown: [],
                wasteBreakdown: [],
              },
        ];
      })
    );
  }

  function buildUsagePayload(days, selectedSource = "claude-code") {
    const detectedSources = detectUsageSources();
    if (!detectedSources.length) {
      return { available: false, sources: [], detectedSources: [], selectedSource };
    }

    const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);
    const records = [];
    let rateLimits = null;
    if (detectedSources.includes("claude-code")) records.push(...loadClaudeRecords({ since }));
    if (detectedSources.includes("codex")) {
      const codex = loadCodexUsage({ since });
      records.push(...codex.records);
      rateLimits = codex.rateLimits;
    }
    if (detectedSources.includes("cursor")) {
      records.push(...loadCursorRecords({ since }));
    }

    const scopedRecords = filterSelectedUsage(records, selectedSource);
    const telemetrySources = [...new Set(scopedRecords.map((record) => record.source))];

    if (!scopedRecords.length) {
      return {
        available: false,
        sources: [],
        detectedSources,
        selectedSource,
        hasAnyTelemetry: records.length > 0,
      };
    }

    const agg = aggregate(scopedRecords, { days });
    const dailyBehavior = buildDailyBehavior(scopedRecords, rateLimits);
    const daily = agg.daily.map((day) => ({
      ...day,
      behavior: dailyBehavior[day.date] || {
        wastedTokens: 0,
        usefulTokens: day.totalTokens || 0,
        wastedPct: 0,
        usefulPct: day.totalTokens ? 100 : 0,
        usefulBreakdown: [],
        wasteBreakdown: [],
      },
    }));
    const requestCount = (agg.models || []).reduce((sum, model) => sum + (model.requests || 0), 0);
    const wastedTokens = daily.reduce(
      (sum, day) => sum + (day.behavior?.wastedTokens || 0),
      0
    );

    // Phase 5: best-effort index of sessions for Typesense discovery. Never
    // blocks or alters the deterministic aggregate payload.
    usageIndexer
      .indexUsageSessions({
        userId: typesenseUserId(),
        sessions: agg.sessions || [],
        records: scopedRecords,
      })
      .catch(() => {});

    return {
      available: true,
      sources: telemetrySources,
      detectedSources,
      days,
      selectedSource,
      generatedAt: new Date().toISOString(),
      rateLimits: selectedSource === "all" || selectedSource === "codex" ? rateLimits : null,
      insights: generateInsights(agg, rateLimits),
      currentSession: analyzeCurrentSession(scopedRecords, { rateLimits }),
      impact: estimateUsageImpact({
        requests: requestCount,
        totalTokens: agg.totals.totalTokens,
        wastedTokens,
      }),
      ...agg,
      daily,
    };
  }

  ipcMain.handle("usage:get", (_event, days, selectedSource) => {
    const d = USAGE_VALID_DAYS.has(days) ? days : 30;
    return buildUsagePayload(d, selectedSource || "claude-code");
  });

  // --- Typesense Project Intelligence (IPC) -------------------------------
  // All network I/O stays in main. The renderer only ever sees sanitized
  // status / search results — never the API key or raw source documents.

  ipcMain.handle("typesense:get-status", async (_event, projectId) => {
    return typesenseStatus(projectId || null);
  });

  ipcMain.handle("typesense:set-config", async (_event, patch) => {
    persistTypesensePrefs(patch || {});
    // Cloud mode with code indexing requires explicit consent. Setting mode
    // to cloud without consent leaves indexesCode=false (metadata-only).
    return typesenseStatus();
  });

  ipcMain.handle("typesense:reindex", async (_event, projectId) => {
    const prefs = loadPrefs();
    let project = prefs.activeProject;
    if (projectId && project?.id !== projectId) {
      // Caller may pass a project id that isn't active — look it up from the
      // linked list when possible; otherwise require the active project.
      try {
        const list = await withAuthRetry((token) => insforge.listLinkedProjects(token));
        project = list.find((p) => p.id === projectId) || project;
      } catch {
        /* keep active */
      }
    }
    if (!project) return { ok: false, error: "No project to index" };
    return indexProjectFully(project, null, { force: true });
  });

  ipcMain.handle("typesense:find-similar", async (_event, prompt) => {
    const activeProject = loadPrefs().activeProject;
    return promptMemory.findSimilar({
      userId: typesenseUserId(),
      projectId: activeProject?.id || null,
      prompt,
      limit: 5,
    });
  });

  // Phase 5 — natural-language / filtered usage discovery
  ipcMain.handle("typesense:search-usage", async (_event, opts) => {
    const o = opts || {};
    return usageIndexer.searchUsageSessions({
      userId: typesenseUserId(),
      q: o.q || "*",
      filters: o.filters || {},
      ranges: o.ranges || {},
      limit: o.limit || 25,
    });
  });

  // Phase 6 — Cmd/Ctrl+K federated search
  ipcMain.handle("typesense:global-search", async (_event, q) => {
    const activeProject = loadPrefs().activeProject;
    return globalSearch.globalSearch({
      userId: typesenseUserId(),
      projectId: activeProject?.id || null,
      q,
      limitPerGroup: 6,
    });
  });

}
