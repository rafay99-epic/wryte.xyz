"use strict";

/**
 * Utility process that periodically checks internet reachability.
 * Spawned by main.cjs via `utilityProcess.fork`. Communicates
 * status changes back to the main process over IPC.
 */

process.on("uncaughtException", (err) => {
  process.stderr.write(`[connectivity-worker] uncaught: ${err.stack}\n`);
  process.exit(1);
});

const https = require("node:https");
const config = require("../config.cjs");

const CHECK_OPTIONS = {
  hostname: config.CONNECTIVITY_CHECK_HOST,
  path: config.CONNECTIVITY_CHECK_PATH,
  method: "HEAD",
  timeout: 8000,
};
const CHECK_INTERVAL_MS = config.CONNECTIVITY_CHECK_INTERVAL_MS;

/** @type {NodeJS.Timeout | undefined} */
let timer;
let lastOnline = null;

function check() {
  const req = https.request(CHECK_OPTIONS, (res) => {
    const online = res.statusCode >= 200 && res.statusCode < 400;
    res.resume();
    if (online !== lastOnline) {
      lastOnline = online;
      process.send?.({ type: "connectivity-change", online });
    }
  });
  req.on("error", () => {
    if (lastOnline !== false) {
      lastOnline = false;
      process.send?.({ type: "connectivity-change", online: false });
    }
  });
  req.on("timeout", () => {
    req.destroy();
    if (lastOnline !== false) {
      lastOnline = false;
      process.send?.({ type: "connectivity-change", online: false });
    }
  });
  req.end();
}

process.on("message", (msg) => {
  if (msg?.type === "start") {
    process.send?.({ type: "started" });
    check();
    timer = setInterval(check, CHECK_INTERVAL_MS);
  }
  if (msg?.type === "stop") {
    clearInterval(timer);
    timer = undefined;
  }
  if (msg?.type === "check-now") {
    check();
  }
});
