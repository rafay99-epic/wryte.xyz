/**
 * Golden checks for the publish-time animation transform — the one piece of
 * code that rewrites a user's post body. Run directly: `bun run
 * tests/animationTransform.test.ts`. Every assert throws on failure.
 */
import assert from "node:assert/strict";
import {
  relativeImportDir,
  transformMdxWithAnimations,
  WRYTE_MANAGED_MARKER,
} from "../convex/_lib/animationTransform";

const ANIMS = {
  HarnessLoop: "export default function HarnessLoop(){return null}",
};

/* --- relative path math ------------------------------------------------ */
assert.equal(
  relativeImportDir("src/content/blog", "src/components/blog"),
  "../../components/blog",
);
assert.equal(relativeImportDir("content", "components"), "../components");
assert.equal(relativeImportDir("blog", "blog"), ".");
assert.equal(relativeImportDir("", "src/anim"), "./src/anim");

/* --- real tag: import + directive injected ------------------------------ */
{
  const body = "# Hi\n\nSome text.\n\n<HarnessLoop />\n\nMore text.\n";
  const { body: out, components } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "src/content/blog",
    animationsDir: "src/components/blog",
  });
  assert.ok(
    out.startsWith(
      'import HarnessLoop from "../../components/blog/HarnessLoop";',
    ),
    "import line prepended",
  );
  assert.ok(out.includes("<HarnessLoop client:visible />"), "directive added");
  assert.ok(out.includes("Some text."), "prose untouched");
  assert.equal(components.length, 1);
  assert.equal(components[0]?.repoPath, "src/components/blog/HarnessLoop.tsx");
  assert.ok(components[0]?.fileContent.includes(WRYTE_MANAGED_MARKER));
}

/* --- tag inside a code fence is NOT a reference -------------------------- */
{
  const body = "Example:\n\n```jsx\n<HarnessLoop />\n```\n\nNo real use.\n";
  const { body: out, components } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "src/content/blog",
    animationsDir: "src/components/blog",
  });
  assert.equal(out, body, "fenced code left byte-identical");
  assert.equal(components.length, 0, "no components committed");
}

/* --- inline code is NOT a reference -------------------------------------- */
{
  const body = "Use `<HarnessLoop />` like this.\n";
  const { components } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "c",
    animationsDir: "a",
  });
  assert.equal(components.length, 0);
}

/* --- fence AND real usage: only the real tag rewritten ------------------- */
{
  const body = "```\n<HarnessLoop />\n```\n\n<HarnessLoop />\n";
  const { body: out } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "src/content/blog",
    animationsDir: "src/components/blog",
  });
  const fenced = out.indexOf("```\n<HarnessLoop />");
  assert.ok(fenced >= 0, "fenced occurrence untouched");
  assert.ok(
    out.includes("\n<HarnessLoop client:visible />"),
    "real one rewritten",
  );
}

/* --- author's own client: directive respected ----------------------------- */
{
  const body = "<HarnessLoop client:load />\n";
  const { body: out } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "c",
    animationsDir: "a",
  });
  assert.ok(!out.includes("client:visible"), "no double directive");
  assert.ok(out.includes("client:load"), "author directive kept");
}

/* --- nextjs target: "use client" header, no tag directive ----------------- */
{
  const body = "<HarnessLoop />\n";
  const { body: out, components } = transformMdxWithAnimations(body, ANIMS, {
    framework: "nextjs",
    contentDir: "content",
    animationsDir: "components",
  });
  assert.ok(!out.includes("client:visible"), "no astro directive for next");
  assert.ok(
    components[0]?.fileContent.includes('"use client";'),
    "use client injected",
  );
}

/* --- unknown capitalized tags ignored ------------------------------------ */
{
  const body = "<SomethingElse />\n";
  const { body: out, components } = transformMdxWithAnimations(body, ANIMS, {
    framework: "astro",
    contentDir: "c",
    animationsDir: "a",
  });
  assert.equal(out, body);
  assert.equal(components.length, 0);
}

/* --- language decides the published extension ------------------------- */
{
  const tsx = transformMdxWithAnimations("<HarnessLoop />", ANIMS, {
    contentDir: "src/content/blog",
    animationsDir: "src/components/blog",
  });
  assert.equal(
    tsx.components[0]?.repoPath,
    "src/components/blog/HarnessLoop.tsx",
  );

  const jsx = transformMdxWithAnimations("<HarnessLoop />", ANIMS, {
    contentDir: "src/content/blog",
    animationsDir: "src/components/blog",
    language: "jsx",
  });
  assert.equal(
    jsx.components[0]?.repoPath,
    "src/components/blog/HarnessLoop.jsx",
  );
  assert.equal(jsx.body, tsx.body);
}

process.stdout.write("animationTransform: all checks passed\n");
