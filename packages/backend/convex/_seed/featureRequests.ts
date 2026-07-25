/**
 * ONE-SHOT SEED — delete `convex/_seed/featureRequests.ts` after running.
 *
 * Backfills the feature request board with the full Wryte feature
 * catalogue:
 *
 *   - **shipped** entries — everything that has already been built,
 *     pulled from the project's git history so the public board shows
 *     a record of work that landed even before the request board
 *     existed.
 *   - **in_progress / planned** entries — the next slate of work,
 *     drawn from the changelog roadmap.
 *   - **open** entries — outstanding community ideas that haven't been
 *     committed to a milestone yet.
 *
 * Triggered from the admin UI (`/admin/seed`) or:
 *
 *   bunx convex run _seed/featureRequests:seed
 *
 * Gated by `publicMetadata.role === "admin"` (see `convex/_lib/admin.ts`)
 * and rate-limited. Idempotent: each entry is keyed by `title`, so
 * re-runs skip already-present rows and report them under `skipped`.
 *
 * The admin who runs the seed is recorded as the Clerk user id on
 * every row, but the public `authorName` is fixed (see `AUTHOR_NAME`
 * below) so the seeded entries don't look like they were posted by
 * one specific person.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

type SeedStatus = "open" | "planned" | "in_progress" | "shipped" | "declined";

type SeedEntry = {
  title: string;
  description: string;
  status: SeedStatus;
  /** Seed votes so the list isn't all zeros on day one. */
  upvoteCount: number;
};

const AUTHOR_NAME = "Wryte team";

/**
 * Every entry sorted roughly by historical importance / community
 * traction. The vote counts are designed to give the public board a
 * believable spread on day one — shipped features carry the highest
 * counts (they're the proven wins), then in-progress, planned, and
 * open ideas in descending order.
 */
