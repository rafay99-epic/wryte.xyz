import {
  absoluteUrl,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_TITLE,
  SITE_URL,
} from "@wryte/logic/lib/seo";
import { readChangelogEntries } from "@/features/changelog/lib/changelog-entries";

type FeedEntry = {
  slug: string;
  title: string;
  description: string;
  publishedAt: number | undefined;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderItem(entry: FeedEntry): string {
  const link = absoluteUrl(`/changelog`);
  const pubDate = entry.publishedAt
    ? new Date(entry.publishedAt).toUTCString()
    : new Date().toUTCString();

  return [
    "    <item>",
    `      <title>${escapeXml(entry.title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(entry.slug)}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description>${escapeXml(entry.description)}</description>`,
    `      <author>noreply@wryte.xyz (${escapeXml(SITE_AUTHOR)})</author>`,
    "    </item>",
  ].join("\n");
}

export function GET(): Response {
  const entries: FeedEntry[] = readChangelogEntries()
    .slice(0, 50)
    .map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      description: entry.description,
      publishedAt: entry.publishedAt,
    }));

  const latest = entries[0]?.publishedAt;
  const lastBuildDate = latest
    ? new Date(latest).toUTCString()
    : new Date().toUTCString();
  const items = entries.map(renderItem).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>${SITE_LOCALE}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <managingEditor>noreply@wryte.xyz (${escapeXml(SITE_AUTHOR)})</managingEditor>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
