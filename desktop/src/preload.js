// Runs in an isolated context with access to Node/Electron APIs, but the
// renderer (untrusted-ish web content, even though it's our own HTML) only
// ever sees the narrow surface exposed below via contextBridge — no direct
// ipcRenderer, no Node globals, per Electron's security guidance
// (contextIsolation: true, nodeIntegration: false, sandbox: true in main.js).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("metriq", {
  getSession: () => ipcRenderer.invoke("auth:get-session"),
  openLogin: () => ipcRenderer.invoke("auth:open-login"),
  openSignup: () => ipcRenderer.invoke("auth:open-signup"),
  logout: () => ipcRenderer.invoke("auth:logout"),
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
});
