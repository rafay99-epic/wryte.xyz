/**
 * Self-check for the runtime-agnostic R2 helpers in convex/providers/shared.ts.
 * Run: bun test tests/r2.test.ts
 *
 * The ListObjectsV2 reader is hand-rolled (the S3 API has no JSON listing), so
 * it is the one piece of the R2 provider that earns a test: everything else is
 * a signed HTTP call.
 */
import assert from "node:assert/strict";
import {
  normalizeKeyPrefix,
  normalizePublicBaseUrl,
  parseListObjectsV2Xml,
  parseR2Secret,
  uniqueObjectKey,
} from "../convex/providers/shared";

/* ---- parseListObjectsV2Xml ---- */

const twoObjects = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>media</Name>
  <Prefix>blog/</Prefix>
  <KeyCount>2</KeyCount>
  <MaxKeys>50</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>blog/hero-a1b2c3.png</Key>
    <LastModified>2026-07-01T10:00:00.000Z</LastModified>
    <ETag>&quot;d41d8cd98f00b204e9800998ecf8427e&quot;</ETag>
    <Size>20480</Size>
  </Contents>
  <Contents>
    <Key>blog/diagram-9f8e7d.svg</Key>
    <ETag>"abc123"</ETag>
    <Size>1024</Size>
  </Contents>
</ListBucketResult>`;

const listed = parseListObjectsV2Xml(twoObjects);
assert.equal(listed.items.length, 2);
assert.deepEqual(listed.items[0], {
  key: "blog/hero-a1b2c3.png",
  size: 20480,
  etag: "d41d8cd98f00b204e9800998ecf8427e",
});
assert.equal(listed.items[1]?.key, "blog/diagram-9f8e7d.svg");
assert.equal(listed.items[1]?.size, 1024);
// Not truncated → no cursor, so callers stop paging.
assert.equal(listed.nextContinuationToken, undefined);

// Truncated page → the continuation token is surfaced verbatim.
const truncated = parseListObjectsV2Xml(`<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=</NextContinuationToken>
  <Contents><Key>a.png</Key><Size>1</Size></Contents>
</ListBucketResult>`);
assert.equal(truncated.items.length, 1);
assert.equal(
  truncated.nextContinuationToken,
  "1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=",
);

// A token present on a non-truncated response must be ignored — paging on it
// would loop forever.
assert.equal(
  parseListObjectsV2Xml(`<ListBucketResult>
    <IsTruncated>false</IsTruncated>
    <NextContinuationToken>stale</NextContinuationToken>
  </ListBucketResult>`).nextContinuationToken,
  undefined,
);

// Empty bucket.
assert.deepEqual(
  parseListObjectsV2Xml(
    `<ListBucketResult><KeyCount>0</KeyCount><IsTruncated>false</IsTruncated></ListBucketResult>`,
  ),
  { items: [] },
);

// Entity-escaped keys decode in a single pass: `&amp;lt;` is a literal "&lt;",
// not "<".
const escaped = parseListObjectsV2Xml(`<ListBucketResult>
  <IsTruncated>false</IsTruncated>
  <Contents><Key>blog/a &amp; b.png</Key><Size>3</Size></Contents>
  <Contents><Key>blog/x&amp;lt;y.png</Key><Size>4</Size></Contents>
  <Contents><Key>blog/caf&#233;.png</Key><Size>5</Size></Contents>
