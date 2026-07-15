"use strict";

const { app, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const config = require("./config.cjs");

/**
 * Auto-update from GitHub Releases: download in the background, then prompt
 * plainly instead of swapping silently. Checks on launch and every 6h.
 */
function init() {
  autoUpdater.on("update-downloaded", async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update ready",
      message: `Wryte ${version} is ready to install.`,
      detail: "Restart the app to apply it. It'll also install on next quit.",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", () => undefined); // never nag on a failed check
  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(
    () => autoUpdater.checkForUpdates().catch(() => undefined),
    config.UPDATE_CHECK_INTERVAL_MS,
  );
}

/** Manual "Check for Updates…" menu action. */
function checkManually() {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: "info",
      message: "Updates are only available in installed builds.",
      detail: "You're running a development build.",
    });
    return;
  }
  autoUpdater.checkForUpdates().catch(() => undefined);
  dialog.showMessageBox({
    type: "info",
    message: "Checking for updates…",
    detail: "You'll be prompted to restart if a new version is ready.",
  });
}

module.exports = { init, checkManually };
