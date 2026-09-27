"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wryteUpdater", {
  onStatus: (cb) => ipcRenderer.on("update-status", (_e, data) => cb(data)),
  install: () => ipcRenderer.send("update-install"),
  close: () => ipcRenderer.send("update-close"),
});
