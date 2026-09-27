"use strict";

/**
 * Minimal file-based logger for the Electron shell.
 *
 * Writes to three rotating files under the flavor-specific log directory
 * (`~/.wryte`, or `~/.wryteDev` for the dev flavor; see config.LOG_DIR):
 *   app.log     — general runtime info
 *   error.log   — errors and warnings
 *   crash.log   — uncaught exceptions, crashes
 *
 * Each file is capped at 1 MB; when exceeded the oldest half is discarded.
 */

const fs = require("node:fs");
const path = require("node:path");

const MAX_BYTES = 1024 * 1024; // 1 MB per file

/** @type {string | undefined} */
let _logDir;

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // non-fatal
  }
}

function rotateIfNeeded(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < MAX_BYTES) return;
    const content = fs.readFileSync(filePath, "utf8");
    const half = Math.floor(content.length / 2);
    const keepFrom = content.indexOf("\n", half);
    if (keepFrom !== -1) {
      fs.writeFileSync(filePath, content.slice(keepFrom + 1));
    }
  } catch {
    // File doesn't exist yet or read error — that's fine.
  }
}

function write(kind, msg) {
  if (!_logDir) return;
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  const line = `${ts} [${kind}] ${msg}\n`;
  const filePath = path.join(_logDir, `${kind}.log`);
  rotateIfNeeded(filePath);
  try {
    fs.appendFileSync(filePath, line);
  } catch {
    // non-fatal
  }
}

/** @param {string} msg */
function info(msg) {
  write("app", msg);
}

/** @param {string} msg */
function error(msg) {
  write("app", msg);
  write("error", msg);
}

/** @param {string} msg */
function crash(msg) {
  write("crash", msg);
  write("error", `[CRASH] ${msg}`);
}

/**
 * Initialise the log directory and wire global crash handlers.
 * @param {string} logDir  e.g. `path.join(os.homedir(), ".wryte")`
 */
function init(logDir) {
  _logDir = logDir;
  ensureDir(_logDir);
  info(`logger initialized — log dir: ${_logDir}`);

  // Process-level crash / error handlers (main process only).
  process.on("uncaughtException", (err) => {
    crash(`Uncaught exception: ${err.stack || err.message}`);
    // Registering this handler suppresses Node's default exit-on-throw, so
    // the app keeps running after the exception is logged.
  });

  process.on("unhandledRejection", (reason) => {
    const msg =
      reason instanceof Error
        ? `[${reason.name}] ${reason.message}\n${reason.stack}`
        : String(reason);
    error(`Unhandled rejection: ${msg}`);
  });

  // Log when the process exits.
  process.on("exit", (code) => {
    info(`process exit code=${code}`);
  });
}

module.exports = { init, info, error, crash };
