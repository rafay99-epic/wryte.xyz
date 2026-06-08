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
  {
    title: "Social media cross-posting and settings refactor",
    slug: "v0-7-4-social-posting-and-settings-refactor",
    description:
      "Auto-announce new blog posts to X, LinkedIn, Bluesky, Threads, Facebook, and Reddit via Upload-Post. Account and project settings pages refactored into modular components.",
    version: "0.7.4",
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
    version: "0.7.5",
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
    version: "0.8.0",
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
    version: "0.9.0",
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
    version: "0.10.0",
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
    version: "0.11.0",
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
    version: "0.12.0",
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
