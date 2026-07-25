"use strict";

// Claude Code adapter.
//
// Auth note, load-bearing: we spawn the user's already-logged-in `claude` and
// inject NOTHING into its environment. The OAuth token lives in the macOS
// keychain and the CLI finds it via $HOME. Two ways to silently break that and
// fall back to per-token API billing:
//   1. overriding HOME (relocates the keychain lookup) — isolate with
//      CLAUDE_CONFIG_DIR instead if isolation is ever needed
//   2. passing --bare (explicitly disables keychain/OAuth reads)
// Neither appears below, on purpose.

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { createLineBuffer } = require("./line-buffer.cjs");
const { resolveBinary } = require("./detect.cjs");
const logger = require("../logger.cjs");

const FORCE_KILL_AFTER_MS = 3000;

/**
 * Translate one Claude Code stream-json line into our normalized event shape,
 * or null for lines the UI has no use for.
 *
 * @param {any} msg
 * @returns {{type: string, [k: string]: unknown} | null}
 */
function normalize(msg) {
  switch (msg.type) {
    case "system":
      // Hook lifecycle chatter — the spawned CLI inherits the user's own hooks
      // and echoes their entire output. Pure noise for a writing panel.
      if (typeof msg.subtype === "string" && msg.subtype.startsWith("hook_")) {
        return null;
      }
      if (msg.subtype === "init") {
        return { type: "session.ready", sessionId: msg.session_id };
      }
      return null;

    case "stream_event": {
      const event = msg.event;
      if (event?.type === "content_block_start") {
        const block = event.content_block;
        if (block?.type === "tool_use") {
          return { type: "tool.started", name: block.name, id: block.id };
        }
        return null;
      }
      if (event?.type === "content_block_delta") {
        const delta = event.delta;
        if (delta?.type === "text_delta") {
          return { type: "text.delta", kind: "assistant", text: delta.text };
        }
        if (delta?.type === "thinking_delta") {
          return {
            type: "text.delta",
            kind: "reasoning",
            text: delta.thinking,
          };
        }
        return null;
      }
      return null;
    }

    case "result":
      return {
        type: "turn.completed",
        error: msg.is_error === true,
        text: typeof msg.result === "string" ? msg.result : null,
        durationMs: msg.duration_ms ?? null,
      };

    default:
      return null;
  }
}

/**
 * One conversation with Claude Code. Each turn is a fresh `claude -p` process;
 * continuity comes from Claude's own session file, pinned by --session-id and
 * resumed with -r. That keeps the adapter stateless between turns and means a
 * crashed turn can never corrupt the conversation.
 */
class ClaudeSession {
  /**
   * @param {{ cwd: string, onEvent: (event: any) => void, mcpConfig?: string, systemPrompt?: string }} options
   */
  constructor({ cwd, onEvent, mcpConfig, systemPrompt }) {
    this.id = randomUUID();
    this.cwd = cwd;
    this.onEvent = onEvent;
    this.mcpConfig = mcpConfig ?? null;
    this.systemPrompt = systemPrompt ?? null;
    this.child = null;
    this.started = false;
  }

  get busy() {
    return this.child !== null;
  }

  /**
   * Run one turn. Resolves when the turn ends.
   * @param {string} prompt
   */
  sendTurn(prompt) {
    if (this.child) {
      return Promise.reject(new Error("A turn is already running"));
    }

    const binaryPath = resolveBinary("claude");
    if (!binaryPath) {
      return Promise.reject(
        new Error("Claude Code is not installed, or not on the resolved PATH"),
      );
    }

    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      // Print mode has nobody to ask, so every tool the agent may use has to be
      // pre-approved. The Wryte tools operate the app; Read/Grep/Glob and web
      // access let it research. Everything else stays off.
      "--allowedTools",
      "mcp__wryte,Read,Grep,Glob,WebSearch,WebFetch,TodoWrite",
      // Belt and braces: no shell, no filesystem writes, no git. The workspace
      // has no remote either, so pushing is not merely denied, it is absent.
      "--disallowedTools",
      "Bash,Write,Edit,NotebookEdit",
      ...(this.mcpConfig
        ? ["--mcp-config", this.mcpConfig, "--strict-mcp-config"]
        : []),
      // Only on the first turn — a resumed session already carries it.
      ...(this.systemPrompt && !this.started
        ? ["--append-system-prompt", this.systemPrompt]
        : []),
      ...(this.started ? ["--resume", this.id] : ["--session-id", this.id]),
    ];

    this.started = true;

    return new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        cwd: this.cwd,
        env: process.env, // untouched — see the auth note at the top
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.child = child;

      this.onEvent({ type: "turn.started" });

      const buffer = createLineBuffer((line) => {
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          return; // non-JSON noise on stdout
        }
        const event = normalize(parsed);
        if (event) this.onEvent(event);
      });

      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => buffer.push(chunk));

      let stderr = "";
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });

      child.on("error", (error) => {
        this.child = null;
        this.onEvent({ type: "error", message: error.message });
        resolve();
      });

      child.on("close", (code) => {
        buffer.flush();
        this.child = null;
        if (code !== 0 && code !== null) {
          this.onEvent({
            type: "error",
            message: stderr.trim() || `claude exited with code ${code}`,
          });
        }
        resolve();
      });
    });
  }

  /** Stop the running turn. The session survives; the next turn resumes it. */
  interrupt() {
    const child = this.child;
    if (!child) return;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, FORCE_KILL_AFTER_MS);
    logger.info(`harness: interrupted session ${this.id}`);
  }
}

module.exports = { ClaudeSession, normalize };
