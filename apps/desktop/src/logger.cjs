"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MAX_BYTES = 1024 * 1024;

let _logDir;

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
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
  } catch {}
}

function write(kind, msg) {
  if (!_logDir) return;
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  const line = `${ts} [${kind}] ${msg}\n`;
  const filePath = path.join(_logDir, `${kind}.log`);
  rotateIfNeeded(filePath);
  try {
    fs.appendFileSync(filePath, line);
  } catch {}
}

function info(msg) {
  write("app", msg);
}

function error(msg) {
  write("app", msg);
  write("error", msg);
}

function crash(msg) {
  write("crash", msg);
  write("error", `[CRASH] ${msg}`);
}

function init(logDir) {
  _logDir = logDir;
  ensureDir(_logDir);
  info(`logger initialized — log dir: ${_logDir}`);

  process.on("uncaughtException", (err) => {
    crash(`Uncaught exception: ${err.stack || err.message}`);
  });

  process.on("unhandledRejection", (reason) => {
    const msg =
      reason instanceof Error
        ? `[${reason.name}] ${reason.message}\n${reason.stack}`
        : String(reason);
    error(`Unhandled rejection: ${msg}`);
  });

  process.on("exit", (code) => {
    info(`process exit code=${code}`);
  });
}

module.exports = { init, info, error, crash };
