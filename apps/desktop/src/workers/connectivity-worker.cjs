"use strict";

/**
 * Child process that periodically checks internet reachability.
 * Spawned by main.cjs via `child_process.fork`. Communicates
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

const last = { known: false, online: false };

function report(online) {
  if (last.known && last.online === online) return;
  last.known = true;
  last.online = online;
  process.send?.({ type: "connectivity-change", online });
}

function check() {
  const req = https.request(CHECK_OPTIONS, (res) => {
    const status = res.statusCode ?? 0;
    const online = status >= 200 && status < 400;
    res.resume();
    report(online);
  });
  req.on("error", () => report(false));
  req.on("timeout", () => {
    req.destroy();
    report(false);
  });
  req.end();
}

process.on("message", (msg) => {
  const type =
    typeof msg === "object" && msg !== null && "type" in msg
      ? msg.type
      : undefined;
  if (type === "start") {
    check();
    setInterval(check, CHECK_INTERVAL_MS);
  }
  if (type === "check-now") {
    check();
  }
});
