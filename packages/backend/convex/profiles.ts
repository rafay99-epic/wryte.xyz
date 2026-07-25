/**
 * Public writing profile — `wryte.xyz/@username`.
 *
 * `getPublicProfile` is the one unauthenticated surface here; it follows the
 * same discipline as `cms/shareLinks.getByToken` — it reads freely but
 * returns ONLY a curated shape, never raw user/document rows, never the
 * email. Everything is gated on `profilePublic`; the streak + heatmap are
 * gated again on `profileShowStats` because they reveal writing cadence.
 *
 * The handle mirrors the Clerk username (source of truth). `syncMyUsername`
 * pulls it via the Clerk backend SDK and stores it lowercased for lookup —
 * no webhook needed; the settings UI syncs on mount, so the handle refreshes
 * whenever the user manages their profile.
 */
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getAuthedUserOrNull } from "./_lib/auth";
import { buildPublishedUrl } from "./_lib/publishedUrl";
import { getRateLimitKey, rateLimiter } from "./_lib/rateLimits";

const PREVIEW_TOKEN_RE = /^[a-zA-Z0-9-]{20,64}$/;

const HANDLE_RE = /^[a-z0-9_-]{1,64}$/;
const MAX_BIO = 280;
const MAX_LINKS = 6;
const MAX_POSTS = 50;
// Mirror of src/features/profile/accents.ts keys — kept as a small closed set
// so the Convex validator doesn't reach into the frontend bundle.
const ACCENT_KEYS = new Set([
  "teal",
  "blue",
  "violet",
  "rose",
  "amber",
  "green",
]);

export type SocialLink = { label: string; url: string };

/**
 * Force an absolute URL. Project Site URLs are often stored without a scheme
 * (e.g. "rafay99.com"), which the browser would treat as a relative link.
 */
function toAbsolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}

function parseSocialLinks(raw: string | undefined): SocialLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is SocialLink =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as SocialLink).label === "string" &&
          typeof (l as SocialLink).url === "string",
      )
      .slice(0, MAX_LINKS);
  } catch {
    return [];
  }
}

const SOCIAL_LINK = v.object({ label: v.string(), url: v.string() });

const POST_ITEM = v.object({
  title: v.string(),
  url: v.string(),
  publishedAt: v.number(),
  projectName: v.string(),
});

type PostItem = {
  title: string;
  url: string;
  publishedAt: number;
  projectName: string;
};

