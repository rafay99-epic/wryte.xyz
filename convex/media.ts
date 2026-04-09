/**
 * Media staging — temporary Convex file storage for images.
 *
 * Images live here while documents are in draft. At publish time,
 * the publish action uploads them to GitHub and deletes them from Convex.
 */
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getRateLimitKey, rateLimiter } from "./rateLimits";

/**
 * Generate a short-lived upload URL for the client to POST a file to.
 * The client calls this, gets a URL, uploads the binary, then calls
 * `saveMedia` with the returned storageId.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:generateUploadUrl", {
      key,
      throws: true,
    });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * After the client uploads the file to the generated URL, call this
 * mutation to record the media entry and get back a serving URL.
 */
export const saveMedia = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:saveMedia", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const mediaId = await ctx.db.insert("media", {
      projectId: args.projectId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      syncedToGithub: false,
      createdAt: Date.now(),
      ...(args.documentId ? { documentId: args.documentId } : {}),
    });

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get storage URL");

    return { mediaId, url };
  },
});

/**
 * List all staged (unsynced) media for a project.
 */
export const listStaged = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const items = await ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Return with serving URLs
    const result = [];
    for (const item of items) {
      if (item.syncedToGithub) continue;
      const url = await ctx.storage.getUrl(item.storageId);
      if (url) {
        result.push({
          _id: item._id,
          fileName: item.fileName,
          contentType: item.contentType,
          size: item.size,
          url,
          createdAt: item.createdAt,
          documentId: item.documentId,
        });
      }
    }

    return result;
  },
});

/**
 * Get a serving URL for a storageId. Used to resolve Convex media URLs.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Delete a staged media file (from Convex storage + DB record).
 */
export const deleteStaged = mutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:deleteStaged", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const media = await ctx.db.get(args.mediaId);
    if (!media) throw new Error("Media not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error("User not found");

    const project = await ctx.db.get(media.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Delete from storage and DB
    await ctx.storage.delete(media.storageId);
    await ctx.db.delete(args.mediaId);
  },
});

/* ------------------------------------------------------------------ */
/*  Internal functions used by the publish actions                      */
/* ------------------------------------------------------------------ */

/**
 * Internal query: get all unsynced media for a project, including
 * the raw binary content (base64) for uploading to GitHub.
 */
export const internalGetUnsyncedMedia = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const result = [];
    for (const item of items) {
      if (item.syncedToGithub) continue;
      const url = await ctx.storage.getUrl(item.storageId);
      if (url) {
        result.push({
          _id: item._id,
          storageId: item.storageId,
          fileName: item.fileName,
          contentType: item.contentType,
          url,
        });
      }
    }
    return result;
  },
});

/**
 * Internal mutation: mark media as synced to GitHub and then delete
 * from Convex storage (we don't want to keep the binary around).
 */
export const internalMarkSyncedAndDelete = internalMutation({
  args: {
    mediaId: v.id("media"),
    githubPath: v.string(),
  },
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media) return;

    // Delete the binary from Convex storage
    await ctx.storage.delete(media.storageId);

    // Update record to mark as synced (keep record briefly for reference,
    // but the storage blob is gone)
    await ctx.db.patch(args.mediaId, {
      syncedToGithub: true,
      githubPath: args.githubPath,
    });
  },
});

/**
 * Internal mutation: clean up media records that have been synced
 * (delete the DB records since the blobs are already gone).
 */
export const internalCleanupSynced = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const item of items) {
      if (item.syncedToGithub) {
        await ctx.db.delete(item._id);
      }
    }
  },
});
