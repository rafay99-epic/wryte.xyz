"use client";

import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Loader2,
  Send,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AgentEvent,
  type HarnessInfo,
  useDesktopAgents,
} from "./desktop-agents";
import { useAgentTools } from "./use-agent-tools";

type Turn = {
  id: number;
  prompt: string;
  assistant: string;
  reasoning: string;
  /** What the agent actually did to the app, in order. */
  actions: string[];
  running: boolean;
  error: string | null;
};

/** Tool names the user shouldn't have to read as `mcp__wryte__add_research`. */
const ACTION_LABELS: Record<string, string> = {
  mcp__wryte__get_document: "Read your document",
  mcp__wryte__update_document: "Edited your document",
  mcp__wryte__create_draft: "Created a draft",
  mcp__wryte__add_research: "Filed research",
  mcp__wryte__search_documents: "Searched your writing",
  WebSearch: "Searched the web",
  WebFetch: "Read a page",
};

/**
 * Agent session panel. Rendered only inside the desktop shell — the web app
 * mounts this behind a `window.wryteDesktop.agents` check, so a browser tab
 * never loads it.
 *
 * ponytail: single session per document, no persistence across reloads.
 * Both are deliberate for the first pass — add a session list once there is
 * evidence anyone wants two at once.
 */
export function AgentPanel({
  documentId,
}: {
  documentId?: string | undefined;
}) {
  const agents = useDesktopAgents();
  const [open, setOpen] = useState(false);
  const [harnesses, setHarnesses] = useState<HarnessInfo[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [showReasoning, setShowReasoning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(0);

  const running = turns.some((turn) => turn.running);

  // Tool calls arrive from main and execute here, against Convex.
  useAgentTools({
    documentId,
    onToolResult: (_name, summary) => {
      setTurns((current) => {
        const index = current.findIndex((turn) => turn.running);
        const turn = index === -1 ? undefined : current[index];
        if (!turn) return current;
        const next = [...current];
        next[index] = { ...turn, actions: [...turn.actions, summary] };
        return next;
      });
    },
  });

  useEffect(() => {
    if (!agents || !open || harnesses) return;
    void agents.probe().then(setHarnesses);
  }, [agents, open, harnesses]);

  // Append streamed deltas onto the turn that is currently running.
  useEffect(() => {
    if (!agents) return;
    return agents.onEvent((event: AgentEvent) => {
      setTurns((current) => {
        const index = current.findIndex((turn) => turn.running);
        if (index === -1) return current;
        const turn = current[index];
        if (!turn) return current;

        const next = [...current];
        switch (event.type) {
          case "text.delta":
            next[index] =
              event.kind === "assistant"
                ? { ...turn, assistant: turn.assistant + event.text }
                : { ...turn, reasoning: turn.reasoning + event.text };
            break;
          case "tool.started": {
            // Wryte tools report their own outcome via onToolResult, which is
            // more specific than the bare name. Only label the rest.
            if (event.name.startsWith("mcp__wryte__")) return current;
            const label = ACTION_LABELS[event.name] ?? event.name;
            next[index] = { ...turn, actions: [...turn.actions, label] };
            break;
          }
          case "turn.completed":
            next[index] = {
              ...turn,
              running: false,
              assistant:
                turn.assistant || (event.error ? "" : (event.text ?? "")),
              error: event.error ? "The turn ended with an error" : null,
            };
            break;
          case "error":
            next[index] = { ...turn, running: false, error: event.message };
            break;
          default:
            return current;
        }
        return next;
      });
    });
  }, [agents]);

  // Scroll on every append. `turns` is the trigger, not a value read here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only dep
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!agents || !prompt || running) return;

    let id = sessionId;
    if (!id) {
      const started = await agents.start(documentId ?? "draft");
      id = started.sessionId;
      setSessionId(id);
    }

    setInput("");
    setTurns((current) => [
      ...current,
      {
        id: nextTurnId.current++,
        prompt,
        assistant: "",
        reasoning: "",
        actions: [],
        running: true,
        error: null,
      },
    ]);

    try {
      await agents.send(id, prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTurns((current) =>
        current.map((turn) =>
          turn.running ? { ...turn, running: false, error: message } : turn,
        ),
      );
    }
  }, [agents, input, running, sessionId, documentId]);

  // Not the desktop shell — render nothing at all.
  if (!agents) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Open agent panel"
      >
        <Bot className="size-5" />
      </button>
    );
  }

  const claude = harnesses?.find((harness) => harness.id === "claude");

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-[420px] max-w-full flex-col border-l bg-card shadow-xl">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="size-4 text-primary" />
        <span className="font-medium text-sm">Agent</span>
        {claude?.version && (
          <span className="truncate font-mono text-muted-foreground text-xs">
            {claude.version}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => setOpen(false)}
          aria-label="Close agent panel"
        >
          <X className="size-4" />
        </Button>
      </header>

      {claude && !claude.installed && (
        <p className="border-b bg-destructive/10 px-4 py-3 text-destructive text-sm">
          Claude Code was not found on this machine.
        </p>
      )}

      <div
        ref={scrollRef}
        className="flex-1 space-y-5 overflow-y-auto px-4 py-4"
      >
        {turns.length === 0 && (
          <p className="text-muted-foreground text-sm">
            It can read and edit this document, create drafts, file research
            into the research panel, and search your earlier writing. It cannot
            publish, schedule, commit, or push — those stay yours.
          </p>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-2">
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              {turn.prompt}
            </p>

            {turn.reasoning && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setShowReasoning((value) => !value)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  {showReasoning ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  Thinking
                </button>
                {showReasoning && (
                  <pre className="mt-1 whitespace-pre-wrap border-muted-foreground/20 border-l-2 pl-2 font-sans text-muted-foreground">
                    {turn.reasoning}
                  </pre>
                )}
              </div>
            )}

            {turn.actions.map((action, index) => (
              <p
                key={`${turn.id}-${action}-${index}`}
                className="flex items-center gap-1.5 text-primary text-xs"
              >
                <Wrench className="size-3 shrink-0" />
                {action}
              </p>
            ))}

            {turn.assistant && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {turn.assistant}
              </p>
            )}

            {turn.running && !turn.assistant && (
              <p className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-3.5 animate-spin" />
                Working…
              </p>
            )}

            {turn.error && (
              <p className="text-destructive text-sm">{turn.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send();
              }
            }}
            rows={3}
            placeholder="Ask the agent…  ⌘↵ to send"
            className={cn(
              "flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          {running ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => sessionId && agents.interrupt(sessionId)}
              aria-label="Stop"
            >
              <CircleStop className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={() => void send()}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
