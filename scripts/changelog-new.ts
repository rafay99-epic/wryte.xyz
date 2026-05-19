#!/usr/bin/env bun
/**
 * Interactive CLI for adding a new changelog entry.
 *
 *   bun run changelog:new
 *
 * Prompts for title, description, and version (defaults to the current
 * package.json version). Auto-fills the build SHA via `git rev-parse
 * --short HEAD` and publishedAt from now. Opens $EDITOR for the
 * markdown body using a template, appends the entry to
 * `convex/_seed/changelog.ts`, and bumps `package.json` if the version
 * changed.
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

const REPO_ROOT = process.cwd();
const PACKAGE_JSON = join(REPO_ROOT, "package.json");
const SEED_FILE = join(REPO_ROOT, "convex", "_seed", "changelog.ts");
const ARRAY_TERMINATOR = "];\n\nexport const seed";

const TEMPLATE = `## What's new

-${" "}

## Fixes

-${" "}
`;

function slugify(version: string, title: string): string {
  const versionSlug = `v${version.replace(/\./g, "-")}`;
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${versionSlug}-${titleSlug}`;
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
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
    version: string;
  };
  const currentVersion = pkg.version;

  const rl = createInterface({ input, output });
  const title = await ask(rl, "Title: ");
  if (!title) {
    rl.close();
    console.error("Title is required.");
    process.exit(1);
  }
  const description = await ask(rl, "Description (one line): ");
  if (!description) {
    rl.close();
    console.error("Description is required.");
    process.exit(1);
  }
  const versionInput = await ask(rl, `Version [${currentVersion}]: `);
  rl.close();

  const version = versionInput || currentVersion;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`Invalid semver: "${version}".`);
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

  const build = execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT })
    .toString()
    .trim();
  const slug = slugify(version, title);
  const publishedAtIso = new Date().toISOString();

  const seedSource = readFileSync(SEED_FILE, "utf8");
  if (seedSource.includes(`slug: "${slug}"`)) {
    console.error(`An entry with slug "${slug}" already exists.`);
    process.exit(1);
  }
  const insertAt = seedSource.lastIndexOf(ARRAY_TERMINATOR);
  if (insertAt === -1) {
    console.error(
      `Could not locate the ENTRIES array terminator (${ARRAY_TERMINATOR.split("\n")[0]}) in ${SEED_FILE}.`,
    );
    process.exit(1);
  }

  const entryLiteral = `  {
    title: ${JSON.stringify(title)},
    slug: ${JSON.stringify(slug)},
    description: ${JSON.stringify(description)},
    version: ${JSON.stringify(version)},
    build: ${JSON.stringify(build)},
    publishedAt: Date.parse("${publishedAtIso}"),
    content: \`${escapeTemplateLiteral(content)}
\`,
  },
`;

  const updatedSeed = `${seedSource.slice(0, insertAt)}${entryLiteral}${seedSource.slice(insertAt)}`;
  writeFileSync(SEED_FILE, updatedSeed);
  console.info(`Appended entry "${slug}" to ${SEED_FILE}.`);

  if (version !== currentVersion) {
    const pkgSource = readFileSync(PACKAGE_JSON, "utf8");
    const bumped = pkgSource.replace(
      /"version":\s*"[^"]+"/,
      `"version": ${JSON.stringify(version)}`,
    );
    writeFileSync(PACKAGE_JSON, bumped);
    console.info(`Bumped package.json: ${currentVersion} → ${version}.`);
  }

  console.info("\nNext steps:");
  console.info("  1. Review the diff for convex/_seed/changelog.ts.");
  console.info("  2. bun run format && bun run lint && bun run type");
  console.info("  3. Push to Convex: bunx convex run _seed/changelog:seed");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
