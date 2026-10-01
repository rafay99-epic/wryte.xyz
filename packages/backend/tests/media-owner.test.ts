import assert from "node:assert/strict";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { QUOTAS } from "../convex/_lib/quotas";
import {
  credentialScope,
  isUsableCredential,
  type MediaOwner,
  NOTE_SOURCE_MISSING,
  noteMediaPrefix,
  ownerLocation,
  ownerProjectId,
  ownerProvider,
  ownerUploadLimit,
  pickProjectProvider,
  resolveUserSource,
  type SourceCredential,
} from "../convex/media/_lib/owner";
import {
  CREDENTIAL_PROVIDER_IDS,
  isCredentialProvider,
} from "../convex/media/_lib/providers";
import { uniqueObjectKey } from "../convex/providers/shared";

const userId = "user_1" as Id<"users">;
const otherUser = "user_2" as Id<"users">;
const projectId = "project_1" as Id<"projects">;
const noteId = "note_1" as Id<"notes">;
const isActive = (status: SourceCredential["status"]) => status === "active";

assert.equal(
  pickProjectProvider("r2", [{ provider: "r2", status: "active" }], isActive),
  "r2",
);
assert.equal(
  pickProjectProvider(
    "github",
    [
      { provider: "r2", status: "active" },
      { provider: "cloudinary", status: "active" },
    ],
    isActive,
  ),
  "cloudinary",
);
assert.equal(
  pickProjectProvider(
    "r2",
    [
      { provider: "r2", status: "invalid" },
      { provider: "uploadthing", status: "active" },
    ],
    isUsableCredential,
  ),
  "uploadthing",
);
assert.equal(
  pickProjectProvider("r2", [{ provider: "r2", status: "rotating" }], isActive),
  null,
);
assert.equal(
  pickProjectProvider(
    "r2",
    [{ provider: "r2", status: "rotating" }],
    isUsableCredential,
  ),
  "r2",
);
assert.equal(pickProjectProvider(undefined, [], isUsableCredential), null);

const project = { _id: projectId, userId, mediaStorageMode: "r2" as const };
const base = { userId, project: null, credentials: [], accept: isActive };

assert.deepEqual(resolveUserSource({ ...base, media: undefined }), {
  ok: false,
  reason: NOTE_SOURCE_MISSING,
});
assert.equal(
  resolveUserSource({ ...base, media: { kind: "own", provider: "r2" } }).ok,
  false,
);
assert.equal(
  resolveUserSource({
    ...base,
    media: { kind: "own", provider: "r2" },
    credentials: [{ provider: "r2", status: "invalid" }],
  }).ok,
  false,
);
assert.deepEqual(
  resolveUserSource({
    ...base,
    media: { kind: "own", provider: "cloudinary" },
    credentials: [{ provider: "cloudinary", status: "active" }],
  }),
  { ok: true, source: { provider: "cloudinary", projectId: undefined } },
);
assert.equal(
  resolveUserSource({ ...base, media: { kind: "project", projectId } }).ok,
  false,
);
assert.equal(
  resolveUserSource({
    ...base,
    media: { kind: "project", projectId },
    project: { ...project, userId: otherUser },
    credentials: [{ provider: "r2", status: "active" }],
  }).ok,
  false,
);
assert.equal(
  resolveUserSource({
    ...base,
    media: { kind: "project", projectId },
    project: { ...project, mediaStorageMode: "github" },
  }).ok,
  false,
);
assert.deepEqual(
  resolveUserSource({
    ...base,
    media: { kind: "project", projectId },
    project,
    credentials: [{ provider: "r2", status: "active" }],
  }),
  { ok: true, source: { provider: "r2", projectId } },
);

assert.equal(noteMediaPrefix("notes", noteId), "notes/note_1");
assert.equal(noteMediaPrefix("/media//notes/ ", noteId), "media/notes/note_1");
assert.equal(noteMediaPrefix("", noteId), "notes/note_1");
assert.equal(noteMediaPrefix("../..", noteId), "notes/note_1");
assert.match(
  uniqueObjectKey(noteMediaPrefix("notes", noteId), "cat.png"),
  /^notes\/note_1\/cat-[a-z0-9]+\.png$/,
);

const ownOwner: MediaOwner = {
  kind: "user",
  userId,
  noteId,
  mediaPath: "notes",
  source: { provider: "r2", projectId: undefined },
};
const projectSourced: MediaOwner = {
  ...ownOwner,
  mediaPath: "journal",
  source: { provider: "cloudinary", projectId },
};

assert.equal(ownerLocation(ownOwner).mediaPath, "notes/note_1");
assert.equal(ownerLocation(projectSourced).mediaPath, "journal/note_1");
assert.equal(ownerLocation(projectSourced).githubRepo, undefined);
assert.equal(ownerProjectId(projectSourced), undefined);
assert.deepEqual(credentialScope(ownOwner), { userId, projectId: undefined });
assert.deepEqual(credentialScope(projectSourced), { userId, projectId });
assert.equal(ownerProvider(ownOwner, "github"), "r2");
assert.equal(ownerUploadLimit(ownOwner), QUOTAS.MAX_UPLOAD_BYTES);

assert.equal(isCredentialProvider("github"), false);
for (const provider of CREDENTIAL_PROVIDER_IDS) {
  assert.notEqual(provider, "github");
}

const projectDoc = {
  _id: projectId,
  userId,
  slug: "blog",
  mediaPath: "public/images",
  mediaStorageMode: "github",
} as Doc<"projects">;
const projectOwner: MediaOwner = { kind: "project", project: projectDoc };
assert.equal(ownerProvider(projectOwner), "github");
assert.equal(ownerProvider(projectOwner, "r2"), "r2");
assert.equal(ownerProjectId(projectOwner), projectId);
assert.equal(ownerLocation(projectOwner).mediaPath, "public/images");
