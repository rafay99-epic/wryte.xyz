import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ChangelogEntry = {
  slug: string;
  title: string;
  publishedAt: number;
  category: "website" | "desktop";
  build: string;
  version?: string;
  description: string;
  content: string;
};

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
