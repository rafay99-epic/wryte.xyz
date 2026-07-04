/**
 * Pre-publish checklist — pure, offline content checks that run just before an
 * author commits an article to their GitHub repo. Nothing here blocks
 * publishing; the goal is to surface easy-to-miss quality problems (broken
 * frontmatter, alt-less images, dead internal links, leftover TODO/conflict
 * markers, thin structure) while there's still a chance to fix them.
 *
 * Deliberately dependency-free and synchronous so it is trivially unit-testable
 * and cheap enough to recompute whenever the publish dialog is open. It reuses
 * the same primitives the editor already trusts: `validateFrontmatter` for
 * schema checks and `parseOutline` for heading structure.
 */

import {
  summarizeIssues,
  type ValidatableField,
  validateFrontmatter,
} from "@/lib/frontmatter-detection/validate";
import { countWords } from "@/lib/word-count";
import { parseOutline } from "./outline";

/** Approximate silent-reading speed used for the reading-time estimate. */
const WORDS_PER_MINUTE = 230;
/** Below this, an article reads as a stub rather than a finished post. */
const MIN_WORDS = 50;

/**
 * Nothing here is fatal — publishing is never gated. Severities only shape how
 * loudly a row asks for attention:
 * - `pass`: the check found no problems.
 * - `warn`: something an author probably wants to fix before shipping.
 * - `info`: neutral context (length, or a soft structural note).
 */
export type ChecklistSeverity = "pass" | "warn" | "info";

export type ChecklistItem = {
  /** Stable key for React lists and tests. */
  id: string;
  /** Short row title. */
  label: string;
  severity: ChecklistSeverity;
  /** One-line explanation of the result. */
  detail: string;
};

/** Lean {title, slug} metadata for resolving `[[wiki links]]`. */
export type KnownDoc = {
  title: string;
  slug: string;
};

export type ChecklistFrontmatter = {
  /** Raw JSON string as stored on the document (Convex stores JSON, not YAML). */
  raw?: string | undefined;
  /** The project's frontmatter schema fields (already parsed). */
  schema: ValidatableField[];
};

export type ChecklistInput = {
  content: string;
  title: string;
  frontmatter: ChecklistFrontmatter;
  contentFormat?: "md" | "mdx" | undefined;
  knownDocs: KnownDoc[];
};

export type ChecklistResult = {
  items: ChecklistItem[];
  /** Number of `warn` rows — drives the dialog's summary line. */
  warnings: number;
};

/* ────────────────────────── text helpers ────────────────────────── */

