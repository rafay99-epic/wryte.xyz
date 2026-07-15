/**
 * ONE-SHOT SEED — delete `convex/_seed/changelog.ts` after running.
 *
 * Backfills the date-based changelog with every historical entry.
 * Triggered from the admin UI (`/admin/seed`) or:
 *
 *   bunx convex run _seed/changelog:seed
 *
 * Entries are ordered by `publishedAt` (date), not by version — the
 * changelog is date-based and carries no version numbers. Each entry keeps
 * its `build` (git SHA) for traceability. A `version` milestone label is
 * optional and omitted by default.
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
  /** Optional cosmetic milestone label (e.g. "1.0") — omitted by default. */
  version?: string;
  build: string;
  /** Which surface the entry describes. Defaults to "website". */
  category?: "website" | "desktop";
  /** Unix ms — when this entry actually shipped. */
  publishedAt: number;
};

/**
 * Every published entry, oldest first. Build hashes come from the commit
 * that shipped each entry; dates from that commit's author timestamp. Edit
 * through the admin UI afterwards if any of this needs to be reworded.
 */
const ENTRIES: SeedEntry[] = [
  {
    title: "Board, settings panel, and command palette",
    slug: "v0-1-1-board-and-command-palette",
    description:
      "First polished iteration after the MVP — drag-and-drop board, settings surface, and the command palette every page now uses.",
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
  {
    title: "Social media cross-posting and settings refactor",
    slug: "v0-7-4-social-posting-and-settings-refactor",
    description:
      "Auto-announce new blog posts to X, LinkedIn, Bluesky, Threads, Facebook, and Reddit via Upload-Post. Account and project settings pages refactored into modular components.",
    build: "38b7ee5",
    publishedAt: Date.parse("2026-05-20T23:59:00+05:00"),
    content: `## What's new

### Social media cross-posting
- **Auto-announce on publish** — when you publish a post to GitHub, Wryte can automatically announce it on X, LinkedIn, Bluesky, Threads, Facebook, and Reddit via Upload-Post integration.
- **Social settings tab** — configure your Upload-Post API key, select platforms, set your username, and customize the post template with \`{{title}}\` and \`{{url}}\` variables.
- **Post template editor** — shared \`SocialPostField\` component with info tooltip, variable insert buttons, and character counter across settings, publish dialog, and schedule dialog.
- **Send test post** — verify the integration end-to-end by sending a dummy post to all selected platforms.
- **Reddit subreddit support** — required subreddit field appears when Reddit is selected, with auto-detection of \`r/\` prefix and trailing slashes.
- **Platform validation** — only platforms supported by Upload-Post's text API are shown (removed TikTok, Instagram, YouTube, Pinterest, Google Business which require images/video).
- **Scheduled publish support** — social posts fire for both instant and scheduled publishes.

### Settings refactor
- **Project settings** — the 3800-line monolith is now a thin shell composing 9 section components (General, GitHub, Content, Publishing, Frontmatter, Media, AI, Social, Danger Zone), each backed by a colocated hook.
- **Account settings** — the 1400-line page is now a thin shell composing 7 tab components (Account, Appearance, Media, Shortcuts, Support, Self-destruct), each with colocated hooks.

## Under the hood

- Added \`socialCredentials\` table with vault-backed key storage, status tracking, and public config for username/platforms/template/subreddit.
- Added \`socialPostOnPublish\` toggle to the projects schema.
- Fire-and-forget \`announcePublish\` internal action — errors are logged but never block the publish flow.
- Six new rate limits for social credential and post operations.
`,
  },
  {
    title: "Paginated public feature requests",
    slug: "v0-7-5-paginated-feature-requests",
    description:
      "The public feature requests board now uses cursor-based pagination instead of loading all entries at once.",
    build: "628f48e",
    publishedAt: Date.parse("2026-05-21T00:30:00+05:00"),
    content: `## What's new

- **Paginated feature requests** — the public board at \`/feature-requests\` now loads 15 items at a time with a "Load more" button, matching the changelog pagination pattern. Reduces initial payload and keeps the page fast as the board grows.
- **Platform list cleanup** — removed 5 platforms (TikTok, Instagram, YouTube, Pinterest, Google Business) from the Upload-Post integration that don't support text-only posting per the API docs.

## Under the hood

- Converted the \`list\` query in \`convex/support/featureRequests.ts\` from \`.take(200)\` to Convex cursor-based \`.paginate()\`.
- Frontend switched from \`useQuery\` to \`usePaginatedQuery\` with loading states for first page and subsequent pages.
`,
  },
  {
    title: "Security & reliability audit",
    slug: "v0-8-0-security-and-reliability-audit",
    description:
      "38 audit findings resolved across backend, frontend, and supply chain — vault hardening, AI stream ownership, project cascade, qs CVE patch.",
    build: "7272349",
    publishedAt: Date.parse("2026-05-23T12:57:00Z"),
    content: `## Security

- **GitHub OAuth token no longer crosses the network boundary** — \`/api/github/token\` now reports connection status only; every GitHub call resolves the token server-side. One XSS or extension would have captured the full \`repo\`-scoped token before.
- **AI streams are now ownership-checked** — a new \`ai_stream_owners\` table binds each \`streamId\` to its creator, and \`getStreamBody\` rejects reads from anyone else. Previously any signed-in user with a stream id could subscribe to another tenant's AI output.
- **Credential rotation is verify-first** — saving a new AI/media/social key verifies it before destroying the old vault entry. A typo no longer locks users out of their provider.
- **Project deletion is now a real cascade** — \`projects.remove\` is a chunked action that cleans up documents, drafts, research, media, three flavours of credential (with vault entries), scheduled-publish workflows, and every other project-scoped table.
- **Filename path-traversal closed** — uploads reject \`..\`, NUL, path separators, and oversize names before they reach any provider.
- **Anonymous \`appVersion.stamp\` closed** — gated by \`VERSION_STAMP_SECRET\`; anyone hitting the Convex URL could previously trigger a "new version" toast on every connected client.
- **Marketing support form hardened** — rate-limited (5/hr) with length caps and an email regex; was previously an open spam vector with no validation.
- **SVG uploads removed** from \`ALLOWED_MIME\` — SVG can contain \`<script>\` and execute in the hosting origin.
- **\`qs\` DoS patched** — pinned to 6.15.2 to clear GHSA-q8mj-m7cp-5q26 pulled in through Express.

## Reliability

- **Autosave race guard** — concurrent saves can no longer mark a stale snapshot as saved.
- **Frontmatter editor debounced** — saves coalesce after 500ms of idle typing instead of firing one Convex mutation per keystroke.
- **Document queries paginate trash-aware** — list/getBySlug/listForCalendar use \`by_projectId_and_trashedAt\` so active docs aren't hidden behind a window full of trash.
- **Workflow rotation preserves prior status** — failed rotations no longer promote previously-invalid credentials to "active".
- **\`getGithubToken\` fails closed** — transient WorkOS Vault and Clerk errors propagate so the workflow's retry policy can engage instead of silently using a stale legacy token.
- **Documents.update locked down** — rejects \`status: "scheduled"/"published"\` and direct \`scheduledAt\` writes that previously bypassed the scheduling workflow. Adds a 500KB byte-aware content cap.
- **\`_backfillGithubSyncedAt\` chunked** — switched to the self-scheduling pattern so large deployments don't risk per-transaction limits mid-backfill.

## UX

- **Pagination reset fixed** — changing filters/search/view no longer strands users on an empty page.
- **Frontmatter reactive refresh** no longer wipes unsaved local edits when another tab saves the same project.
- **Markdown editor desync fixed** — AI applies no longer get overwritten by a stale user keystroke.
- **Inline AI bails on content shift** instead of silently replacing the wrong paragraph via \`indexOf\` fallback.
- **Version-available toast retriggers** for a second deploy in the same session.
- **Board view re-renders only on relevant store changes** (\`useShallow\` selector).

## Under the hood

- 38 audit findings closed across 4 commits + 1 self-review followup commit; lint and type-check are clean.
- New \`ai_stream_owners\` table with \`by_streamId\`/\`by_userId_and_createdAt\`/\`by_projectId\` indexes, drained by both project delete and account self-destruct.
- \`_wipeProjectChunk\` mirrors \`selfDestruct._wipeChunk\`'s budget accounting so a project with thousands of rows fans out across chunks instead of blowing a single transaction.
- \`_deleteProjectRow\` is idempotent — retried delete passes are no-ops.
- Frontmatter MDX/JS parsing uses JSON5 instead of \`new Function\`; the MDX preview's trust boundary is documented in source.
- Project-local \`bunfig.toml\` lowers \`minimumReleaseAge\` to 5 days to admit the qs patch ahead of the global gate.
`,
  },
  {
    title: "Writing analytics, goals & streaks",
    slug: "v0-9-0-writing-analytics-goals-and-streaks",
    description:
      "Account-wide writing streaks, daily word goals with confetti celebration, per-project dashboards, 30-day activity chart, and a full dashboard refactor.",
    build: "d3b1b87",
    publishedAt: Date.parse("2026-05-23T22:00:00+05:00"),
    content: `## What's new

- **Writing streaks** — consecutive-day tracking with flame icon color escalation (amber → orange → red) and milestone callouts at 7, 14, 30, 60, 100, and 365 days.
- **Daily word goals** — set a target from presets (250/500/1k/2k) or a custom value. Progress bar color shifts from amber → blue → emerald as you approach the goal.
- **Goal celebration** — confetti burst and shimmer animation when you hit your daily word target. The progress bar glows, the icon swaps to a party popper, and "Goal reached!" appears.
- **30-day activity chart** — bar chart showing daily word output. When a goal is set, bars that met the target turn emerald with a dot above, a dashed goal line appears, and an "X/30 goals met" counter is shown.
- **Per-project dashboard** — entering a project now lands on an overview page with project-scoped status counts, total word count, status distribution bar, recent activity, upcoming scheduled posts, and keyboard shortcuts. The articles board moves to a dedicated "Articles" tab.
- **Project status distribution** — horizontal stacked bar chart showing the breakdown of draft/review/ready/scheduled/published articles, with hover highlighting and a legend.
- **Upcoming scheduled posts** — next 5 scheduled articles shown on both the workspace and project dashboards with purple indicators and relative timestamps.
- **Per-project mini stats** in the workspace dashboard sidebar — each project shows article count and total words.

## Performance

- **Dashboard no longer scans all documents** — the old \`listAllForUser\` query (up to 1,000 docs) is replaced by \`getDashboardStats\`, which reads ~5 small precomputed rows. Status counts, word totals, and streaks are denormalized on write.
- **Stats update asynchronously** — word count deltas and status changes fire via \`ctx.scheduler.runAfter(0, ...)\` so the document save path stays fast (1 read + 1 write) with zero inline overhead.
- **Bulk delete batches status changes** — soft-deleting N documents fires one \`scheduleStatusChange\` per status type with a count, not N individual mutations.

## Architecture

- **New tables**: \`writing_stats\` (one row per user) and \`project_stats\` (one row per project) — isolated from write-hot \`projects\` and \`users\` tables to avoid OCC contention.
- **Reusable dashboard components** — \`StatPill\`, \`ActivityChart\`, \`RecentDocsList\`, \`ShortcutsPanel\`, \`WritingStreak\`, \`TodaysProgress\`, and \`UpcomingSchedule\` are shared between workspace and project dashboards.
- **Hooks extract data fetching** — \`useDashboardStats\` and \`useProjectDashboard\` keep pages thin and logic testable.
- **Cascade cleanup** — project deletion subtracts word counts from \`writing_stats\` and deletes \`project_stats\`; account self-destruct wipes both tables.
- **Backfill mutations** — \`_backfillWordCounts\`, \`_backfillProjectStats\`, and \`_backfillWritingStats\` handle existing data migration.
- **Daily maintenance cron** prunes \`recentActivity\` arrays to 30 days.

## Routing

- \`/projects/[id]\` now shows the project dashboard overview.
- \`/projects/[id]/articles\` shows the articles board (previously at root).
- Sidebar adds "Overview" as the first project nav item.
`,
  },
  {
    title: "Framework-aware frontmatter detection & validation",
    slug: "v0-10-0-framework-aware-frontmatter",
    description:
      "Schema detection now reads each framework's real config (Astro, Hugo, Next/Contentlayer, Jekyll), a publish-time guard keeps list fields valid so builds never break, the editor validates frontmatter before publish, and existing projects self-repair with an in-app notice.",
    build: "c0c1e16",
    publishedAt: Date.parse("2026-06-08T12:00:00+05:00"),
    content: `## What's new

- **Framework-aware schema detection** — connecting a repo now identifies the framework (Astro, Hugo, Next.js/Contentlayer, Jekyll, Gatsby, Eleventy, SvelteKit) and reads its *authoritative* config as the source of truth: Astro's Zod content schema, Contentlayer \`fields\`, Hugo taxonomies + archetypes, and Jekyll \`defaults\`.
- **Multi-file sampling** — detection samples many posts and types each field by majority vote instead of trusting a single file, so one unusual post can't poison the schema.
- **Inline pre-publish validation** — the editor's Frontmatter panel shows a live "Ready / warnings / issues" badge and flags problems (missing required fields, invalid dates, out-of-range \`select\` values, malformed URLs) *before* you publish — no more discovering a broken build minutes later.
- **TOML frontmatter** — Hugo and other \`+++\`-fenced sites now publish real TOML frontmatter (the previously-declared format option is now implemented).
- **Re-detect from repo** — a button in Project Settings → Frontmatter re-runs framework-aware detection on demand and refreshes the schema, framework, and format.

## Fixes

- **List fields can no longer break builds.** A publish-time guard guarantees \`tags\`, \`keywords\`, \`categories\`, \`topics\`, \`authors\`, and \`aliases\` always serialize as YAML/TOML arrays — even if the stored schema mistyped them — fixing failures like Astro's \`Expected array, received string\`.
- **Empty lists** now serialize as \`[]\` instead of a bare key that parses back as \`null\`.
- **Re-publishing preserves the original date** — fixing or re-shipping an old post no longer stamps it with today's date (first publishes and scheduled posts still stamp as expected).

## Existing projects

- **One-time repair migration** (\`/admin/migrations\` → "Repair frontmatter schemas") fixes every existing project's stored schema, paginated and idempotent.
- **In-app notice** — each repaired project shows a dismissible banner so owners know their schema was updated, with a deep link straight to the Frontmatter settings.

## Performance & scale

- Detection enumerates a repo with a **single recursive Git Trees call** (instead of walking directories) and fetches a bounded, parallel sample of files — each request uses the caller's own GitHub token, so there's no shared rate-limit bottleneck.
- The publish-time array guard is pure and in-memory: zero extra database reads or writes on the publish path.
`,
  },
  {
    title: "AI provider registry & scalable stream cleanup",
    slug: "v0-11-0-ai-provider-registry",
    description:
      "The AI provider concept is now a single source of truth — adding a provider is a one-file config change. Stale model ids are corrected to current models, a one-time migration upgrades existing projects, and AI stream bookkeeping is drained by a budget-aware daily cron.",
    build: "0d7b6f1",
    publishedAt: Date.parse("2026-06-08T18:00:00+05:00"),
    content: `## What's new

- **Single source of truth for AI providers** — provider id, label, models, base URL, and key/dashboard metadata all live in one registry (\`convex/ai/_lib/providers.ts\`). The Convex validators, schema, credential lifecycle, and settings UI all derive from it, replacing a provider union that was duplicated across seven files.
- **Adding a provider is now a one-file change** — for any OpenAI-compatible provider (Groq, DeepSeek, Together, Ollama, …) it's a single registry entry with a base URL and model list; no new backend code. A compile-time assertion fails the type-check if the provider list and the Convex validator ever drift apart.
- **Current model ids** — the model picker now offers real, current models (Claude Opus 4.8 / Sonnet 4.6 / Haiku 4.5, the GPT-4.1 family, and live OpenRouter free models) instead of stale or invented ids.

## Existing projects

- **One-time AI model upgrade** (\`/admin/migrations\` → "Upgrade AI models") rewrites every project's saved model to a current, valid id for its provider — fixing projects pinned to soon-retired ids (e.g. \`claude-sonnet-4-20250514\`) while preserving the chosen tier (Opus→Opus, Sonnet→Sonnet, Haiku→Haiku). Paginated, self-scheduling, and idempotent.

## Performance & scale

- **AI stream ownership rows are now garbage-collected** — a daily, self-draining cron clears \`ai_stream_owners\` bookkeeping (which previously only disappeared on project/user deletion), so the table stays bounded under heavy use at scale. The cleanup batches and re-schedules itself, so its function-call cost tracks the real backlog rather than wall-clock — consistent with the streaming component's 24h GC.

## Under the hood

- New \`convex/ai/_lib/providers.ts\` registry (\`PROVIDER_IDS\`, \`providerValidator\`, \`getProvider\`, \`ALL_PROVIDERS\`); \`src/types/ai.ts\` is now a thin re-export so the \`@/types/ai\` import path is unchanged.
- \`streamByProvider\` and \`runProviderPing\` branch on a registry \`kind\` (anthropic-native vs openai-compatible) and read base URL/headers from the entry — OpenRouter is just an openai-compatible entry, not a special case.
- Removed duplicated provider unions and the copy-pasted brand-mark components from the settings UI; bring-your-own-key and WorkOS Vault storage are unchanged.
- Added a \`by_createdAt\` index on \`ai_stream_owners\` plus \`ai/aiStreams.ts:_cleanupOwners\`.
`,
  },
  {
    title: "Google Gemini AI provider",
    slug: "v0-12-0-google-gemini-provider",
    description:
      "Bring your own Google Gemini key alongside Anthropic, OpenAI, and OpenRouter — with Gemini 3.5 Flash and 2.5 Flash, ideal for content writing.",
    build: "5e22f4d",
    publishedAt: Date.parse("2026-06-09T12:00:00+05:00"),
    content: `## What's new

- **Google Gemini support** — add your own [Google AI Studio](https://aistudio.google.com/apikey) key in Settings → AI and enhance with Gemini, alongside the existing Anthropic, OpenAI, and OpenRouter providers.
- **Flash models** — **Gemini 3.5 Flash** (default) and **Gemini 2.5 Flash**, both tuned for fast, high-volume content writing.
- Bring-your-own-key as usual — the key is stored encrypted in WorkOS Vault and the Gemini call runs entirely server-side; it never touches the browser.

## Under the hood

- First provider to use the new \`gemini-native\` kind in the provider registry — added via a single registry entry plus one streaming adapter (\`@google/genai\` \`generateContentStream\`) and a free key-verification ping. No schema migration; the validator widened automatically.
`,
  },
  {
    title: "Groq AI provider & layered rate limiting",
    slug: "v0-13-0-groq-and-layered-rate-limits",
    description:
      "Bring your own Groq key for blazing-fast Llama 3.3 70B and GPT-OSS models, plus a three-layer rate-limit system (per-user, per-provider, and a deployment-wide cap) that keeps the backend safe under load.",
    build: "86d0201",
    publishedAt: Date.parse("2026-06-09T18:00:00+05:00"),
    content: `## What's new

- **Groq support** — add your own [Groq](https://console.groq.com/keys) key in Settings → AI for fast LPU inference, alongside Anthropic, OpenAI, OpenRouter, and Google Gemini.
- **Groq models** — **Llama 3.3 70B** (default, best for content writing), **GPT-OSS 120B**, and **GPT-OSS 20B**, all production models with 131K context.
- Bring-your-own-key as usual — the key is stored encrypted in WorkOS Vault and every call runs server-side.

## Performance & scale

- **Three-layer AI rate limiting** keeps the backend safe as call volume grows:
  - **Per-user** limits (already in place) cap how fast any one user can start enhancements.
  - **Per-provider** caps — one shared bucket per provider, so a spike on one provider can't starve the others.
  - A **deployment-wide global cap** as a load-shedding backstop against thundering-herd spikes.
- All caps are generous safety valves, not throughput ceilings, and tune from a single config file.

## Under the hood

- Groq needed **no new backend code** — it's OpenAI-compatible, so it slots into the provider registry as a config-only entry (base URL + models) reusing the existing OpenAI adapter and SDK. No new dependency.
- The per-provider rate limit is a single config entry keyed by provider id, so it already covers every current and future provider with no per-provider duplication.
`,
  },
  {
    title: "Editor: readability lens & slash commands",
    slug: "v0-14-0-readability-and-slash-commands",
    description:
      "Two opt-in writing aids — a Hemingway-style readability panel and a Notion-style slash (/) command menu — plus a board horizontal-scroll fix. Both editor features are off by default to keep the editor fast.",
    build: "88204db",
    publishedAt: Date.parse("2026-06-09T22:00:00+05:00"),
    content: `## What's new

### Readability lens
- A toggleable side panel showing a **reading-ease score**, grade level, word/sentence stats, and a clickable list of **long, passive, and adverb-heavy sentences** to tighten — click one to jump straight to it in the editor.
- Pure, client-side analysis (Flesch reading ease + Flesch–Kincaid grade) — **no AI cost**. Debounced, and offloaded to a Web Worker on large documents so typing never stutters.

### Slash commands
- Type **\`/\`** at the start of a line for a Notion-style menu to insert headings, lists, quotes, code blocks, dividers, tables, and links — plus an **"Ask AI to write…"** action that opens the inline-AI flow at the cursor.
- Caret-anchored popover with keyboard navigation, smart filtering, and a light open/close animation.

### Editor settings
- New **Editor** tab in Project Settings to toggle each feature. **Both default off** — when disabled, nothing mounts and no listeners attach, so the editor stays exactly as fast as before.

## Fixes
- **Board horizontal scroll** — the kanban board now scrolls sideways with a normal mouse wheel (hover the board and scroll), so the rightmost columns are reachable when the sidebar is open. Individual columns still scroll vertically.

## Under the hood
- New modular editor lib (\`src/features/editor/lib/{readability,slash,caret}\`) with framework-free analysis, a textarea caret-measurement utility, and a self-contained slash-command registry.
- The slash menu renders through a portal to dodge transformed-ancestor \`position: fixed\` issues; a single \`min-w-0\` on the app shell lets inner overflow regions scroll correctly.
`,
  },
  {
    title: "Snippets: reusable text blocks",
    slug: "v0-15-0-snippets",
    description:
      "Save reusable blocks per project — sign-offs, bios, CTAs, disclaimers — and paste any of them straight from the editor's / menu under a searchable Snippets submenu. Opt-in, scales to thousands per project.",
    build: "620c4e2",
    publishedAt: Date.parse("2026-06-09T23:45:00+05:00"),
    content: `## What's new

### Snippets
- Define **named, reusable text blocks** per project — sign-offs, bios, CTAs, disclaimers, recurring endings — and stop retyping them.
- In the editor, open **\`/\`** → **Snippets ▸**, type to find one (e.g. \`exit\`), and its text is pasted at the cursor. Arrow/Enter to pick, ArrowLeft/Backspace/Esc to back out.
- Manage them in **Project Settings → Editor**: create, edit, and delete with live character counters, all from plain name + content fields (no JSON, ever).

### Built to scale, cheap to run
- Snippets live in their own searchable, paginated table, so a project can hold **thousands** without slowing anything down — the \`/\` menu searches as you type and shows the top matches.
- Has its own **on/off toggle** (off by default), independent of the readability and slash-command toggles.

## Fixes
- **Board scrolling** — the content board now scrolls naturally in every direction: vertical gestures scroll up/down and horizontal gestures (trackpad swipe, the bottom scrollbar, or Shift+wheel) scroll the board sideways. A previous build redirected vertical scrolling into horizontal, which broke up/down scrolling on trackpads.

## Under the hood
- The snippet search query is gated so it only runs while the Snippets submenu is open (and is debounced) — a denormalized per-project count decides the submenu's visibility, so normal editing fires **zero extra queries**.
- New standalone \`convex/cms/snippets.ts\` module (paginated list, full-text search, rate-limited create/update/remove) with a dedicated \`snippets\` table and \`search_name\` index.
`,
  },
  {
    title: "Performance: lighter editor, leaner data",
    slug: "v0-15-1-performance-tier-1",
    description:
      "First performance pass — the editor ships less JavaScript up front and the content board stops shuttling full article bodies over the wire, so the app loads faster and stays smoother.",
    build: "9db054d",
    publishedAt: Date.parse("2026-06-09T23:55:00+05:00"),
    content: `## Performance

- **Smaller editor load** — the Markdown preview, MDX preview, and the diff viewer (sync-conflicts page) now load on demand instead of up front, trimming a large chunk of JavaScript from the initial editor bundle. You'll briefly see "Loading preview…" the first time you open preview or split mode.
- **Leaner board & lists** — the document list no longer ships full article bodies to the board, sidebar, and header on every keystroke; it sends only what those views render (title, status, a short excerpt, word count). Recent-document lists are trimmed the same way — less data over the wire, less work on every save.
- **Fewer wasted re-renders** — the board's tag-filter bar now subscribes to only the state it actually uses.
- **Tighter bundles** — per-module imports enabled for \`framer-motion\` so only the animation code actually used ships to the browser.

No behavior changes — everything works exactly as before, just lighter and faster.
`,
  },
  {
    title: "Video embeds",
    slug: "v0-16-0-video-embeds",
    description:
      "Embed videos in your posts — pick from the media library, paste a hosted URL, or upload through your project's media provider, with playback right in the preview.",
    build: "6f3f8b1",
    publishedAt: Date.parse("2026-06-12T00:27:26+05:00"),
    content: `## What's new

- **Video embeds** — a new Video button in the editor toolbar (next to Image) opens a dialog with three ways in: pick a video from your project's media library, paste a hosted URL (UploadThing, Cloudinary, anywhere), or upload one through the project's configured media provider. Inserts a portable \`<video>\` tag that GitHub and most static-site renderers understand.
- **\`/video\` slash command** — type \`/video\` to drop an embed skeleton at the cursor.
- **Playback in preview** — both the Markdown and MDX previews now render embedded videos with controls, styled to match preview images.
- **Video uploads** — \`mp4\`, \`webm\`, \`mov\`, and \`ogg\` files are accepted by the upload pipeline (up to the project upload limit; host larger files externally and embed by URL).

## Under the hood

- The Markdown preview now parses raw HTML (via \`rehype-raw\`) and sanitizes it — \`<video>\` is whitelisted with \`src\` restricted to http/https, and scripts or unknown tags are still stripped.
`,
  },
  {
    title: "Faster writing: paste uploads, smart lists, find & replace",
    slug: "v0-17-0-editor-workflow",
    description:
      "A batch of editor workflow upgrades — paste or drop media to upload, lists that continue themselves, find & replace, a document outline, media slash commands, and a decluttered toolbar.",
    build: "b1c241e",
    publishedAt: Date.parse("2026-06-12T00:48:43+05:00"),
    content: `## What's new

- **Paste & drop to upload** — paste a screenshot (or drop an image/video file) straight into the editor. It uploads through your project's media provider and inserts the markup at the cursor, with a placeholder while the upload runs. Images respect your compression settings.
- **Smart lists** — Enter continues bullets, numbered lists (auto-incrementing), checkboxes, and quotes; Enter on an empty item exits the list; Tab / Shift+Tab indent and outdent list lines.
- **Paste a link onto text** — select a word, paste a URL, get a markdown link.
- **Find & replace** — \`Ctrl/Cmd+F\` opens a floating bar with live match count, next/previous, case toggle, replace one, or replace all.
- **Outline panel** — the heading tree of your draft in a side panel; click any heading to jump there.
- **\`/image\` and \`/video\` slash commands** — both open the full insert dialog (library / URL / upload) right at the caret, and they work in focus mode too.
- **Decluttered toolbar** — lists, quote, divider, code, link, image, and video moved into a single Insert menu; the side-panel toggles became compact icon buttons. Everything is still one click away, with a lot less noise.
`,
  },
  {
    title: "Version snapshots, selection toolbar & writing insights",
    slug: "v0-18-0-snapshots-selection-toolbar",
    description:
      "Your drafts now have a real safety net — automatic version snapshots with diff and restore — plus a floating selection toolbar with one-click AI actions, internal [[ links, SEO checks, typewriter focus mode, and session writing stats.",
    build: "c6e4d13",
    publishedAt: Date.parse("2026-06-12T01:45:23+05:00"),
    content: `## What's new

- **Version snapshots** — the editor automatically snapshots your draft on every manual save (Ctrl+S) and every 10 minutes of active writing. The History panel's new **Snapshots** tab shows them all with a line-by-line **diff** of what restoring would change and **one-click restore** — and restoring snapshots your current draft first, so even a restore is reversible. A bad AI rewrite or accidental deletion is no longer permanent.
- **Selection toolbar** — select text and a floating toolbar appears: Bold, Italic, Link, plus one-click AI actions (**Improve, Shorten, Expand, Fix grammar**) that run instantly through inline AI. On by default; toggle it in Project Settings → Editor.
- **Internal links** — type \`[[\` to link to another post in the project. Browse loads a few documents at a time as you scroll, and typing searches every post by title server-side.
- **Structure & SEO checks** — the readability panel now flags multiple H1s, heading-level jumps, images missing alt text, very long paragraphs, and link-less long posts. Click any issue to jump to it.
- **Typewriter focus mode** — in focus mode the caret line stays vertically centered while you type, and everything outside the current paragraph gently dims.
- **Session writing stats** — the word count shows the words you've added this session; hover it for today's total, your daily goal, and your writing streak.

## Under the hood

- New \`document_snapshots\` table (content-deduped, capped at 30 per document, pruned automatically) with rate-limited create/restore mutations.
- New \`search_title\` search index on documents powering the \`[[\` menu's typeahead; browsing uses a lean paginated query so large projects never ship their full document list at once.
- Snapshots, the selection toolbar toggle, and the editor-stats query all follow the function-budget rules: deduped writes, queries gated on visible UI, no per-keystroke calls.
`,
  },
  {
    title: "Share previews, project tools & planning upgrades",
    slug: "v0-19-0-share-previews-and-tools",
    description:
      "Share read-only draft previews with anyone, export your whole project as markdown, hunt down dead links, capture ideas, drag posts across the calendar, and watch your writing streak fill in a heatmap.",
    build: "2b6616e",
    publishedAt: Date.parse("2026-06-12T02:35:40+05:00"),
    content: `## What's new

- **Shareable draft previews** — a new Share button in the editor header creates a read-only preview link on your app's own URL (\`/preview/…\`). Anyone with the link sees the latest saved draft — no account needed — and you can revoke it at any time. Preview pages are hidden from search engines.
- **Project export** — Settings → Tools → "Export all articles" downloads your entire project as a zip of markdown files with YAML frontmatter. Your content is never locked in.
- **Link checker** — also in Tools: one click probes every external link across your articles and reports the dead ones, with jump-links to the affected posts. Strictly on-demand — it never runs in the background.
- **Idea inbox** — capture post ideas on the project overview with a single keystroke, and convert one into a ready-to-write draft (slug + frontmatter included) when its time comes.
- **Instant calendar rescheduling** — drag an already-scheduled post to another day and it reschedules immediately, keeping its publish time. The time picker now only appears when it's actually needed.
- **Writing heatmap** — a GitHub-style activity grid on the dashboard. Activity history now spans 12 weeks (up from 30 days), so the heatmap fills in as you write.

## Under the hood

- New \`share_links\` and \`ideas\` tables, both wired into project-deletion cleanup; preview pages resolve tokens through a single public query.
- Export walks documents in pages of 50 via one-shot queries and zips client-side — nothing reactive, only paid on click.
- The link checker is a single rate-limited action with a bounded worker pool (8 parallel probes, HEAD-with-GET-fallback, private hosts skipped, 150-link cap reported rather than silently truncated).
`,
  },
  {
    title: "Leaner data path, smarter board selection & social fixes",
    slug: "v0-20-0-document-body-split-and-board-selection",
    description:
      "The big one: writing no longer re-reads every article in your project, cutting DB bandwidth dramatically. Plus a Notion-style board selection mode and social template variables that actually resolve in custom text.",
    build: "33a00ab",
    publishedAt: Date.parse("2026-06-14T21:00:00+05:00"),
    content: `## Performance

- **Writing no longer re-reads your whole project.** The heavy article body now lives in its own \`document_content\` table, separated from the lightweight metadata (title, status, excerpt, word count) that the board, sidebar, calendar, and lists subscribe to. Those hot paths used to pay to read *every* article body in the project on each reactive invalidation — a single autosave could re-read up to 500 full bodies. Now they read metadata only.
- **Autosave writes only the body.** The periodic 3-second autosave touches the \`document_content\` row alone and leaves the always-mounted sidebar/board subscriptions untouched, so typing no longer invalidates the project's metadata. The full metadata refresh (word count, \`updatedAt\`) fires once on manual save and when you leave the editor, so lists still reflect the final state. Per-save cost during a writing session drops from ~500 metadata rows + body to a single body write.
- **No behavior change** — the editor, AI synthesis, drafts, frontmatter, preview, and GitHub publish all join the body back transparently. This is the bandwidth fix the whole project has been building toward.

## What's new

- **Notion-style board selection.** Once any card is selected, plain clicks toggle selection instead of opening the document, so you can never accidentally open a post mid-selection. Modifier-click (\`Cmd\`/\`Ctrl\`/\`Shift\`) anywhere on a card toggles it — no need to hit the small checkbox — and the checkbox hit target is now larger. Opening a document clears the active selection, so returning to the board never leaves stale cards selected.

## Fixes

- **Social template variables now resolve in custom text.** \`{{title}}\` and \`{{url}}\` typed into a *custom* announcement message are now substituted at publish time, for both publish-now and scheduled flows. Previously substitution only ran on the default template, so a \`{{url}}\` in custom text went out verbatim (or got dropped) and had to be pasted in by hand. Scheduled posts resolve the title and URL as they exist when the post actually goes out.
- **Polished announcement UI** — the Social Announcement section is now a flat layout with labeled variable-insert chips, a live resolved preview, and a clear "Will publish on" callout.

## Under the hood

- New \`document_content\` table (\`by_documentId\`/\`by_projectId\`/\`by_userId\`), with \`documents.content\` made optional and \`documents.excerpt\` denormalized for list views. A single \`cms/_lib/documentContent.ts\` helper owns every read/write/delete/excerpt path, with a legacy-inline fallback for the backfill window.
- Body rows cascade-delete on trash purge, project wipe, and account self-destruct. A resumable \`_backfillDocumentContent\` migration (body-size-safe batches of 25) is driven to completion from \`/admin/migrations\` → "Migrate document bodies," reporting an accurate migrated count.
- Autosave split into \`onSave\` (body-only) and \`onFlush\` (full metadata refresh); shared social-template helpers extracted to \`src/lib/social-template.ts\` mirroring the server's \`renderPostTemplate\`.
`,
  },
  {
    title: "A redesigned landing page",
    slug: "landing-page-v2-diff-hero-and-product-canvas",
    description:
      "A brand-new landing page built around what makes Wryte different — your content is real diffs in your own Git repo. Diff-driven hero, a live commit ticker, parallax product canvas, and an honest CMS comparison.",
    build: "33a00ab",
    publishedAt: Date.parse("2026-06-14T21:15:00+05:00"),
    content: `## What's new

- **A new landing page**, designed around the one thing that sets Wryte apart: your writing lives as real diffs in your own Git repo. It leads with a diff — not a screenshot.
  - **Diff-driven hero** with an animated unified-diff card.
  - **Commit ticker** — a marquee of git commits scrolling beneath the fold.
  - **Product canvas** — editor and board sections that tilt in 3D parallax as you move.
  - **Connected-flow** section that walks through how capture → board → AI → publish fit together.
  - **Honest CMS comparison** — a readable matrix versus Payload, TinaCMS, Sanity, and Contentful, framed as a diff narrative rather than a feature checklist.
  - **Diff-themed call to action** to close.

## Under the hood

- The redesign lives in \`features/marketing/components\` with its constants in \`features/marketing/constants\`, reusing the shared navbar, footer, page background, and magnetic button. The old landing sections (hero, marquee, statement, editor, board, features, workflow, CTA) and their private dependencies were removed.
`,
  },
  {
    title: "Automatic versioning & a date-based changelog",
    slug: "automatic-versioning-and-date-based-changelog",
    description:
      "Wryte no longer has a hand-typed version number — the deployed git commit SHA is the release identity, so update detection is fully automatic and can't be forgotten. The changelog is now organized by date and stamped with the build that shipped it.",
    build: "33a00ab",
    publishedAt: Date.parse("2026-06-14T23:30:00+05:00"),
    content: `## What's new

- **Automatic versioning.** There's no version number to bump by hand anymore. The deployed git commit SHA is the release identity, and the "new version available" prompt compares the build your tab loaded against the one that's live — so every deploy is detected automatically, and a release can never ship without the version being updated.
- **Date-based changelog.** Releases are now organized by date and tagged with the build (commit SHA) that shipped them, instead of a semver label. An optional milestone label (e.g. \`1.0\`) is still supported for the rare release you want to name.

## Why

- The old flow required hand-bumping \`package.json\` *and* writing a version-numbered changelog entry on every release — a manual step that was easy to forget (and was, for several commits in a row). Tying update detection to the commit SHA makes it automatic and reliable, the way continuously-deployed apps actually ship: the SHA is the version, and the human-facing label is optional.

## Under the hood

- \`use-version-check\` now compares the deployed build SHA (\`app_version.build\`) against the client's \`NEXT_PUBLIC_BUILD_SHA\` rather than the semver string; \`package.json\` version is demoted to a cosmetic label that's allowed to go stale.
- The changelog \`version\` field is optional end-to-end — schema, create/update mutations, admin form, public page, and RSS — and entries are keyed on \`publishedAt\` + \`build\`.
- The changelog seed is now an idempotent **upsert migration**: re-running it reconciles already-imported rows to the version-free structure (clearing any stale label) instead of skipping them.
- The admin "New entry" form auto-fills the build SHA from the live deploy, and the \`changelog:new\` CLI no longer prompts for a version or touches \`package.json\`.
`,
  },
  {
    title: "Database bandwidth overhaul — content side-tables everywhere",
    slug: "database-bandwidth-overhaul-content-side-tables",
    description:
      "Every stored version of your writing — drafts, snapshots, publish history — now keeps its body in a dedicated content table, so autosave and the always-open panels stop re-billing full article bodies. Measured locally: the draft list's per-autosave read set dropped 96%.",
    build: "e4cb56d",
    publishedAt: Date.parse("2026-07-04T18:00:00+05:00"),
    content: `## What's new

- **Autosave got dramatically cheaper.** Convex bills every database read and write at the full size of the row involved, and re-runs any subscribed query whose data an autosave touches. Editing inside a draft tab used to re-bill *every* draft's full body every 3 seconds via the always-mounted tab bar; the main-document path paid a full-body read before every full-body write. Both are gone.
- **Nothing saved twice for no reason.** The editor now skips the save entirely when your content is byte-identical to what's already persisted (typing and undoing back costs nothing), and a 30-second ceiling guarantees a save even during an uninterrupted typing streak.
- **History panel loads only what you look at.** Snapshots and Publishes each subscribe only while their tab is selected, and the publish list ships commit metadata instead of up to 100 full article bodies per open.
- **Deleting a document now really deletes it.** Permanent delete, Empty Trash, and the retention cron cascade through drafts, snapshots, sync conflicts, publish history, research notes, and share links — previously those rows were orphaned forever.

## Why

- Free-tier database bandwidth was getting demolished during heavy writing sessions. The biggest single cause was the classic Convex trap: article bodies living on rows that list queries subscribe to, so every keystroke batch re-billed whole libraries of text.

## Under the hood

- New 1:1 content side-tables mirroring \`document_content\`: \`document_draft_content\` (carries the draft's title so title edits ride the hot path), \`document_snapshot_content\`, and \`publish_history_content\` — each with cascade indexes. Metadata rows stay tiny; list subscriptions never touch bodies.
- \`documents.contentId\` / \`document_drafts.contentId\` pointers let the hot save mutations \`db.replace\` the body row blind — a single N-byte write instead of read-then-patch (2N). New \`documentDrafts.autosaveContent\` writes ONLY the content row; \`updateContent\` became the flush path.
- Snapshot dedup now compares an FNV-1a \`contentHash\` on the metadata row instead of reading the previous body; the on-insert prune scans metadata only. Publish history is capped at the newest 50 per document.
- Resolved sync conflicts are stripped of their two full-content snapshots (audit metadata stays); the per-tick conflict guard reads only open conflicts via a new \`by_documentId_unresolved\` index. \`getBySlug\` swapped a 2,000-row scan for a \`by_projectId_and_slug\` index.
- Six idempotent, chunked, resumable admin migrations drained all existing data into the new shape, verified by a seeded before/after test bench: draft-list read set 48.5&nbsp;KB → 1.8&nbsp;KB (−96%), snapshot list −96%, publish list −93%, with all 14 post-migration invariants passing.
`,
  },
  {
    title: "Dependency security patches",
    slug: "dependency-security-patches-ws-hono-jsyaml",
    description:
      "Cleared every bun audit finding blocking deploys: patched ws, hono, protobufjs, @babel/core, and js-yaml across the dependency tree — all pinned within their current majors so nothing changes behavior.",
    build: "8d91fe2",
    publishedAt: Date.parse("2026-07-04T19:00:00+05:00"),
    content: `## Fixes

- **All \`bun audit\` findings resolved** (2 high, 7 moderate, 1 low). Highlights: \`ws\` memory-exhaustion DoS, \`hono\` CORS wildcard-with-credentials reflection, \`protobufjs\` schema-derived property shadowing, \`@babel/core\` sourceMappingURL file read, and \`js-yaml\` quadratic-complexity merge-key DoS.

## Under the hood

- Transitive dependencies pinned via \`overrides\`, each within its current major (\`ws ^8.21.0\`, \`hono ^4.12.25\`, \`protobufjs ^7.6.4\`, \`@babel/core ^7.29.7\`) — no API surface changes.
- \`js-yaml\` needed care: \`gray-matter\` (the frontmatter parser at the heart of the app) hard-requires the v3-only API, and Bun overrides are flat, so the whole tree is pinned to the patched final 3.x release. Every first-party call site uses only \`load\`/\`dump\`/\`YAMLException\` — identical across majors — and frontmatter parsing was smoke-tested.
`,
  },
  {
    title: "Spring cleaning — legacy fields, migrations, and dead code removed",
    slug: "spring-cleaning-legacy-fields-and-migrations-removed",
    description:
      "With the bandwidth-overhaul migrations confirmed complete in production, the entire compatibility layer is gone: legacy inline content fields, every fallback read, all completed one-shot migrations and their admin page, the temporary test bench, and older dead surfaces like the plaintext GitHub token and Convex-storage media era.",
    build: "502f810",
    publishedAt: Date.parse("2026-07-04T21:00:00+05:00"),
    content: `## What's new

- **The codebase is 2,400+ lines lighter.** The widen→migrate→narrow rollout of the content side-table split completed in production, so the safety scaffolding came out: no legacy fields, no fallback branches, no dead migrations waiting to confuse future work.

## Under the hood

- Schema narrowed: dropped \`documents.content\`, \`document_drafts.contentSnapshot\`/\`titleSnapshot\`, \`document_snapshots.content\`, and \`publish_history.contentSnapshot\` — verified against both deployments' inferred schemas (zero rows carried any of them) before removal, since Convex validates existing documents at deploy time.
- Every legacy fallback read removed. One deliberate behavior change: rolling back to a publish whose content row is missing now throws a clear error instead of silently restoring an empty article.
- All completed one-shot migrations retired — the six bandwidth migrations, the document-body backfill, plus the older AI-model, analytics, and frontmatter-repair backfills — together with the entire \`/admin/migrations\` page and its sidebar link.
- Older dead surfaces swept out after data verification: the legacy plaintext \`users.githubAccessToken\` (vault-only now) and its lazy migration, the Convex-storage \`convex_legacy\` media era (provider literal, six deprecated fields, \`by_storageId\` index, and legacy rate limits), the \`"external"\` media-storage mode alias, and the schema-repair notice machinery.
- The temporary cost-optimization test bench and workload seeder were deleted from \`/admin/seed\`.
`,
  },
  {
    title: "Compare your drafts side by side",
    slug: "draft-compare-side-by-side",
    description:
      'Every draft tab now has "Compare with Main" — a full-width side-by-side diff with a selector on each side, so you can finally see how two versions of a post differ before promoting one. Shipped alongside a full Playwright end-to-end test suite.',
    build: "3a53b82",
    publishedAt: Date.parse("2026-07-04T23:10:00+05:00"),
    content: `## What's new

- **Compare with Main.** Open any draft tab's menu and pick *Compare with Main* to get a split diff of the two versions — additions and removals highlighted line by line, word counts in the titles, and a selector on each side so you can compare Main against any draft, or two drafts against each other. Unsaved keystrokes are flushed first, so the diff always reflects what you see.

## Under the hood

- The diff renderer was extracted from the sync-conflicts page into a shared \`MarkdownDiffViewer\`, which the conflict page now consumes too (~80 lines lighter).
- Content is fetched one-shot when the sheet opens or a selector changes — no live subscriptions, no new backend functions, nothing on the autosave hot path.
- This release also added the project's end-to-end test harness: Playwright with automated Clerk sign-in and a smoke suite covering marketing, auth, the dashboard, editor autosave, the outline panel, version history, and the draft-tab lifecycle. Run it with \`bun run test:e2e\`.
`,
  },
  {
    title: "A pre-publish checklist",
    slug: "pre-publish-checklist",
    description:
      "The publish dialog now runs six instant quality checks before your post ships to GitHub — frontmatter validity, missing image alt text, unresolved internal links, leftover TODO markers, structure sanity, and reading time. Warnings never block publishing.",
    build: "0a51a02",
    publishedAt: Date.parse("2026-07-04T23:20:00+05:00"),
    content: `## What's new

- **A checklist in the publish dialog.** The moment you open Publish, six checks run against your post: frontmatter parses and matches the project schema, every image has alt text, every \`[[internal link]]\` resolves to a real document, no TODO/FIXME or merge-conflict markers were left behind, the structure makes sense (one H1, not suspiciously thin), plus word count and reading time. Warnings are informational — you can always publish anyway.
- **Check external links on demand.** A button runs the existing link checker against the post when you ask for it (it stays manual because the checker is rate-limited).

## Under the hood

- All checks are pure client-side functions over the content already in the editor; the only network cost is one bounded metadata query to resolve internal links when the dialog opens. The schedule dialog was deliberately left out — it can open from the board where the editor's content isn't loaded, which would have produced stale results.
`,
  },
  {
    title: "Hemingway-style writing lint",
    slug: "style-lint-readability-lens",
    description:
      "The readability lens grew a Style section: passive voice, adverb density, sentence-length monotony, weasel words, and clichés — each with click-to-jump excerpts and its own toggle. Pure client-side, zero backend cost.",
    build: "17b63ec",
    publishedAt: Date.parse("2026-07-04T23:30:00+05:00"),
    content: `## What's new

- **Five style checks in the readability lens**: passive voice, adverb density (with a whitelist so *family* and *only* don't count), runs of same-length sentences that read monotonously, weasel words (*very, really, quite, basically…*), and ~44 common clichés.
- **Click an excerpt to jump to it** — same interaction as the outline panel — fix it, and the finding disappears on the next pass.
- **Per-check toggles**, persisted locally, so you can silence the checks you disagree with.

## Under the hood

- One pure module (\`style-lint.ts\`) masks code blocks, frontmatter, and URLs before analysis, reuses the lens's existing sentence segmentation, and runs debounced only while the panel is open. Zero Convex reads or writes.
`,
  },
  {
    title: "Writing sprints & typewriter focus",
    slug: "writing-sprints-typewriter-focus",
    description:
      "A sprint timer with a word target and live WPM in a floating HUD, plus typewriter scrolling that keeps the caret line centered while focus mode is on. Entirely client-side — a 25-minute sprint costs zero database traffic.",
    build: "15f198e",
    publishedAt: Date.parse("2026-07-04T23:40:00+05:00"),
    content: `## What's new

- **Writing sprints.** Pick a word target (250/500/750 or custom) and a duration (15/25/45 min or custom) from the new Sprint control in the editor toolbar. A floating pill shows time remaining, words written this sprint, live WPM, and progress — with pause/resume, a celebratory finish when you hit the target, and a \`⌘⇧U\` shortcut.
- **Session stats** — words and WPM since you opened the editor, always visible in the sprint popover.
- **Typewriter scrolling.** With focus mode on, the line you're typing stays vertically centered — smooth, and it steps aside the moment you scroll manually. Toggleable and remembered per browser.

## Under the hood

- Sprint state lives entirely in the editor store; the once-a-second tick is a local render counter that never touches the dirty flag, so it can never wake the autosave. Words still reach your streaks and goals through the existing save path — a sprint adds zero reads and zero writes.
- Five duplicated word-count implementations across the app were consolidated into one shared \`src/lib/word-count.ts\`.
`,
  },
  {
    title: "Backlinks — see what links here",
    slug: "backlinks-what-links-here",
    description:
      "Wiki links now work in both directions: the research panel shows every document that links to the one you're editing, turning your content library into a connected graph.",
    build: "a9c6200",
    publishedAt: Date.parse("2026-07-04T23:50:00+05:00"),
    content: `## What's new

- **"Linked from" in the research panel.** Open the research panel on any document and see every post that references it via \`[[wiki links]]\`, with status badges — click one to jump straight into that document. Great for building series and keeping internal links healthy alongside the pre-publish checklist's unresolved-link warnings.

## Under the hood

- New \`document_links\` edge table, maintained **only on the flush path** (manual save, promote, restore, conflict resolution) — the 3-second autosave never parses links or writes edges, keeping the hot path exactly as cheap as the bandwidth overhaul left it.
- The backlinks list is a bounded query subscribed only while the research panel is open; link rows cascade-delete with their documents.
- A one-time, idempotent CLI backfill populates edges for existing content: \`bunx convex run cms/documents:_backfillDocumentLinks '{}'\` after deploying.
`,
  },
  {
    title: "Instant draft switching & compare any two versions",
    slug: "instant-draft-switching-compare-promote",
    description:
      "Draft tabs now switch instantly — no lag, no flicker, no content bleeding between versions. The compare view diffs any draft against any other (or Main) and can promote either side, and a backend hardening pass closed a frontmatter data-loss bug.",
    build: "b69e3e2",
    publishedAt: Date.parse("2026-07-10T01:54:00+05:00"),
    content: `## What's new

- **Instant draft switching.** Every draft you've opened, edited, or created this session renders immediately when you return to it, and empty drafts open instantly even on first visit. When a switch genuinely has to wait, the editor fades softly instead of snapping — fast switches show no transition at all.
- **Compare any two versions.** The compare view now diffs any draft against any other draft or Main (not just draft-vs-Main), and either side can be **promoted to Main** right from the comparison.
- **Honest switch feedback.** The target tab shows a spinner during a slow switch, typing is locked for the in-flight moment so keystrokes can't land in the wrong draft, and a failed switch keeps you where you were with a clear error instead of showing one version's text under another's tab.

## Fixes

- **Draft content no longer leaks between tabs.** Switching from a draft with fresh edits to a new or empty draft used to carry the old text on screen — and could then autosave it into the wrong draft. Fixed at the root (the editor now force-syncs whenever a different version loads).
- **Promoting a draft preserves your unsaved edits** on whatever tab you're on, and no longer silently wipes Main's frontmatter when the draft carries none.
- **No more sideways jump** when switching between a scrolling draft and an empty one — the scrollbar's 4px gutter is now always reserved.

## Under the hood

- The switch cache revalidates in the background at most once per draft per 30s window, so rapid tab browsing costs **fewer** Convex function calls than before; creating a blank draft now costs zero content reads.
- Backend hardening: promote now respects the sync-conflict lock like every other main-body write, the 50-drafts-per-article cap is actually enforced, the AI-synthesis draft path got the same size caps as the interactive one, stale content pointers self-heal permanently, and draft deletion no longer pays a full-body read.
- Two new Playwright specs pin all of this down: a draft-state isolation regression (switches, creates, reloads) and promote-from-compare.
`,
  },
  {
    title: "Calendar view in the articles dashboard",
    slug: "calendar-dashboard-view-unschedule",
    description:
      "The content calendar is now a third view mode right next to Table and Board — and scheduling finally has its inverse: drag a scheduled article onto the unscheduled panel to cancel it.",
    build: "fc2e00e",
    publishedAt: Date.parse("2026-07-10T13:57:00+05:00"),
    content: `## What's new

- **Calendar, Table, Board — one switcher.** The month calendar now lives inside the articles dashboard as a third view mode, remembered per project, with the layout keyboard shortcut cycling through all three. The dedicated calendar page in the sidebar still works — both render the same surface.
- **Drag to unschedule.** Dragging a scheduled article onto the Unscheduled panel cancels its schedule and returns it to drafts — the missing inverse of dragging an article onto a date.

## Under the hood

- The calendar's queries are mounted only while the calendar is visible, so Table and Board users pay zero additional reads.
- Month navigation and view-mode buttons gained proper accessibility labels, and a new self-cleaning Playwright spec covers view switching, month navigation, and preference persistence.
- A public \`.plan/\` roadmap folder now tracks what's next: SEO & link intelligence, cross-posting, and reviewer comments on share links.
`,
  },
  {
    title: "SEO & link intelligence",
    slug: "seo-link-intelligence",
    description:
      "See exactly how your post will look on Google and social cards while you edit the frontmatter, get one-click suggestions to interlink your articles, and a stale-content radar that tells you which published posts deserve a refresh.",
    build: "e181274",
    publishedAt: Date.parse("2026-07-10T14:20:00+05:00"),
    content: `## What's new

- **Search preview.** A new section at the bottom of the frontmatter panel renders a live Google result and social card from your title, description, image, and slug — with honest pixel-width warnings when Google would truncate your title (~600px) or description (~920px), and nudges when a description or site URL is missing. Everything updates as you type.
- **Link suggestions.** The research panel now spots unlinked mentions of your other articles ("mentioned as …") and links them with one click — the mention becomes a \\[\\[wiki link\\]\\] in place, feeding the backlinks graph. Code blocks, existing links, and articles you already link to are never suggested.
- **Stale-content radar.** The project overview lists published articles untouched for 6+ months, oldest first, each one click from the editor — prose quality was covered by the readability lens; this closes the loop on keeping content fresh.

## Under the hood

- The search preview and suggestion scanning are pure client-side (canvas text measurement, style-lint's offset-preserving masking) — the entire feature adds ONE metadata query per research-panel open and one bounded query while the project overview is on screen. No crons, no new subscriptions, no hot-path reads.
`,
  },
  {
    title: "A split view that keeps up",
    slug: "split-view-that-keeps-up",
    description:
      "The editor's split view now follows your caret as you write, the preview scrolls in lockstep in both directions without judder, and double-clicking anywhere in reading mode drops you into the editor at that exact spot.",
    build: "d5282c8",
    publishedAt: Date.parse("2026-07-11T12:00:00+05:00"),
    content: `## What's new

- **The preview follows your writing.** Typing in split view now keeps both panes on the caret: the editor nudges itself so the caret never slips off screen, and the preview scrolls to the exact rendered block you're editing — matched by source line, not a scroll-ratio guess. Hit Enter at the bottom of a long draft and the new line is right there on both sides.
- **Double-click to edit.** In reading mode, double-click any paragraph, heading, or list item and you land in the editor with the caret on that exact word — no more switching modes and scrolling back down by hand. In split view it jumps the caret in the editing pane without leaving the layout.
- **No more preview judder.** The preview used to re-parse the whole document on every keystroke, fighting your typing for the main thread. Rendering is now deferred and memoized, so keystrokes stay instant and the preview catches up the moment you pause.

## Under the hood

- Scroll sync got an ownership model: whichever pane you're actually using drives the other, and the echo events that used to make the panes fight each other are ignored outright.
- Every rendered block carries its markdown source line (a tiny remark plugin), which powers both the caret-follow and double-click-to-edit. MDX previews compile positions away, so they fall back to word search and ratio sync.
- All client-side — zero new Convex functions, queries, or subscriptions.
`,
  },
  {
    title: "Board renames that behave",
    slug: "board-renames-that-behave",
    description:
      "Renaming a card on the board no longer tears the card apart mid-typing, the cancel button actually cancels, and a sweep of the surrounding code fixed a handful of races before anyone hit them.",
    build: "9a68341",
    publishedAt: Date.parse("2026-07-12T00:15:00+05:00"),
    content: `## What's fixed

- **Renaming a board card no longer fights drag-and-drop.** The card stayed a drag handle while its rename input was open, so selecting text in the input started dragging the whole card — cards visually tore apart mid-typing, and the drag's focus loss could save half-typed titles. Cards now stop being draggable the moment a rename or tag edit opens, and the hover preview stays out of the way while you type.
- **Cancel means cancel.** Clicking ✗ on a rename blurred the input first, and the blur saved your edit before the cancel could run. Same story for removing a tag chip — it kicked off the editor's close timer mid-edit. Both now keep focus where it belongs and do what the button says.
- **No more double-saves.** Confirming a rename with Enter while the save was already in flight could fire the mutation twice; a guard now makes the second call a no-op.
- **Double-click-to-edit lands more precisely.** The jump now resolves against the exact content the preview rendered (not the store's slightly-newer text), and malformed source-line stamps fall back to word search instead of silently jumping to the top of the document.
`,
  },
  {
    title: "A command palette worth the shortcut",
    slug: "command-palette-worth-the-shortcut",
    description:
      "⌘K got the Raycast treatment: fuzzy search across every article in every project, instant project switching, smarter commands — and typing in it never costs a server call.",
    build: "c2e2216",
    publishedAt: Date.parse("2026-07-12T01:30:00+05:00"),
    content: `## What's new

- **Search everything, not just recents.** The palette used to list your 20 most recent articles and match them by exact substring. It now searches every article across every project — titles, slugs, tags, and project names — with real fuzzy matching: \\"nart\\" finds *New Article*, a half-remembered slug finds its post, and matched characters are highlighted so you can see why a result ranked.
- **One ranked list, Raycast style.** Typing collapses the categories into a single relevance-ranked list — commands, projects, and articles compete on match quality, with a freshness boost so newer articles win ties. Idle, you still get tidy groups: actions, navigation, projects, and your ten most recent articles.
- **Commands answer to synonyms.** \\"kanban\\" finds *Switch Layout*, \\"night\\" finds the dark theme, \\"hide panel\\" finds the sidebar toggle. Article rows show their project and status so cross-project results stay unambiguous.
- **Deep search when titles aren't enough.** The last row hands your query to the current project's full-text content search — one Enter and you're on the articles page with the search pre-filled.

## Under the hood

- Keystrokes never touch the server. One metadata-only catalog query (titles, slugs, tags — never bodies, ~100 bytes a row) feeds an in-memory fuzzy index; all matching is client-side.
- The palette's subscriptions are now lazy: nothing loads until the first ⌘K, then stays warm for instant reopens. Previously it subscribed two queries permanently from the app shell even if you never opened it.
- No new search indexes, crons, writes, or storage — the whole feature is one read-only query and a 120-line dependency-free fuzzy matcher.
`,
  },
  {
    title: "Social announcements that actually announce",
    slug: "social-announcements-via-buffer",
    description:
      "Upload-Post is out, Buffer is in: reliable auto-announcements on publish, a channel picker that mirrors what you've actually connected, correct framework-aware post URLs, and fully automated announcement text.",
    build: "af2492a",
    publishedAt: Date.parse("2026-07-12T03:30:00+05:00"),
    content: `## What's new

- **Buffer powers social announcements now.** Upload-Post's flaky API is gone. Connect your social accounts in Buffer, paste one API key (stored encrypted in the vault, per project — every user brings their own), and publishing announces automatically. Verification is honest: the key is checked by listing your real connected channels.
- **A channel picker that can't lie.** Settings shows exactly the channels connected to your Buffer account — X, LinkedIn, Threads, Instagram, YouTube, and more — as toggles. Connect a new platform in Buffer, hit Test Connection, and it appears. Announcements only go to channels you've enabled, and one failing channel never blocks the others.
- **Announcement links finally point at the post.** URLs were built as \`site.com/slug\`, skipping the blog path entirely. They're now framework-aware (\`/blog/\` for Astro/Next.js, \`/posts/\` for Hugo) with a per-project **Post URL Path** override and a live preview in settings.
- **No more template fiddling.** The announcement text is composed automatically from the live title and URL at publish time. Want a custom message? Type one in the publish or schedule dialog — and if you forget to include the link, it's appended for you. The preview always shows exactly what will be posted.

## Migration

- Projects still on Upload-Post keep their "post on publish" setting, and publishing never breaks — announcements simply pause with a clear reconnect prompt in Settings → Social until a Buffer key is added. A one-click cleanup removes the old credentials (vault entry included).
`,
  },
  {
    title: "Wryte for desktop",
    slug: "desktop-1-0-0-wryte-for-desktop",
    description:
      "Wryte is now a native macOS desktop app — the full workspace in its own window, with automatic updates and a one-command Homebrew install.",
    version: "1.0.0",
    category: "desktop",
    build: "6527eb2",
    publishedAt: Date.parse("2026-07-14T18:00:00+05:00"),
    content: `## What's new

- **Native desktop app.** The whole Wryte workspace in a dedicated window, backed by the same Convex-cloud data — sign in once and everything syncs.
- **Automatic updates.** New versions download in the background; you get a plain "Update ready — Restart now / Later" prompt instead of a silent swap.
- **Install with Homebrew.** \`brew install --cask rafay99-epic/apps/wryte\` — opens cleanly, no Gatekeeper detours.
- **Locked-down shell.** Sandboxed with context isolation; device permissions (camera, mic, location) are denied by default, external links open in your browser.
`,
  },
  {
    title: "Window memory, zoom, and a branded About",
    slug: "desktop-1-0-4-window-memory-zoom-about",
    description:
      "Desktop quality-of-life: the app reopens exactly where you left it, text zoom that sticks, and a proper About window with project and license info.",
    version: "1.0.4",
    category: "desktop",
    build: "aeefd03",
    publishedAt: Date.parse("2026-07-15T13:00:00+05:00"),
    content: `## What's new

- **Window memory.** Size, position, and maximized state persist across launches — reopen right where you left off (and never off-screen if you unplug a monitor).
- **Back & forward.** Move through your history with \`Cmd [\` / \`Cmd ]\`, a trackpad swipe, or your mouse's side buttons.
- **Zoom controls.** \`Cmd +\` / \`Cmd −\` / \`Cmd 0\` scale the interface, and your zoom level is remembered.
- **Branded About window.** Company (Syntax Lab Technology), author (Abdul Rafay), the GitHub repo, and the MIT / open-source status — reachable from the app menu.
- **Real app menu.** About, Check for Updates, GitHub / Report an Issue, plus the standard editing and view shortcuts.

## Fixes

- Smoother scrolling — the macOS rubber-band overscroll that made a wrapped web app feel off is gone.
`,
  },
  {
    title: "Updates you can watch",
    slug: "desktop-1-0-5-updates-you-can-watch",
    description:
      "The in-app updater now shows real progress — checking, downloading with a live progress bar, then a one-click Restart & Install.",
    version: "1.0.5",
    category: "desktop",
    build: "8c59ed1",
    publishedAt: Date.parse("2026-07-15T15:00:00+05:00"),
    content: `## What's new

- **A visible update flow.** Check for Updates now opens a small window that walks the whole thing: checking → downloading (with a live progress bar and size) → **Restart & Install**, then the app relaunches into the new version.
- **Quiet in the background.** Automatic checks stay out of your way and only surface the window once an update has finished downloading and is ready to install.
- **Diagnosable.** Update activity is written to an \`updater.log\` in the app's data folder, so a stuck update leaves a trail instead of failing silently.

## Note for macOS

- The mac build is ad-hoc signed, so in-app install can be blocked by macOS's update signature checks. If an update won't apply, \`brew upgrade --cask wryte\` always works.
`,
  },
  {
    title: "Smoother launch and a draggable header",
    slug: "desktop-1-0-6-launch-and-title-bar",
    description:
      "A loading screen so launch never shows a blank window, a header you can grab to move the window, and background work that no longer gets throttled.",
    version: "1.0.6",
    category: "desktop",
    build: "ae99e8f",
    publishedAt: Date.parse("2026-07-15T17:00:00+05:00"),
    content: `## What's new

- **A real loading screen.** Launch now shows the Wryte mark and a spinner instantly and holds it until the app has painted — no more blank window during the initial load.
- **A header you can grab.** On macOS the window is frameless and the app's own header doubles as the title bar — the traffic-light buttons get their own space instead of overlapping the logo, and you can drag the header to move the window, including between monitors.
- **No background throttling.** Autosave and AI streaming keep running at full speed even when the window isn't focused.
`,
  },
];

const seedResult = v.object({
  inserted: v.number(),
  updated: v.number(),
  details: v.array(v.string()),
});

export const seed = action({
  args: {},
  returns: seedResult,
  handler: async (
    ctx,
  ): Promise<{ inserted: number; updated: number; details: string[] }> => {
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
        version: v.optional(v.string()),
        build: v.string(),
        category: v.optional(
          v.union(v.literal("website"), v.literal("desktop")),
        ),
        publishedAt: v.number(),
      }),
    ),
  },
  returns: seedResult,
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    const details: string[] = [];

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("changelog")
        .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
        .unique();

      const now = Date.now();

      if (existing) {
        // Upsert (migration): reconcile a row that was seeded under the old
        // version-based structure with the current entry definition. We
        // explicitly patch `version: entry.version` (which is `undefined` for
        // date-based entries) so Convex clears any stale version label left on
        // the existing row — `patch` treats `undefined` as "remove this field".
        // `createdAt` and `authorClerkUserId` are preserved.
        await ctx.db.patch(existing._id, {
          title: entry.title,
          description: entry.description,
          content: entry.content,
          build: entry.build,
          category: entry.category ?? "website",
          publishedAt: entry.publishedAt,
          version: entry.version,
          updatedAt: now,
        });
        updated += 1;
        details.push(`updated: ${entry.slug}`);
        continue;
      }

      await ctx.db.insert("changelog", {
        title: entry.title,
        slug: entry.slug,
        description: entry.description,
        content: entry.content,
        build: entry.build,
        category: entry.category ?? "website",
        publishedAt: entry.publishedAt,
        authorClerkUserId: args.authorClerkUserId,
        createdAt: now,
        updatedAt: now,
        ...(entry.version ? { version: entry.version } : {}),
      });
      inserted += 1;
      details.push(`inserted: ${entry.slug}`);
    }

    return { inserted, updated, details };
  },
});
