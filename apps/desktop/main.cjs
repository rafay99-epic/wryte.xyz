"use strict";

// Logger must be initialised first — before any other module — so crash
// handlers are in place from the very first tick.
const path = require("node:path");
const os = require("node:os");
const config = require("./src/config.cjs");
const logger = require("./src/logger.cjs");
logger.init(path.join(os.homedir(), config.LOG_DIR));

// Entry point: app lifecycle + wiring. Feature logic lives in the sibling
// modules (config / logger / state / window / menu / updater / about).
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  webContents,
  powerMonitor,
  nativeImage,
} = require("electron");
const { fork } = require("node:child_process");
const state = require("./src/window/state.cjs");
const win = require("./src/window/window.cjs");
const menu = require("./src/menu/menu.cjs");
const updater = require("./src/updater/updater.cjs");
const tray = require("./src/tray/tray.cjs");
const harness = require("./src/harness/manager.cjs");

const isMac = process.platform === "darwin";

logger.info(
  `starting ${config.APP_NAME} v${app.getVersion()} on ${process.platform} ${process.arch}`,
);

// ── Performance: V8 code caching ──────────────────────────────────────────
// Pre-compile cached JS data so subsequent starts skip parse/compile.
app.commandLine.appendSwitch("v8-cache-options", "code");

// ── Performance: GPU acceleration ──────────────────────────────────────────
// Force GPU rasterization + zero-copy for smoother rendering.
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("enable-gpu-rasterization");

// ── Worker processes ────────────────────────────────────────────────────────
/** @type {import("node:child_process").ChildProcess | undefined} */
let connectivityWorker;
/** @type {import("node:child_process").ChildProcess | undefined} */
let taskWorker;
let lastOnline = null;

