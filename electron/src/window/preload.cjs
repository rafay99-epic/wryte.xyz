"use strict";

// Tiny, sandboxed bridge so the wrapped site can tell it's running inside the
// desktop shell (and on which platform) — used to render an Electron-aware,
// draggable title bar with room for the macOS traffic-lights.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("wryteDesktop", {
  isDesktop: true,
  platform: process.platform, // "darwin" | "win32" | "linux"
  isMac: process.platform === "darwin",
});
