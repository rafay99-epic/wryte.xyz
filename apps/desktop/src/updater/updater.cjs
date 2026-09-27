"use strict";

const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const config = require("../config.cjs");

let updaterWindow;
let lastStatus = { state: "checking" };
let wired = false;

function logLine(level, ...args) {
  try {
    fs.appendFileSync(
      path.join(app.getPath("userData"), "updater.log"),
      `[${level}] ${args.map(String).join(" ")}\n`,
    );
  } catch {}
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
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

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
    openWindow();
    send({ state: "ready", version: info.version });
  });
  autoUpdater.on("error", (err) =>
    send({ state: "error", message: String(err?.message || err) }),
  );

  ipcMain.on("update-install", () => {
    send({ state: "installing" });
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 250);
  });
  ipcMain.on("update-close", () => updaterWindow?.close());
}

function init() {
  wire();
  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(
    () => autoUpdater.checkForUpdates().catch(() => undefined),
    config.UPDATE_CHECK_INTERVAL_MS,
  );
}

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
