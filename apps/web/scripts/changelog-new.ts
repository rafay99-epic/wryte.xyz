#!/usr/bin/env bun
/**
 * Interactive CLI for adding a new changelog entry.
 *
 *   bun run changelog:new
 *
 * Prompts for title and description, opens $EDITOR for the markdown body,
 * and appends the entry to `convex/_seed/changelog.ts`. The build SHA is
 * auto-filled via `git rev-parse --short HEAD` and `publishedAt` from now.
 *
 * The changelog is date-based: entries carry NO hand-typed version number,
 * and this script does NOT bump `package.json`. Versioning is automatic —
 * the deployed git SHA is the release identity (see
 * `src/hooks/use-version-check.ts`). Add an optional milestone label by
 * hand to the generated entry only if you're marking something like a 1.0.
 *
 * After running, push to Convex with:
 *
 *   bunx convex run _seed/changelog:seed
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

// This script runs from `apps/web` (via `bun run --filter @wryte/web`), but the
// changelog seed lives in the backend workspace — the monorepo split moved it and
// left the old single-package path behind.
const SEED_FILE = join(
  process.cwd(),
  "..",
  "..",
  "packages",
  "backend",
  "convex",
  "_seed",
  "changelog.ts",
);

/**
 * Anchors the insertion point on the ENTRIES array's own closing bracket rather
 * than on whatever declaration happens to follow it. The previous anchor was the
 * literal text after the array, so inserting an unrelated const between the two
 * silently broke this script.
 */
const ARRAY_DECLARATION = "const ENTRIES: SeedEntry[] = [";

/** The array's closing bracket at column 0. Anchored separately from whatever
 *  declaration follows it, so adding a const after ENTRIES can't break this. */
const ARRAY_TERMINATOR = "\n];\n";

const TEMPLATE = `## What's new

-${" "}

## Fixes

-${" "}
`;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeTemplateLiteral(content: string): string {
  return content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

function ask(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
): Promise<string> {
  return rl.question(prompt).then((s) => s.trim());
}

async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  const title = await ask(rl, "Title: ");
  if (!title) {
    rl.close();
    console.error("Title is required.");
    process.exit(1);
  }
  const description = await ask(rl, "Description (one line): ");
  rl.close();
  if (!description) {
    console.error("Description is required.");
    process.exit(1);
  }

  const editor = process.env["EDITOR"] || process.env["VISUAL"] || "vim";
  const tmpFile = join(tmpdir(), `changelog-${Date.now()}.md`);
  writeFileSync(tmpFile, TEMPLATE);
  console.info(`\nOpening ${editor} for the entry body...`);
  const editorResult = spawnSync(editor, [tmpFile], { stdio: "inherit" });
  if (editorResult.status !== 0) {
    unlinkSync(tmpFile);
    console.error(`${editor} exited with code ${editorResult.status}.`);
    process.exit(1);
  }
  const rawContent = readFileSync(tmpFile, "utf8");
  unlinkSync(tmpFile);
  const content = rawContent.trimEnd();
  if (!content || content === TEMPLATE.trimEnd()) {
    console.error("Empty entry body — aborting.");
    process.exit(1);
  }

  const build = execSync("git rev-parse --short HEAD", { cwd: process.cwd() })
    .toString()
    .trim();
  const slug = slugify(title);
  const publishedAtIso = new Date().toISOString();

  const seedSource = readFileSync(SEED_FILE, "utf8");
  if (seedSource.includes(`slug: "${slug}"`)) {
    console.error(`An entry with slug "${slug}" already exists.`);
    process.exit(1);
  }
  const declAt = seedSource.indexOf(ARRAY_DECLARATION);
  if (declAt === -1) {
    console.error(`Could not locate "${ARRAY_DECLARATION}" in ${SEED_FILE}.`);
    process.exit(1);
  }
  // The array's closing bracket on its own line, searched from the declaration.
  // Bracket-counting would be wrong here: entry bodies are template literals
  // containing markdown links, so the depth never balances. A column-0 `];` is
  // unambiguous — entry content is always indented or inside a literal.
  const insertAt = seedSource.indexOf(ARRAY_TERMINATOR, declAt);
  if (insertAt === -1) {
    console.error(`ENTRIES array in ${SEED_FILE} is not closed.`);
    process.exit(1);
  }

  const entryLiteral = `  {
    title: ${JSON.stringify(title)},
    slug: ${JSON.stringify(slug)},
    description: ${JSON.stringify(description)},
    build: ${JSON.stringify(build)},
    publishedAt: Date.parse("${publishedAtIso}"),
    content: \`${escapeTemplateLiteral(content)}
\`,
  },
`;

  const updatedSeed = `${seedSource.slice(0, insertAt + 1)}${entryLiteral}${seedSource.slice(insertAt + 1)}`;
  writeFileSync(SEED_FILE, updatedSeed);
  console.info(`Appended entry "${slug}" to ${SEED_FILE}.`);

  console.info("\nNext steps:");
  console.info("  1. Review the diff for convex/_seed/changelog.ts.");
  console.info(
    "  2. (Optional) add a `version:` line to the entry to mark a milestone.",
  );
  console.info("  3. bun run format && bun run lint && bun run type");
  console.info("  4. Push to Convex: bunx convex run _seed/changelog:seed");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
