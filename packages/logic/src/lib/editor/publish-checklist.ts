import {
  summarizeIssues,
  type ValidatableField,
  validateFrontmatter,
} from "@wryte/logic/lib/frontmatter-detection/validate";
import { countWords } from "@wryte/logic/lib/word-count";
import { parseOutline } from "./outline";

const WORDS_PER_MINUTE = 230;
const MIN_WORDS = 50;

export type ChecklistSeverity = "pass" | "warn" | "info";

export type ChecklistItem = {
  id: string;
  label: string;
  severity: ChecklistSeverity;
  detail: string;
};

export type KnownDoc = {
  title: string;
  slug: string;
};

export type ChecklistFrontmatter = {
  raw?: string | undefined;
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
  warnings: number;
};

const FENCE_LINE_RE = /^(```|~~~)/;

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

export function readingMinutes(words: number): number {
  return words > 0 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0;
}

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

const SEO_TITLE_MAX = 60;
const SEO_DESC_MIN = 80;
const SEO_DESC_MAX = 165;

function parseFrontmatterObject(
  raw: string | undefined,
): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function checkSeoTitle(title: string): ChecklistItem {
  const base = { id: "seo-title", label: "SEO title" } as const;
  const length = title.trim().length;
  if (length === 0) {
    return { ...base, severity: "warn", detail: "The document has no title." };
  }
  if (length > SEO_TITLE_MAX) {
    return {
      ...base,
      severity: "warn",
      detail: `${length} chars — search results truncate around ${SEO_TITLE_MAX}.`,
    };
  }
  return {
    ...base,
    severity: "pass",
    detail: `${length} chars — fits search snippets.`,
  };
}

function checkSeoDescription(
  frontmatter: Record<string, unknown> | null,
): ChecklistItem {
  const base = { id: "seo-description", label: "Meta description" } as const;
  const value = frontmatter?.["description"] ?? frontmatter?.["excerpt"];
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return {
      ...base,
      severity: "warn",
      detail:
        "Missing — search engines will improvise one. The AI frontmatter assistant can write it.",
    };
  }
  if (text.length > SEO_DESC_MAX) {
    return {
      ...base,
      severity: "warn",
      detail: `${text.length} chars — gets cut around ${SEO_DESC_MAX} in results.`,
    };
  }
  if (text.length < SEO_DESC_MIN) {
    return {
      ...base,
      severity: "info",
      detail: `${text.length} chars — a fuller ${SEO_DESC_MIN}–${SEO_DESC_MAX} chars earns the whole snippet.`,
    };
  }
  return {
    ...base,
    severity: "pass",
    detail: `${text.length} chars — snippet-sized.`,
  };
}

function checkSeoTags(
  frontmatter: Record<string, unknown> | null,
): ChecklistItem {
  const base = { id: "seo-tags", label: "Tags" } as const;
  const value = frontmatter?.["tags"] ?? frontmatter?.["keywords"];
  const count = Array.isArray(value)
    ? value.filter((t) => typeof t === "string" && t.trim()).length
    : 0;
  if (count === 0) {
    return {
      ...base,
      severity: "info",
      detail: "No tags or keywords — topical phrases help discovery.",
    };
  }
  return {
    ...base,
    severity: "pass",
    detail: `${count} tag${count === 1 ? "" : "s"} set.`,
  };
}

function lengthRow(words: number): ChecklistItem {
  const minutes = readingMinutes(words);
  return {
    id: "length",
    label: "Length",
    severity: "info",
    detail: `${words.toLocaleString()} word${words === 1 ? "" : "s"} · ${minutes} min read`,
  };
}

export function buildPublishChecklist(input: ChecklistInput): ChecklistResult {
  const words = countWords(input.content);

  const seoFrontmatter = parseFrontmatterObject(input.frontmatter.raw);
  const items: ChecklistItem[] = [
    checkFrontmatter(input),
    checkSeoTitle(input.title),
    checkSeoDescription(seoFrontmatter),
    checkSeoTags(seoFrontmatter),
    checkImageAltText(input.content),
    checkInternalLinks(input.content, input.knownDocs),
    checkWorkMarkers(input.content),
    checkStructure(input.content, words),
    lengthRow(words),
  ];

  const warnings = items.filter((i) => i.severity === "warn").length;
  return { items, warnings };
}
