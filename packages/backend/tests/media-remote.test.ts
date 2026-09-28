import assert from "node:assert/strict";
import {
  extensionForMime,
  filenameFromUrl,
  mediaMarkdown,
  parseRemoteMediaUrl,
  readCapped,
} from "../convex/media/_lib/remote";

assert.equal(
  parseRemoteMediaUrl("https://cdn.example.com/a.png").hostname,
  "cdn.example.com",
);
for (const bad of [
  "http://cdn.example.com/a.png",
  "https://localhost/a.png",
  "https://127.0.0.1/a.png",
  "https://10.0.0.4/a.png",
  "https://192.168.1.2/a.png",
  "https://172.20.0.1/a.png",
  "https://169.254.169.254/latest",
  "https://[::1]/a.png",
  "not a url",
]) {
  assert.throws(() => parseRemoteMediaUrl(bad), Error, bad);
}

assert.equal(
  filenameFromUrl(new URL("https://x.dev/img/cover%20art.webp"), "image/webp"),
  "cover art.webp",
);
assert.equal(
  filenameFromUrl(new URL("https://x.dev/photo?id=1"), "image/jpeg"),
  "photo.jpg",
);

assert.equal(extensionForMime("image/jpeg"), "jpg");
assert.equal(extensionForMime("image/svg+xml"), "svg");
assert.equal(extensionForMime(""), "bin");

assert.equal(
  mediaMarkdown("image/png", "/images/a.png", "A [chart]"),
  "![A chart](/images/a.png)",
);
assert.equal(mediaMarkdown("video/mp4", "/v.mp4", "clip"), null);

{
  const bytes = await readCapped(new Response(new Uint8Array(10)), 10);
  assert.equal(bytes.byteLength, 10);
  await assert.rejects(
    readCapped(new Response(new Uint8Array(11)), 10),
    /larger than/,
  );
}

console.info("media-remote: all assertions passed");
