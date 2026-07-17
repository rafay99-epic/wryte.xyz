/**
 * Self-check for the SEO rows in src/features/editor/lib/publish-checklist.ts.
 * Run: bun scripts/publish-checklist-seo.test.ts
 */
import assert from "node:assert/strict";
import { buildPublishChecklist } from "../src/features/editor/lib/publish-checklist";

function run(opts: { title?: string; raw?: string }) {
  const { items } = buildPublishChecklist({
    content:
      "# Hello\n\nSome body text that is long enough to not be a stub. ".repeat(
        3,
      ),
    title: opts.title ?? "A perfectly sized title",
    frontmatter: { raw: opts.raw, schema: [] },
    knownDocs: [],
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  return {
    title: byId.get("seo-title"),
    description: byId.get("seo-description"),
    tags: byId.get("seo-tags"),
  };
}

// Title: fits → pass; empty → warn; 61+ chars → warn
assert.equal(run({}).title?.severity, "pass");
assert.equal(run({ title: "  " }).title?.severity, "warn");
assert.equal(run({ title: "x".repeat(61) }).title?.severity, "warn");
assert.equal(run({ title: "x".repeat(60) }).title?.severity, "pass");

// Description: missing → warn; short → info; ideal → pass; long → warn
assert.equal(run({}).description?.severity, "warn");
assert.equal(
  run({ raw: JSON.stringify({ description: "short" }) }).description?.severity,
  "info",
);
assert.equal(
  run({ raw: JSON.stringify({ description: "d".repeat(120) }) }).description
    ?.severity,
  "pass",
);
assert.equal(
  run({ raw: JSON.stringify({ description: "d".repeat(200) }) }).description
    ?.severity,
  "warn",
);
// excerpt is accepted as a fallback field
assert.equal(
  run({ raw: JSON.stringify({ excerpt: "e".repeat(120) }) }).description
    ?.severity,
  "pass",
);

// Tags: none → info; some → pass; keywords accepted; junk entries ignored
assert.equal(run({}).tags?.severity, "info");
assert.equal(
  run({ raw: JSON.stringify({ tags: ["a", "b"] }) }).tags?.severity,
  "pass",
);
assert.equal(
  run({ raw: JSON.stringify({ keywords: ["seo phrase"] }) }).tags?.severity,
  "pass",
);
assert.equal(
  run({ raw: JSON.stringify({ tags: ["", "  "] }) }).tags?.severity,
  "info",
);

// Broken frontmatter JSON: SEO rows degrade gracefully (missing, not crash)
assert.equal(run({ raw: "{not json" }).description?.severity, "warn");

console.info("publish-checklist-seo: all assertions passed");
