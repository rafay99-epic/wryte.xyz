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
  {
    title: "Drafts as editor tabs, research panel, and hook colocation",
    slug: "v0-6-0-drafts-tabs-and-research-panel",
    description:
      "Open multiple drafts as tabs in the editor with a built-in research panel, surface AI errors inline, and a structural refactor that colocates hooks with the features that own them.",
    version: "0.6.0",
    build: "0d507b9",
    publishedAt: Date.parse("2026-05-19T22:00:00+05:00"),
    content: `## What's new

### Editor
- **Drafts as tabs** — open multiple drafts side-by-side in the editor with a tab bar instead of swapping documents one at a time.
- **Research panel** — a dockable panel for quick lookups while you write, so reference material stays one click away.
- **Inline AI error messages** — failures from AI features surface in-place in the editor instead of disappearing into the console.

### Dashboard
- **Shared tag colors** — board cards, table rows, and the tag editor popover all pull from the same palette, so a tag looks identical everywhere.

## Fixes

- Blog editor resolves media paths correctly when posts reference assets outside the default folder.
- Version and build numbers in app footers auto-update from the build environment instead of going stale.
- Board view no longer logs an \`'Escape' is already registered\` warning when its keyboard nav mounts alongside the global app hotkeys.

## Under the hood

- **Hook colocation** — feature-specific hooks now live in \`hooks/\` folders inside their feature directory (\`src/features/editor/hooks/\`, \`src/features/content-dashboard/hooks/\`, \`src/components/layout/hooks/\`). \`src/hooks/\` is reserved for genuinely shared hooks used by multiple unrelated features.
- **Changelog authoring CLI** — \`bun run changelog:new\` walks you through a new entry, auto-fills the build SHA and slug, and bumps \`package.json\` so the next release does not ship with stale version metadata.
`,
  },
  {
    title: "Changelog pagination, footer, and dialog fix",
    slug: "v0-6-1-changelog-pagination-and-dialog-fix",
    description:
      "Paginated changelog on both backend and frontend, added the marketing footer to the changelog page, and fixed text overflow in the new article dialog.",
    version: "0.6.1",
    build: "e6d3814",
    publishedAt: Date.parse("2026-05-19T22:30:00+05:00"),
    content: `## What's new

- **Changelog pagination** — the public changelog page now uses cursor-based pagination via Convex's \`usePaginatedQuery\`, with a "Load older releases" button instead of dumping every entry at once.
- **Changelog footer** — the \`/changelog\` page now includes the same marketing footer (brand, links, version label) used across the rest of the site.
- **Shared marketing footer** — extracted the duplicated footer markup into a reusable \`MarketingFooter\` component in \`src/components/layout/\`.

## Fixes

- **Dialog text overflow** — long slugs and file paths in the "New article" dialog (and the full-page \`/articles/new\` form) now truncate correctly instead of overflowing the container.
`,
  },
  {
    title: "Convex query safety audit",
    slug: "v0-6-2-convex-query-safety-audit",
    description:
      "Replaced every unbounded .collect() across the Convex backend with bounded .take(n) calls to prevent runaway reads as tables grow.",
    version: "0.6.2",
    build: "76b9a1e",
    publishedAt: Date.parse("2026-05-19T23:00:00+05:00"),
    content: `## Under the hood

- **Bounded all database queries** — every \`.collect()\` call across the Convex backend has been replaced with \`.take(n)\` using limits appropriate to each table's expected cardinality. Affected files: \`documents.ts\`, \`projects.ts\`, \`documentDrafts.ts\`, \`documentResearch.ts\`, \`conflicts.ts\`, \`boardColumns.ts\`, \`trash.ts\`, \`scheduling.ts\`, \`credentialsDb.ts\`, and \`selfDestruct.ts\`.
- **No functional changes** — queries return the same results for any realistic dataset; the bounds simply prevent runaway reads if a table grows unexpectedly.
`,
  },
  {
    title: "Editor undo/redo fix",
    slug: "v0-6-3-editor-undo-redo-fix",
    description:
      "Fixed Cmd+Z / Ctrl+Z undo and redo not working in the markdown editor by preserving the browser's native undo stack.",
    version: "0.6.3",
    build: "907c5e5",
    publishedAt: Date.parse("2026-05-19T23:30:00+05:00"),
    content: `## Fixes

- **Undo/redo restored** — \`Cmd+Z\` / \`Ctrl+Z\` and \`Cmd+Shift+Z\` / \`Ctrl+Y\` now work correctly in the editor. The store-to-textarea sync effect was overwriting \`textarea.value\` on every content change, which destroyed the browser's native undo stack. Internal (typed) changes now skip the sync, preserving undo history.
- **\`replaceContent\` preserves undo** — the \`replaceContent\` helper (used by AI features) now uses \`setRangeText\` instead of direct \`.value\` assignment, keeping the undo chain intact after AI rewrites.
`,
  },
  {
    title: "MDX file format support",
    slug: "v0-7-0-mdx-file-format-support",
    description:
      "Projects can now use MDX as their content format — live React component rendering in the editor preview, MDX-aware AI prompts, and correct .mdx extensions in GitHub publishes.",
    version: "0.7.0",
    build: "12c0177",
    publishedAt: Date.parse("2026-05-20T20:00:00+05:00"),
    content: `## What's new

- **MDX content format** — projects can now choose between Markdown (\`.md\`) and MDX (\`.mdx\`) in Content settings. The setting controls file extensions in GitHub publishes, file path previews, and editor behavior.
- **Live React preview** — the MDX editor preview compiles and renders React components in real time. Define components with \`export function\`, use hooks like \`useState\` and \`useEffect\`, and see interactive UI directly in the preview pane.
- **Unknown component placeholders** — JSX tags that reference undefined components render as styled placeholder blocks instead of crashing the preview.
- **MDX-aware AI** — enhancement and final-draft prompts now preserve JSX/MDX syntax when the project uses MDX format.

## Fixes

- **GitHub publish format change** — changing a project's content format no longer causes 422 errors. Old-extension files are cleaned up automatically on publish.
- **Bulk publish orphan cleanup** — switching from \`.md\` to \`.mdx\` (or vice versa) deletes the old-extension file in the same commit.
- **Content Format selector** — fixed dropdown alignment and width in project settings.
`,
  },
  {
    title: "Atomic deploys & version notifications",
    slug: "v0-7-2-atomic-deploys-version-notifications",
    description:
      "Frontend and backend now deploy atomically through Vercel. Connected clients get a real-time toast when a new version is available.",
    version: "0.7.2",
    build: "4166076",
    publishedAt: Date.parse("2026-05-20T21:00:00+05:00"),
    content: `## What's new

- **Atomic FE+BE deploys** — the Vercel build now runs \`convex deploy\` before \`next build\`, so frontend and backend deploy together. Reverting a Vercel deployment rolls back both. The separate \`convex-deploy.yml\` GitHub Action has been retired.
- **Version update notification** — when a new version is deployed, every connected client receives a persistent toast via Convex's real-time websocket (zero polling). Clicking "Update now" refreshes the page to load the latest build.
- **Version stamp** — a post-deploy script writes the current version and build SHA into the \`app_version\` table using \`ConvexHttpClient\`, so the notification system knows what's live.

## Under the hood

- Added \`app_version\` Convex table (singleton row: version, build, deployedAt).
- Added \`stamp-version.ts\` script that runs after \`convex deploy\` during Vercel builds.
- Added \`useVersionCheck\` hook that subscribes to the deployed version and compares against the build-time \`APP_VERSION\`.
- CI now runs \`bunx next build\` directly instead of the deploy-aware build command.
`,
  },
  {
    title: "Per-project AI prompt templates",
    slug: "v0-7-3-ai-prompt-templates",
    description:
      "Save reusable AI prompts per project and one-click apply them. All AI flows — enhance, inline, and final draft — now use customizable system prompts instead of hardcoded ones.",
    version: "0.7.3",
    build: "d2389be",
    publishedAt: Date.parse("2026-05-20T23:00:00+05:00"),
    content: `## What's new

- **AI prompt templates** — save reusable AI instructions per project in Settings → AI Enhancement → Prompt Templates. Templates appear as one-click pills in the inline AI popover (Mod+J) for zero-typing transforms.
- **Customizable system prompts** — the AI Enhancement panel now shows an editable system prompt with template presets. Pick a template or write your own — the AI uses exactly what you give it.
- **All AI flows updated** — enhance, inline transform, and final draft all accept custom system prompts. The hardcoded prompts are now editable defaults that ship with every project.
- **Default templates** — new projects come with six defaults: Enhance, Inline transform, Final draft, Simplify, Make concise, and Fix grammar. All match the previously hardcoded system prompts.
- **MDX-aware custom prompts** — MDX projects automatically get the JSX preservation addendum appended to custom prompts, so components are never mangled.

## Under the hood

- Added \`aiPromptTemplates\` field to projects schema (JSON-stringified array, same pattern as \`boardColumns\`).
- Added \`convex/ai/promptTemplates.ts\` with \`getTemplates\` query and \`addTemplate\`, \`updateTemplates\`, \`removeTemplate\` mutations.
- Three new rate limits for template operations.
- Threaded \`systemPrompt\` through \`createEnhanceStream\`, \`createInlineEnhanceStream\`, and \`createFinalDraftStream\` mutations and their corresponding actions.
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
