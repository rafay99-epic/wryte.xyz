"use client";

import {
  CHATGPT_URL,
  claudeCodeCommand,
  cursorInstallUrl,
  vscodeInstallUrl,
} from "@wryte/logic/lib/mcp-install";
import { Button, buttonVariants } from "@wryte/ui/button";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ClaudeMark,
  CodexMark,
  CursorMark,
  VSCodeMark,
} from "../branding/tool-logos";

type Copyable = "claude" | "chatgpt";

export function McpInstallButtons({ endpoint }: { endpoint: string | null }) {
  const [copied, setCopied] = useState<Copyable | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  if (!endpoint) return null;

  const copy = async (which: Copyable, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(which);
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopied(null), 1500);
  };

  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex flex-wrap gap-2 border-b px-3.5 py-3">
      <Button
        size="sm"
        onClick={() => void copy("claude", claudeCodeCommand(endpoint))}
        title="Copies the claude mcp add command"
      >
        {copied === "claude" ? <Check /> : <ClaudeMark className="size-4" />}
        {copied === "claude" ? "Command copied" : "Claude Code"}
      </Button>
      <a href={cursorInstallUrl(endpoint)} className={linkClass}>
        <CursorMark className="size-4" />
        Cursor
      </a>
      <a href={vscodeInstallUrl(endpoint)} className={linkClass}>
        <VSCodeMark className="size-4" />
        VS Code
      </a>
      <Button
        size="sm"
        variant="outline"
        title="Copies the endpoint and opens ChatGPT"
        onClick={() => {
          void copy("chatgpt", endpoint);
          window.open(CHATGPT_URL, "_blank", "noopener");
        }}
      >
        {copied === "chatgpt" ? <Check /> : <CodexMark className="size-4" />}
        {copied === "chatgpt" ? "Endpoint copied" : "ChatGPT"}
      </Button>
    </div>
  );
}
