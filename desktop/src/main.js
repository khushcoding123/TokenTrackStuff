const { app, BrowserWindow, Tray, Menu, shell, ipcMain, nativeImage } = require("electron");
const path = require("node:path");
const { saveSession, loadSession, clearSession } = require("./auth-store");
const { PROTOCOL, findProtocolUrlInArgv, parseAuthCallbackUrl } = require("./protocol");

const WEB_BASE_URL = process.env.METRIQ_WEB_URL || "https://tokenpilot-mocha.vercel.app";

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
  };
}

let mainWindow = null;
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
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 480,
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
}
