/**
 * Contract for the media provider registry.
 * Run: bun test tests/media-providers.test.ts
 *
 * Adding a storage backend touches two files — an entry here and an adapter in
 * `convex/providers/registry.ts`. TypeScript already forces the validators and
 * the adapter table to stay exhaustive; these assertions cover what types
 * can't: whether an entry is *coherent*. A provider with duplicate field keys,
 * a secret marked for display, or a `raw` format with three inputs compiles
 * perfectly and then misbehaves at runtime.
 */
import assert from "node:assert/strict";
import {
  ALL_CREDENTIAL_PROVIDERS,
  ALL_MEDIA_PROVIDERS,
  CREDENTIAL_PROVIDER_IDS,
  credentialProviderValidator,
  describeMediaLocation,
  getMediaProvider,
  isCredentialProvider,
  isMediaProvider,
  MEDIA_PROVIDER_IDS,
  MEDIA_PROVIDER_LABELS,
  mediaProviderValidator,
  resolveDefaultProvider,
} from "../convex/media/_lib/providers";

/* ---- registry / validator agreement ---- */

assert.equal(ALL_MEDIA_PROVIDERS.length, MEDIA_PROVIDER_IDS.length);
assert.equal(ALL_CREDENTIAL_PROVIDERS.length, CREDENTIAL_PROVIDER_IDS.length);

// Both validators must accept exactly the ids they mirror — the compile-time
// assertion catches a *missing* literal, not a stray one.
const mediaLiterals = mediaProviderValidator.members.map((m) => m.value);
assert.deepEqual([...mediaLiterals].sort(), [...MEDIA_PROVIDER_IDS].sort());
const credentialLiterals = credentialProviderValidator.members.map(
  (m) => m.value,
);
assert.deepEqual(
  [...credentialLiterals].sort(),
  [...CREDENTIAL_PROVIDER_IDS].sort(),
);

// Every credential provider is a media provider; GitHub is the only one that
// isn't credential-backed.
for (const id of CREDENTIAL_PROVIDER_IDS) {
  assert.ok(isMediaProvider(id), `${id} missing from MEDIA_PROVIDER_IDS`);
}
assert.equal(isCredentialProvider("github"), false);

/* ---- per-entry coherence ---- */

for (const entry of ALL_MEDIA_PROVIDERS) {
  const where = `provider "${entry.id}"`;

  assert.equal(getMediaProvider(entry.id), entry, `${where}: lookup mismatch`);
  assert.ok(entry.label.trim() !== "", `${where}: needs a label`);
  assert.ok(entry.description.trim() !== "", `${where}: needs a description`);
  assert.ok(entry.pathHint.trim() !== "", `${where}: needs a pathHint`);
  assert.equal(
    MEDIA_PROVIDER_LABELS[entry.id],
    entry.label,
    `${where}: label map out of sync`,
  );

  // Only credential-backed providers collect credentials, and they must
  // collect at least one field or the connect form renders empty.
  if (entry.credentialSource === "vault") {
    assert.ok(
      isCredentialProvider(entry.id),
      `${where}: not in credential ids`,
    );
    assert.ok(entry.fields.length > 0, `${where}: vault provider needs fields`);
  } else {
    assert.equal(entry.fields.length, 0, `${where}: OAuth provider has fields`);
  }

  // `raw` stores exactly one value verbatim, so a second field would be
  // silently dropped on save.
  if (entry.secretFormat === "raw") {
    assert.ok(
      entry.fields.length <= 1,
      `${where}: raw format can only carry one field`,
    );
  }

  const keys = entry.fields.map((f) => f.key);
  assert.equal(
    new Set(keys).size,
    keys.length,
    `${where}: duplicate field keys would overwrite each other in the secret`,
  );

  for (const field of entry.fields) {
    const at = `${where} field "${field.key}"`;
    assert.match(
      field.key,
      /^[a-z][a-z0-9_]*$/,
      `${at}: key must be snake_case`,
    );
    assert.ok(field.label.trim() !== "", `${at}: needs a label`);
    // A credential-shaped field that isn't marked secret gets pre-filled into
    // the settings form as plain text — which is how Cloudinary's `api_key`
    // ended up on screen. Cheap guard, since the naming is conventional.
    if (/(key|secret|token|password)/.test(field.key)) {
      assert.ok(
        field.secret,
        `${at}: looks like a credential but isn't marked secret`,
      );
    }
    // Mirroring a secret for display would defeat the whole vault.
    assert.ok(
      !(field.secret && field.showAfterSave),
      `${at}: a secret must never be marked showAfterSave`,
    );
    // A field that's in neither the secret nor the display config is inert.
    assert.ok(
      !field.excludeFromSecret || field.showAfterSave,
      `${at}: excluded from the secret but never displayed`,
    );
  }
}

/* ---- location rendering ---- */

assert.equal(
  describeMediaLocation("github", "public/images"),
  "/public/images",
);
assert.equal(
  describeMediaLocation("github", "/public/images"),
  "/public/images",
);
assert.equal(describeMediaLocation("cloudinary", "blog"), "blog");
assert.equal(describeMediaLocation("r2", "blog/images"), "blog/images");
// UploadThing has a flat namespace — there is no location to show.
assert.equal(describeMediaLocation("uploadthing", "public/images"), null);
assert.equal(describeMediaLocation("r2", undefined), null);
assert.equal(describeMediaLocation("r2", ""), null);

/* ---- default resolution ---- */

for (const id of MEDIA_PROVIDER_IDS) {
  assert.equal(resolveDefaultProvider(id), id);
}
// Unset or unrecognised falls back to GitHub so writes still resolve for
// projects created before the field existed.
assert.equal(resolveDefaultProvider(undefined), "github");
assert.equal(resolveDefaultProvider(null), "github");
assert.equal(resolveDefaultProvider("s3"), "github");

console.info("media-providers: all assertions passed");
