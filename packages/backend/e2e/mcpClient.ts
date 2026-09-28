type JsonRpcResponse = {
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export type ToolOutcome =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

const PROTOCOL_VERSION = "2025-06-18";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBody(text: string, contentType: string): JsonRpcResponse | null {
  if (!text.trim()) return null;
  const payload = contentType.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .findLast((line) => line.length > 0)
    : text;
  if (payload === undefined) return null;
  const parsed: unknown = JSON.parse(payload);
  return isRecord(parsed) ? parsed : null;
}

function toolText(result: unknown): string {
  if (!isRecord(result) || !Array.isArray(result["content"])) return "";
  return result["content"]
    .map((part: unknown) =>
      isRecord(part) && typeof part["text"] === "string" ? part["text"] : "",
    )
    .join("");
}

export class McpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  private readonly endpoint: string;
  private readonly token: () => Promise<string>;

  constructor(endpoint: string, token: () => Promise<string>) {
    this.endpoint = endpoint;
    this.token = token;
  }

  private async post(
    body: Record<string, unknown>,
  ): Promise<{ status: number; message: JsonRpcResponse | null }> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.token()}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOL_VERSION,
        ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...body }),
    });
    this.sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
    const text = await response.text();
    return {
      status: response.status,
      message: parseBody(text, response.headers.get("content-type") ?? ""),
    };
  }

  async request(method: string, params: unknown = {}): Promise<unknown> {
    const { status, message } = await this.post({
      id: this.nextId++,
      method,
      params,
    });
    if (message?.error) {
      throw new Error(`${method}: ${message.error.message}`);
    }
    if (status >= 400 || message === null) {
      throw new Error(`${method}: HTTP ${String(status)}`);
    }
    return message.result;
  }

  async initialize(): Promise<unknown> {
    const result = await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "wryte-mcp-e2e", version: "1.0.0" },
    });
    await this.post({ method: "notifications/initialized" });
    return result;
  }

  async listTools(): Promise<string[]> {
    const result = await this.request("tools/list");
    if (!isRecord(result) || !Array.isArray(result["tools"])) return [];
    return result["tools"].flatMap((tool: unknown) =>
      isRecord(tool) && typeof tool["name"] === "string" ? [tool["name"]] : [],
    );
  }

  async call(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutcome> {
    try {
      const result = await this.request("tools/call", {
        name,
        arguments: args,
      });
      const text = toolText(result);
      if (isRecord(result) && result["isError"] === true) {
        return { ok: false, error: text || "tool error" };
      }
      const structured = isRecord(result)
        ? result["structuredContent"]
        : undefined;
      if (structured !== undefined) return { ok: true, data: structured };
      try {
        return { ok: true, data: text ? JSON.parse(text) : null };
      } catch {
        return { ok: true, data: text };
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
