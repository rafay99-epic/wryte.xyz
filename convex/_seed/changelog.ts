/**
 * ONE-SHOT SEED — delete `convex/_seed/changelog.ts` after running.
 *
 * Backfills the changelog with every release from v0.1.1 through the
 * current version. Triggered from the admin UI (`/admin/seed`) or:
 *
 *   bunx convex run _seed/changelog:seed
 *
 * Gated by `publicMetadata.role === "admin"` (see `convex/_lib/admin.ts`)
 * and rate-limited so accidental loops can't blow up the changelog
 * table. Idempotent: each entry is keyed by slug, so re-runs skip
 * already-present rows and report them under `skipped`.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

type SeedEntry = {
  title: string;
  slug: string;
  description: string;
  content: string;
  version: string;
  build: string;
  /** Unix ms — when this version actually shipped. */
  publishedAt: number;
};

/**
 * Every published release, oldest first. Build hashes come from the
 * commit that ships each version; dates from that commit's author
 * timestamp. Edit through the admin UI afterwards if any of this needs
 * to be reworded.
 */
const ENTRIES: SeedEntry[] = [
  {
    title: "Board, settings panel, and command palette",
    slug: "v0-1-1-board-and-command-palette",
    description:
      "First polished iteration after the MVP — drag-and-drop board, settings surface, and the command palette every page now uses.",
    version: "0.1.1",
    build: "9b7074d",
    publishedAt: Date.parse("2026-04-08T02:07:26+05:00"),
    content: `## What's new

- **Kanban board** for moving posts through draft → published columns.
- **Settings panel** for project and account configuration.
- **Command palette** (\`Cmd+K\`) — jump to any document, project, or action.
- **Smarter frontmatter detection** when importing existing posts.

## Fixes

- GitHub sync now correctly handles paths with spaces and unicode.
`,
  },
  {
    title: "Scheduled publishing and AI rewrite",
    slug: "v0-2-0-scheduling-and-ai",
    description:
      "Schedule posts for the future, and pull in AI assistance for rewriting and enhancing your prose without leaving the editor.",
    version: "0.2.0",
    build: "545a551",
    publishedAt: Date.parse("2026-04-09T04:33:16+05:00"),
    content: `## What's new

- **Scheduled publishing** — pick a date/time and Wryte commits to GitHub for you when the moment arrives.
- **AI features** — rewrite, summarise, and expand selections inline using Anthropic models.
- **Settings UI refresh** — clearer sections, less scrolling.

## Fixes

- Action errors no longer swallow stack traces during local dev.
- Biome and dependency versions brought current.
`,
  },
  {
    title: "Dashboard redesign, history, and import improvements",
    slug: "v0-2-1-dashboard-and-history",
    description:
      "New dashboard with better search, document history for every project, and multi-select for bulk GitHub imports.",
    version: "0.2.1",
    build: "61a326d",
    publishedAt: Date.parse("2026-04-09T17:39:47+05:00"),
    content: `## What's new

- **Redesigned dashboard** — quick stats, recent activity, and faster search across every project.
- **Document history** — every save snapshots, so you can scroll back through revisions.
- **Multi-select GitHub import** — pull in a batch of existing posts in one click.
- **Cleaner top nav** with project-aware breadcrumbs.

## Fixes

- Middleware no longer redirects signed-in users away from the landing page.
- Nav bar layout stays stable on narrow viewports.
`,
  },
  {
    title: "File storage and rate limiting",
    slug: "v0-3-0-storage-and-rate-limits",
    description:
      "First-class file storage for media, application-wide rate limiting on every mutation, and a redesigned publish flow.",
    version: "0.3.0",
    build: "3a5a659",
    publishedAt: Date.parse("2026-04-10T19:35:28+05:00"),
    content: `## What's new

- **File storage** via Convex — upload images and assets directly from the editor.
- **Rate limiting** on every mutation across the app, with named buckets per operation so editor auto-save stays snappy while destructive ops are tightly capped.
- **New publish dialog** — preview the rendered frontmatter and commit message before pushing to GitHub.

## Fixes

- Publish race conditions when clicking quickly are now serialized server-side.
`,
  },
  {
    title: "Project favorites",
    slug: "v0-3-1-favorites",
    description:
      "Star your most-used projects to keep them at the top of the sidebar.",
    version: "0.3.1",
    build: "83e2f5f",
    publishedAt: Date.parse("2026-04-11T19:57:08+05:00"),
    content: `## What's new

- **Favorites** — star a project and it floats to the top of the sidebar under a dedicated section.
- Sidebar now shows favorites and the rest of your workspaces separately.
`,
  },
  {
    title: "Per-project media providers and BYOK keys",
    slug: "v0-4-0-providers-and-byok",
    description:
      "Plug your own UploadThing or Cloudinary into each project, bring your own AI provider keys, and reset accounts cleanly via self-destruct.",
    version: "0.4.0",
    build: "4881c67",
    publishedAt: Date.parse("2026-05-13T17:44:50+05:00"),
    content: `## What's new

### Media providers
- **Per-project media storage** — choose between GitHub-committed binaries, UploadThing, or Cloudinary for each project.
- **WorkOS Vault-backed credentials** — provider API keys are encrypted at rest, never round-trip to the client, and rotate with one click.
- Status indicators per credential (active / verifying / invalid / rotating) so misconfigured projects surface immediately.

### AI keys
- **Bring Your Own Key (BYOK)** for Anthropic, OpenAI, and OpenRouter. We never proxy your AI usage — keys go straight to the provider from a Convex action.
- UI gates AI features behind a configured key with a clear "Set up" CTA when missing.

### Account
- **Self-destruct** — reset your entire account (projects, documents, credentials, vault entries) in one confirmed action.
- New product logo assets across the app.
`,
  },
  {
    title: "Image compression, Clerk OAuth, and analytics",
    slug: "v0-4-1-compression-oauth-analytics",
    description:
      "Client-side image compression before upload, server-side Clerk OAuth for GitHub, timezone-aware scheduling, and Vercel Web Analytics.",
    version: "0.4.1",
    build: "e367f99",
    publishedAt: Date.parse("2026-05-13T23:40:43+05:00"),
    content: `## What's new

- **Client-side image compression** before upload — smaller commits, faster Vercel/Netlify builds. Per-project and per-account overrides for compression quality.
- **Server-side Clerk OAuth for GitHub** — scheduled publishes now mint a fresh GitHub token at fire time, so jobs scheduled weeks ahead don't fail on expired sessions.
- **Timezone-aware scheduling** — pick the date in your timezone, store it as UTC, render it in the viewer's timezone.
- **Autosave** for the editor with a manual-save fallback per project preference.
- **Dedicated \`/articles/new\` page** plus a matching in-project dialog for fast capture.
- **Vercel Web Analytics** wired up across the app.

## Fixes

- Dropped the AVIF/WASM codec path that was causing slow Convex round-trips on large images.
- Media library polish — better empty states, fewer redundant Convex calls.
`,
  },
  {
    title: "Domain-organised Convex backend",
    slug: "v0-4-2-backend-refactor",
    description:
      "Convex functions now live under clear domain folders (cms, media, ai, integrations, account) with end-to-end type safety from schema to client.",
    version: "0.4.2",
    build: "97b8664",
    publishedAt: Date.parse("2026-05-14T02:10:30+05:00"),
    content: `## What's new

- **Domain-organised Convex backend** — \`cms/\`, \`media/\`, \`ai/\`, \`integrations/\`, \`account/\`, \`support/\`, \`workflows/\`. Shared helpers live under \`_lib/\` and workpools under \`_pools/\`.
- **End-to-end type safety** — every server function has explicit return types so the client gets full inference without \`any\` leaks.
- CI now triggers a Convex deploy whenever \`package.json\`, \`bun.lock\`, or patches change.

## Fixes

- Persistent-text-streaming cleanup cron throttled from once-a-minute to once-a-day, eliminating an avoidable load spike.
`,
  },
  {
    title: "Front-end refactor, GitHub branch picker, and frontmatter polish",
    slug: "v0-4-3-frontend-refactor-and-frontmatter",
    description:
      "Eight phases of front-end refactoring, a smarter GitHub repo connector with branch picker, and a long list of frontmatter editor improvements.",
    version: "0.4.3",
    build: "184914c",
    publishedAt: Date.parse("2026-05-15T04:40:28+05:00"),
    content: `## What's new

### Front-end refactor
- Eight-phase refactor across types, shared primitives, hooks (\`use-bulk-import\`, \`use-bulk-delete\`, \`use-pending-deletes\`), feature folders, page thinning, layout, and marketing — pages are now thin wrappers around feature modules.

### GitHub integration
- **Branch picker** with auto-detection when connecting a repo.
- **Write-failure diagnostics** that tell you exactly which scope is missing on your token.

### Project settings
- New \`defaultAuthorAvatar\` setting injected into frontmatter for new posts.
- Custom commit message templates, filename patterns, and default draft state per project.

### Frontmatter editor
- **Pretty labels** with smart capitalisation.
- **Chip input** for array fields (tags, categories).
- **Auto-injection** of \`pubDate\` and \`draft\` flag using your project's frontmatter schema.
- **Image-name fallback** when no alt text is provided.
- **Visual density pass** — bigger labels, fewer columns, more spacing.

### Schema editor
- **YAML mode** that mirrors the exact frontmatter format your posts will render with.
- **Clear default values** button for projects whose schema picked up sampled values during detection.

## Fixes

- Author defaults pull from project config instead of leaking per-post values into the schema.
- Frontmatter detection stops copying sampled post values into schema defaults.
- \`inferFieldType\` now prefers image-name hints over URL-based detection.
- Sidebar **Back button** in the editor steps editor → project → dashboard (matches mental model).
- Scheduling: guarded against an \`onComplete\` race when cancelling a scheduled publish.
`,
  },
  {
    title: "AI schema-aware suggestions and sync conflict resolution",
    slug: "v0-4-4-ai-schema-and-sync",
    description:
      "AI frontmatter suggestions respect your project schema, and bulk imports now detect and resolve sync conflicts before overwriting work.",
    version: "0.4.4",
    build: "c9ec78b",
    publishedAt: Date.parse("2026-05-15T23:37:25+05:00"),
    content: `## What's new

### AI
- **Schema-driven frontmatter suggestions** — the AI assistant respects each project's frontmatter schema and skips fields it shouldn't touch (images, dates, draft flag).

### Sync & lifecycle
- **Diff-before-enqueue** — bulk imports skip files that haven't changed in GitHub since the last sync, cutting noise.
- **Sync conflict UI** — when GitHub and Convex have both edited a file since the last sync, we surface a three-way resolver (use GitHub / keep Convex / merge).
- **Soft-delete trash** — deleted documents linger in a per-project trash with configurable retention, instead of vanishing forever.
`,
  },
  {
    title: "Production hardening, support tickets, and marketing surface",
    slug: "v0-5-0-production-and-marketing",
    description:
      "Production-readiness hardening, end-to-end support tickets, fresh marketing pages, and a long list of editor + board improvements.",
    version: "0.5.0",
    build: "e12803e",
    publishedAt: Date.parse("2026-05-16T03:02:45+05:00"),
    content: `## What's new

### Production hardening
- Every query is now bounded (\`take(n)\` or paginate, no naked \`collect()\`).
- Denormalized counters where read-amplification was hurting (document counts per project, vote counts, etc.).
- Stricter input validation across every mutation, plus consistent error envelopes the client can render as friendly toasts.

### Support
- **Support tickets** end-to-end — submit from the dashboard or the marketing contact form, with a normalized status workflow (\`open → in_progress → resolved → closed\`).

### Marketing
- **Contact page** for anonymous outreach.
- **How it works** page walks through the editor → publish loop.
- **Landing polish** — typography, spacing, animation tightening across every section.
- **Footer credits** with live version, build hash, and company attribution.

### Editor & board
- Refactored board hooks to fix drag, hover, and checkbox edge cases.
- Dependencies upgraded across the stack.
`,
  },
  {
    title: "Open source under MIT",
    slug: "v0-5-1-open-source",
    description:
      "Wryte is now open source under MIT. New README, contributing guide, OG image, and a polished marketing surface.",
    version: "0.5.1",
    build: "2b7b7af",
    publishedAt: Date.parse("2026-05-16T03:27:04+05:00"),
    content: `## What's new

- **Open sourced under MIT** — the full Wryte codebase is now public.
- **New README + contributing guide** so newcomers can get a local dev environment running quickly.
- **OG image refresh** — link previews on social platforms now show the new brand artwork.

## Fixes

- Twitter image route defines its runtime directly instead of re-exporting it, removing a Next.js build warning.
`,
  },
  {
    title: "Public changelog and admin authoring",
    slug: "v0-5-2-changelog-admin",
    description:
      "A public changelog page powered by an admin-only authoring surface, with markdown rendering and role-gated access via Clerk.",
    version: "0.5.2",
    build: "73",
    publishedAt: Date.parse("2026-05-16T15:00:00+05:00"),
    content: `## What's new

- **Public changelog** at \`/changelog\` — ISR-cached at the CDN, regenerated every 60s, with sanitised markdown rendering.
- **Admin authoring** under \`/admin/changelog\` — list view, dedicated create page, and per-entry edit page, all gated by Clerk's \`publicMetadata.role === "admin"\`.
- **Admin sidebar section** that only appears for admin users, with quick links to list, create, and manage.
- **Draft vs published** lifecycle — entries stay hidden until you check the publish box.
- Slugs auto-derive from titles but are editable; unique-slug enforcement at the database level.
`,
  },
  {
    title: "Feature request board and production readiness",
    slug: "v0-5-3-feature-requests-and-hardening",
    description:
      "A public feature request board with Clerk-gated upvoting, admin moderation, and a final round of refactor work to bring the new admin surface up to the rest of the codebase.",
    version: "0.5.3",
    build: "73",
    publishedAt: Date.parse("2026-05-16T18:00:00+05:00"),
    content: `## What's new

### Public feature requests
- **Board at \`/feature-requests\`** — status-filter tabs (All / Open / Planned / In progress / Shipped), submission dialog, and a chunky upvote button per card.
- **Auth-gated submission and voting** — signed-in users only, so we can track votes per user and prevent double-voting.
- **Live updates** via Convex subscriptions — vote counts shift in real time as others vote.

### Admin moderation
- **Status moderation** — admins flip each request through its lifecycle from a dropdown that updates optimistically.
- **Delete with cascade** — removing a request also cleans up its upvote rows.

### Seeding from the UI
- **Seed admin page** (\`/admin/seed\`) — one-click buttons run the changelog and feature-request seeds without dropping to the CLI. Rate-limited and admin-gated.

### Production hardening
- **Shared admin gate** — \`convex/_lib/admin.ts\` replaces four copies of the same role-check helper.
- **Rate limits** for every new admin and public mutation, registered in \`_lib/rateLimits.ts\` alongside the rest.
- **Convex folder structure** — feature requests live under \`support/\` (alongside support tickets), and one-shot seed scripts moved to \`convex/_seed/\` to match the existing underscore-prefixed special folders.
`,
  },
];

export const seed = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ inserted: number; skipped: number; details: string[] }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });

    const clerkUserId = await requireAdmin(ctx);
    return await ctx.runMutation(internal._seed.changelog._seedInternal, {
      authorClerkUserId: clerkUserId,
      entries: ENTRIES,
    });
  },
});

export const _seedInternal = internalMutation({
  args: {
    authorClerkUserId: v.string(),
    entries: v.array(
      v.object({
        title: v.string(),
        slug: v.string(),
        description: v.string(),
        content: v.string(),
        version: v.string(),
        build: v.string(),
        publishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("changelog")
        .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
        .unique();

      if (existing) {
        skipped += 1;
        details.push(`skipped (already exists): ${entry.slug}`);
        continue;
      }

      const now = Date.now();
      await ctx.db.insert("changelog", {
        title: entry.title,
        slug: entry.slug,
        description: entry.description,
        content: entry.content,
        version: entry.version,
        build: entry.build,
        publishedAt: entry.publishedAt,
        authorClerkUserId: args.authorClerkUserId,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
      details.push(`inserted: ${entry.slug}`);
    }

    return { inserted, skipped, details };
  },
});
