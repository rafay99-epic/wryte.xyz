/**
 * Self-check for convex/_lib/commitAttribution.ts.
 * Run: bun scripts/commit-attribution.test.ts
 */
import assert from "node:assert/strict";
import {
  ATTRIBUTION_CO_AUTHOR,
  ATTRIBUTION_URL,
  attributionLine,
  renderCommitTemplate,
  validateAttributionText,
  withAttribution,
} from "../convex/_lib/commitAttribution";

const coAuthorBlock = `\n\nCo-authored-by: ${ATTRIBUTION_CO_AUTHOR}`;

const vars = {
  title: "Hello World",
  slug: "hello-world",
  filename: "hello-world.md",
  date: "2026-07-17",
};

// renderCommitTemplate
assert.equal(
  renderCommitTemplate("docs: publish {{filename}} ({{date}})", vars),
  "docs: publish hello-world.md (2026-07-17)",
);
assert.equal(
  renderCommitTemplate("{{title}} / {{slug}} / {{title}}", vars),
  "Hello World / hello-world / Hello World",
);

// withAttribution — append, default text
const appended = withAttribution("Add Hello World", { enabled: true });
assert.equal(
  appended,
  `Add Hello World\n\nPublished with Wryte (${ATTRIBUTION_URL})${coAuthorBlock}`,
);

// co-author identity uses GitHub's generated noreply form (avatar renders)
assert.match(
  ATTRIBUTION_CO_AUTHOR,
  /^wryte-xyz\[bot\] <\d+\+wryte-xyz\[bot\]@users\.noreply\.github\.com>$/,
);

// idempotent — appending twice changes nothing
assert.equal(withAttribution(appended, { enabled: true }), appended);

// disabled — untouched
assert.equal(
  withAttribution("Add Hello World", { enabled: false }),
  "Add Hello World",
);

// custom text with template vars
assert.equal(
  withAttribution("msg", {
    enabled: true,
    customText: "{{title}} shipped via Wryte",
    vars,
  }),
  `msg\n\nHello World shipped via Wryte (${ATTRIBUTION_URL})${coAuthorBlock}`,
);

// invalid stored custom text falls back to the default phrase
assert.equal(
  withAttribution("msg", { enabled: true, customText: "Co-authored-by: evil" }),
  `msg\n\nPublished with Wryte (${ATTRIBUTION_URL})${coAuthorBlock}`,
);

// validateAttributionText
assert.equal(validateAttributionText("Published with Wryte"), null);
assert.equal(validateAttributionText(""), null);
assert.ok(validateAttributionText("two\nlines"));
assert.ok(validateAttributionText("x".repeat(101)));
assert.ok(validateAttributionText("Signed-off-by: someone"));
assert.ok(validateAttributionText("Co-authored-by: bot <x@y.z>"));

// attributionLine preview matches what withAttribution appends
assert.equal(attributionLine(), `Published with Wryte (${ATTRIBUTION_URL})`);
assert.equal(attributionLine("Custom"), `Custom (${ATTRIBUTION_URL})`);

console.info("commit-attribution: all assertions passed");