const ENTRIES: SeedEntry[] = [
  /* ---------------------------------------------------------------- */
  /*  SHIPPED — derived from git history (v0.0.1 → v0.5.3)             */
  /* ---------------------------------------------------------------- */

  {
    title: "Markdown editor with live preview",
    description:
      "Distraction-free markdown editor with a side-by-side preview pane that re-renders as you type.",
    status: "shipped",
    upvoteCount: 142,
  },
  {
    title: "Publish straight to GitHub",
    description:
      "One-click commits to a configured GitHub repo and branch, with frontmatter intact and clean commit messages.",
    status: "shipped",
    upvoteCount: 138,
  },
  {
    title: "AI-powered rewrite and enhance",
    description:
      "Highlight a selection and let the AI rewrite, summarise, expand, or polish it without leaving the editor.",
    status: "shipped",
    upvoteCount: 128,
  },
  {
    title: "Frontmatter schema editor",
    description:
      "Define a frontmatter schema per project — field types, defaults, required flags — so every new post starts consistent.",
    status: "shipped",
    upvoteCount: 116,
  },
  {
    title: "Bring your own AI keys (BYOK)",
    description:
      "Plug in your own Anthropic, OpenAI, or OpenRouter API keys. Keys are encrypted in WorkOS Vault and never proxied through Wryte.",
    status: "shipped",
    upvoteCount: 108,
  },
  {
    title: "Kanban board for content lifecycle",
    description:
      "Drag posts across draft → in-review → ready → published columns. Custom columns supported per project.",
    status: "shipped",
    upvoteCount: 102,
  },
  {
    title: "Scheduled publishing",
    description:
      "Pick a future date and time and Wryte commits to GitHub for you when the moment arrives, even weeks ahead.",
    status: "shipped",
    upvoteCount: 98,
  },
  {
    title: "Command palette (Cmd+K)",
    description:
      "Jump to any document, project, setting, or action with a single keystroke.",
    status: "shipped",
    upvoteCount: 94,
  },
  {
    title: "Per-project Cloudinary media storage",
    description:
      "Send uploaded images to your own Cloudinary account with folder selection and signed URLs.",
    status: "shipped",
    upvoteCount: 88,
  },
  {
    title: "Per-project UploadThing media storage",
    description:
      "Send uploaded images to your own UploadThing account with one-click credential rotation.",
    status: "shipped",
    upvoteCount: 86,
  },
  {
    title: "Client-side image compression before upload",
    description:
      "Compress images in the browser before they hit your storage provider. Per-project and per-account quality overrides.",
    status: "shipped",
    upvoteCount: 82,
  },
  {
    title: "Autosave with a manual save fallback",
    description:
      "Auto-save every keystroke, or turn it off and use Cmd+S — your call, per project.",
    status: "shipped",
    upvoteCount: 78,
  },
  {
    title: "Timezone-aware scheduling",
    description:
      "Pick a publish time in your timezone, stored as UTC, rendered correctly for every viewer.",
    status: "shipped",
    upvoteCount: 74,
  },
  {
    title: "WorkOS Vault for encrypted credentials",
    description:
      "All third-party API keys live in WorkOS Vault. Wryte holds opaque references, never plaintext secrets.",
    status: "shipped",
    upvoteCount: 70,
  },
  {
    title: "GitHub branch picker with auto-detection",
    description:
      "Pick the target branch when connecting a repo. Wryte auto-detects the default branch and lists every other one.",
    status: "shipped",
    upvoteCount: 68,
  },
  {
    title: "Multi-select bulk import from GitHub",
    description:
      "Pull dozens of existing posts into Wryte in one go. Workpool-paced so even hundreds of files don't trip rate limits.",
    status: "shipped",
    upvoteCount: 65,
  },
  {
    title: "Sync conflict resolution",
    description:
      "When GitHub and Convex have both edited a file since the last sync, Wryte surfaces a three-way diff so you choose what wins.",
    status: "shipped",
    upvoteCount: 62,
  },
  {
    title: "Document history and version snapshots",
    description:
      "Every save snapshots — scroll back through revisions and see exactly what changed.",
    status: "shipped",
    upvoteCount: 60,
  },
  {
    title: "Soft-delete trash with per-project retention",
    description:
      "Deleted documents linger in a project trash for a configurable window before a cleanup cron hard-deletes them.",
    status: "shipped",
    upvoteCount: 56,
  },
  {
    title: "Project favorites in sidebar",
    description:
      "Star your most-used projects to keep them pinned at the top of the sidebar under a dedicated section.",
    status: "shipped",
    upvoteCount: 54,
  },
  {
    title: "Schema-aware AI frontmatter suggestions",
    description:
      "AI suggestions respect each project's frontmatter schema — no leaks of image fields, dates, or the draft flag.",
    status: "shipped",
    upvoteCount: 52,
  },
  {
    title: "Dashboard with global search",
    description:
      "A unified dashboard showing quick stats, recent activity, and a fast keyboard-friendly search across every project.",
    status: "shipped",
    upvoteCount: 50,
  },
  {
    title: "YAML mode for the schema editor",
    description:
      "Edit your frontmatter schema in raw YAML that mirrors exactly how your posts will render.",
    status: "shipped",
    upvoteCount: 48,
  },
  {
    title: "Server-side Clerk OAuth for GitHub",
    description:
      "Scheduled publishes mint a fresh GitHub token at fire time, so jobs scheduled weeks ahead never fail on expired sessions.",
    status: "shipped",
    upvoteCount: 46,
  },
  {
    title: "Per-project frontmatter format (YAML or TOML)",
    description:
      "Pick the frontmatter delimiter that matches your static site generator — YAML for Astro, TOML for Hugo, etc.",
    status: "shipped",
    upvoteCount: 44,
  },
  {
    title: "Custom commit message templates",
    description:
      "Configure templates like `docs: update {{filename}}` so every publish lands in your repo with a consistent style.",
    status: "shipped",
    upvoteCount: 42,
  },
  {
    title: "Custom filename patterns for new posts",
    description:
      "Pick a filename pattern like `{{date}}-{{slug}}.md` and Wryte names every new draft accordingly.",
    status: "shipped",
    upvoteCount: 40,
  },
  {
    title: "Default author avatar per project",
    description:
      "Set a default author and avatar at the project level — auto-injected into the frontmatter of every new post.",
    status: "shipped",
    upvoteCount: 38,
  },
  {
    title: "Auto-injection of pubDate and draft flag",
    description:
      "Wryte stamps `pubDate` at publish time and toggles the `draft` flag according to your project's schema.",
    status: "shipped",
    upvoteCount: 36,
  },
  {
    title: "Diff-before-enqueue for bulk imports",
    description:
      "Bulk imports skip files that haven't changed in GitHub since the last sync, cutting noise on every refresh.",
    status: "shipped",
    upvoteCount: 34,
  },
  {
    title: "Self-destruct account reset",
    description:
      "Wipe every trace of your account — projects, documents, credentials, vault entries — with one confirmed click.",
    status: "shipped",
    upvoteCount: 32,
  },
  {
    title: "Public changelog page",
    description:
      "Browse every release at /changelog. CDN-cached, regenerated every minute, with sanitised markdown rendering.",
    status: "shipped",
    upvoteCount: 30,
  },
  {
    title: "Public feature request board with upvoting",
    description:
      "This page. Submit ideas, upvote others, watch the roadmap evolve in public.",
    status: "shipped",
    upvoteCount: 28,
  },
  {
    title: "Admin moderation surface",
    description:
      "Admin-only UI for managing changelog entries, feature requests, and seeding initial data — gated by Clerk roles.",
    status: "shipped",
    upvoteCount: 25,
  },
  {
    title: "Support tickets workflow",
    description:
      "Submit feedback or bug reports from the dashboard or marketing contact form. Statuses flow open → in progress → resolved → closed.",
    status: "shipped",
    upvoteCount: 24,
  },
  {
    title: "Marketing site (contact and how-it-works)",
    description:
      "Polished marketing surface explaining the editor → publish loop, with a contact page for anonymous outreach.",
    status: "shipped",
    upvoteCount: 22,
  },
  {
    title: "Rate limiting on every mutation",
    description:
      "Named token-bucket and fixed-window limits per operation, so editor auto-save stays snappy while destructive ops are tightly capped.",
    status: "shipped",
    upvoteCount: 20,
  },
  {
    title: "Vercel Web Analytics",
    description:
      "First-party analytics for every page view, without third-party trackers.",
    status: "shipped",
    upvoteCount: 18,
  },
  {
    title: "Open source under MIT",
    description:
      "The full Wryte codebase is public on GitHub under the MIT license, with a contributing guide and local dev setup.",
    status: "shipped",
    upvoteCount: 16,
  },
  {
    title: "Domain-organised Convex backend",
    description:
      "Convex functions live under clear domain folders (cms, media, ai, integrations, account, support) with end-to-end type safety.",
    status: "shipped",
    upvoteCount: 14,
  },

  /* ---------------------------------------------------------------- */
  /*  IN PROGRESS — actively being built                               */
  /* ---------------------------------------------------------------- */

  {
    title: "Real-time collaborative editing",
    description:
      "Live cursors and presence indicators so two people can edit one post without stepping on each other.",
    status: "in_progress",
    upvoteCount: 89,
  },
  {
    title: "MDX support alongside Markdown",
    description:
      "Embed React components in posts — callouts, video embeds, custom layouts — without dropping out of the editor.",
    status: "in_progress",
    upvoteCount: 72,
  },

  /* ---------------------------------------------------------------- */
  /*  PLANNED — next slate of work                                     */
  /* ---------------------------------------------------------------- */

  {
    title: "Bulk import from Notion",
    description:
      "Pipe a Notion workspace into a Wryte project with frontmatter mapping and image migration in one go.",
    status: "planned",
    upvoteCount: 54,
  },
  {
    title: "Per-project AI prompt templates",
    description:
      "Save reusable prompts per project (e.g. 'rewrite for the blog voice', 'summarise for social') and one-click apply them to selections.",
    status: "planned",
    upvoteCount: 48,
  },
  {
    title: "Custom domains for the public changelog",
    description:
      "Point changelog.mysite.com at the Wryte-hosted changelog so it lives under your own brand.",
    status: "planned",
    upvoteCount: 42,
  },

  /* ---------------------------------------------------------------- */
  /*  OPEN — community wishlist, no milestone yet                      */
  /* ---------------------------------------------------------------- */

  {
    title: "GitLab and Bitbucket publishing",
    description:
      "Same publishing flow as GitHub, just pointed at GitLab or Bitbucket repos.",
    status: "open",
    upvoteCount: 31,
  },
  {
    title: "Scheduled social posts when a draft publishes",
    description:
      "Auto-cross-post to X, LinkedIn, or Bluesky when a document is published, with a per-network template.",
    status: "open",
    upvoteCount: 28,
  },
  {
    title: "Mobile app for capturing rough drafts on the go",
    description:
      "Minimal iOS/Android app for getting ideas down quickly — full editing can stay on the web.",
    status: "open",
    upvoteCount: 24,
  },
  {
    title: "Version history with one-click rollback",
    description:
      "Every save creates a snapshot you can diff against and roll back to without going through GitHub.",
    status: "open",
    upvoteCount: 19,
  },
  {
    title: "Multi-author teams with role permissions",
    description:
      "Invite teammates to a project with editor / reviewer / admin roles and per-role permissions on publish.",
    status: "open",
    upvoteCount: 15,
  },
];

