"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const config = require("../config.cjs");
const state = require("./state.cjs");

const isMac = process.platform === "darwin";

/** @type {Electron.BrowserWindow | undefined} */
let mainWindow;
/** Set to true by main.cjs when the system tray is active. */
let trayEnabled = false;
/**
 * Set on `before-quit` so the close handler lets the window actually close.
 * Without this, hide-to-tray's preventDefault would block app.quit() from
 * every path — tray Quit, Cmd+Q, and updater restarts — forever.
 */
let isQuitting = false;
/** @type {string | undefined} */
let pendingAppUrl;

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
  if (!mainWindow.isVisible()) mainWindow.show();
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
    icon: path.join(__dirname, "..", "..", "..", "public", "wryte-icon.png"),
    // Frameless with inset traffic-lights on mac. The wrapped site reacts to
    // the desktop flag (preload below) and turns its own header into the drag
    // bar with room for the lights — so no overlap and the window still drags.
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: { x: 12, y: 12 },
    autoHideMenuBar: true,
    show: false, // revealed once the loading screen has painted (below)
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep autosave / AI streaming running at full speed when backgrounded.
      backgroundThrottling: false,
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
  mainWindow.on("close", (event) => {
    state.capture(mainWindow);
    state.writeNow();
    // When tray is active, hide to tray instead of closing. Quit via
    // tray menu or Cmd+Q (isQuitting lets those actually close the window).
    if (trayEnabled && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
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

  // Native spell check (all platforms, language list is a hint — the OS
  // decides which dictionaries are actually available).
  contents.session.setSpellCheckerEnabled(true);
  contents.session.setSpellCheckerLanguages(["en-US"]);

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

  // Paint a local loading screen instantly, then check connectivity. If online,
  // load the app URL; if offline, show the offline page and wait for a reconnect.
  let started = false;
  const start = () => {
    if (started || !mainWindow) return;
    started = true;
    mainWindow.show();
    loadAppOrOffline(appUrl);
  };
  mainWindow.once("ready-to-show", start);
  setTimeout(start, 3000);
  mainWindow.loadFile(path.join(__dirname, "loading.html"));

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

/** Quick HEAD request to see if the internet is reachable (5s timeout). */
function checkConnectivity() {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: config.CONNECTIVITY_CHECK_HOST,
        path: config.CONNECTIVITY_CHECK_PATH,
        method: "HEAD",
        timeout: 5000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Try to load the app URL. If the connectivity check fails, show the
 * offline page so the user can retry. The connectivity worker keeps
 * polling in the background and will trigger a reload when online.
 */
function loadAppOrOffline(appUrl) {
  pendingAppUrl = appUrl;
  checkConnectivity().then((online) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (online) {
      mainWindow.loadURL(appUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, "offline.html"));
    }
  });
}

/**
 * Called by main.cjs when the connectivity worker detects a state change.
 * When we come back online after showing the offline page, reload the app.
 * @param {boolean} online
 */
function onConnectivityChange(online) {
  if (!online || !mainWindow || mainWindow.isDestroyed()) return;
  const url = mainWindow.webContents.getURL();
  if (url.includes("offline.html") && pendingAppUrl) {
    mainWindow.loadURL(pendingAppUrl);
  }
}

// ── IPC: offline page retry ─────────────────────────────────────────────────
ipcMain.on("offline-retry", () => {
  if (!mainWindow || mainWindow.isDestroyed() || !pendingAppUrl) return;
  checkConnectivity().then((online) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (online) {
      mainWindow.loadURL(pendingAppUrl);
    }
    // If still offline, stay on offline page — user can click Retry again.
  });
});

/** Connectivity-aware reload. Shows loading screen, checks connectivity,
 * then loads app URL if online or offline page if not. */
function reloadWithCheck() {
  if (pendingAppUrl) {
    loadAppOrOffline(pendingAppUrl);
  } else {
    resolveAppUrl().then((url) => loadAppOrOffline(url));
  }
}

function setTrayEnabled(enabled) {
  trayEnabled = enabled;
}

function setQuitting(quitting) {
  isQuitting = quitting;
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
  onConnectivityChange,
  reloadWithCheck,
  setTrayEnabled,
  setQuitting,
};
