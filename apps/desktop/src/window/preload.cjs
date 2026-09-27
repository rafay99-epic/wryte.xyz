"use strict";

// Tiny, sandboxed bridge so the wrapped site can tell it's running inside the
// desktop shell (and on which platform) — used to render an Electron-aware,
// draggable title bar with room for the macOS traffic-lights.
const { contextBridge, ipcRenderer } = require("electron");

const desktopAPI = {
  isDesktop: true,
  platform: process.platform, // "darwin" | "win32" | "linux"
  isMac: process.platform === "darwin",
  /** Subscribe to connectivity changes. Returns unsubscribe fn. */
  onOnlineStatusChange: (/** @type {(online: boolean) => void} */ cb) => {
    const handler = (_event, online) => cb(online);
    ipcRenderer.on("connectivity-change", handler);
    // Ask main to replay the last known state (if any) to this subscriber.
    ipcRenderer.send("connectivity-subscribe");
    return () => ipcRenderer.removeListener("connectivity-change", handler);
  },
  /** Tell the main process to re-check connectivity and navigate if online. */
  retryConnectivity: () => {
    ipcRenderer.send("offline-retry");
  },
  /**
   * Forward a log entry to the main-process file logger.
   * The web app can call this for desktop-specific diagnostics.
   * @param {"info" | "warn" | "error"} level
   * @param {string} message
   */
  log: (level, message) => {
    ipcRenderer.send("log", { level, message });
  },
};

contextBridge.exposeInMainWorld("wryteDesktop", desktopAPI);
