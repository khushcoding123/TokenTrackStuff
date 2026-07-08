// Runs in an isolated context with access to Node/Electron APIs, but the
// renderer (untrusted-ish web content, even though it's our own HTML) only
// ever sees the narrow surface exposed below via contextBridge — no direct
// ipcRenderer, no Node globals, per Electron's security guidance
// (contextIsolation: true, nodeIntegration: false, sandbox: true in main.js).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("metriq", {
  getCaptureHotkey: () => ipcRenderer.invoke("app:get-capture-hotkey"),

  getSession: () => ipcRenderer.invoke("auth:get-session"),
  openLogin: () => ipcRenderer.invoke("auth:open-login"),
  openSignup: () => ipcRenderer.invoke("auth:open-signup"),
  logout: () => ipcRenderer.invoke("auth:logout"),
  updateDisplayName: (name) => ipcRenderer.invoke("account:update-name", name),
  onAuthSuccess: (callback) => {
    const listener = (_event, session) => callback(session);
    ipcRenderer.on("auth:success", listener);
    return () => ipcRenderer.removeListener("auth:success", listener);
  },
  onLoggedOut: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("auth:logged-out", listener);
    return () => ipcRenderer.removeListener("auth:logged-out", listener);
  },

  pickFolder: () => ipcRenderer.invoke("projects:pick-folder"),
  linkProject: (folderPath) => ipcRenderer.invoke("projects:link", folderPath),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  rescanProject: (project) => ipcRenderer.invoke("projects:rescan", project),
  removeProject: (projectId) => ipcRenderer.invoke("projects:remove", projectId),
  setActiveProject: (project) => ipcRenderer.invoke("projects:set-active", project),
  getActiveProjectId: () => ipcRenderer.invoke("projects:get-active-id"),
  getActiveProject: () => ipcRenderer.invoke("projects:get-active-project"),
  getFileIndex: (projectId) => ipcRenderer.invoke("projects:get-file-index", projectId),

  getTools: () => ipcRenderer.invoke("prefs:get-tools"),
  setTools: (tools) => ipcRenderer.invoke("prefs:set-tools", tools),

  getTheme: () => ipcRenderer.invoke("prefs:get-theme"),
  setTheme: (theme) => ipcRenderer.invoke("prefs:set-theme", theme),

  openCapture: () => ipcRenderer.invoke("capture:open"),
  closeCapture: () => ipcRenderer.invoke("capture:close"),
  getCaptureContext: () => ipcRenderer.invoke("capture:get-context"),
  analyzePrompt: (prompt) => ipcRenderer.invoke("capture:analyze", prompt),
  copyToClipboard: (text, stats) => ipcRenderer.invoke("capture:copy", text, stats),

  getStatsSummary: () => ipcRenderer.invoke("stats:get-summary"),
});
