/**
 * Per-project code-animation components — backend module (standalone).
 *
 * An animation is a user-authored React component (raw TSX source) referenced
 * from MDX bodies by its PascalCase name (`<HarnessLoop />`). The editor
 * preview compiles the source live; publish commits it as a `.tsx` file under
 * `projects.animationsPath` and injects the import into the post. Rows are
 * shared-mutable — one component per name, reused across every post in the
 * project (edits propagate on the next publish of each referencing post).
 *
 * Mirrors `snippets.ts`: own table (never bloats the hot `projects` doc),
 * ownership resolved through the project, every mutation rate-limited.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/* Caps. Source cap is generous — a hand-written animation island is a few KB;
 * 100KB catches runaway pastes long before the 1MB Convex document limit. */
const MAX_ANIMATIONS = 200;
const MAX_ANIMATION_NAME = 60;
const MAX_ANIMATION_SOURCE = 100_000;

/**
 * Component names must be valid PascalCase JS identifiers — they're used
 * verbatim as JSX tags, import specifiers, and `.tsx` filenames.
 */
const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Names that collide with MDX/React internals or the preview's component
 * map. Lowercase HTML overrides (img, table…) can't collide with PascalCase,
 * so only capitalized reserved words need listing.
 */
const RESERVED_NAMES = new Set(["Fragment", "React", "Component", "Suspense"]);

/** Lightweight client shape — the editor needs id + name + source. */
export type AnimationView = {
  _id: Id<"animations">;
  name: string;
  source: string;
  updatedAt: number;
};
const toView = (d: Doc<"animations">): AnimationView => ({
  _id: d._id,
  name: d.name,
  source: d.source,
  updatedAt: d.updatedAt,
});

/* ------------------------------------------------------------------ */
/*  Ownership helpers (same contract as snippets.ts)                    */
/* ------------------------------------------------------------------ */

async function ownedProjectForQuery(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return null;
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== user._id) return null;
  return project;
}

async function requireOwnedProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await getCurrentUser(ctx);
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this project");
  }
  return project;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                          */
/* ------------------------------------------------------------------ */

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Component name is required");
  if (name.length > MAX_ANIMATION_NAME) {
    throw new Error(
      `Component name must be ${String(MAX_ANIMATION_NAME)} characters or fewer`,
    );
  }
  if (!NAME_RE.test(name)) {
    throw new Error(
      "Component name must be PascalCase — start with a capital letter, letters and digits only (e.g. HarnessLoop)",
    );
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`"${name}" is a reserved name — pick another`);
  }
  return name;
}

/** Source is stored verbatim — only the size is capped here. Structural
 * rules (single default export, allowlisted imports) are enforced by the
 * editor's compile step and re-checked at publish. */
function validateSource(raw: string): string {
  if (!raw.trim()) throw new Error("Component source is required");
  if (raw.length > MAX_ANIMATION_SOURCE) {
    throw new Error(
      `Component source must be ${String(MAX_ANIMATION_SOURCE)} characters or fewer`,
    );
  }
  return raw;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every animation in the project — bounded by MAX_ANIMATIONS, so a single
 * take covers the full set. Powers the editor preview's component map and
 * the author sheet's "existing animations" list.
 */
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<AnimationView[]> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return [];
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(MAX_ANIMATIONS);
    return rows.map(toView);
  },
});

/**
 * Posts whose MAIN body references `<Name`. Powers the reference-checked
 * delete flow: a component still used by posts can't be deleted until the
 * tags are removed.
 *
 * Cost note: this scans document bodies ON DEMAND, only when a delete is
 * being considered — deliberately NOT an edge table maintained on the
 * autosave hot path (the wiki-links approach); delete is far too rare to
 * justify taxing every save. Convex bills bytes read, so the scan is the
 * entire cost of the feature and it's paid once per delete attempt.
 *
 * ponytail: bounded scan — first 500 content rows per project, larger
 * projects return `truncated: true` and the UI warns instead of blocking.
 * Switch to a client-driven paginated loop if any project outgrows this.
 */
export const usage = query({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    posts: { documentId: Id<"documents">; title: string }[];
    truncated: boolean;
  }> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return { posts: [], truncated: false };

    // Name is validated PascalCase ([A-Za-z0-9]+) so it's regex-safe.
    // `<Name` followed by whitespace, `/`, or `>` — never matches a longer
    // component name that shares the prefix.
    const tagRe = new RegExp(`<${args.name}[\\s/>]`);
    const SCAN_LIMIT = 500;
    const rows = await ctx.db
      .query("document_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(SCAN_LIMIT + 1);
    const truncated = rows.length > SCAN_LIMIT;

    const posts: { documentId: Id<"documents">; title: string }[] = [];
    for (const row of rows.slice(0, SCAN_LIMIT)) {
      if (!tagRe.test(row.content)) continue;
      const doc = await ctx.db.get(row.documentId);
      if (doc && doc.trashedAt === undefined) {
        posts.push({ documentId: doc._id, title: doc.title });
      }
    }
    return { posts, truncated };
  },
});

/**
 * Server-side lookup for the publish pipeline (github.ts) — ownership is
 * already verified by the caller before the publish action runs.
 */
export const internalListByProject = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ name: string; source: string }[]> => {
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_ANIMATIONS);
    return rows.map((d) => ({ name: d.name, source: d.source }));
  },
});

/* ------------------------------------------------------------------ */
/*  Mutations                                                           */
/* ------------------------------------------------------------------ */

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args): Promise<AnimationView> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "animations:create", { key, throws: true });

    await requireOwnedProject(ctx, args.projectId);

    const name = normalizeName(args.name);
    const source = validateSource(args.source);

    const existing = await ctx.db
      .query("animations")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", args.projectId).eq("name", name),
      )
      .unique();
    if (existing) {
      throw new Error(
        `An animation named "${name}" already exists in this project`,
      );
    }

    // Bounded existence check for the cap — cheaper than a denormalized
    // counter at this table's expected size.
    const all = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_ANIMATIONS);
    if (all.length >= MAX_ANIMATIONS) {
      throw new Error(
        `You've reached the limit of ${String(MAX_ANIMATIONS)} animations for this project.`,
      );
    }

    const now = Date.now();
    const animationId = await ctx.db.insert("animations", {
      projectId: args.projectId,
      name,
      source,
      updatedAt: now,
    });

    return { _id: animationId, name, source, updatedAt: now };
  },
});

export const update = mutation({
  args: {
    animationId: v.id("animations"),
    source: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "animations:update", { key, throws: true });

    const animation = await ctx.db.get(args.animationId);
    if (!animation) throw new Error("Animation not found");
    await requireOwnedProject(ctx, animation.projectId);

    // Name is deliberately immutable — it's the reference key inside every
    // post body. Renaming would silently break `<OldName />` tags; delete
    // and re-create instead.
    await ctx.db.patch(args.animationId, {
      source: validateSource(args.source),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { animationId: v.id("animations") },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "animations:remove", { key, throws: true });

    const animation = await ctx.db.get(args.animationId);
    if (!animation) return null; // idempotent
    await requireOwnedProject(ctx, animation.projectId);

    await ctx.db.delete(args.animationId);
    return null;
  },
});