const PUBLIC_PROFILE = v.object({
  username: v.string(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  bio: v.optional(v.string()),
  joinedAt: v.number(),
  accent: v.optional(v.string()),
  feedUrl: v.optional(v.string()),
  socialLinks: v.array(SOCIAL_LINK),
  sites: v.array(v.object({ name: v.string(), url: v.string() })),
  topics: v.array(v.string()),
  featured: v.optional(POST_ITEM),
  posts: v.array(POST_ITEM),
  stats: v.optional(
    v.object({
      totalPublished: v.number(),
      totalWords: v.number(),
      currentStreak: v.number(),
      longestStreak: v.number(),
    }),
  ),
  heatmap: v.optional(
    v.array(v.object({ date: v.string(), words: v.number() })),
  ),
});

type ProfileResult = {
  username: string;
  name: string;
  imageUrl?: string;
  bio?: string;
  joinedAt: number;
  accent?: string;
  feedUrl?: string;
  socialLinks: SocialLink[];
  sites: { name: string; url: string }[];
  topics: string[];
  featured?: PostItem;
  posts: PostItem[];
  stats?: {
    totalPublished: number;
    totalWords: number;
    currentStreak: number;
    longestStreak: number;
  };
  heatmap?: { date: string; words: number }[];
};

/**
 * Build the curated public shape for a loaded user — shared by the public
 * and preview queries. Read-only; returns only whitelisted fields.
 */
async function assembleProfile(
  ctx: QueryCtx,
  user: Doc<"users">,
  username: string,
): Promise<ProfileResult> {
  {
    // Published posts across every project the user owns. Only those whose
    // project has a siteUrl are linkable — a profile link that 404s is worse
    // than an omitted post.
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "published"),
      )
      .order("desc")
      .take(200);

    type ProjectInfo = {
      siteUrl?: string;
      name: string;
      postUrlPrefix?: string;
      framework?: string;
    };
    const projectCache = new Map<string, ProjectInfo | null>();
    const resolveProject = async (
      projectId: (typeof docs)[number]["projectId"],
    ): Promise<ProjectInfo | null> => {
      const cached = projectCache.get(projectId);
      if (cached !== undefined) return cached;
      const p = await ctx.db.get(projectId);
      const info: ProjectInfo | null = p
        ? {
            name: p.name,
            ...(p.siteUrl !== undefined ? { siteUrl: p.siteUrl } : {}),
            ...(p.postUrlPrefix !== undefined
              ? { postUrlPrefix: p.postUrlPrefix }
              : {}),
            ...(p.framework !== undefined ? { framework: p.framework } : {}),
          }
        : null;
      projectCache.set(projectId, info);
      return info;
    };

    // One pass over published docs: collect linkable posts, tally tags for the
    // topics cloud, and the distinct sites they live on.
    const linkable: (PostItem & {
      documentId: string;
      siteUrl: string;
      siteName: string;
    })[] = [];
    const tagCounts = new Map<string, number>();
    for (const doc of docs) {
      if (doc.trashedAt !== undefined) continue;
      const project = await resolveProject(doc.projectId);
      if (!project?.siteUrl) continue;
      for (const tag of doc.tags ?? []) {
        const t = tag.trim();
        if (t) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
      linkable.push({
        documentId: doc._id,
        siteUrl: project.siteUrl,
        siteName: project.name,
        title: doc.title,
        url: toAbsolute(
          buildPublishedUrl({
            siteUrl: project.siteUrl,
            slug: doc.slug,
            postUrlPrefix: project.postUrlPrefix,
            framework: project.framework,
          }),
        ),
        publishedAt: doc.publishedAt ?? doc.updatedAt,
        projectName: project.name,
      });
    }
    linkable.sort((a, b) => b.publishedAt - a.publishedAt);

    const toPostItem = (p: (typeof linkable)[number]): PostItem => ({
      title: p.title,
      url: p.url,
      publishedAt: p.publishedAt,
      projectName: p.projectName,
    });

    // Featured post — pinned to the top and removed from the main list.
    let featured: PostItem | undefined;
    if (user.featuredDocumentId) {
      const match = linkable.find(
        (p) => p.documentId === user.featuredDocumentId,
      );
      if (match) featured = toPostItem(match);
    }

    const posts = linkable
      .filter((p) => p.documentId !== user.featuredDocumentId)
      .slice(0, MAX_POSTS)
      .map(toPostItem);

    // Distinct sites (homepages), for the "Visit site" buttons.
    const siteMap = new Map<string, string>();
    for (const p of linkable) {
      const abs = toAbsolute(p.siteUrl);
      if (!siteMap.has(abs)) siteMap.set(abs, p.siteName);
    }
    const sites = [...siteMap.entries()]
      .slice(0, 5)
      .map(([url, name]) => ({ name, url }));

    const topics = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const result: ProfileResult = {
      username,
      name: user.name,
      ...(user.imageUrl !== undefined ? { imageUrl: user.imageUrl } : {}),
      ...(user.bio ? { bio: user.bio } : {}),
      joinedAt: user.createdAt,
      ...(user.profileAccent ? { accent: user.profileAccent } : {}),
      ...(user.feedUrl ? { feedUrl: user.feedUrl } : {}),
      socialLinks: parseSocialLinks(user.socialLinks),
      sites,
      topics,
      ...(featured ? { featured } : {}),
      posts,
    };

    if (user.profileShowStats === true) {
      const stats = await ctx.db
        .query("writing_stats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique();
      if (stats) {
        result.stats = {
          totalPublished: stats.totalPublished,
          totalWords: stats.totalWords,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
        };
        result.heatmap = stats.recentActivity;
      }
    }

    return result;
  }
}

/**
 * PUBLIC — a handle → curated profile, or null when unknown or private
 * (indistinguishable on purpose).
 */
export const getPublicProfile = query({
  args: { username: v.string() },
  returns: v.union(v.null(), PUBLIC_PROFILE),
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (!HANDLE_RE.test(username)) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (!user || user.profilePublic !== true) return null;
    return await assembleProfile(ctx, user, username);
  },
});

