"use strict";

// Session registry + IPC surface for agent harnesses.
//
// Renderer never spawns anything. It asks main to start a session, sends turns,
// and receives normalized events on one channel. Every event carries its
// sessionId so a future multi-session UI needs no protocol change.

const { ipcMain, BrowserWindow, app } = require("electron");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { ClaudeSession } = require("./claude.cjs");
const { probe } = require("./detect.cjs");
const logger = require("../logger.cjs");

/** @type {Map<string, ClaudeSession>} */
const sessions = new Map();

/**
 * Scratch directory for a session. Deliberately NOT a blog repo: with no git
 * remote in scope the agent cannot commit or push, regardless of what it is
 * asked to do. Capability removed beats permission denied.
 * @param {string} label
 */
function workspaceFor(label) {
  const safe = label.replace(/[^a-z0-9-]/gi, "-").slice(0, 40) || "session";
  const dir = path.join(os.tmpdir(), "wryte-agent", safe);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** @param {string} sessionId @param {any} event */
function broadcast(sessionId, event) {
  const payload = { ...event, sessionId };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("agent-event", payload);
  }
}

function register() {
  ipcMain.handle("agent-probe", async () => {
    const results = await Promise.all([probe("claude"), probe("cmd")]);
    return results;
  });

  ipcMain.handle("agent-start", (_event, { label } = {}) => {
    const cwd = workspaceFor(label ?? "session");
    const session = new ClaudeSession({
      cwd,
      onEvent: (event) => broadcast(session.id, event),
    });
    sessions.set(session.id, session);
    logger.info(`harness: session ${session.id} started in ${cwd}`);
    return { sessionId: session.id, cwd };
  });

  ipcMain.handle("agent-send", async (_event, { sessionId, prompt }) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("Unknown session");
    if (session.busy) throw new Error("A turn is already running");
    await session.sendTurn(prompt);
    return true;
  });

  ipcMain.on("agent-interrupt", (_event, { sessionId }) => {
    sessions.get(sessionId)?.interrupt();
  });

  ipcMain.on("agent-stop", (_event, { sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.interrupt();
    sessions.delete(sessionId);
  });

  // Never leave orphaned CLI processes behind on quit.
  app.on("before-quit", () => {
    for (const session of sessions.values()) session.interrupt();
    sessions.clear();
  });
}

module.exports = { register };
