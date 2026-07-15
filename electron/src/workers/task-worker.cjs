"use strict";

/**
 * General-purpose background worker for CPU-bound or I/O tasks.
 * Spawned by main.cjs via `utilityProcess.fork`. Tasks are dispatched
 * from the renderer (via main process relay) and results are sent back.
 *
 * Add new task handlers to the `handlers` map below.
 */

process.on("uncaughtException", (err) => {
  process.stderr.write(`[task-worker] uncaught: ${err.stack}\n`);
  process.exit(1);
});

process.send?.({ type: "started" });

const handlers = {
  /**
   * Ping a URL and return response time + status.
   * @param {{ url: string, timeout?: number }} params
   */
  ping: async (params) => {
    const { url, timeout = 5000 } = params;
    const start = Date.now();
    const https = require("https");
    const http = require("http");
    const httpMod = url.startsWith("https") ? https : http;
    return new Promise((resolve) => {
      const req = httpMod.request(url, { method: "HEAD" }, (res) => {
        res.resume();
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          ms: Date.now() - start,
        });
      });
      req.on("error", () =>
        resolve({ ok: false, status: 0, ms: Date.now() - start }),
      );
      req.setTimeout(timeout, () => {
        req.destroy();
        resolve({ ok: false, status: 0, ms: Date.now() - start });
      });
      req.end();
    });
  },
};

process.on("message", async (msg) => {
  if (!msg || msg.type !== "task") return;
  const { taskId, task, params } = msg;
  const handler = handlers[task];
  if (!handler) {
    process.send?.({
      type: "task-result",
      taskId,
      error: `Unknown task: ${task}`,
    });
    return;
  }
  try {
    const result = await handler(params);
    process.send?.({ type: "task-result", taskId, result });
  } catch (err) {
    process.send?.({
      type: "task-result",
      taskId,
      error: err?.message ?? String(err),
    });
  }
});
