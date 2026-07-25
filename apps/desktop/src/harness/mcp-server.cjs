"use strict";

// Wryte MCP server — how the agent actually operates the app.
//
// The agent needs to read the open document, edit it, spin up drafts, and file
// research notes. All of that is Convex, and Convex auth is a Clerk JWT that
// only the renderer holds. So main does not talk to Convex at all: it exposes
// these as MCP tools, and proxies every call to the renderer, which executes it
// with the session the user is already signed into.
//
//   claude --mcp-config → http://127.0.0.1:<port>/mcp (here)
//        → IPC "agent-tool-call" → renderer → Convex
//        → IPC "agent-tool-result" → back out as the tool result
//
// Bound to loopback with a per-launch bearer token, so nothing else on the
// machine can drive the user's documents.

const http = require("node:http");
const { randomBytes, randomUUID, timingSafeEqual } = require("node:crypto");
const logger = require("../logger.cjs");

const PROTOCOL_VERSION = "2025-06-18";
const CALL_TIMEOUT_MS = 30_000;

/**
 * Tool surface. Kept deliberately small: everything here is something the user
 * asked the agent to be able to do. Publishing, scheduling, deleting, and
 * anything touching git are absent on purpose — those stay the user's.
 */
const TOOLS = [
  {
    name: "get_document",
    description:
      "Read the document the user currently has open in the editor: title, body, and frontmatter. Call this first — it is the thing the user is writing.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "update_document",
    description:
      "Replace the body of the open document. The new text lands in the editor immediately and autosaves. Use for rewrites, restructures, and grammar fixes. Always call get_document first so you are editing the current text.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The complete new body." },
        summary: {
          type: "string",
          description: "One line on what you changed, shown to the user.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "create_draft",
    description:
      "Create a named parallel draft of the open document, so an alternative version can be explored without touching the main text.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", description: "Short name for the draft." },
        copyFromMain: {
          type: "boolean",
          description: "Start from the current body instead of empty.",
        },
      },
      required: ["label"],
    },
  },
  {
    name: "add_research",
    description:
      "File a research note against the open document. It appears in the editor's research panel and can be pulled into AI context later. Use this for findings, sources, quotes, outlines, and ideas rather than dumping them into the chat.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["note", "source", "quote", "outline", "idea", "ai_summary"],
        },
        title: { type: "string" },
        content: { type: "string" },
        url: { type: "string", description: "Source URL, when there is one." },
        sourceName: { type: "string" },
      },
      required: ["type", "title", "content"],
    },
  },
  {
    name: "search_documents",
    description:
      "Search the user's own writing in this project by title. Use it to find earlier posts worth linking to or building on.",
    inputSchema: {
      type: "object",
      properties: { term: { type: "string" } },
      required: ["term"],
    },
  },
];

/** @param {string} a @param {string} b */
function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

class McpServer {
  /**
   * @param {(name: string, args: Record<string, unknown>) => Promise<unknown>} invokeTool
   */
  constructor(invokeTool) {
    this.invokeTool = invokeTool;
    this.token = randomBytes(24).toString("hex");
    this.server = null;
    this.port = null;
  }

  /** @returns {Promise<{ port: number, token: string }>} */
  start() {
    if (this.port)
      return Promise.resolve({ port: this.port, token: this.token });

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handle(req, res).catch((error) => {
          logger.error(`mcp: unhandled ${error.message}`);
          if (!res.headersSent) res.writeHead(500).end();
        });
      });
      this.server.on("error", reject);
      // Loopback only — never 0.0.0.0.
      this.server.listen(0, "127.0.0.1", () => {
        const address = this.server.address();
        this.port =
          typeof address === "object" && address ? address.port : null;
        logger.info(`mcp: listening on 127.0.0.1:${this.port}`);
        resolve({ port: this.port, token: this.token });
      });
    });
  }

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  async handle(req, res) {
    const auth = req.headers["authorization"];
    if (
      typeof auth !== "string" ||
      !auth.startsWith("Bearer ") ||
      !safeEqual(auth.slice(7), this.token)
    ) {
      res.writeHead(401).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    const body = await new Promise((resolve) => {
      let raw = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => resolve(raw));
    });

    let message;
    try {
      message = JSON.parse(body);
    } catch {
      res.writeHead(400).end();
      return;
    }

    // Notifications carry no id and expect no response.
    if (message.id === undefined) {
      res.writeHead(202).end();
      return;
    }

    const result = await this.dispatch(message);
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      ...result,
    });
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  /** @param {{ method: string, params?: any }} message */
  async dispatch(message) {
    switch (message.method) {
      case "initialize":
        return {
          result: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "wryte", version: "1.0.0" },
          },
        };

      case "ping":
        return { result: {} };

      case "tools/list":
        return { result: { tools: TOOLS } };

      case "tools/call": {
        const name = message.params?.name;
        const args = message.params?.arguments ?? {};
        if (!TOOLS.some((tool) => tool.name === name)) {
          return {
            error: { code: -32602, message: `Unknown tool: ${name}` },
          };
        }
        try {
          const value = await this.invokeTool(name, args);
          return {
            result: {
              content: [
                {
                  type: "text",
                  text:
                    typeof value === "string"
                      ? value
                      : JSON.stringify(value, null, 2),
                },
              ],
            },
          };
        } catch (error) {
          // Tool errors belong in the result, not the protocol layer — the
          // model should see them and adapt rather than the turn dying.
          return {
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : String(error),
                },
              ],
            },
          };
        }
      }

      default:
        return {
          error: { code: -32601, message: `Unknown method: ${message.method}` },
        };
    }
  }

  /** Config blob for `claude --mcp-config`. */
  configJson() {
    return JSON.stringify({
      mcpServers: {
        wryte: {
          type: "http",
          url: `http://127.0.0.1:${this.port}/mcp`,
          headers: { Authorization: `Bearer ${this.token}` },
        },
      },
    });
  }

  stop() {
    this.server?.close();
    this.server = null;
    this.port = null;
  }
}

module.exports = { McpServer, TOOLS, CALL_TIMEOUT_MS, randomUUID };
