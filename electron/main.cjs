const { app, BrowserWindow, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("node:http");
const path = require("node:path");

const isMac = process.platform === "darwin";

// Thin shell: wryte is a hosted Next.js + Convex-cloud app, so the desktop
// build just loads the running site. Dev probes the local dev server (Next
// picks the first free port from 3000), packaged builds load production.
// ponytail: no bundled Next server — backend is Convex cloud + Clerk, a
// wrapped URL is the whole product.
const DEV_PORTS = [3000, 3001, 3002];
const PROD_URL = "https://wryte.xyz";
const MAX_LOAD_RETRIES = 5;

// Kill the macOS elastic overscroll (the rubber-band bounce that makes a
// wrapped web app feel unnative), and give the shell momentum scrolling.
const SCROLL_CSS = `
  html, body { overscroll-behavior: none; }
  * { -webkit-overflow-scrolling: touch; }
`;

// Only hand these schemes to the OS. Blocks a hostile page from launching
// arbitrary local handlers via window.open("file://…" / "someapp://…").
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
  if (process.env.WRYTE_DESKTOP_URL) return process.env.WRYTE_DESKTOP_URL;
  if (!app.isPackaged) {
    for (const port of DEV_PORTS) {
      if (await probe(port)) return `http://localhost:${port}`;
    }
  }
  return PROD_URL;
}

let mainWindow;

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
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

  const contents = mainWindow.webContents;

  // window.open (target=_blank, Clerk OAuth popups): keep http(s) in-app as a
  // child window so cross-origin auth flows complete, deny everything else.
  // Navigation itself is left untouched so Clerk redirects aren't hijacked.
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      return { action: "allow" };
    }
    openExternal(url);
    return { action: "deny" };
  });

  // Keep the top frame on http(s) only — a hijacked page can't drive the main
  // window into file:// or a custom scheme. http(s) nav stays open so Clerk
  // OAuth redirects work.
  contents.on("will-navigate", (event, url) => {
    if (!/^https?:\/\//i.test(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // Reliability: if the page fails to load (dev server still booting, brief
  // network drop), retry the *current* url a few times before giving up.
  let retries = 0;
  let cssKey = "";
  contents.on("did-finish-load", async () => {
    retries = 0;
    // Replace the prior stylesheet so reloads/redirects don't stack copies.
    if (cssKey) contents.removeInsertedCSS(cssKey).catch(() => undefined);
    cssKey = await contents.insertCSS(SCROLL_CSS).catch(() => "");
  });
  contents.on(
    "did-fail-load",
    (_event, errorCode, _desc, validatedURL, isMainFrame) => {
      // -3 == ERR_ABORTED (navigation superseded); ignore it.
      if (!isMainFrame || errorCode === -3) return;
      if (retries >= MAX_LOAD_RETRIES) return;
      retries += 1;
      setTimeout(() => {
        if (!contents.isDestroyed()) contents.loadURL(validatedURL || appUrl);
      }, 1500);
    },
  );

  mainWindow.loadURL(appUrl);
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// Single instance: a second launch focuses the existing window instead of
// opening a duplicate.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);

  // Security: never allow embedded <webview> tags.
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });

  app.whenReady().then(async () => {
    // Deny device-level permissions by default; a wrapped web page has no
    // business grabbing camera/mic/geolocation/USB/serial. Allow only the
    // handful the editor actually uses.
    const ALLOWED_PERMISSIONS = new Set([
      "clipboard-read",
      "clipboard-sanitized-write",
      "notifications",
      "fullscreen",
    ]);
    session.defaultSession.setPermissionRequestHandler(
      (_wc, permission, callback) =>
        callback(ALLOWED_PERMISSIONS.has(permission)),
    );

    createWindow(await resolveAppUrl());
    // Auto-update from GitHub Releases (config in package.json build.publish).
    if (app.isPackaged) autoUpdater.checkForUpdatesAndNotify();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(await resolveAppUrl());
      } else {
        focusMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (!isMac) app.quit();
  });
}
