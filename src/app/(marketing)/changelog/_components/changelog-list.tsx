import { fetchQuery } from "convex/nextjs";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { api } from "../../../../../convex/_generated/api";

/**
 * Server-only changelog list. Fetched with `fetchQuery` so the result
 * lands inside the PPR dynamic Suspense boundary — Next streams it into
 * the prerendered shell once Convex responds.
 *
 * `await` here is what makes the parent Suspense fall back; do NOT
 * convert to client-side `useQuery` or PPR loses its benefit and the
 * marketing page falls back to plain SSR.
 */
export async function ChangelogList() {
  const entries = await fetchQuery(api.cms.changelog.listPublished, {});

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/15 p-12 text-center">
        <p className="text-sm text-foreground/60">
          No releases yet — check back soon.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-20 border-l border-foreground/10 pl-8">
      {entries.map((entry) => (
        <li key={entry._id} className="relative">
          {/* Timeline dot — anchored to the heading row */}
          <span className="absolute -left-[34px] top-2 size-3 rounded-full border-2 border-background bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]" />

          {/* Meta — date, version, build */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px]">
            <time
              dateTime={new Date(entry.publishedAt ?? 0).toISOString()}
              className="font-mono text-foreground/55"
            >
              {new Date(entry.publishedAt ?? 0).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              v{entry.version}
            </span>
            <span className="font-mono text-[11px] text-foreground/40">
              build {entry.build}
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {entry.title}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/65 dark:text-foreground/55">
            {entry.description}
          </p>

          <article className="prose prose-neutral dark:prose-invert mt-6 max-w-none prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-[1.7] prose-p:text-foreground/85 prose-li:leading-[1.7] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-strong:text-foreground prose-strong:font-semibold">
            <ChangelogMarkdown content={entry.content} />
          </article>
        </li>
      ))}
    </ol>
  );
}
