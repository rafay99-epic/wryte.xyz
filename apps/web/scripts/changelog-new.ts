#!/usr/bin/env bun
/**
 * Interactive CLI for adding a new changelog entry.
 *
 *   bun run changelog:new
 *
 * Prompts for title and description, opens $EDITOR for the markdown body,
 * and inserts the entry at the top of `src/content/changelog.md`. The build
 * SHA is auto-filled via `git rev-parse --short HEAD` and the date from now.
 *
 * The changelog is date-based: entries carry NO hand-typed version number,
 * and this script does NOT bump `package.json`. Versioning is automatic —
 * the deployed git SHA is the release identity (see
 * `src/hooks/use-version-check.ts`). Add an optional `version:` line to the
 * generated entry by hand only if you're marking something like a 1.0.
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

// This script runs from `apps/web` (via `bun run --filter @wryte/web`).
const CHANGELOG_FILE = join(process.cwd(), "src", "content", "changelog.md");

/** First entry marker — new entries insert directly above it. */
const ENTRY_MARKER = "<!-- changelog-entry";

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
  const date = new Date().toISOString().slice(0, 10);

  const source = readFileSync(CHANGELOG_FILE, "utf8");
  if (source.includes(`slug: ${slug}\n`)) {
    console.error(`An entry with slug "${slug}" already exists.`);
    process.exit(1);
  }
  const insertAt = source.indexOf(ENTRY_MARKER);
  if (insertAt === -1) {
    console.error(`No "${ENTRY_MARKER}" marker found in ${CHANGELOG_FILE}.`);
    process.exit(1);
  }

  const entryBlock = `<!-- changelog-entry
slug: ${slug}
title: ${title}
date: ${date}
category: website
build: ${build}
description: ${description}
-->
${content}

`;

  const updated = `${source.slice(0, insertAt)}${entryBlock}${source.slice(insertAt)}`;
  writeFileSync(CHANGELOG_FILE, updated);
  console.info(`Inserted entry "${slug}" at the top of ${CHANGELOG_FILE}.`);

  console.info("\nNext steps:");
  console.info("  1. Review the diff for src/content/changelog.md.");
  console.info(
    "  2. (Optional) add a `version:` line to the entry to mark a milestone.",
  );
  console.info("  3. bun run format && bun run lint && bun run type");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
