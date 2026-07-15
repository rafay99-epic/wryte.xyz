"use strict";

// Tiny, sandboxed bridge so the wrapped site can tell it's running inside the
// desktop shell (and on which platform) — used to render an Electron-aware,
// draggable title bar with room for the macOS traffic-lights.
const { contextBridge, ipcRenderer } = require("electron");

const desktopAPI = {
  isDesktop: true,
  platform: process.platform, // "darwin" | "win32" | "linux"
  isMac: process.platform === "darwin",
  /** Current online state (null until first check completes). */
  online: null,
  /** Subscribe to connectivity changes. Returns unsubscribe fn. */
  onOnlineStatusChange: (/** @type {(online: boolean) => void} */ cb) => {
    const handler = (_event, online) => {
      desktopAPI.online = online;
      cb(online);
    };
    ipcRenderer.on("connectivity-change", handler);
    // Kick off the main-process check loop (noop if already running).
    ipcRenderer.send("connectivity-subscribe");
    return () => ipcRenderer.removeListener("connectivity-change", handler);
  },
  /**
   * Submit a background task to the task worker (utility process).
   * Returns a promise that resolves with the result.
   * @param {string} task
   * @param {Record<string, unknown>} params
   * @returns {Promise<unknown>}
   */
  submitTask: (task, params) => {
    return new Promise((resolve, reject) => {
      const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const handler = (_event, msg) => {
        if (msg.taskId !== taskId) return;
        ipcRenderer.removeListener("task-result", handler);
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.result);
      };
      ipcRenderer.on("task-result", handler);
      ipcRenderer.send("task-submit", { type: "task", taskId, task, params });
      // Safety timeout: reject after 30s so hanging tasks don't leak.
      setTimeout(() => {
        ipcRenderer.removeListener("task-result", handler);
        reject(new Error("Task timed out"));
      }, 30_000);
    });
  },
  /**
   * Query worker process status (PIDs). Useful for verifying
   * the multi-process architecture is active.
   * @returns {Promise<{ connectivity: number | null, task: number | null }>}
   */
  getWorkerStatus: () => {
    return ipcRenderer.invoke("worker-status");
  },
  /** Tell the main process to re-check connectivity and navigate if online. */
  retryConnectivity: () => {
    ipcRenderer.send("offline-retry");
  },
};

contextBridge.exposeInMainWorld("wryteDesktop", desktopAPI);