/**
 * PREVIEW — the owner's profile via a secret token, visible even while
 * private. The token is the credential (mirrors cms/shareLinks). `isPublic`
 * lets the page badge "private preview" vs "already live".
 */
export const getProfilePreview = query({
  args: { username: v.string(), token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ isPublic: v.boolean(), profile: PUBLIC_PROFILE }),
  ),
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();
    if (!HANDLE_RE.test(username)) return null;
    if (!PREVIEW_TOKEN_RE.test(args.token)) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (!user || user.profilePreviewToken !== args.token) return null;
    return {
      isPublic: user.profilePublic === true,
      profile: await assembleProfile(ctx, user, username),
    };
  },
});

/**
 * Ensure the owner has a preview token (generated client-side, shape-checked
 * here — same convention as shareLinks). Idempotent: reuses the existing one.
 */
export const ensurePreviewToken = mutation({
  args: { token: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) throw new ConvexError({ message: "Not authenticated" });
    if (user.profilePreviewToken) return user.profilePreviewToken;
    if (!PREVIEW_TOKEN_RE.test(args.token)) {
      throw new ConvexError({ message: "Invalid preview token." });
    }
    await ctx.db.patch(user._id, { profilePreviewToken: args.token });
    return args.token;
  },
});

/** Owner view for the settings section. */
export const getMyProfile = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      username: v.union(v.string(), v.null()),
      bio: v.string(),
      socialLinks: v.array(SOCIAL_LINK),
      profilePublic: v.boolean(),
      profileShowStats: v.boolean(),
      profileAccent: v.string(),
      feedUrl: v.string(),
      featuredDocumentId: v.union(v.id("documents"), v.null()),
      previewToken: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    return {
      username: user.username ?? null,
      bio: user.bio ?? "",
      socialLinks: parseSocialLinks(user.socialLinks),
      profilePublic: user.profilePublic === true,
      profileShowStats: user.profileShowStats === true,
      profileAccent: user.profileAccent ?? "teal",
      feedUrl: user.feedUrl ?? "",
      featuredDocumentId: user.featuredDocumentId ?? null,
      previewToken: user.profilePreviewToken ?? null,
    };
  },
});

/** The user's published posts — for the "featured post" picker in settings. */
export const myPublishedPosts = query({
  args: {},
  returns: v.array(v.object({ id: v.id("documents"), title: v.string() })),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "published"),
      )
      .order("desc")
      .take(100);
    return docs
      .filter((d) => d.trashedAt === undefined)
      .map((d) => ({ id: d._id, title: d.title }));
  },
});

