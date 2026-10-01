import type { Doc, Id } from "../../_generated/dataModel";
import { projectUploadLimit } from "../../_lib/quotas";
import type { ProjectMediaConfig } from "../../providers/registry";
import { normalizeKeyPrefix } from "../../providers/shared";
import {
  CREDENTIAL_PROVIDER_IDS,
  type CredentialProvider,
  isCredentialProvider,
  type MediaCredentialStatus,
  type MediaProvider,
  resolveDefaultProvider,
} from "./providers";

export const DEFAULT_NOTE_MEDIA_PATH = "notes";

export const NOTE_SOURCE_MISSING =
  "Choose where note images are stored in Notes settings.";

export type NoteMediaSetting = NonNullable<Doc<"note_settings">["media"]>;

export type UserMediaSource = {
  provider: CredentialProvider;
  projectId: Id<"projects"> | undefined;
};

export type MediaOwner =
  | { kind: "project"; project: Doc<"projects"> }
  | {
      kind: "user";
      userId: Id<"users">;
      noteId: Id<"notes">;
      mediaPath: string;
      source: UserMediaSource;
    };

export type CredentialScope = {
  userId: Id<"users">;
  projectId: Id<"projects"> | undefined;
};

export type SourceCredential = {
  provider: CredentialProvider;
  status: MediaCredentialStatus;
};

export type SourceDecision =
  | { ok: true; source: UserMediaSource }
  | { ok: false; reason: string };

export function ownerUserId(owner: MediaOwner): Id<"users"> {
  return owner.kind === "project" ? owner.project.userId : owner.userId;
}

export function ownerProjectId(owner: MediaOwner): Id<"projects"> | undefined {
  return owner.kind === "project" ? owner.project._id : undefined;
}

export function ownerProvider(
  owner: MediaOwner,
  requested?: MediaProvider,
): MediaProvider {
  return owner.kind === "project"
    ? (requested ?? resolveDefaultProvider(owner.project.mediaStorageMode))
    : owner.source.provider;
}

export function credentialScope(owner: MediaOwner): CredentialScope {
  return owner.kind === "project"
    ? { userId: owner.project.userId, projectId: owner.project._id }
    : { userId: owner.userId, projectId: owner.source.projectId };
}

export function ownerUploadLimit(owner: MediaOwner): number {
  return projectUploadLimit(owner.kind === "project" ? owner.project : {});
}

export function normalizeNoteMediaPath(raw: string | undefined): string {
  return normalizeKeyPrefix(raw) || DEFAULT_NOTE_MEDIA_PATH;
}

export function noteMediaPrefix(mediaPath: string, noteId: string): string {
  return `${normalizeNoteMediaPath(mediaPath)}/${noteId}`;
}

export function ownerLocation(owner: MediaOwner): ProjectMediaConfig {
  if (owner.kind === "user") {
    return {
      slug: normalizeNoteMediaPath(owner.mediaPath),
      mediaPath: noteMediaPrefix(owner.mediaPath, owner.noteId),
    };
  }
  const { project } = owner;
  return {
    slug: project.slug,
    mediaPath: project.mediaPath,
    githubRepo: project.githubRepo,
    githubBranch: project.githubBranch,
  };
}

export function isUsableCredential(status: MediaCredentialStatus): boolean {
  return status !== "invalid";
}

export function pickProjectProvider(
  mediaStorageMode: string | undefined,
  credentials: readonly SourceCredential[],
  accept: (status: MediaCredentialStatus) => boolean,
): CredentialProvider | null {
  const usable = new Set(
    credentials
      .filter((credential) => accept(credential.status))
      .map((credential) => credential.provider),
  );
  const preferred = resolveDefaultProvider(mediaStorageMode);
  if (isCredentialProvider(preferred) && usable.has(preferred)) {
    return preferred;
  }
  return CREDENTIAL_PROVIDER_IDS.find((id) => usable.has(id)) ?? null;
}

export function resolveUserSource(args: {
  userId: Id<"users">;
  media: NoteMediaSetting | undefined;
  project: Pick<Doc<"projects">, "_id" | "userId" | "mediaStorageMode"> | null;
  credentials: readonly SourceCredential[];
  accept: (status: MediaCredentialStatus) => boolean;
}): SourceDecision {
  const { media } = args;
  if (!media) return { ok: false, reason: NOTE_SOURCE_MISSING };

  if (media.kind === "own") {
    const credential = args.credentials.find(
      (row) => row.provider === media.provider,
    );
    if (!credential) {
      return {
        ok: false,
        reason:
          "Your notes bucket isn't connected. Reconnect it in Notes settings.",
      };
    }
    if (!args.accept(credential.status)) {
      return {
        ok: false,
        reason:
          "Your notes bucket credentials failed verification. Update them in Notes settings.",
      };
    }
    return {
      ok: true,
      source: { provider: media.provider, projectId: undefined },
    };
  }

  const { project } = args;
  if (!project || project.userId !== args.userId) {
    return {
      ok: false,
      reason:
        "The project your notes use for images is gone. Pick another source in Notes settings.",
    };
  }
  const provider = pickProjectProvider(
    project.mediaStorageMode,
    args.credentials,
    args.accept,
  );
  if (!provider) {
    return {
      ok: false,
      reason:
        "That project has no working bucket for note images. Pick another source in Notes settings.",
    };
  }
  return { ok: true, source: { provider, projectId: project._id } };
}
