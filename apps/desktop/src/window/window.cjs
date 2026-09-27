"use strict";

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const config = require("../config.cjs");
const logger = require("../logger.cjs");
const state = require("./state.cjs");

const isMac = process.platform === "darwin";

let mainWindow;
let trayEnabled = false;
let isQuitting = false;
let pendingAppUrl;
const loaded = { value: false };
const connStatus = { known: false, value: false };

function getMainWindow() {
  return mainWindow;
}

function openExternal(url) {
  if (/^(https?|mailto|tel):/i.test(url)) {
    shell.openExternal(url).catch(() => undefined);
  }
}

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

async function resolveAppUrl() {
  if (process.env["WRYTE_DESKTOP_URL"]) return process.env["WRYTE_DESKTOP_URL"];

  if (config.isDevFlavor || !app.isPackaged) {
    for (const port of config.DEV_PORTS) {
      if (await probe(port)) return `http://localhost:${port}`;
    }
  }

  if (config.isDevFlavor) {
    return `http://localhost:${config.DEV_PORTS[0]}`;
  }

  return config.PROD_URL;
}

function applyZoom() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomLevel(state.get().zoom || 0);
  }
}

function nudgeZoom(delta) {
  state.setZoom((state.get().zoom || 0) + delta);
  applyZoom();
  state.save();
}

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

function createWindow(appUrl) {
  const s = state.get();
  const usePos = state.positionVisible();
  logger.info(
    `creating window — url=${appUrl} max=${s.isMaximized} sz=${s.width}x${s.height}`,
  );
  mainWindow = new BrowserWindow({
    width: s.width,
    height: s.height,
    x: usePos ? s.x : undefined,
    y: usePos ? s.y : undefined,
    minWidth: 960,
    minHeight: 640,
    title: config.APP_NAME,
    backgroundColor: "#0a0a0a",
    icon: path.join(__dirname, "..", "..", "assets", "wryte-icon.png"),
    titleBarStyle: isMac ? "hiddenInset" : undefined,
    trafficLightPosition: { x: 12, y: 12 },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (s.isMaximized) mainWindow.maximize();

  const onBounds = () => {
    state.capture(mainWindow);
    state.save();
  };
  mainWindow.on("resize", onBounds);
  mainWindow.on("move", onBounds);
  mainWindow.on("close", (event) => {
    state.capture(mainWindow);
    state.writeNow();
    if (trayEnabled && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("swipe", (_e, dir) => {
    if (dir === "left") goBack();
    else if (dir === "right") goForward();
  });
  mainWindow.on("app-command", (_e, cmd) => {
    if (cmd === "browser-backward") goBack();
    else if (cmd === "browser-forward") goForward();
  });

  const contents = mainWindow.webContents;

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    if (!/^https?:\/\//i.test(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  let retries = 0;
  let cssKey = "";
  let spellcheckEnabled = false;
  loaded.value = false;
  connStatus.known = false;
  connStatus.value = false;

  contents.on("did-finish-load", () => {
    const url = contents.getURL();
    if (url.includes("loading.html")) return;
    retries = 0;
    loaded.value = true;
    logger.info(`page loaded — url=${contents.getURL()}`);
    applyZoom();
    if (!cssKey) {
      contents
        .insertCSS(config.SCROLL_CSS)
        .then((key) => {
          cssKey = key;
        })
        .catch(() => undefined);
    }
    if (!spellcheckEnabled) {
      contents.session.setSpellCheckerEnabled(true);
      contents.session.setSpellCheckerLanguages(["en-US"]);
      spellcheckEnabled = true;
    }
  });

  contents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    logger.error(
      `page failed to load — code=${code} desc=${desc} url=${url} retry=${retries}`,
    );
    if (connStatus.known && !connStatus.value) {
      mainWindow?.loadFile(path.join(__dirname, "offline.html"));
      return;
    }
    if (retries >= config.MAX_LOAD_RETRIES) return;
    retries += 1;
    setTimeout(() => {
      if (!contents.isDestroyed()) contents.loadURL(url || appUrl);
    }, 1500);
  });

  let started = false;
  const start = () => {
    if (started || !mainWindow) return;
    started = true;
    mainWindow.show();
    loadAppOrOffline(appUrl);
  };
  mainWindow.once("ready-to-show", start);
  mainWindow.loadFile(path.join(__dirname, "loading.html"));

  mainWindow.on("closed", () => {
    logger.info("window closed");
    mainWindow = undefined;
  });
}

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
        const status = res.statusCode ?? 0;
        resolve(status >= 200 && status < 400);
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

function loadAppOrOffline(appUrl) {
  pendingAppUrl = appUrl;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(appUrl);
  }

  checkConnectivity().then((online) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    connStatus.known = true;
    connStatus.value = online;
    logger.info(
      `parallel connectivity check — online=${online} loaded=${loaded.value}`,
    );
    if (!online && !loaded.value) {
      logger.info("offline detected — showing offline page");
      mainWindow.loadFile(path.join(__dirname, "offline.html"));
    }
  });
}

function onConnectivityChange(online) {
  if (!online || !mainWindow || mainWindow.isDestroyed()) return;
  const url = mainWindow.webContents.getURL();
  if (url.includes("offline.html") && pendingAppUrl) {
    mainWindow.loadURL(pendingAppUrl);
  }
}

ipcMain.on("offline-retry", () => {
  logger.info("offline-retry triggered by user");
  if (!mainWindow || mainWindow.isDestroyed() || !pendingAppUrl) return;
  checkConnectivity().then((online) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    logger.info(`offline retry — online=${online}`);
    if (online && pendingAppUrl) {
      mainWindow.loadURL(pendingAppUrl);
    }
  });
});

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