/** Save bio / links / visibility / stats opt-in. */
export const updateProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    socialLinks: v.optional(v.array(SOCIAL_LINK)),
    profilePublic: v.optional(v.boolean()),
    profileShowStats: v.optional(v.boolean()),
    profileAccent: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    // null clears the pin; an id sets it (validated to be the user's own).
    featuredDocumentId: v.optional(v.union(v.id("documents"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "profiles:update", { key, throws: true });

    const user = await getAuthedUserOrNull(ctx);
    if (!user) throw new ConvexError({ message: "Not authenticated" });

    const patch: Record<string, unknown> = {};

    if (args.profileAccent !== undefined) {
      // A preset key, or a custom #rrggbb from the color wheel.
      const isHex = /^#[0-9a-fA-F]{6}$/.test(args.profileAccent);
      if (!ACCENT_KEYS.has(args.profileAccent) && !isHex) {
        throw new ConvexError({ message: "Invalid accent color." });
      }
      patch["profileAccent"] = isHex
        ? args.profileAccent.toLowerCase()
        : args.profileAccent;
    }

    if (args.feedUrl !== undefined) {
      const feedUrl = args.feedUrl.trim();
      if (feedUrl) {
        let parsed: URL;
        try {
          parsed = new URL(feedUrl);
        } catch {
          throw new ConvexError({ message: "Feed URL is not valid." });
        }
        if (parsed.protocol !== "https:") {
          throw new ConvexError({
            message: "Feed URL must start with https://",
          });
        }
      }
      patch["feedUrl"] = feedUrl || undefined;
    }

    if (args.featuredDocumentId !== undefined) {
      if (args.featuredDocumentId === null) {
        patch["featuredDocumentId"] = undefined;
      } else {
        const doc = await ctx.db.get(args.featuredDocumentId);
        if (!doc || doc.userId !== user._id) {
          throw new ConvexError({ message: "That post isn't yours." });
        }
        patch["featuredDocumentId"] = args.featuredDocumentId;
      }
    }

    if (args.bio !== undefined) {
      const bio = args.bio.trim();
      if (bio.length > MAX_BIO) {
        throw new ConvexError({
          message: `Bio must be ${MAX_BIO} characters or fewer.`,
        });
      }
      patch["bio"] = bio || undefined;
    }

    if (args.socialLinks !== undefined) {
      const cleaned: SocialLink[] = [];
      for (const link of args.socialLinks.slice(0, MAX_LINKS)) {
        const label = link.label.trim().slice(0, 40);
        const url = link.url.trim();
        if (!label || !url) continue;
        // https-only — an http/javascript: link on a public page is a footgun.
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          throw new ConvexError({ message: `"${url}" is not a valid URL.` });
        }
        if (parsed.protocol !== "https:") {
          throw new ConvexError({
            message: "Links must start with https://",
          });
        }
        cleaned.push({ label, url });
      }
      patch["socialLinks"] = cleaned.length
        ? JSON.stringify(cleaned)
        : undefined;
    }

    if (args.profilePublic !== undefined) {
      // Can't go public without a handle to be reached at.
      if (args.profilePublic && !user.username) {
        throw new ConvexError({
          message:
            "Set a username in your account first — it's your profile's public address.",
        });
      }
      patch["profilePublic"] = args.profilePublic;
    }
    if (args.profileShowStats !== undefined) {
      patch["profileShowStats"] = args.profileShowStats;
    }

    await ctx.db.patch(user._id, patch);
    return null;
  },
});

/**
 * Mirror the Clerk username onto the Convex row (lowercased). Clerk is the
 * source of truth, so the CLIENT passes `clerkUser.username` (it already has
 * it via `useUser()`) — no server-side Clerk SDK call, no cross-runtime
 * Node action. Skips claiming a handle another user already holds.
 */
export const setMyUsername = mutation({
  args: { username: v.union(v.string(), v.null()) },
  returns: v.object({ username: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "profiles:sync", { key, throws: true });

    const user = await getAuthedUserOrNull(ctx);
    if (!user) throw new ConvexError({ message: "Not authenticated" });

    const username = args.username ? args.username.trim().toLowerCase() : null;

    // A Clerk username that isn't URL-handle-shaped can't be a profile URL —
    // clear ours rather than store something the route can't resolve.
    if (username && !HANDLE_RE.test(username)) {
      if (user.username !== undefined) {
        await ctx.db.patch(user._id, { username: undefined });
      }
      return { username: null };
    }

    if (username) {
      const holder = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (holder && holder._id !== user._id) {
        // Taken by someone else — keep whatever we already had.
        return { username: user.username ?? null };
      }
    }

    if (user.username !== (username ?? undefined)) {
      await ctx.db.patch(user._id, { username: username ?? undefined });
    }
    return { username };
  },
});
