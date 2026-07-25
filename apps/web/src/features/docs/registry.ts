import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The docs table of contents.
 *
 * Static on purpose: the ordering, titles and blurbs are editorial decisions, so
 * they live in code rather than being scraped out of frontmatter. The bodies are
 * plain markdown in `src/content/docs/` and are read at build time — no CMS, no
 * database, no client-side fetching.
 *
 * `tools.md` is **generated** from `convex/mcp/tools.ts` so the reference can't
 * drift from the registry. Re-run the generator after changing the catalog.
 */
export type DocPage = {
  slug: string;
  title: string;
  /** Shown on the index cards and as the page subtitle. */
  description: string;
  /** Short eyebrow label grouping pages in the sidebar. */
  group: "Getting started" | "Reference" | "Operating it";
  /** lucide icon name, resolved in `docs-icon.tsx` — the registry stays
   *  server-safe and free of component imports. */
  icon:
    | "rocket"
    | "shield"
    | "toggles"
    | "wrench"
    | "layers"
    | "gauge"
    | "life";
};

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    title: "Overview",
    description:
      "What the MCP server is, the endpoint, and connecting an agent in one command.",
    group: "Getting started",
    icon: "rocket",
  },
  {
    slug: "authentication",
    title: "Authentication",
    description:
      "The OAuth 2.1 flow, why there is no API token, and how to revoke a machine.",
    group: "Getting started",
    icon: "shield",
  },
  {
    slug: "capabilities",
    title: "Capabilities",
    description:
      "The five permissions, what is on by default, and what is never reachable.",
    group: "Getting started",
    icon: "toggles",
  },
  {
    slug: "tools",
    title: "Tool reference",
    description: "Every tool, its arguments, and the capability it requires.",
    group: "Reference",
    icon: "wrench",
  },
  {
    slug: "resources",
    title: "Resources",
    description:
      "Read-only context an agent should load before acting, including the frontmatter contract.",
    group: "Reference",
    icon: "layers",
  },
  {
    slug: "rate-limits",
    title: "Rate limits",
    description:
      "What is enforced, what happens at the ceiling, and how the costs actually break down.",
    group: "Operating it",
    icon: "gauge",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Every error message the server returns and how to fix it.",
    group: "Operating it",
    icon: "life",
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

/**
 * Reads a doc body from disk. Server-only — called from a server component at
 * build time, so the markdown never ships to the browser as data.
 */
export function readDocBody(slug: string): string {
  return readFileSync(
    join(process.cwd(), "src", "content", "docs", `${slug}.md`),
    "utf8",
  );
}

/** Previous/next links so a reader can move through the docs in order. */
export function getDocNeighbours(slug: string): {
  previous: DocPage | undefined;
  next: DocPage | undefined;
} {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  return { previous: DOC_PAGES[i - 1], next: DOC_PAGES[i + 1] };
}