const FENCE_LINE_RE = /^(```|~~~)/;

/**
 * Blank out fenced code blocks so scans for images/markers/links don't trip on
 * example snippets. Replaces fenced content (and the fences) with blank lines,
 * preserving overall length so any offsets stay meaningful.
 */
function stripFencedCode(content: string): string {
  let inFence = false;
  const out: string[] = [];
  for (const line of content.split("\n")) {
    if (FENCE_LINE_RE.test(line.trimStart())) {
      inFence = !inFence;
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line);
  }
  return out.join("\n");
}

/** Reading time in whole minutes (min 1 for any non-empty content). */
export function readingMinutes(words: number): number {
  return words > 0 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0;
}

/* ────────────────────────── individual checks ────────────────────────── */

/** Frontmatter parses as JSON and satisfies the project schema. */
function checkFrontmatter(input: ChecklistInput): ChecklistItem {
  const base = { id: "frontmatter", label: "Frontmatter" } as const;
  const raw = input.frontmatter.raw;

  let values: Record<string, string | boolean | undefined> = {};
  if (raw?.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ...base,
        severity: "warn",
        detail: "Frontmatter is not valid JSON and may break the build.",
      };
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      values = coerceValues(parsed as Record<string, unknown>);
    }
  }

  const issues = validateFrontmatter(values, input.frontmatter.schema);
  const { errors, warnings } = summarizeIssues(issues);
  const total = errors + warnings;
  if (total === 0) {
    return { ...base, severity: "pass", detail: "Valid against the schema." };
  }

  const first = issues[0];
  const lead = first ? `${first.label} ${first.message}` : "";
  const suffix = total > 1 ? ` (+${total - 1} more)` : "";
  return {
    ...base,
    severity: "warn",
    detail: `${total} field ${total === 1 ? "issue" : "issues"}: ${lead}${suffix}`,
  };
}

/**
 * Flatten a parsed frontmatter object into the string/boolean map the schema
 * validator expects (arrays → comma-joined, scalars → string, booleans kept).
 */
function coerceValues(
  obj: Record<string, unknown>,
): Record<string, string | boolean | undefined> {
  const out: Record<string, string | boolean | undefined> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      out[key] = undefined;
    } else if (typeof value === "boolean" || typeof value === "string") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => String(v)).join(", ");
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

/** `![](...)` with an empty alt, plus `<img>` tags without a real alt. */
const EMPTY_ALT_MD_RE = /!\[\s*\]\([^)]*\)/g;
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const ALT_ATTR_RE = /\balt\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;

function checkImageAltText(content: string): ChecklistItem {
  const base = { id: "image-alt", label: "Image alt text" } as const;
  const scanned = stripFencedCode(content);

  let missing = 0;
  EMPTY_ALT_MD_RE.lastIndex = 0;
  while (EMPTY_ALT_MD_RE.exec(scanned)) missing++;

  IMG_TAG_RE.lastIndex = 0;
  let tag = IMG_TAG_RE.exec(scanned);
  while (tag) {
    const alt = ALT_ATTR_RE.exec(tag[0]);
    const altValue = alt ? (alt[2] ?? alt[3] ?? alt[4] ?? "") : null;
    if (altValue === null || altValue.trim() === "") missing++;
    tag = IMG_TAG_RE.exec(scanned);
  }

  if (missing === 0) {
    return { ...base, severity: "pass", detail: "All images have alt text." };
  }
  return {
    ...base,
    severity: "warn",
    detail: `${missing} image${missing === 1 ? "" : "s"} missing alt text — hurts accessibility and SEO.`,
  };
}

/** `[[Target]]` (or `[[Target|alias]]`) that matches no known doc. */
const WIKI_LINK_RE = /\[\[([^\]\n]+)\]\]/g;

function checkInternalLinks(
  content: string,
  knownDocs: KnownDoc[],
): ChecklistItem {
  const base = { id: "internal-links", label: "Internal links" } as const;
  const scanned = stripFencedCode(content);

  const known = new Set<string>();
  for (const doc of knownDocs) {
    if (doc.title) known.add(doc.title.trim().toLowerCase());
    if (doc.slug) known.add(doc.slug.trim().toLowerCase());
  }

  const unresolved: string[] = [];
  const seen = new Set<string>();
  WIKI_LINK_RE.lastIndex = 0;
  let match = WIKI_LINK_RE.exec(scanned);
  while (match) {
    // Support `[[target|display]]` — resolve against the target only.
    const target = (match[1] as string).split("|")[0]?.trim() ?? "";
    const key = target.toLowerCase();
    if (target && !known.has(key) && !seen.has(key)) {
      seen.add(key);
      unresolved.push(target);
    }
    match = WIKI_LINK_RE.exec(scanned);
  }

  if (unresolved.length === 0) {
    return {
      ...base,
      severity: "pass",
      detail: "All internal links resolve.",
    };
  }
  const preview = unresolved.slice(0, 3).join(", ");
  const suffix = unresolved.length > 3 ? ", …" : "";
  return {
    ...base,
    severity: "warn",
    detail: `${unresolved.length} unresolved: ${preview}${suffix}`,
  };
}

/** TODO / FIXME / XXX and merge-conflict markers left in the prose. */
const WORK_MARKER_RE = /\b(TODO|FIXME|XXX)\b/g;
const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7})/gm;

function checkWorkMarkers(content: string): ChecklistItem {
  const base = { id: "work-markers", label: "Work markers" } as const;
  const scanned = stripFencedCode(content);

  const found = new Set<string>();
  WORK_MARKER_RE.lastIndex = 0;
  let m = WORK_MARKER_RE.exec(scanned);
  while (m) {
    found.add(m[1] as string);
    m = WORK_MARKER_RE.exec(scanned);
  }
  const hasConflict = CONFLICT_MARKER_RE.test(scanned);
  if (hasConflict) found.add("merge conflict");

  if (found.size === 0) {
    return { ...base, severity: "pass", detail: "No leftover markers." };
  }
  return {
    ...base,
    severity: "warn",
    detail: `Found ${[...found].join(", ")} in the content.`,
  };
}

/** More than one H1, or suspiciously thin content. */
function checkStructure(content: string, words: number): ChecklistItem {
  const base = { id: "structure", label: "Structure" } as const;
  const h1Count = parseOutline(content).filter((h) => h.level === 1).length;

  if (h1Count > 1) {
    return {
      ...base,
      severity: "warn",
      detail: `${h1Count} H1 headings — most themes render the title as H1, so keep body headings at H2+.`,
    };
  }
  if (words > 0 && words < MIN_WORDS) {
    return {
      ...base,
      severity: "info",
      detail: `Only ${words} word${words === 1 ? "" : "s"} — this reads like a stub.`,
    };
  }
  return { ...base, severity: "pass", detail: "Headings look well-formed." };
}

/** Neutral length / reading-time context row. */
function lengthRow(words: number): ChecklistItem {
  const minutes = readingMinutes(words);
  return {
    id: "length",
    label: "Length",
    severity: "info",
    detail: `${words.toLocaleString()} word${words === 1 ? "" : "s"} · ${minutes} min read`,
  };
}

/* ────────────────────────── orchestration ────────────────────────── */

/**
 * Run every pre-publish check and return an ordered, typed result. Pure: the
 * same input always yields the same output, so it can be unit-tested in
 * isolation and memoized in the UI.
 */
export function buildPublishChecklist(input: ChecklistInput): ChecklistResult {
  const words = countWords(input.content);

  const items: ChecklistItem[] = [
    checkFrontmatter(input),
    checkImageAltText(input.content),
    checkInternalLinks(input.content, input.knownDocs),
    checkWorkMarkers(input.content),
    checkStructure(input.content, words),
    lengthRow(words),
  ];

  const warnings = items.filter((i) => i.severity === "warn").length;
  return { items, warnings };
}
