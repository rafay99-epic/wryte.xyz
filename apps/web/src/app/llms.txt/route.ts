import {
  SITE_DESCRIPTION,
  SITE_GITHUB,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@wryte/logic/lib/seo";

/**
 * `/llms.txt` — the short, link-style index defined by https://llmstxt.org
 *
 * Designed to be fetched by LLM crawlers and agentic tools that want a
 * concise map of the site. The long-form companion lives at
 * `/llms-full.txt` and contains the actual content.
 */

export const dynamic = "force-static";

const BODY = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_TITLE} is a Next.js + Convex web application that gives developers an
editor-first content workflow: capture rough ideas in a markdown/MDX editor,
refine drafts with AI assistance, and publish straight to a GitHub repository
on a schedule of your choosing.

## Core pages

- [Home](${SITE_URL}/): Product overview, features, and call-to-action.
- [Privacy policy](${SITE_URL}/privacy): How we collect, use, and protect data.
- [Terms of service](${SITE_URL}/terms): Service terms and conditions.

## Discovery

- [Sitemap](${SITE_URL}/sitemap.xml): All public, indexable URLs.
- [RSS feed](${SITE_URL}/rss.xml): Product updates and changelog entries.
- [Full content for LLMs](${SITE_URL}/llms-full.txt): Long-form site context.

## Source

- [GitHub repository](${SITE_GITHUB}): Issues, discussions, and source code.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