function spawnWorkers() {
  const workerDir = path.join(__dirname, "src", "workers");

  function spawn(name, file) {
    const child = fork(file, [], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
    logger.info(`worker ${name} spawned pid=${child.pid}`);
    child.on("error", (err) => {
      logger.error(`worker ${name} error: ${err.message}`);
    });
    child.on("exit", (code, signal) => {
      logger.info(`worker ${name} exited code=${code} signal=${signal}`);
    });
    child.stderr?.on("data", (d) => {
      process.stderr.write(`[${name}-worker] ${d}`);
    });
    return child;
  }

  // Connectivity worker: periodic internet reachability checks.
  connectivityWorker = spawn(
    "connectivity",
    path.join(workerDir, "connectivity-worker.cjs"),
  );
  connectivityWorker.on("message", (msg) => {
    if (msg?.type === "connectivity-change") {
      lastOnline = msg.online;
      webContents.getAllWebContents().forEach((wc) => {
        wc.send("connectivity-change", msg.online);
      });
      win.onConnectivityChange(msg.online);
    }
  });
  connectivityWorker.send({ type: "start" });

  // Task worker: general-purpose background computation.
  taskWorker = spawn("task", path.join(workerDir, "task-worker.cjs"));
  taskWorker.on("message", (msg) => {
    if (msg?.type === "task-result") {
      webContents.getAllWebContents().forEach((wc) => {
        wc.send("task-result", msg);
      });
    }
  });
}

/** @returns {{ connectivity: number | null, task: number | null }} */
function workerStatus() {
  return {
    connectivity: connectivityWorker?.pid ?? null,
    task: taskWorker?.pid ?? null,
  };
}

function killWorkers() {
  const s = workerStatus();
  connectivityWorker?.kill();
  taskWorker?.kill();
  if (s.connectivity || s.task) {
    logger.info(`killed workers connectivity=${s.connectivity} task=${s.task}`);
  }
}

// Single instance: a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  logger.info("single-instance lock denied — second instance, quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    logger.info("second-instance event — focusing existing window");
    win.focusMainWindow();
  });

  // Security: never allow embedded <webview> tags.
  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });

  // ── Performance: memory pressure handler ──────────────────────────────
  // When the OS signals low memory, clear session caches and hint GC.
  app.on("memory-pressure", (_e, level) => {
    logger.info(`memory-pressure: ${level}`);
    if (level === "critical" || level === "moderate") {
      session.defaultSession.clearCache().catch(() => undefined);
      for (const wc of webContents.getAllWebContents()) {
        wc.executeJavaScript("window.gc?.()", false).catch(() => undefined);
      }
    }
  });

  // ── IPC: renderer subscribes to connectivity ──────────────────────────
  ipcMain.on("connectivity-subscribe", () => {
    if (lastOnline !== null) return;
  });

  // ── IPC: renderer submits a background task ───────────────────────────
  ipcMain.on("task-submit", (_event, msg) => {
    taskWorker?.send(msg);
  });

  // ── IPC: renderer queries worker status (PIDs) ────────────────────────
  ipcMain.handle("worker-status", () => workerStatus());

  // ── IPC: agent harnesses (spawn local CLIs, stream back) ──────────────
  harness.register();

  // ── IPC: renderer forwards logs to the main-process logger ────────────
  ipcMain.on("log", (_event, { level, message }) => {
    if (level === "error" || level === "warn") {
      logger.error(`[renderer] ${message}`);
    } else {
      logger.info(`[renderer] ${message}`);
    }
  });

  app.whenReady().then(async () => {
    logger.info("app ready");

    const ALLOWED = new Set([
      "clipboard-read",
      "clipboard-sanitized-write",
      "notifications",
      "fullscreen",
    ]);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
      cb(ALLOWED.has(permission)),
    );

    if (config.isDevFlavor) {
      app.setPath("userData", `${app.getPath("userData")}-dev`);
      logger.info(`dev userData: ${app.getPath("userData")}`);
      // Set the dock icon — unpackaged Electron uses its own icon by default.
      try {
        app.dock?.setIcon(
          nativeImage.createFromPath(
            path.join(__dirname, "assets", "wryte-icon.png"),
          ),
        );
      } catch {
        // Non-mac or icon read failure — non-fatal.
      }
    }
    state.load();
    menu.build();
    spawnWorkers();

    // Native system tray (shown after window is created).
    const appUrl = await win.resolveAppUrl();
    logger.info(`resolved app URL: ${appUrl}`);
    win.createWindow(appUrl);
    const mainWin = win.getMainWindow();
    if (mainWin) {
      try {
        tray.createTray(mainWin);
        win.setTrayEnabled(true);
      } catch {
        // Tray may be unsupported (headless Linux, sandboxed).
        win.setTrayEnabled(false);
      }
    }

    // Re-check connectivity when the system wakes from sleep.
    powerMonitor.on("resume", () => {
      logger.info("system resumed from sleep — re-checking connectivity");
      if (!connectivityWorker || connectivityWorker.killed) return;
      connectivityWorker.send({ type: "check-now" });
    });

    if (app.isPackaged && !config.isDevFlavor) updater.init();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        logger.info("activate — no windows, creating one");
        win.createWindow(await win.resolveAppUrl());
      } else {
        win.focusMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    logger.info("all windows closed");
    if (!isMac) app.quit();
  });

  // Flag every quit path (tray Quit, Cmd+Q, updater restart) so the
  // hide-to-tray close handler doesn't preventDefault the real quit.
  app.on("before-quit", () => {
    logger.info("before-quit");
    win.setQuitting(true);
  });

  app.on("will-quit", () => {
    logger.info("will-quit — cleaning up");
    killWorkers();
    tray.destroyTray();
  });

  // Renderer process crash / hang detection.
  app.on("renderer-process-crashed", (_event, wc, killed) => {
    logger.crash(`renderer crashed wcId=${wc?.id} killed=${killed}`);
  });
  app.on("render-process-gone", (_event, wc, details) => {
    logger.crash(
      `renderer gone wcId=${wc?.id} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  app.on("child-process-gone", (_event, details) => {
    logger.crash(
      `child process gone type=${details.type} reason=${details.reason} exit=${details.exitCode}`,
    );
  });
}
