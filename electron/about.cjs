"use strict";

const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { openExternal } = require("./window.cjs");

/** @type {Electron.BrowserWindow | undefined} */
let aboutWindow;

/** Branded About window (logo, company, author, repo, license). */
function openAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }
  aboutWindow = new BrowserWindow({
    width: 400,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "About Wryte",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  aboutWindow.setMenu(null);
  aboutWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  aboutWindow.loadFile(path.join(__dirname, "about.html"), {
    query: { v: app.getVersion(), y: String(new Date().getFullYear()) },
  });
  aboutWindow.on("closed", () => {
    aboutWindow = undefined;
  });
}

module.exports = { openAboutWindow };
