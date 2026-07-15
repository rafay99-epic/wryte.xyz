const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  screen,
  session,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
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
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-check every 6h

// Kill the macOS elastic overscroll (the rubber-band bounce that makes a
// wrapped web app feel unnative), and give the shell momentum scrolling.
const SCROLL_CSS = `
  html, body { overscroll-behavior: none; }
  * { -webkit-overflow-scrolling: touch; }
`;

// Persisted window bounds + zoom, so the app reopens where you left it at the
// size and zoom you set. Stored as a small JSON in userData.
// ponytail: hand-rolled instead of the electron-window-state dep — it's ~30 lines.
const DEFAULT_STATE = { width: 1280, height: 840, zoom: 0 };
let winState = { ...DEFAULT_STATE };
let saveTimer;

function stateFile() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function loadState() {
  try {
    winState = {
      ...DEFAULT_STATE,
      ...JSON.parse(fs.readFileSync(stateFile(), "utf8")),
    };
  } catch {
    // First launch / unreadable — defaults are fine.
  }
}

function writeStateNow() {
  clearTimeout(saveTimer);
  try {
    fs.writeFileSync(stateFile(), JSON.stringify(winState));
  } catch {
    // Non-fatal: a failed write just means we forget bounds this once.
  }
}

// Debounced during live resizing/moving; on close we flush synchronously
// (writeStateNow) since the app quits before a timer would fire.
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStateNow, 400);
}

// Only restore a saved position if it still lands on a connected display —
// otherwise a window saved on an unplugged monitor opens off-screen.
function savedPositionVisible() {
  if (typeof winState.x !== "number" || typeof winState.y !== "number")
    return false;
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      winState.x < a.x + a.width &&
      winState.x + 100 > a.x &&
      winState.y < a.y + a.height &&
      winState.y + 40 > a.y
    );
  });
}

function captureBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  winState.isMaximized = mainWindow.isMaximized();
  // Only persist bounds when normal — a maximized window's bounds are the
  // whole screen, which we don't want to restore as the un-maximized size.
  if (!winState.isMaximized) Object.assign(winState, mainWindow.getBounds());
}

function applyZoom() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomLevel(winState.zoom || 0);
  }
}

function setZoom(level) {
  winState.zoom = Math.max(-3, Math.min(3, level));
  applyZoom();
  saveState();
}

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
  const usePos = savedPositionVisible();
  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    x: usePos ? winState.x : undefined,
    y: usePos ? winState.y : undefined,
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
  if (winState.isMaximized) mainWindow.maximize();

  // Persist size/position/maximized as they change (debounced), and flush
  // synchronously on close since the app quits before a timer would fire.
  const onBoundsChange = () => {
    captureBounds();
    saveState();
  };
  mainWindow.on("resize", onBoundsChange);
  mainWindow.on("move", onBoundsChange);
  mainWindow.on("close", () => {
    captureBounds();
    writeStateNow();
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
    applyZoom(); // zoom level resets on navigation; re-apply the saved one.
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

// Auto-update from GitHub Releases. Downloads in the background, then tells the
// user plainly and lets them restart on their terms — no silent surprise.
function initAutoUpdate() {
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
  // Stay quiet on network/update errors — never nag on a failed check.
  autoUpdater.on("error", () => undefined);

  autoUpdater.checkForUpdates().catch(() => undefined);
  setInterval(
    () => autoUpdater.checkForUpdates().catch(() => undefined),
    UPDATE_CHECK_INTERVAL_MS,
  );
}

const REPO_URL = "https://github.com/rafay99-epic/wryte.xyz";

let aboutWindow;
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
  // Links in the About page open in the system browser, not in-app.
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

function checkForUpdatesManually() {
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

function buildAppMenu() {
  const helpItems = [
    { label: "Wryte on GitHub", click: () => openExternal(REPO_URL) },
    {
      label: "Report an Issue",
      click: () => openExternal(`${REPO_URL}/issues/new`),
    },
  ];
  const template = [
    ...(isMac
      ? [
          {
            label: "Wryte",
            submenu: [
              { label: "About Wryte", click: openAboutWindow },
              { label: "Check for Updates…", click: checkForUpdatesManually },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => setZoom(0),
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => setZoom((winState.zoom || 0) + 0.5),
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => setZoom((winState.zoom || 0) - 0.5),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: isMac
        ? helpItems
        : [
            { label: "About Wryte", click: openAboutWindow },
            { label: "Check for Updates…", click: checkForUpdatesManually },
            { type: "separator" },
            ...helpItems,
          ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

    loadState();
    buildAppMenu();
    createWindow(await resolveAppUrl());
    if (app.isPackaged) initAutoUpdate();

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
