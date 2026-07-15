"use strict";

const { app, BrowserWindow, shell } = require("electron");
const http = require("node:http");
const path = require("node:path");
const config = require("./config.cjs");
const state = require("./state.cjs");

const isMac = process.platform === "darwin";

/** @type {Electron.BrowserWindow | undefined} */
let mainWindow;

/** @returns {Electron.BrowserWindow | undefined} */
function getMainWindow() {
  return mainWindow;
}

/** Hand a URL to the OS, but only safe schemes — blocks file:// / custom-scheme abuse. */
function openExternal(url) {
  if (/^(https?|mailto|tel):/i.test(url)) {
    shell.openExternal(url).catch(() => undefined);
  }
}

/** @param {number} port @returns {Promise<boolean>} */
function probe(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "localhost", port, path: "/", timeout: 800 },
      (res) => {
        res.destroy();
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Dev → first live local port; packaged → production. `WRYTE_DESKTOP_URL` overrides. */
async function resolveAppUrl() {
  if (process.env.WRYTE_DESKTOP_URL) return process.env.WRYTE_DESKTOP_URL;
  if (!app.isPackaged) {
    for (const port of config.DEV_PORTS) {
      if (await probe(port)) return `http://localhost:${port}`;
    }
  }
  return config.PROD_URL;
}

function applyZoom() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomLevel(state.get().zoom || 0);
  }
}

/** @param {number} delta */
function nudgeZoom(delta) {
  state.setZoom((state.get().zoom || 0) + delta);
  applyZoom();
  state.save();
}

/** @param {number} level */
function setZoom(level) {
  state.setZoom(level);
  applyZoom();
  state.save();
}

function goBack() {
  const c = mainWindow?.webContents;
  if (c?.navigationHistory.canGoBack()) c.navigationHistory.goBack();
}

function goForward() {
  const c = mainWindow?.webContents;
  if (c?.navigationHistory.canGoForward()) c.navigationHistory.goForward();
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

/** @param {string} appUrl */
function createWindow(appUrl) {
  const s = state.get();
  const usePos = state.positionVisible();
  mainWindow = new BrowserWindow({
    width: s.width,
    height: s.height,
    x: usePos ? s.x : undefined,
    y: usePos ? s.y : undefined,
    minWidth: 960,
    minHeight: 640,
    title: "Wryte",
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "..", "public", "wryte-icon.png"),
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (s.isMaximized) mainWindow.maximize();

  // Persist size/position/maximized (debounced live, flushed sync on close).
  const onBounds = () => {
    state.capture(mainWindow);
    state.save();
  };
  mainWindow.on("resize", onBounds);
  mainWindow.on("move", onBounds);
  mainWindow.on("close", () => {
    state.capture(mainWindow);
    state.writeNow();
  });

  // Back/forward via trackpad swipe (macOS) and mouse side-buttons (Win/Linux).
  mainWindow.on("swipe", (_e, dir) => {
    if (dir === "left") goBack();
    else if (dir === "right") goForward();
  });
  mainWindow.on("app-command", (_e, cmd) => {
    if (cmd === "browser-backward") goBack();
    else if (cmd === "browser-forward") goForward();
  });

  const contents = mainWindow.webContents;

  // window.open (Clerk OAuth popups): keep http(s) in-app, deny the rest.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      return { action: "allow" };
    }
    openExternal(url);
    return { action: "deny" };
  });

  // Keep the top frame on http(s); a hijacked page can't drive it elsewhere.
  contents.on("will-navigate", (event, url) => {
    if (!/^https?:\/\//i.test(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Re-apply zoom + scroll CSS on each load; retry transient load failures.
  let retries = 0;
  let cssKey = "";
  contents.on("did-finish-load", async () => {
    retries = 0;
    applyZoom();
    if (cssKey) contents.removeInsertedCSS(cssKey).catch(() => undefined);
    cssKey = await contents.insertCSS(config.SCROLL_CSS).catch(() => "");
  });
  contents.on("did-fail-load", (_e, code, _d, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = ERR_ABORTED
    if (retries >= config.MAX_LOAD_RETRIES) return;
    retries += 1;
    setTimeout(() => {
      if (!contents.isDestroyed()) contents.loadURL(url || appUrl);
    }, 1500);
  });

  mainWindow.loadURL(appUrl);
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

module.exports = {
  createWindow,
  getMainWindow,
  focusMainWindow,
  resolveAppUrl,
  openExternal,
  goBack,
  goForward,
  setZoom,
  nudgeZoom,
};
