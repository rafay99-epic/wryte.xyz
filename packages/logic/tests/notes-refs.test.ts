import assert from "node:assert/strict";
import { isHttpUrl, refLabel, urlLabel } from "@wryte/logic/lib/notes/refs";

assert.equal(urlLabel("https://github.com/acme/app/pull/12"), "acme/app#12");
assert.equal(
  urlLabel("https://github.com/acme/app/issues/34#issuecomment-1"),
  "acme/app#34",
);
assert.equal(urlLabel("https://www.example.com/docs/"), "example.com/docs");
assert.equal(urlLabel("not a url"), "not a url");

assert.equal(isHttpUrl("https://example.com"), true);
assert.equal(isHttpUrl("ftp://example.com"), false);
assert.equal(isHttpUrl("example.com"), false);

assert.equal(refLabel({ text: "Ship it", url: "https://x.dev" }), "Ship it");
assert.equal(refLabel({ url: "https://github.com/a/b/pull/1" }), "a/b#1");
assert.equal(refLabel({}), "");

console.info("notes-refs: all assertions passed");
