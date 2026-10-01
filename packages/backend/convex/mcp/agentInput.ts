import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  assertDueDate,
  MAX_NOTE_BYTES,
  MAX_NOTE_LINKS,
} from "../cms/notes/_lib/model";
import { frontmatterContract } from "./frontmatterSchema";

const MAX_TITLE = 200;
const MAX_SLUG = 120;
const MAX_TAGS = 20;
const MAX_TAG = 60;
const MAX_QUERY = 200;
export const DEFAULT_NOTE_CHARS = 20_000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function agentTitle(raw: string): string {
  const title = raw.trim();
  if (!title) throw new Error("Title is required.");
  if (title.length > MAX_TITLE) {
    throw new Error(`Title must be ${String(MAX_TITLE)} characters or fewer.`);
  }
  return title;
}

export function agentSlug(raw: string): string {
  const slug = raw.trim();
  if (!SLUG_RE.test(slug) || slug.length > MAX_SLUG) {
    throw new Error(
      `Slug must be lowercase letters, digits and single hyphens, ${String(MAX_SLUG)} characters or fewer (e.g. "my-first-post").`,
    );
  }
  return slug;
}

export async function assertSlugFree(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  slug: string,
): Promise<void> {
  const taken = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .first();
  if (taken) {
    throw new Error(
      `Slug "${slug}" is already used by "${taken.title}" (${taken._id}) in this project. Pick another slug or add to that post.`,
    );
  }
}

export function agentTags(raw: string[]): string[] {
  const tags = [...new Set(raw.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > MAX_TAGS) {
    throw new Error(`At most ${String(MAX_TAGS)} tags per post.`);
  }
  const long = tags.find((tag) => tag.length > MAX_TAG);
  if (long !== undefined) {
    throw new Error(
      `Tag "${long.slice(0, 20)}…" is longer than ${String(MAX_TAG)} characters.`,
    );
  }
  return tags;
}

export function agentLabel(raw: string): string {
  const label = raw.trim();
  if (!label) {
    throw new Error(
      'Label is required. Use "<model> · <harness>", e.g. "Opus 5.5 · Claude Code".',
    );
  }
  return label;
}

export function agentFrontmatter(
  project: Pick<Doc<"projects">, "frontmatterSchema">,
  raw: string,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Frontmatter must be a JSON object string.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a JSON object string.");
  }

  const missing = frontmatterContract(
    project.frontmatterSchema,
  ).requiredFields.filter((name) => {
    const value: unknown = Reflect.get(parsed, name);
    return value === undefined || value === null || value === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `Frontmatter is missing required fields: ${missing.join(", ")}. See wryte_project_context.`,
    );
  }
  return JSON.stringify(parsed);
}

export function agentQueryText(raw: string): string {
  const query = raw.trim();
  if (!query) throw new Error("Query is required.");
  if (query.length > MAX_QUERY) {
    throw new Error(`Query must be ${String(MAX_QUERY)} characters or fewer.`);
  }
  return query;
}

export function agentDate(raw: string): string {
  const date = raw.trim();
  assertDueDate(date);
  return date;
}

export function agentDocumentIds<T extends string>(raw: T[]): T[] {
  const ids = [...new Set(raw)];
  if (ids.length > MAX_NOTE_LINKS) {
    throw new Error(
      `A note can link to at most ${String(MAX_NOTE_LINKS)} posts.`,
    );
  }
  return ids;
}

export function agentMaxChars(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_NOTE_CHARS;
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_NOTE_BYTES) {
    throw new Error(
      `maxChars must be a whole number from 1 to ${String(MAX_NOTE_BYTES)}.`,
    );
  }
  return raw;
}
