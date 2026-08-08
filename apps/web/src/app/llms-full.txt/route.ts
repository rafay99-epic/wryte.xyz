import {
  SITE_AUTHOR,
  SITE_AUTHOR_URL,
  SITE_DESCRIPTION,
  SITE_GITHUB,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@wryte/logic/lib/seo";

/**
 * `/llms-full.txt` — long-form, plain-text site context for LLM crawlers.
 *
 * Mirrors the structure of `llms.txt` but inlines the prose so an LLM can
 * answer questions about the product without fetching every page.
 */

const BODY = `# ${SITE_TITLE}

${SITE_DESCRIPTION}

Maintained by ${SITE_AUTHOR} (${SITE_AUTHOR_URL}).
Source: ${SITE_GITHUB}
Canonical URL: ${SITE_URL}

---

## What ${SITE_NAME} is

${SITE_NAME} is a writing workspace for developers who publish to GitHub. It
combines a markdown/MDX editor with AI-assisted refinement, scheduled
publishing via durable workflows, and a Kanban-style content board. Articles
move through a five-stage pipeline — Draft, Review, Ready, Scheduled,
Published — and ship as clean commits to a configured repository and branch.

## Who it is for

- Developers who write technical blogs, changelogs, or documentation.
- Teams that already store content in Git and want a tool that respects that
  workflow instead of replacing it with a proprietary CMS.
- Writers who want AI assistance without being locked into a single provider:
  ${SITE_NAME} supports Anthropic, OpenAI, and OpenRouter via user-supplied
  API keys (BYOK) stored encrypted in WorkOS Vault.

## Feature summary

Content management:
- Rich Markdown/MDX editor with live preview, frontmatter editing, and
  syntax highlighting.
- Five-stage status pipeline (Draft → Review → Ready → Scheduled → Published).
- Kanban board with drag-and-drop and configurable columns.
- Table view with sorting, filtering, and inline actions.
- Document tagging, bookmarks, duplication, and inline rename.
- Full-text search across titles, slugs, and paths.
- Per-project configurable frontmatter schema with type validation.

Publishing and scheduling:
- One-click publish to GitHub with clean commits and SHA tracking.
- Scheduled publishing backed by durable workflows (3x retry).
- Two-way GitHub sync, batch import of existing markdown files.

Project management:
- Multi-project workspaces with per-project settings.
- 3-step project creation wizard (repo, paths, frontmatter schema).
- Customizable board columns (add, remove, reorder, color-code).

GitHub integration:
- OAuth with private repo access, or manual PAT setup.
- Repository browser, branch picker, remote file management.

Editor experience:
- Focus mode (Esc to exit), auto-save, prev/next navigation,
  inline status selector, breadcrumb navigation.

Dashboard:
- Status overview, recent activity, project quick access, command palette,
  configurable keyboard shortcuts.

Authentication and security:
- Clerk authentication with multiple providers.
- Per-user GitHub OAuth scopes.
- Protected routes via middleware.
- Convex backend secured by Clerk JWT.
- User-supplied AI and media provider keys stored encrypted in WorkOS Vault.

Infrastructure:
- Convex real-time database with optimistic UI.
- Durable workflows for scheduled publishing.
- GitHub Actions CI/CD with automatic Convex deployment.
- Full SEO setup: OpenGraph, Twitter cards, JSON-LD, sitemap, robots.txt,
  RSS feed, PWA manifest, llms.txt.

## Technology stack

- Frontend: Next.js 16 (App Router) + React 19, Tailwind CSS v4, Base UI /
  shadcn-style components, Framer Motion.
- Backend: Convex (queries, mutations, actions, durable workflows).
- Auth: Clerk (JWT bridged to Convex via auth.config.ts).
- Secrets: WorkOS Vault encrypts every user-supplied API key.
- AI: BYOK — Anthropic SDK, OpenAI SDK, OpenRouter.
- Media: BYOK — UploadThing, Cloudinary.
- Tooling: Bun, Biome (lint + format), TypeScript strict.

## Pricing

${SITE_NAME} is free to use. Users supply their own AI and media provider
keys, so they pay those providers directly and ${SITE_NAME} never charges
for AI usage.

## Useful URLs

- Home page: ${SITE_URL}/
- Privacy policy: ${SITE_URL}/privacy
- Terms of service: ${SITE_URL}/terms
- Sitemap: ${SITE_URL}/sitemap.xml
- RSS feed: ${SITE_URL}/rss.xml
- robots.txt: ${SITE_URL}/robots.txt
- llms.txt (short): ${SITE_URL}/llms.txt
- Source code: ${SITE_GITHUB}
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
