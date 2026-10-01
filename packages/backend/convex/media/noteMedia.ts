import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import {
  loadNoteSettings,
  noteMediaSettingValidator,
  resolveNoteSource,
} from "./_lib/noteSource";
import { normalizeNoteMediaPath, pickProjectProvider } from "./_lib/owner";
import {
  CREDENTIAL_PROVIDER_IDS,
  type CredentialProvider,
  credentialProviderValidator,
  credentialStatusValidator,
  type MediaCredentialStatus,
  type MediaProvider,
} from "./_lib/providers";
import { adjustUsage } from "./_lib/usage";

const PURGE_BATCH = 100;
const DETECT_LIMIT = 50;
const MAX_MEDIA_PATH = 200;

const isActive = (status: MediaCredentialStatus) => status === "active";

export const sources = query({
  args: {},
  returns: v.object({
    detected: v.array(
      v.object({
        projectId: v.id("projects"),
        projectName: v.string(),
        provider: credentialProviderValidator,
      }),
    ),
    own: v.array(
      v.object({
        provider: credentialProviderValidator,
        status: credentialStatusValidator,
      }),
    ),
  }),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { detected: [], own: [] };

    const [rows, ownRows] = await Promise.all([
      ctx.db
        .query("mediaCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", user._id))
        .take(DETECT_LIMIT),
      ctx.db
        .query("mediaCredentials")
        .withIndex("by_userId_and_projectId_and_provider", (q) =>
          q.eq("userId", user._id).eq("projectId", undefined),
        )
        .take(CREDENTIAL_PROVIDER_IDS.length),
    ]);

    const byProject = new Map<
      Id<"projects">,
      Array<{ provider: CredentialProvider; status: MediaCredentialStatus }>
    >();
    for (const row of rows) {
      if (row.projectId === undefined) continue;
      const list = byProject.get(row.projectId) ?? [];
      list.push({ provider: row.provider, status: row.status });
      byProject.set(row.projectId, list);
    }

    const detected: Array<{
      projectId: Id<"projects">;
      projectName: string;
      provider: CredentialProvider;
    }> = [];
    for (const [projectId, credentials] of byProject) {
      const project = await ctx.db.get(projectId);
      if (!project || project.userId !== user._id) continue;
      const provider = pickProjectProvider(
        project.mediaStorageMode,
        credentials,
        isActive,
      );
      if (provider) {
        detected.push({ projectId, projectName: project.name, provider });
      }
    }

    return {
      detected,
      own: ownRows.map((row) => ({
        provider: row.provider,
        status: row.status,
      })),
    };
  },
});

export const getSettings = query({
  args: {},
  returns: v.union(
    v.object({
      media: v.optional(noteMediaSettingValidator),
      mediaPath: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const settings = await loadNoteSettings(ctx, user._id);
    if (!settings) return null;
    return {
      mediaPath: settings.mediaPath,
      ...(settings.media !== undefined ? { media: settings.media } : {}),
    };
  },
});

export const setSource = mutation({
  args: {
    source: v.union(noteMediaSettingValidator, v.null()),
    mediaPath: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) throw new Error("Not authenticated");

    if (args.source) {
      const decision = await resolveNoteSource(
        ctx,
        user._id,
        args.source,
        isActive,
      );
      if (!decision.ok) throw new Error(decision.reason);
    }

    const settings = await loadNoteSettings(ctx, user._id);
    const mediaPath =
      args.mediaPath !== undefined
        ? normalizeNoteMediaPath(args.mediaPath)
        : (settings?.mediaPath ?? normalizeNoteMediaPath(undefined));
    if (mediaPath.length > MAX_MEDIA_PATH) {
      throw new Error(`Folder must be ${MAX_MEDIA_PATH} characters or fewer.`);
    }
    const media = args.source ?? undefined;

    if (settings) {
      await ctx.db.patch(settings._id, { media, mediaPath });
    } else {
      await ctx.db.insert("note_settings", {
        userId: user._id,
        mediaPath,
        ...(media !== undefined ? { media } : {}),
      });
    }
    return null;
  },
});

export const _purgeForNote = internalMutation({
  args: { noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("media")
      .withIndex("by_noteId", (q) => q.eq("noteId", args.noteId))
      .take(PURGE_BATCH);

    const freed = new Map<Id<"users">, { files: number; bytes: number }>();
    const refs = new Map<
      Id<"users">,
      Array<{
        provider: MediaProvider;
        externalId: string;
        sourceProjectId?: Id<"projects">;
      }>
    >();
    for (const row of rows) {
      await ctx.db.delete(row._id);
      if (row.userId === undefined) continue;
      const total = freed.get(row.userId) ?? { files: 0, bytes: 0 };
      freed.set(row.userId, {
        files: total.files + 1,
        bytes: total.bytes + (row.bytes ?? 0),
      });
      if (row.provider !== undefined && row.externalId !== undefined) {
        const list = refs.get(row.userId) ?? [];
        list.push({
          provider: row.provider,
          externalId: row.externalId,
          ...(row.sourceProjectId !== undefined
            ? { sourceProjectId: row.sourceProjectId }
            : {}),
        });
        refs.set(row.userId, list);
      }
    }

    for (const [userId, total] of freed) {
      await adjustUsage(
        ctx,
        { userId, projectId: undefined },
        { files: -total.files, bytes: -total.bytes, uploads: 0 },
      );
    }
    for (const [userId, list] of refs) {
      await ctx.scheduler.runAfter(
        0,
        internal.media.uploads._deleteNoteObjects,
        {
          userId,
          noteId: args.noteId,
          refs: list,
        },
      );
    }

    if (rows.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.media.noteMedia._purgeForNote, {
        noteId: args.noteId,
      });
    }
    return null;
  },
});
