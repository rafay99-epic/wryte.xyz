"use client";

import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { Badge } from "@wryte/ui/badge";
import { Button } from "@wryte/ui/button";
import { Skeleton } from "@wryte/ui/skeleton";
import { Switch } from "@wryte/ui/switch";
import { motion } from "framer-motion";
import { AlertTriangle, Check, Copy, Loader2, Plug } from "lucide-react";
import { useState } from "react";
import { useMcpTab } from "../hooks/use-mcp-tab";
import { resolveMcpEndpoint } from "../lib/mcp-endpoint";
import { Divider, SectionHeader } from "./shared";

/**
 * Capabilities an MCP client may be granted.
 *
 * Mirrors `SCOPES` in `convex/mcp/scopes.ts`. Read and write are the default
 * grant — the "read my posts, research this, draft it" workflow needs both, and
 * an agent that stops mid-task for a second approval is worse than one scoped
 * correctly up front. Everything with an effect outside Wryte is opt-in.
 */
const CAPABILITIES: {
  scope: string;
  label: string;
  description: string;
  tone?: "default" | "caution";
}[] = [
  {
    scope: "wryte:read",
    label: "Read",
    description:
      "List and search projects, documents, research, calendar and stats.",
  },
  {
    scope: "wryte:write",
    label: "Write",
    description: "Create and edit documents and research notes.",
  },
  {
    scope: "wryte:publish",
    label: "Publish",
    description:
      "Commit documents to GitHub, and schedule or cancel publishing.",
    tone: "caution",
  },
  {
    scope: "wryte:media",
    label: "Media",
    description:
      "Upload and list media through this project's storage provider.",
    tone: "caution",
  },
  {
    scope: "wryte:trash",
    label: "Trash",
    description:
      "Move documents to the project trash. Recoverable — there is no permanent delete over MCP.",
    tone: "caution",
  },
];

function EndpointRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/60 p-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {url}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function McpTab() {
  const { draft, isLoading, isDirty, isSaving, toggle, save } = useMcpTab();

  const endpoint = resolveMcpEndpoint();

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Plug}
        title="MCP Server"
        description="Let coding agents work in Wryte on your behalf"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        {endpoint ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Add this endpoint to your agent, then authorize it in the browser.
              No token is created or stored anywhere.
            </p>
            <EndpointRow url={endpoint} />
            <pre className="mt-2 overflow-x-auto rounded-lg border bg-muted/30 p-2.5 font-mono text-[11px] text-muted-foreground">
              claude mcp add --transport http wryte {endpoint}
            </pre>
          </>
        ) : (
          /* Better a visible misconfiguration than a blank box or a wrong URL —
             a mistyped endpoint fails OAuth discovery in a confusing way. */
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-xs">
              <p className="font-medium text-foreground">
                Endpoint URL unavailable
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Set{" "}
                <code className="text-[11px]">NEXT_PUBLIC_CONVEX_SITE_URL</code>{" "}
                (or <code className="text-[11px]">NEXT_PUBLIC_CONVEX_URL</code>)
                in this deployment&apos;s environment so the MCP endpoint can be
                resolved.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3">
          <h3 className="text-sm font-semibold tracking-tight">Capabilities</h3>
          <p className="text-xs text-muted-foreground">
            Applies to every agent connected to your account. An agent never
            sees tools it can&apos;t call.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-2">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.scope}
                className="flex items-start gap-3 rounded-lg border bg-card/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cap.label}</p>
                    {cap.tone === "caution" && (
                      <Badge variant="outline" className="text-[10px]">
                        Off by default
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cap.description}
                  </p>
                </div>
                <Switch
                  checked={draft.includes(cap.scope)}
                  onCheckedChange={(on) => toggle(cap.scope, on)}
                  disabled={isSaving}
                  aria-label={cap.label}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Revoke a specific machine from your Clerk dashboard.
          </p>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!isDirty || isSaving}
          >
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            Save capabilities
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
