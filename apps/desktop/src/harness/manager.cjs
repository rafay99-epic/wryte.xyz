"use strict";

// Session registry, tool routing, and IPC surface for agent harnesses.
//
// Renderer never spawns anything, and main never talks to Convex. Main owns
// processes; the renderer owns the authenticated Convex session. Tool calls
// travel main → renderer → Convex → back.

const { ipcMain, BrowserWindow, app } = require("electron");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { ClaudeSession } = require("./claude.cjs");
const { probe } = require("./detect.cjs");
const { McpServer, CALL_TIMEOUT_MS } = require("./mcp-server.cjs");
const logger = require("../logger.cjs");

/** @type {Map<string, ClaudeSession>} */
const sessions = new Map();

/** In-flight tool calls awaiting a renderer response. */
/** @type {Map<string, { resolve: (v: unknown) => void, reject: (e: Error) => void, timer: NodeJS.Timeout }>} */
const pendingCalls = new Map();

/** @type {McpServer | null} */
let mcp = null;

const SYSTEM_PROMPT = `You are working inside Wryte, the user's writing app. A document is open in their editor right now.

You have tools that operate the app directly. Use them instead of describing what you would do:
- get_document — always call this first; it returns what the user is actually writing
- update_document — apply rewrites and fixes to the body; changes appear in their editor live
- create_draft — explore an alternative version without touching the main text
- add_research — file findings, sources, quotes, outlines and ideas into the research panel
- search_documents — find the user's earlier posts to link to or build on

Prefer acting over explaining. If asked to fix grammar, call get_document then update_document — do not paste the corrected text into chat. If asked to research, file what you find with add_research rather than listing it in the reply, then say briefly what you filed.

You cannot publish, schedule, commit, or push. Those are the user's to do.`;

/**
 * Scratch directory for a session. Deliberately NOT a blog repo: with no git
 * remote in scope the agent cannot commit or push, regardless of instructions.
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

/**
 * Ask the renderer to run a tool and wait for its answer.
 * @param {string} name
 * @param {Record<string, unknown>} args
 */
function invokeToolInRenderer(name, args) {
  const target = BrowserWindow.getAllWindows().find(
    (win) => !win.isDestroyed(),
  );
  if (!target) return Promise.reject(new Error("No window is open"));

  const callId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCalls.delete(callId);
      reject(new Error(`Tool ${name} timed out`));
    }, CALL_TIMEOUT_MS);

    pendingCalls.set(callId, { resolve, reject, timer });
    target.webContents.send("agent-tool-call", { callId, name, args });
  });
}

function register() {
  mcp = new McpServer(invokeToolInRenderer);

  ipcMain.on("agent-tool-result", (_event, { callId, result, error }) => {
    const pending = pendingCalls.get(callId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingCalls.delete(callId);
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
  });

  ipcMain.handle("agent-probe", () =>
    Promise.all([probe("claude"), probe("cmd")]),
  );

  ipcMain.handle("agent-start", async (_event, { label } = {}) => {
    await mcp.start();
    const cwd = workspaceFor(label ?? "session");
    const session = new ClaudeSession({
      cwd,
      mcpConfig: mcp.configJson(),
      systemPrompt: SYSTEM_PROMPT,
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
    mcp?.stop();
  });
}

module.exports = { register, SYSTEM_PROMPT };
