import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static changelog source of truth: `src/content/changelog.md`.
 *
 * One markdown file, newest first. Each entry opens with an HTML comment
 * block carrying its metadata, followed by the markdown body rendered on
 * `/changelog`:
 *
 *   <!-- changelog-entry
 *   slug: my-entry
 *   title: My entry
 *   date: 2026-08-25
 *   category: website
 *   build: fefe04b
 *   description: One-line summary used by the RSS feed.
 *   -->
 *   ## What's new
 *   ...
 *
 * `bun run changelog:new` appends entries; this module parses them at
 * build time — the changelog is a file on disk, not database rows, so the
 * page prerenders with no runtime data fetch.
 */

export type ChangelogEntry = {
  slug: string;
  title: string;
  /** Unix ms — parsed from the entry's `date:` line (UTC midnight). */
  publishedAt: number;
  category: "website" | "desktop";
  build: string;
  /** Optional cosmetic milestone label (e.g. "1.6.4"). */
  version?: string;
  description: string;
  content: string;
};

/** Reads and parses every entry from the changelog markdown, newest first. */
export function readChangelogEntries(): ChangelogEntry[] {
  const raw = readFileSync(
    join(process.cwd(), "src", "content", "changelog.md"),
    "utf8",
  );
  const entries: ChangelogEntry[] = [];

  const marker = "<!-- changelog-entry";
  let cursor = raw.indexOf(marker);
  while (cursor !== -1) {
    const metaStart = cursor + marker.length;
    const metaEnd = raw.indexOf("-->", metaStart);
    if (metaEnd === -1) break;

    const meta: Record<string, string> = {};
    for (const line of raw.slice(metaStart, metaEnd).trim().split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }

    const nextMarker = raw.indexOf(marker, metaEnd);
    const content = raw
      .slice(metaEnd + 3, nextMarker === -1 ? raw.length : nextMarker)
      .trim();

    const dateMs = Date.parse(`${meta["date"] ?? ""}T00:00:00Z`);
    entries.push({
      slug: meta["slug"] ?? "",
      title: meta["title"] ?? "",
      publishedAt: Number.isNaN(dateMs) ? 0 : dateMs,
      category: meta["category"] === "desktop" ? "desktop" : "website",
      build: meta["build"] ?? "",
      ...(meta["version"] ? { version: meta["version"] } : {}),
      description: meta["description"] ?? "",
      content,
    });
    cursor = nextMarker;
  }

  return entries;
}
