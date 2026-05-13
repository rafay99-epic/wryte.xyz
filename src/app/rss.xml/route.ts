import { FEED_ENTRIES, type FeedEntry } from "@/lib/feed-entries";
import {
  absoluteUrl,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";

/**
 * `/rss.xml` — RSS 2.0 feed of product updates.
 *
 * Entries live in `src/lib/feed-entries.ts`. The generator does not sort,
 * so keep that file newest-first.
 */

export const dynamic = "force-static";

// XML-escape characters that would otherwise produce invalid markup.
// Source values are author-controlled, but feed readers are strict.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderItem(entry: FeedEntry): string {
  const link = absoluteUrl(entry.url);
  return [
    "    <item>",
    `      <title>${escapeXml(entry.title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(entry.id)}</guid>`,
    `      <pubDate>${new Date(entry.date).toUTCString()}</pubDate>`,
    `      <description>${escapeXml(entry.description)}</description>`,
    `      <author>noreply@wryte.xyz (${escapeXml(SITE_AUTHOR)})</author>`,
    "    </item>",
  ].join("\n");
}

export function GET(): Response {
  const latest = FEED_ENTRIES[0]?.date ?? new Date().toISOString();
  const lastBuildDate = new Date(latest).toUTCString();
  const items = FEED_ENTRIES.map(renderItem).join("\n");

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
