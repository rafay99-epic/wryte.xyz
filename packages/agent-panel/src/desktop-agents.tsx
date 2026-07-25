"use client";

import { useEffect, useState } from "react";

/** Normalized event stream produced by the desktop harness layer. */
export type AgentEvent =
  | { type: "session.ready"; sessionId: string }
  | { type: "turn.started"; sessionId: string }
  | {
      type: "text.delta";
      sessionId: string;
      kind: "assistant" | "reasoning";
      text: string;
    }
  | { type: "tool.started"; sessionId: string; name: string; id: string }
  | {
      type: "turn.completed";
      sessionId: string;
      error: boolean;
      text: string | null;
      durationMs: number | null;
    }
  | { type: "error"; sessionId: string; message: string };

export type HarnessInfo = {
  id: string;
  installed: boolean;
  path: string | null;
  version: string | null;
};

export type DesktopAgents = {
  probe: () => Promise<HarnessInfo[]>;
  start: (label: string) => Promise<{ sessionId: string; cwd: string }>;
  send: (sessionId: string, prompt: string) => Promise<boolean>;
  interrupt: (sessionId: string) => void;
  stop: (sessionId: string) => void;
  onEvent: (cb: (event: AgentEvent) => void) => () => void;
  onToolCall?: (
    run: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ) => () => void;
};

/**
 * The full preload bridge contract. This is the single declaration of
 * `window.wryteDesktop` — it mirrors `apps/desktop/src/window/preload.cjs`, and
 * anything in the web app that reads the bridge gets its types from here.
 */
export type WryteDesktopBridge = {
  isDesktop: boolean;
  platform: string;
  isMac: boolean;
  online: boolean | null;
  onOnlineStatusChange: (cb: (online: boolean) => void) => () => void;
  submitTask: (
    task: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  getWorkerStatus: () => Promise<{
    connectivity: number | null;
    task: number | null;
  }>;
  agents?: DesktopAgents;
};

declare global {
  interface Window {
    wryteDesktop?: WryteDesktopBridge;
  }
}

/**
 * The desktop agent bridge, or null everywhere else.
 *
 * Resolved after mount rather than during render: the preload script defines
 * the bridge before first paint, but reading `window` during render would
 * desync server and client HTML on the web build.
 */
export function useDesktopAgents(): DesktopAgents | null {
  const [agents, setAgents] = useState<DesktopAgents | null>(null);

  useEffect(() => {
    setAgents(window.wryteDesktop?.agents ?? null);
  }, []);

  return agents;
}
