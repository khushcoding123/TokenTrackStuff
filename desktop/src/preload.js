// Runs in an isolated context with access to Node/Electron APIs, but the
// renderer (untrusted-ish web content, even though it's our own HTML) only
// ever sees the narrow surface exposed below via contextBridge — no direct
// ipcRenderer, no Node globals, per Electron's security guidance
// (contextIsolation: true, nodeIntegration: false, sandbox: true in main.js).

const { contextBridge, ipcRenderer } = require("electron");

// Read once, synchronously, before the page's own scripts run (preload
// always finishes before that) — index.html's blocking <head> script uses
// this to set the theme/accessibility classes on <html> before first
// paint, so the app never flashes the default theme/contrast/motion on
// launch. Deliberately a plain object, not a live binding: it's a one-time
// snapshot for pre-paint use, not a subscription (renderer.js re-reads
// current values via the async metriq.getAccessibility()/getTheme() below
// for anything that needs to react to later changes).
contextBridge.exposeInMainWorld("metriqInitial", ipcRenderer.sendSync("prefs:get-initial-sync"));

contextBridge.exposeInMainWorld("metriq", {
  getCaptureHotkey: () => ipcRenderer.invoke("app:get-capture-hotkey"),
  openRepoDocs: () => ipcRenderer.invoke("app:open-repo-docs"),

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
  linkGithubProject: (repoUrl) => ipcRenderer.invoke("projects:link-github", repoUrl),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  rescanProject: (project) => ipcRenderer.invoke("projects:rescan", project),
  removeProject: (project) => ipcRenderer.invoke("projects:remove", project),
  setActiveProject: (project) => ipcRenderer.invoke("projects:set-active", project),
  getActiveProjectId: () => ipcRenderer.invoke("projects:get-active-id"),
  getActiveProject: () => ipcRenderer.invoke("projects:get-active-project"),
  getFileIndex: (projectId) => ipcRenderer.invoke("projects:get-file-index", projectId),

  getTools: () => ipcRenderer.invoke("prefs:get-tools"),
  setTools: (tools) => ipcRenderer.invoke("prefs:set-tools", tools),

  getTheme: () => ipcRenderer.invoke("prefs:get-theme"),
  setTheme: (theme) => ipcRenderer.invoke("prefs:set-theme", theme),

  getAccessibility: () => ipcRenderer.invoke("prefs:get-accessibility"),
  setAccessibility: (patch) => ipcRenderer.invoke("prefs:set-accessibility", patch),

  openCapture: () => ipcRenderer.invoke("capture:open"),
  closeCapture: () => ipcRenderer.invoke("capture:close"),
  getCaptureContext: () => ipcRenderer.invoke("capture:get-context"),
  analyzePrompt: (prompt) => ipcRenderer.invoke("capture:analyze", prompt),
  copyToClipboard: (text, stats) => ipcRenderer.invoke("capture:copy", text, stats),

  // GitHub-aware recommendation + auto-capture apply-back.
  recommendPrompt: (prompt) => ipcRenderer.invoke("capture:recommend", prompt),
  getSeededPrompt: () => ipcRenderer.invoke("capture:get-seeded"),
  applyPrompt: (text, stats) => ipcRenderer.invoke("capture:apply", text, stats),
  // Fired when a new clipboard prompt arrives while the popup is already open.
  onSeedPrompt: (callback) => {
    const listener = (_event, prompt) => callback(prompt);
    ipcRenderer.on("capture:seed", listener);
    return () => ipcRenderer.removeListener("capture:seed", listener);
  },

  // Auto-capture toggle + OS permissions.
  getAutoCapture: () => ipcRenderer.invoke("settings:get-autocapture"),
  setAutoCapture: (enabled) => ipcRenderer.invoke("settings:set-autocapture", enabled),
  getPermissionStatus: () => ipcRenderer.invoke("permissions:status"),
  openPermissionSettings: (which) => ipcRenderer.invoke("permissions:open-settings", which),
  getCaptureRepoUrl: () => ipcRenderer.invoke("settings:get-repo-url"),
  setCaptureRepoUrl: (url) => ipcRenderer.invoke("settings:set-repo-url", url),

  // AI-tailored rewrite (Claude API key), used by the capture popup instead
  // of the offline template when enabled.
  getAiRewrite: () => ipcRenderer.invoke("settings:get-ai-rewrite"),
  setAiRewrite: (patch) => ipcRenderer.invoke("settings:set-ai-rewrite", patch),
  testAiKey: () => ipcRenderer.invoke("settings:test-ai-key"),

  // Terminal-agent capture (Phase 5b, metriq-wrap sessions).
  getTerminalWrap: () => ipcRenderer.invoke("settings:get-wrap"),
  setTerminalWrap: (enabled) => ipcRenderer.invoke("settings:set-wrap", enabled),

  // GUI editor capture (Phase 5a, Cursor/VS Code, macOS only).
  getEditorCapture: () => ipcRenderer.invoke("settings:get-editor-capture"),
  setEditorCapture: (enabled) => ipcRenderer.invoke("settings:set-editor-capture", enabled),

  getStatsSummary: () => ipcRenderer.invoke("stats:get-summary"),

  getUsage: (days, source) => ipcRenderer.invoke("usage:get", days, source),
});
