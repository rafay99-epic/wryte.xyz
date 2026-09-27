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

assert.equal(ALL_MEDIA_PROVIDERS.length, MEDIA_PROVIDER_IDS.length);
assert.equal(ALL_CREDENTIAL_PROVIDERS.length, CREDENTIAL_PROVIDER_IDS.length);

const mediaLiterals = mediaProviderValidator.members.map((m) => m.value);
assert.deepEqual([...mediaLiterals].sort(), [...MEDIA_PROVIDER_IDS].sort());
const credentialLiterals = credentialProviderValidator.members.map(
  (m) => m.value,
);
assert.deepEqual(
  [...credentialLiterals].sort(),
  [...CREDENTIAL_PROVIDER_IDS].sort(),
);

for (const id of CREDENTIAL_PROVIDER_IDS) {
  assert.ok(isMediaProvider(id), `${id} missing from MEDIA_PROVIDER_IDS`);
}
assert.equal(isCredentialProvider("github"), false);

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

  if (entry.credentialSource === "vault") {
    assert.ok(
      isCredentialProvider(entry.id),
      `${where}: not in credential ids`,
    );
    assert.ok(entry.fields.length > 0, `${where}: vault provider needs fields`);
  } else {
    assert.equal(entry.fields.length, 0, `${where}: OAuth provider has fields`);
  }

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
    if (/(key|secret|token|password)/.test(field.key)) {
      assert.ok(
        field.secret,
        `${at}: looks like a credential but isn't marked secret`,
      );
    }
    assert.ok(
      !(field.secret && field.showAfterSave),
      `${at}: a secret must never be marked showAfterSave`,
    );
    assert.ok(
      !field.excludeFromSecret || field.showAfterSave,
      `${at}: excluded from the secret but never displayed`,
    );
  }
}

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
assert.equal(describeMediaLocation("uploadthing", "public/images"), null);
assert.equal(describeMediaLocation("r2", undefined), null);
assert.equal(describeMediaLocation("r2", ""), null);

for (const id of MEDIA_PROVIDER_IDS) {
  assert.equal(resolveDefaultProvider(id), id);
}
assert.equal(resolveDefaultProvider(undefined), "github");
assert.equal(resolveDefaultProvider(null), "github");
assert.equal(resolveDefaultProvider("s3"), "github");

console.info("media-providers: all assertions passed");
