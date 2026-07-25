import { Card } from "@wryte/ui/card";
import { Separator } from "@wryte/ui/separator";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { DocsIcon } from "@/features/docs/components/docs-icon";
import { DocsShell } from "@/features/docs/components/docs-shell";
import {
  DOC_PAGES,
  getDocNeighbours,
  getDocPage,
  readDocBody,
} from "@/features/docs/registry";

/** Every doc page is prerendered — the bodies are files on disk, not data. */
export function generateStaticParams() {
  return DOC_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return { title: "Not found" };
  return {
    title: `${page.title} — MCP Server`,
    description: page.description,
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) notFound();

  // The markdown files open with their own `# Heading`, so the page header here
  // is the eyebrow + subtitle only — no duplicated title.
  const body = readDocBody(page.slug);
  const { previous, next } = getDocNeighbours(page.slug);

  return (
    <DocsShell activeSlug={page.slug}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
          <Link
            href="/docs"
            className="text-foreground/40 transition-colors hover:text-foreground/70"
          >
            Docs
          </Link>
          <span className="text-foreground/25">/</span>
          <span className="text-amber-600 dark:text-amber-400">
            {page.group}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.07]">
            <DocsIcon icon={page.icon} className="size-4 text-amber-500" />
          </span>
          <p className="max-w-2xl pt-1.5 text-[15px] leading-relaxed text-foreground/60 dark:text-foreground/50">
            {page.description}
          </p>
        </div>
      </div>

      <Separator className="mb-8 bg-foreground/[0.08]" />

      {/* Prose classes mirror the changelog's article styling so markdown reads
          identically across the marketing surface. */}
      <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mb-3 prose-h1:text-[28px] prose-h2:mt-12 prose-h2:mb-3 prose-h2:text-lg prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-[15px] prose-p:leading-[1.75] prose-p:text-foreground/80 prose-a:font-medium prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-amber-400 prose-blockquote:border-l-amber-500/40 prose-blockquote:text-foreground/65 prose-strong:font-semibold prose-strong:text-foreground prose-code:rounded prose-code:bg-foreground/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-foreground/[0.08] prose-pre:bg-foreground/[0.03] prose-pre:text-[12.5px] prose-li:leading-[1.75] prose-li:text-foreground/80 prose-table:text-[13px] prose-thead:border-foreground/15 prose-th:font-heading prose-th:font-semibold prose-td:align-top">
        <ChangelogMarkdown content={body} />
      </article>

      {/* ── Prev / next ───────────────────────────────────────────── */}
      <nav className="mt-16 grid gap-2.5 sm:grid-cols-2">
        {previous ? (
          <Link href={`/docs/${previous.slug}`} className="group">
            <Card
              size="sm"
              className="h-full gap-1 bg-card/40 ring-foreground/[0.08] transition-all group-hover:bg-card/70 group-hover:ring-amber-500/20"
            >
              <div className="px-3">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                  <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
                  Previous
                </span>
                <p className="mt-1 truncate text-[13.5px] font-medium">
                  {previous.title}
                </p>
              </div>
            </Card>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}

        {next ? (
          <Link href={`/docs/${next.slug}`} className="group">
            <Card
              size="sm"
              className="h-full gap-1 bg-card/40 ring-foreground/[0.08] transition-all group-hover:bg-card/70 group-hover:ring-amber-500/20"
            >
              <div className="px-3 text-right">
                <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                  Next
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
                <p className="mt-1 truncate text-[13.5px] font-medium">
                  {next.title}
                </p>
              </div>
            </Card>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
      </nav>
    </DocsShell>
  );
}
