import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import {
  type CredentialScope,
  type NoteMediaSetting,
  resolveUserSource,
  type SourceDecision,
} from "./owner";
import {
  CREDENTIAL_PROVIDER_IDS,
  type CredentialProvider,
  credentialProviderValidator,
  type MediaCredentialStatus,
} from "./providers";

export const noteMediaSettingValidator = v.union(
  v.object({ kind: v.literal("own"), provider: credentialProviderValidator }),
  v.object({ kind: v.literal("project"), projectId: v.id("projects") }),
);

type DbCtx = Pick<QueryCtx, "db">;

export async function findCredential(
  ctx: DbCtx,
  scope: CredentialScope,
  provider: CredentialProvider,
): Promise<Doc<"mediaCredentials"> | null> {
  const { userId, projectId } = scope;
  const credentials = ctx.db.query("mediaCredentials");
  return projectId === undefined
    ? await credentials
        .withIndex("by_userId_and_projectId_and_provider", (q) =>
          q
            .eq("userId", userId)
            .eq("projectId", undefined)
            .eq("provider", provider),
        )
        .unique()
    : await credentials
        .withIndex("by_projectId_and_provider", (q) =>
          q.eq("projectId", projectId).eq("provider", provider),
        )
        .unique();
}

export async function loadNoteSettings(
  ctx: DbCtx,
  userId: Id<"users">,
): Promise<Doc<"note_settings"> | null> {
  return await ctx.db
    .query("note_settings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function projectCredentials(
  ctx: DbCtx,
  projectId: Id<"projects">,
): Promise<Doc<"mediaCredentials">[]> {
  return await ctx.db
    .query("mediaCredentials")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .take(CREDENTIAL_PROVIDER_IDS.length);
}

export async function resolveNoteSource(
  ctx: DbCtx,
  userId: Id<"users">,
  media: NoteMediaSetting | undefined,
  accept: (status: MediaCredentialStatus) => boolean,
): Promise<SourceDecision> {
  if (media?.kind === "project") {
    const project = await ctx.db.get(media.projectId);
    const credentials =
      project && project.userId === userId
        ? await projectCredentials(ctx, project._id)
        : [];
    return resolveUserSource({ userId, media, project, credentials, accept });
  }
  const own =
    media?.kind === "own"
      ? await findCredential(
          ctx,
          { userId, projectId: undefined },
          media.provider,
        )
      : null;
  return resolveUserSource({
    userId,
    media,
    project: null,
    credentials: own ? [own] : [],
    accept,
  });
}
