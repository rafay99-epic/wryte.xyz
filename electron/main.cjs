"use strict";

// Entry point: app lifecycle + wiring. Feature logic lives in the sibling
// modules (config / state / window / menu / updater / about).
const { app, BrowserWindow, session } = require("electron");
const state = require("./src/window/state.cjs");
const win = require("./src/window/window.cjs");
const menu = require("./src/menu/menu.cjs");
const updater = require("./src/updater/updater.cjs");

const isMac = process.platform === "darwin";

// Single instance: a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", win.focusMainWindow);

  // Security: never allow embedded <webview> tags.
  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });

  app.whenReady().then(async () => {
    // Deny device-level permissions by default; allow only what the editor uses.
    const ALLOWED = new Set([
      "clipboard-read",
      "clipboard-sanitized-write",
      "notifications",
      "fullscreen",
    ]);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
      cb(ALLOWED.has(permission)),
    );

    state.load();
    menu.build();
    win.createWindow(await win.resolveAppUrl());
    if (app.isPackaged) updater.init();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        win.createWindow(await win.resolveAppUrl());
      } else {
        win.focusMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (!isMac) app.quit();
  });
}
