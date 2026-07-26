"use client";

import { Button, buttonVariants } from "@wryte/ui/button";
import { InfoHint } from "@wryte/ui/info-hint";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wryte/ui/tooltip";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ClaudeMark,
  CodexMark,
  CursorMark,
  GenericMcpMark,
} from "../branding/tool-logos";

type McpClientSetupProps = {
  endpoint: string | null;
  compact?: boolean;
};

type ToolMark = (props: { className?: string }) => React.ReactNode;

export function CopyIconButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-foreground/60 hover:text-primary dark:text-foreground/70"
            aria-label={label}
            onClick={() => {
              void navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          />
        }
      >
        {copied ? <Check className="text-emerald-500" /> : <Copy />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
    </Tooltip>
  );
}

function OpenLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={href}
            className={buttonVariants({
              variant: "ghost",
              size: "icon-sm",
              className: "text-primary hover:text-primary/80",
            })}
            aria-label={label}
          >
            <ExternalLink />
            <span className="sr-only">{label}</span>
          </a>
        }
      ></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function cursorInstallUrl(endpoint: string): string {
  const config = btoa(JSON.stringify({ url: endpoint }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=wryte&config=${encodeURIComponent(config)}`;
}

function ClientRow({
  label,
  detail,
  Mark,
  value,
  copyLabel,
  hint,
  openUrl,
  openLabel,
}: {
  label: string;
  detail: string;
  Mark: ToolMark;
  value: string;
  copyLabel: string;
  hint: string;
  openUrl?: string | undefined;
  openLabel?: string | undefined;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3.5 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card">
        <Mark className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{label}</p>
          <InfoHint>{hint}</InfoHint>
        </div>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <CopyIconButton value={value} label={copyLabel} />
        {openUrl && openLabel && (
          <OpenLinkButton href={openUrl} label={openLabel} />
        )}
      </div>
    </div>
  );
}

function ClientGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="border-b bg-muted/20 px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {title}
      </p>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

export function McpClientSetup({
  endpoint,
  compact = false,
}: McpClientSetupProps) {
  const displayEndpoint =
    endpoint ?? "https://<your-deployment>.convex.site/mcp";
  const cursorUrl = useMemo(
    () => (endpoint ? cursorInstallUrl(endpoint) : undefined),
    [endpoint],
  );

  return (
    <TooltipProvider>
      <section
        className={
          compact
            ? "overflow-hidden rounded-xl border bg-card/30"
            : "overflow-hidden rounded-xl border bg-card/50"
        }
        aria-labelledby="mcp-client-setup-title"
      >
        <div className="flex items-center gap-2.5 border-b px-3.5 py-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 id="mcp-client-setup-title" className="text-sm font-medium">
                Quick setup
              </h3>
              <InfoHint>
                Copy the command or endpoint for your tool. After you add Wryte,
                the tool opens a browser so you can sign in and approve access.
              </InfoHint>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Choose where you write code.
            </p>
          </div>
        </div>

        <ClientGroup title="Desktop apps">
          <ClientRow
            label="Claude Desktop"
            detail="Remote connector"
            Mark={ClaudeMark}
            value={displayEndpoint}
            copyLabel="Copy Claude Desktop endpoint"
            hint="Open Claude Desktop → Settings → Connectors → Add custom connector, then paste this endpoint."
            openUrl="https://claude.ai/settings/connectors"
            openLabel="Open Claude connectors"
          />
          <ClientRow
            label="Codex Desktop"
            detail="Shared config"
            Mark={CodexMark}
            value={`codex mcp add wryte --url ${displayEndpoint}`}
            copyLabel="Copy Codex Desktop command"
            hint="Codex Desktop reads the same MCP configuration as Codex CLI. Run this command once in a terminal."
          />
          <ClientRow
            label="Cursor"
            detail={endpoint ? "Install or copy config" : "MCP config"}
            Mark={CursorMark}
            value={JSON.stringify({
              mcpServers: { wryte: { url: displayEndpoint } },
            })}
            copyLabel="Copy Cursor MCP config"
            hint="Use the open button for one-click setup, or copy the JSON into Cursor's MCP settings."
            openUrl={cursorUrl}
            openLabel="Add Wryte to Cursor"
          />
        </ClientGroup>

        <ClientGroup title="Command line">
          <ClientRow
            label="Claude Code"
            detail="CLI command"
            Mark={ClaudeMark}
            value={`claude mcp add --transport http wryte ${displayEndpoint}`}
            copyLabel="Copy Claude Code command"
            hint="Paste this command into your terminal, then run /mcp and authenticate Wryte."
          />
          <ClientRow
            label="Codex CLI"
            detail="CLI command"
            Mark={CodexMark}
            value={`codex mcp add wryte --url ${displayEndpoint}`}
            copyLabel="Copy Codex CLI command"
            hint="Paste this command into your terminal. The Wryte server will then appear in Codex."
          />
        </ClientGroup>

        <ClientGroup title="Generic MCP client">
          <ClientRow
            label="Any compatible client"
            detail="Copy the server endpoint"
            Mark={GenericMcpMark}
            value={displayEndpoint}
            copyLabel="Copy generic MCP endpoint"
            hint="Use this endpoint in any client that supports remote MCP over HTTP."
          />
        </ClientGroup>
      </section>
    </TooltipProvider>
  );
}
