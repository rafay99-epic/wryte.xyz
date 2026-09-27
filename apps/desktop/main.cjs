"use strict";

const path = require("node:path");
const os = require("node:os");
const config = require("./src/config.cjs");
const logger = require("./src/logger.cjs");
logger.init(path.join(os.homedir(), config.LOG_DIR));

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

const isMac = process.platform === "darwin";

logger.info(
  `starting ${config.APP_NAME} v${app.getVersion()} on ${process.platform} ${process.arch}`,
);

app.commandLine.appendSwitch("v8-cache-options", "code");

app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("enable-gpu-rasterization");

let connectivityWorker;
const connectivity = { known: false, online: false };

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

  connectivityWorker = spawn(
    "connectivity",
    path.join(workerDir, "connectivity-worker.cjs"),
  );
  connectivityWorker.on("message", (msg) => {
    if (
      typeof msg !== "object" ||
      msg === null ||
      !("type" in msg) ||
      msg.type !== "connectivity-change" ||
      !("online" in msg) ||
      typeof msg.online !== "boolean"
    ) {
      return;
    }
    const { online } = msg;
    connectivity.known = true;
    connectivity.online = online;
    webContents.getAllWebContents().forEach((wc) => {
      wc.send("connectivity-change", online);
    });
    win.onConnectivityChange(online);
  });
  connectivityWorker.send({ type: "start" });
}

function killWorkers() {
  const pid = connectivityWorker?.pid;
  connectivityWorker?.kill();
  if (pid) logger.info(`killed connectivity worker pid=${pid}`);
}

if (!app.requestSingleInstanceLock()) {
  logger.info("single-instance lock denied — second instance, quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    logger.info("second-instance event — focusing existing window");
    win.focusMainWindow();
  });

  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });

  ipcMain.on("connectivity-subscribe", (event) => {
    if (connectivity.known)
      event.sender.send("connectivity-change", connectivity.online);
  });

  const MAX_RENDERER_LOG_LENGTH = 4000;
  ipcMain.on("log", (_event, payload) => {
    const level = payload?.level;
    const message = payload?.message;
    if (typeof level !== "string" || typeof message !== "string") return;
    const line = `[renderer] ${message.slice(0, MAX_RENDERER_LOG_LENGTH)}`;
    if (level === "error" || level === "warn") {
      logger.error(line);
    } else {
      logger.info(line);
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
      try {
        app.dock?.setIcon(
          nativeImage.createFromPath(
            path.join(__dirname, "assets", "wryte-icon.png"),
          ),
        );
      } catch {}
    }
    state.load();
    menu.build();
    spawnWorkers();

    const appUrl = await win.resolveAppUrl();
    logger.info(`resolved app URL: ${appUrl}`);
    win.createWindow(appUrl);
    const mainWin = win.getMainWindow();
    if (mainWin) {
      try {
        tray.createTray();
        win.setTrayEnabled(true);
      } catch {
        win.setTrayEnabled(false);
      }
    }

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

  app.on("before-quit", () => {
    logger.info("before-quit");
    win.setQuitting(true);
  });

  app.on("will-quit", () => {
    logger.info("will-quit — cleaning up");
    killWorkers();
    tray.destroyTray();
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