const STATUS_VALIDATOR = v.union(
  v.literal("open"),
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("shipped"),
  v.literal("declined"),
);

export const seed = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ inserted: number; skipped: number; details: string[] }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });

    const clerkUserId = await requireAdmin(ctx);
    return await ctx.runMutation(internal._seed.featureRequests._seedInternal, {
      authorClerkUserId: clerkUserId,
      authorName: AUTHOR_NAME,
      entries: ENTRIES,
    });
  },
});

export const _seedInternal = internalMutation({
  args: {
    authorClerkUserId: v.string(),
    authorName: v.string(),
    entries: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        status: STATUS_VALIDATOR,
        upvoteCount: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skipped = 0;
    const details: string[] = [];

    // Pull every existing title once so we can dedupe in O(1) per
    // entry instead of issuing a query per seed row.
    const existing = await ctx.db.query("feature_requests").take(1000);
    const existingTitles = new Set(existing.map((r) => r.title));

    for (const entry of args.entries) {
      if (existingTitles.has(entry.title)) {
        skipped += 1;
        details.push(`skipped (already exists): ${entry.title}`);
        continue;
      }

      const now = Date.now();
      await ctx.db.insert("feature_requests", {
        title: entry.title,
        description: entry.description,
        status: entry.status,
        authorClerkUserId: args.authorClerkUserId,
        authorName: args.authorName,
        // Seed votes live on the row; no `feature_request_upvotes`
        // join rows are inserted, so real users still have to vote
        // to be recorded as having voted and can't double-vote on
        // top of the seed.
        upvoteCount: entry.upvoteCount,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
      details.push(`inserted: ${entry.title}`);
    }

    return { inserted, skipped, details };
  },
});
