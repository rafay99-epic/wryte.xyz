"use client";

import {
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { Button } from "@wryte/ui/button";
import { InfoHint } from "@wryte/ui/info-hint";
import { Skeleton } from "@wryte/ui/skeleton";
import { Switch } from "@wryte/ui/switch";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Image,
  Loader2,
  LockKeyhole,
  PenLine,
  Plug,
  Send,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  CopyIconButton,
  McpClientSetup,
} from "@/components/mcp/mcp-client-setup";
import { useMcpTab } from "../hooks/use-mcp-tab";
import { resolveMcpEndpoint } from "../lib/mcp-endpoint";
import { Divider, SectionHeader } from "./shared";

type Capability = {
  scope: string;
  label: string;
  description: string;
  icon: React.ElementType;
  optional?: boolean;
};

const CAPABILITIES: Capability[] = [
  {
    scope: "wryte:read",
    label: "Read",
    description: "Projects, documents, research, calendar and stats.",
    icon: Terminal,
  },
  {
    scope: "wryte:write",
    label: "Write",
    description: "Create and edit documents and research notes.",
    icon: PenLine,
  },
  {
    scope: "wryte:publish",
    label: "Publish",
    description: "Commit to GitHub and schedule or cancel publishing.",
    icon: Send,
    optional: true,
  },
  {
    scope: "wryte:media",
    label: "Media",
    description: "Upload and list media through your storage provider.",
    icon: Image,
    optional: true,
  },
  {
    scope: "wryte:trash",
    label: "Trash",
    description: "Move documents to recoverable project trash.",
    icon: Trash2,
    optional: true,
  },
];

function EndpointPanel({ url }: { url: string }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
          <Plug className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium">Your Wryte endpoint</h3>
            <InfoHint>
              This is the address your coding tool uses to connect to Wryte.
              Keep the trailing path exactly as shown.
            </InfoHint>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Copy it once, then choose your tool below.
          </p>
        </div>
        <CopyIconButton value={url} label="Copy endpoint URL" />
      </div>
      <code className="mt-3 block truncate rounded-lg border bg-background/70 px-3 py-2 font-mono text-xs text-muted-foreground">
        {url}
      </code>
    </div>
  );
}

function CapabilityRow({
  capability,
  enabled,
  isSaving,
  onToggle,
}: {
  capability: Capability;
  enabled: boolean;
  isSaving: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const Icon = capability.icon;

  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{capability.label}</p>
          <InfoHint>{capability.description}</InfoHint>
          {capability.optional && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              Optional
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {enabled ? "Enabled" : "Disabled"}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={isSaving}
        aria-label={`${capability.label} capability`}
      />
    </div>
  );
}

export function McpTab() {
  const { draft, isLoading, isDirty, isSaving, toggle, save } = useMcpTab();
  const endpoint = resolveMcpEndpoint();

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-5"
    >
      <SectionHeader
        icon={Plug}
        title="MCP Server"
        description="Connect your writing tool to Wryte"
      />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        {endpoint ? (
          <div className="space-y-3">
            <EndpointPanel url={endpoint} />
            <McpClientSetup endpoint={endpoint} compact />
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Endpoint unavailable
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Set the public Convex site URL in this deployment&apos;s
                environment.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <Divider />

      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold tracking-tight">Permissions</h3>
          <InfoHint>
            These permissions apply to every tool connected to your Wryte
            account. Read and write are the usual starting point; publishing,
            media and trash are optional.
          </InfoHint>
        </div>

        {isLoading ? (
          <div className="space-y-1.5">
            {CAPABILITIES.slice(0, 3).map((capability) => (
              <Skeleton
                key={capability.scope}
                className="h-14 w-full rounded-lg"
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-card/30">
            {CAPABILITIES.map((capability) => (
              <CapabilityRow
                key={capability.scope}
                capability={capability}
                enabled={draft.includes(capability.scope)}
                isSaving={isSaving}
                onToggle={(enabled) => toggle(capability.scope, enabled)}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed bg-muted/20 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Changes apply on the next tool call. Revoke a single client in
              your Clerk dashboard.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!isDirty || isSaving}
          >
            {isSaving && (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            )}
            Save permissions
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