</ListBucketResult>`);
assert.deepEqual(
  escaped.items.map((i) => i.key),
  ["blog/a & b.png", "blog/x&lt;y.png", "blog/café.png"],
);

// Zero-byte "directory" markers that S3 clients create are not media.
assert.deepEqual(
  parseListObjectsV2Xml(`<ListBucketResult>
    <IsTruncated>false</IsTruncated>
    <Contents><Key>blog/</Key><Size>0</Size></Contents>
    <Contents><Key>blog/real.png</Key><Size>7</Size></Contents>
  </ListBucketResult>`).items.map((i) => i.key),
  ["blog/real.png"],
);

// A malformed size degrades to 0 rather than NaN reaching the usage counters.
assert.equal(
  parseListObjectsV2Xml(
    `<ListBucketResult><Contents><Key>a.png</Key><Size>bogus</Size></Contents></ListBucketResult>`,
  ).items[0]?.size,
  0,
);

/* ---- normalizeKeyPrefix ---- */

assert.equal(normalizeKeyPrefix("public/images"), "public/images");
assert.equal(normalizeKeyPrefix("/blog/images/"), "blog/images");
assert.equal(normalizeKeyPrefix("blog//images"), "blog/images");
assert.equal(normalizeKeyPrefix(" blog / images "), "blog/images");
assert.equal(normalizeKeyPrefix(undefined), "");
assert.equal(normalizeKeyPrefix(""), "");
// Traversal segments are dropped, not escaped — the prefix is concatenated
// into object keys and repo paths.
assert.equal(normalizeKeyPrefix("../../etc"), "etc");
assert.equal(normalizeKeyPrefix("blog/../.."), "blog");
assert.equal(normalizeKeyPrefix("./."), "");

/* ---- uniqueObjectKey ---- */

const keyed = uniqueObjectKey("blog/images", "hero.png");
assert.match(keyed, /^blog\/images\/hero-[a-z0-9]{1,6}\.png$/);
// No prefix → bare key, no leading slash.
assert.match(uniqueObjectKey("", "hero.png"), /^hero-[a-z0-9]{1,6}\.png$/);
// Extensionless names still get a suffix.
assert.match(uniqueObjectKey("", "README"), /^README-[a-z0-9]{1,6}$/);
// Dotfiles keep their leading dot as part of the stem.
assert.match(uniqueObjectKey("", ".gitkeep"), /^\.gitkeep-[a-z0-9]{1,6}$/);
// Only the final extension is preserved.
assert.match(
  uniqueObjectKey("", "archive.tar.gz"),
  /^archive\.tar-[a-z0-9]{1,6}\.gz$/,
);
// Two uploads of the same filename must not collide.
assert.notEqual(
  uniqueObjectKey("p", "hero.png"),
  uniqueObjectKey("p", "hero.png"),
);

/* ---- normalizePublicBaseUrl ---- */

assert.equal(
  normalizePublicBaseUrl("https://cdn.example.com/"),
  "https://cdn.example.com",
);
assert.equal(
  normalizePublicBaseUrl("  https://cdn.example.com  "),
  "https://cdn.example.com",
);
assert.equal(
  normalizePublicBaseUrl("https://cdn.example.com/media/"),
  "https://cdn.example.com/media",
);
assert.equal(
  normalizePublicBaseUrl("https://pub-abc.r2.dev"),
  "https://pub-abc.r2.dev",
);
assert.throws(() => normalizePublicBaseUrl("cdn.example.com"), /absolute URL/);
assert.throws(() => normalizePublicBaseUrl(""), /absolute URL/);
assert.throws(() => normalizePublicBaseUrl("ftp://cdn.example.com"), /https?/);

/* ---- parseR2Secret ---- */

const validSecret = JSON.stringify({
  account_id: " acc123 ",
  access_key_id: "AKIA",
  secret_access_key: "shh",
  bucket: "media",
  public_base_url: "https://cdn.example.com/",
});
assert.deepEqual(parseR2Secret(validSecret), {
  account_id: "acc123",
  access_key_id: "AKIA",
  secret_access_key: "shh",
  bucket: "media",
  public_base_url: "https://cdn.example.com",
});

// Every missing field is named at once, so the form can fix them in one pass.
assert.throws(
  () => parseR2Secret(JSON.stringify({ account_id: "a", bucket: "b" })),
  /access_key_id, secret_access_key, public_base_url/,
);
// Blank strings count as missing.
assert.throws(
  () =>
    parseR2Secret(
      JSON.stringify({
        account_id: "a",
        access_key_id: "  ",
        secret_access_key: "s",
        bucket: "b",
        public_base_url: "https://x.dev",
      }),
    ),
  /access_key_id/,
);
assert.throws(() => parseR2Secret("not json"), /must be JSON/);
// A structurally complete blob with a junk URL still fails — the URL is what
// every stored media reference is built from.
assert.throws(
  () =>
    parseR2Secret(
      JSON.stringify({
        account_id: "a",
        access_key_id: "k",
        secret_access_key: "s",
        bucket: "b",
        public_base_url: "not-a-url",
      }),
    ),
  /absolute URL/,
);

console.info("r2: all assertions passed");
