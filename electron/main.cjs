"use strict";

// Entry point: app lifecycle + wiring. Feature logic lives in the sibling
// modules (config / state / window / menu / updater / about).
const { app, BrowserWindow, ipcMain, session, webContents, powerMonitor } =
  require("electron");
const path = require("node:path");
const { fork } = require("node:child_process");
const state = require("./src/window/state.cjs");
const win = require("./src/window/window.cjs");
const menu = require("./src/menu/menu.cjs");
const updater = require("./src/updater/updater.cjs");
const tray = require("./src/tray/tray.cjs");

const isMac = process.platform === "darwin";

// ── Performance: V8 code caching ──────────────────────────────────────────
// Pre-compile cached JS data so subsequent starts skip parse/compile.
app.commandLine.appendSwitch("v8-cache-options", "code");

// ── Performance: GPU acceleration ──────────────────────────────────────────
// Force GPU rasterization + zero-copy for smoother rendering.
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

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
    console.info(`[workers] ${name} spawned pid=${child.pid}`);
    child.on("error", (err) => {
      console.error(`[workers] ${name} error: ${err.message}`);
    });
    child.on("exit", (code, signal) => {
      console.info(`[workers] ${name} exited code=${code} signal=${signal}`);
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
    console.info(
      `[workers] killed connectivity=${s.connectivity} task=${s.task}`,
    );
  }
}

// Single instance: a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", win.focusMainWindow);

  // Security: never allow embedded <webview> tags.
  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });

  // ── Performance: memory pressure handler ──────────────────────────────
  // When the OS signals low memory, clear session caches and hint GC.
  app.on("memory-pressure", (_e, level) => {
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

  app.whenReady().then(async () => {
    const ALLOWED = new Set([
      "clipboard-read",
      "clipboard-sanitized-write",
      "notifications",
      "fullscreen",
    ]);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
      cb(ALLOWED.has(permission)),
    );

    state.load();
    menu.build();
    spawnWorkers();

    // Native system tray (shown after window is created).
    win.createWindow(await win.resolveAppUrl());
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
      if (!connectivityWorker || connectivityWorker.killed) return;
      connectivityWorker.send({ type: "check-now" });
    });

    if (app.isPackaged) updater.init();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        win.createWindow(await win.resolveAppUrl());
      } else {
        win.focusMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (!isMac) app.quit();
  });

  // Flag every quit path (tray Quit, Cmd+Q, updater restart) so the
  // hide-to-tray close handler doesn't preventDefault the real quit.
  app.on("before-quit", () => {
    win.setQuitting(true);
  });

  app.on("will-quit", () => {
    killWorkers();
    tray.destroyTray();
  });
}
