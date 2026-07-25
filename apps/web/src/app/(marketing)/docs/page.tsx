import { Badge } from "@wryte/ui/badge";
import { Card, CardDescription, CardTitle } from "@wryte/ui/card";
import { ArrowRight, Plug, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocsIcon } from "@/features/docs/components/docs-icon";
import { DocsShell } from "@/features/docs/components/docs-shell";
import { DOC_PAGES } from "@/features/docs/registry";

export const metadata: Metadata = {
  title: "MCP Server Docs",
  description:
    "Documentation for Wryte's MCP server: authentication, capabilities, every tool, rate limits and troubleshooting.",
};

/** The three-step path from nothing to a working agent. */
const STEPS = [
  {
    title: "Sign in once",
    body: "Your account is created on first web sign-in. Agents are matched to it.",
  },
  {
    title: "Add the endpoint",
    body: "One command. Copy the exact URL from Settings → MCP Server.",
  },
  {
    title: "Authorize in the browser",
    body: "Run /mcp, choose Authenticate, approve. No token is ever stored.",
  },
];

export default function DocsIndexPage() {
  return (
    <DocsShell>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/[0.07]">
          <Plug className="size-5 text-amber-500" />
        </div>

        <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
          Documentation
        </p>

        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-foreground">MCP </span>
          <span className="bg-gradient-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent">
            Server
          </span>
        </h1>

        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/55">
          Connect a coding agent to Wryte over the Model Context Protocol. It
          can read your posts, research a topic, file what it finds, draft,
          schedule and publish — working as you, over OAuth, with no API token
          anywhere.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px]">
            21 tools
          </Badge>
          <Badge variant="outline" className="font-mono text-[11px]">
            OAuth 2.1 + PKCE
          </Badge>
          <Badge variant="outline" className="font-mono text-[11px]">
            No API tokens
          </Badge>
        </div>
      </div>

      {/* ── Quickstart ────────────────────────────────────────────── */}
      <Card className="mb-12 gap-0 bg-card/50 py-0 ring-foreground/[0.08]">
        <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-5 py-3.5">
          <Sparkles className="size-3.5 text-amber-500" />
          <p className="font-heading text-[13px] font-semibold tracking-tight">
            Quickstart
          </p>
        </div>

        <div className="grid gap-0 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="border-b border-foreground/[0.07] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span className="mb-2 flex size-5 items-center justify-center rounded-full bg-amber-500/15 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                {i + 1}
              </span>
              <p className="text-[13px] font-medium">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/55">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-foreground/[0.07] bg-foreground/[0.02] px-5 py-4">
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-foreground/70">
            <span className="text-amber-600 dark:text-amber-400">$</span> claude
            mcp add --transport http wryte{" "}
            <span className="text-foreground/45">
              https://&lt;your-deployment&gt;.convex.site/mcp
            </span>
          </pre>
        </div>
      </Card>

      {/* ── Pages ─────────────────────────────────────────────────── */}
      <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
        All pages
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {DOC_PAGES.map((page) => (
          <Link key={page.slug} href={`/docs/${page.slug}`} className="group">
            <Card
              size="sm"
              className="h-full gap-2 bg-card/40 ring-foreground/[0.08] transition-all group-hover:bg-card/70 group-hover:ring-amber-500/20"
            >
              <div className="flex items-start gap-3 px-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/[0.08] transition-colors group-hover:bg-amber-500/[0.14]">
                  <DocsIcon
                    icon={page.icon}
                    className="size-3.5 text-amber-500"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-[13.5px]">
                      {page.title}
                    </CardTitle>
                    <ArrowRight className="size-3.5 shrink-0 text-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-amber-500" />
                  </div>
                  <CardDescription className="mt-1 text-xs leading-relaxed">
                    {page.description}
                  </CardDescription>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </DocsShell>
  );
}
