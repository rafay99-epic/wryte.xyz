"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../config.cjs");

/**
 * Auto-update with a visible flow: check → download (live progress) → ready →
 * install & relaunch. Background checks stay silent until an update is ready;
 * the manual "Check for Updates…" menu action shows every step.
 */

/** @type {Electron.BrowserWindow | undefined} */
let updaterWindow;
/** Last status pushed — replayed once the window's renderer is ready. */
let lastStatus = { state: "checking" };
let wired = false;

// Log to userData so a silent failure (notably macOS Squirrel signature
// checks on ad-hoc-signed builds) is at least diagnosable after the fact.
function logLine(level, ...args) {
  try {
    fs.appendFileSync(
      path.join(app.getPath("userData"), "updater.log"),
      `[${level}] ${args.map(String).join(" ")}\n`,
    );
  } catch {
    // logging is best-effort
  }
}
autoUpdater.logger = {
  info: (...a) => logLine("info", ...a),
  warn: (...a) => logLine("warn", ...a),
  error: (...a) => logLine("error", ...a),
  debug: () => undefined,
};

function send(status) {
  lastStatus = status;
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send("update-status", status);
  }
}

function openWindow() {
  if (updaterWindow) {
    updaterWindow.focus();
    return;
  }
  updaterWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Software Update",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updaterWindow.setMenu(null);
  updaterWindow.loadFile(path.join(__dirname, "updater.html"));
  // Replay the latest status once the renderer's listener is attached.
  updaterWindow.webContents.on("did-finish-load", () => {
    updaterWindow?.webContents.send("update-status", lastStatus);
  });
  updaterWindow.on("closed", () => {
    updaterWindow = undefined;
  });
}

function wire() {
  if (wired) return;
  wired = true;
  autoUpdater.autoDownload = false; // we drive the download to show progress
  autoUpdater.autoInstallOnAppQuit = true; // fallback if the user just quits

  autoUpdater.on("checking-for-update", () => send({ state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    send({ state: "downloading", percent: 0, version: info.version });
    autoUpdater
      .downloadUpdate()
      .catch((e) => send({ state: "error", message: String(e?.message || e) }));
  });
  autoUpdater.on("update-not-available", () => send({ state: "none" }));
  autoUpdater.on("download-progress", (p) =>
    send({
      state: "downloading",
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bps: p.bytesPerSecond,
    }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    openWindow(); // surface it even when the check ran in the background
    send({ state: "ready", version: info.version });
  });
  autoUpdater.on("error", (err) =>
    send({ state: "error", message: String(err?.message || err) }),
  );

  ipcMain.on("update-install", () => {
    send({ state: "installing" });
    // isSilent=false, isForceRunAfter=true — apply then relaunch.
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 250);
  });
  ipcMain.on("update-close", () => updaterWindow?.close());
}

/** Background: check on launch + every 6h, silent until an update is ready. */
function init() {
  wire();
  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(
    () => autoUpdater.checkForUpdates().catch(() => undefined),
    config.UPDATE_CHECK_INTERVAL_MS,
  );
}

/** Menu action: open the window and walk the whole flow with progress. */
function checkManually() {
  wire();
  openWindow();
  if (!app.isPackaged) {
    send({ state: "dev" });
    return;
  }
  send({ state: "checking" });
  autoUpdater
    .checkForUpdates()
    .catch((e) => send({ state: "error", message: String(e?.message || e) }));
}

module.exports = { init, checkManually };
