"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const desktopAPI = {
  isDesktop: true,
  platform: process.platform,
  isMac: process.platform === "darwin",
  onOnlineStatusChange: (cb) => {
    const handler = (_event, online) => cb(online);
    ipcRenderer.on("connectivity-change", handler);
    ipcRenderer.send("connectivity-subscribe");
    return () => ipcRenderer.removeListener("connectivity-change", handler);
  },
  retryConnectivity: () => {
    ipcRenderer.send("offline-retry");
  },
  log: (level, message) => {
    ipcRenderer.send("log", { level, message });
  },
};

contextBridge.exposeInMainWorld("wryteDesktop", desktopAPI);
