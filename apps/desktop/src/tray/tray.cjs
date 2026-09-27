"use strict";

const { Tray, Menu, nativeImage, app } = require("electron");
const path = require("node:path");
const config = require("../config.cjs");
const win = require("../window/window.cjs");

const isMac = process.platform === "darwin";

/** @type {Tray | undefined} */
let tray;

function createTray() {
  if (tray) return tray;

  const iconPath = path.join(__dirname, "..", "..", "assets", "wryte-icon.png");
  const src = nativeImage.createFromPath(iconPath);
  // A missing/unreadable icon yields an empty image and an invisible tray —
  // throw instead so main.cjs disables hide-to-tray and close works normally.
  if (src.isEmpty()) {
    throw new Error(`Tray icon not found at ${iconPath}`);
  }

  // macOS: small Template icon (auto-inverts for dark/light menu bar).
  // Windows/Linux: larger, full-color in the notification area.
  const trayIcon = isMac
    ? src.resize({ width: 16, height: 16 })
    : src.resize({ width: 22, height: 22 });
  if (isMac) {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);
  tray.setToolTip(config.APP_NAME);
  rebuildMenu();

  // Single-click shows/focuses the window on all platforms.
  tray.on("click", win.focusMainWindow);

  return tray;
}

function rebuildMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Show ${config.APP_NAME}`,
        click: win.focusMainWindow,
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]),
  );
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = undefined;
}

module.exports = { createTray, rebuildMenu, destroyTray };
