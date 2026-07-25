import { cn } from "@wryte/logic/lib/utils";
import { Separator } from "@wryte/ui/separator";
import Link from "next/link";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingNavbar } from "@/components/layout/marketing-navbar";
import { DOC_PAGES, type DocPage } from "../registry";
import { DocsIcon } from "./docs-icon";

/**
 * Chrome shared by the docs index and every doc page.
 *
 * Uses the same visual vocabulary as the rest of the marketing surface: noise
 * texture, ambient amber/purple glow, `MarketingNavbar` / `MarketingFooter`, and
 * amber as the accent — matching the changelog's timeline dots and version pills.
 *
 * A pure server component. The docs ship no JavaScript beyond what the navbar
 * already needs.
 */

/** Sidebar order follows the registry, grouped by its `group` field. */
function groupPages(): { group: DocPage["group"]; pages: DocPage[] }[] {
  const order: DocPage["group"][] = [
    "Getting started",
    "Reference",
    "Operating it",
  ];
  return order
    .map((group) => ({
      group,
      pages: DOC_PAGES.filter((p) => p.group === group),
    }))
    .filter((section) => section.pages.length > 0);
}

function SidebarNav({ activeSlug }: { activeSlug: string | undefined }) {
  return (
    <nav className="space-y-6">
      {groupPages().map((section) => (
        <div key={section.group}>
          <p className="mb-2 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">
            {section.group}
          </p>
          <ul className="space-y-0.5">
            {section.pages.map((page) => {
              const active = page.slug === activeSlug;
              return (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
                        : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground",
                    )}
                  >
                    <DocsIcon
                      icon={page.icon}
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        active
                          ? "text-amber-500"
                          : "text-foreground/35 group-hover:text-foreground/60",
                      )}
                    />
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsShell({
  activeSlug,
  children,
}: {
  activeSlug?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Noise texture — matches the rest of the marketing surface. */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[520px] w-[680px] -translate-x-1/2 rounded-full bg-amber-500/[0.05] blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-[320px] w-[320px] rounded-full bg-purple-500/[0.035] blur-[110px]" />
      </div>

      <div className="relative z-10">
        <MarketingNavbar />

        <div className="mx-auto flex max-w-6xl gap-12 px-6 pt-28 pb-24">
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-28">
              <Link
                href="/docs"
                className="mb-5 flex items-center gap-2 px-3 transition-opacity hover:opacity-80"
              >
                <span className="size-1.5 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" />
                <span className="font-heading text-[13px] font-semibold tracking-tight">
                  MCP Server
                </span>
              </Link>
              <SidebarNav activeSlug={activeSlug} />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {/* Mobile nav — the sidebar is hidden below `lg`. */}
            <div className="mb-8 lg:hidden">
              <div className="flex flex-wrap gap-1.5">
                {DOC_PAGES.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/docs/${page.slug}`}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                      page.slug === activeSlug
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "text-foreground/55 hover:bg-foreground/[0.05] hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                ))}
              </div>
              <Separator className="mt-6 bg-foreground/10" />
            </div>

            {children}
          </main>
        </div>

        <MarketingFooter />
      </div>
    </div>
  );
}
