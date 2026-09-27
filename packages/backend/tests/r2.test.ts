import assert from "node:assert/strict";
import {
  normalizeKeyPrefix,
  normalizePublicBaseUrl,
  parseListObjectsV2Xml,
  parseR2Secret,
  uniqueObjectKey,
} from "../convex/providers/shared";

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
    <ETag>&quot;fake-etag-0001&quot;</ETag>
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
  etag: "fake-etag-0001",
});
assert.equal(listed.items[1]?.key, "blog/diagram-9f8e7d.svg");
assert.equal(listed.items[1]?.size, 1024);
assert.equal(listed.nextContinuationToken, undefined);

const truncated = parseListObjectsV2Xml(`<ListBucketResult>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>fake-page-2-token/x=</NextContinuationToken>
  <Contents><Key>a.png</Key><Size>1</Size></Contents>
</ListBucketResult>`);
assert.equal(truncated.items.length, 1);
assert.equal(truncated.nextContinuationToken, "fake-page-2-token/x=");

assert.equal(
  parseListObjectsV2Xml(`<ListBucketResult>
    <IsTruncated>false</IsTruncated>
    <NextContinuationToken>stale</NextContinuationToken>
  </ListBucketResult>`).nextContinuationToken,
  undefined,
);

assert.deepEqual(
  parseListObjectsV2Xml(
    `<ListBucketResult><KeyCount>0</KeyCount><IsTruncated>false</IsTruncated></ListBucketResult>`,
  ),
  { items: [] },
);

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

assert.deepEqual(
  parseListObjectsV2Xml(`<ListBucketResult>
    <IsTruncated>false</IsTruncated>
    <Contents><Key>blog/</Key><Size>0</Size></Contents>
    <Contents><Key>blog/real.png</Key><Size>7</Size></Contents>
  </ListBucketResult>`).items.map((i) => i.key),
  ["blog/real.png"],
);

assert.equal(
  parseListObjectsV2Xml(
    `<ListBucketResult><Contents><Key>a.png</Key><Size>bogus</Size></Contents></ListBucketResult>`,
  ).items[0]?.size,
  0,
);

assert.equal(normalizeKeyPrefix("public/images"), "public/images");
assert.equal(normalizeKeyPrefix("/blog/images/"), "blog/images");
assert.equal(normalizeKeyPrefix("blog//images"), "blog/images");
assert.equal(normalizeKeyPrefix(" blog / images "), "blog/images");
assert.equal(normalizeKeyPrefix(undefined), "");
assert.equal(normalizeKeyPrefix(""), "");
assert.equal(normalizeKeyPrefix("../../etc"), "etc");
assert.equal(normalizeKeyPrefix("blog/../.."), "blog");
assert.equal(normalizeKeyPrefix("./."), "");

const keyed = uniqueObjectKey("blog/images", "hero.png");
assert.match(keyed, /^blog\/images\/hero-[a-z0-9]{1,6}\.png$/);
assert.match(uniqueObjectKey("", "hero.png"), /^hero-[a-z0-9]{1,6}\.png$/);
assert.match(uniqueObjectKey("", "README"), /^README-[a-z0-9]{1,6}$/);
assert.match(uniqueObjectKey("", ".gitkeep"), /^\.gitkeep-[a-z0-9]{1,6}$/);
assert.match(
  uniqueObjectKey("", "archive.tar.gz"),
  /^archive\.tar-[a-z0-9]{1,6}\.gz$/,
);
assert.notEqual(
  uniqueObjectKey("p", "hero.png"),
  uniqueObjectKey("p", "hero.png"),
);

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
assert.throws(
  () =>
    normalizePublicBaseUrl(
      "https://a24ec82fb5d7d28e654e44fd638e0c04.r2.cloudflarestorage.com",
    ),
  /S3 API endpoint/,
);
assert.throws(
  () =>
    normalizePublicBaseUrl("https://acc.r2.cloudflarestorage.com/my-bucket"),
  /S3 API endpoint/,
);

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

assert.throws(
  () => parseR2Secret(JSON.stringify({ account_id: "a", bucket: "b" })),
  /access_key_id, secret_access_key, public_base_url/,
);
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
