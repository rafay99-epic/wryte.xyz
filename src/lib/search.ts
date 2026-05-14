/**
 * Advanced content search engine with multi-field matching and relevance scoring.
 *
 * Supports:
 * - Multi-word tokenized search (AND logic — every word must match somewhere)
 * - Weighted field scoring (title > tags > slug > excerpt > path)
 * - Prefix matching bonus for partial words
 * - Case-insensitive matching
 */

import type { ContentItem } from "@/features/content-dashboard/components/content-table-row";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";

/** Weights for field-level relevance scoring. Higher = more relevant. */
const FIELD_WEIGHTS = {
  title: 10,
  tags: 8,
  status: 6,
  author: 5,
  slug: 4,
  excerpt: 2,
  path: 1,
  frontmatter: 1,
} as const;

/** Bonus multiplier when a token matches at the start of a field value. */
const PREFIX_BONUS = 1.5;

type SearchableItem = {
  item: ContentItem;
  /** Pre-lowered searchable fields for performance. */
  fields: {
    title: string;
    slug: string;
    path: string;
    excerpt: string;
    tags: string[];
    status: string;
    author: string;
    /** Flat string of all frontmatter values. */
    frontmatterText: string;
  };
};

/**
 * Tokenize a search query into lowercase words.
 * Trims whitespace and filters empty tokens.
 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Score a single token against a string field.
 * Returns 0 if no match, or a weighted score based on match type.
 */
function scoreField(token: string, fieldValue: string, weight: number): number {
  if (!fieldValue) return 0;
  const idx = fieldValue.indexOf(token);
  if (idx === -1) return 0;

  // Prefix match (starts at word boundary) gets bonus
  if (
    idx === 0 ||
    fieldValue[idx - 1] === " " ||
    fieldValue[idx - 1] === "-" ||
    fieldValue[idx - 1] === "/"
  ) {
    return weight * PREFIX_BONUS;
  }
  return weight;
}

/**
 * Score a single token against an array of tag strings.
 * Exact tag match gets full weight; partial match gets reduced.
 */
function scoreTagsField(token: string, tags: string[], weight: number): number {
  let best = 0;
  for (const tag of tags) {
    if (tag === token) {
      // Exact match
      best = Math.max(best, weight * 2);
    } else if (tag.includes(token)) {
      best = Math.max(best, weight);
    }
  }
  return best;
}

/**
 * Build pre-computed searchable items for efficient repeated searching.
 * Call once when contentItems or frontmatterMap changes.
 */
export function buildSearchIndex(
  items: ContentItem[],
  frontmatterMap: Map<string, ParsedFrontmatter>,
): SearchableItem[] {
  return items.map((item) => {
    const fm = item.id ? frontmatterMap.get(item.id) : undefined;

    // Build flat frontmatter text from all string values
    let frontmatterText = "";
    if (fm) {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(fm)) {
        if (key === "tags" || key === "category" || key === "author") continue;
        if (typeof value === "string" && value.trim()) {
          parts.push(value.toLowerCase());
        }
      }
      frontmatterText = parts.join(" ");
    }

    return {
      item,
      fields: {
        title: item.title.toLowerCase(),
        slug: item.slug.toLowerCase(),
        path: item.path.toLowerCase(),
        excerpt: item.excerpt.toLowerCase(),
        tags: [
          ...(item.tags ?? []).map((t) => t.toLowerCase()),
          ...(fm?.tags ?? []).map((t) => t.toLowerCase()),
        ],
        status: (item.status ?? "").toLowerCase(),
        author: (fm?.author ?? "").toLowerCase(),
        frontmatterText,
      },
    };
  });
}

/**
 * Search and rank items by relevance.
 *
 * Returns items that match ALL tokens (AND logic).
 * Items are returned with their relevance scores for sorting.
 */
export function searchItems(
  searchIndex: SearchableItem[],
  query: string,
): { item: ContentItem; score: number }[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return searchIndex.map((si) => ({ item: si.item, score: 0 }));
  }

  const results: { item: ContentItem; score: number }[] = [];

  for (const si of searchIndex) {
    let totalScore = 0;
    let allTokensMatch = true;

    for (const token of tokens) {
      let tokenScore = 0;

      tokenScore += scoreField(token, si.fields.title, FIELD_WEIGHTS.title);
      tokenScore += scoreTagsField(token, si.fields.tags, FIELD_WEIGHTS.tags);
      tokenScore += scoreField(token, si.fields.status, FIELD_WEIGHTS.status);
      tokenScore += scoreField(token, si.fields.author, FIELD_WEIGHTS.author);
      tokenScore += scoreField(token, si.fields.slug, FIELD_WEIGHTS.slug);
      tokenScore += scoreField(token, si.fields.excerpt, FIELD_WEIGHTS.excerpt);
      tokenScore += scoreField(token, si.fields.path, FIELD_WEIGHTS.path);
      tokenScore += scoreField(
        token,
        si.fields.frontmatterText,
        FIELD_WEIGHTS.frontmatter,
      );

      if (tokenScore === 0) {
        allTokensMatch = false;
        break;
      }

      totalScore += tokenScore;
    }

    if (allTokensMatch) {
      results.push({ item: si.item, score: totalScore });
    }
  }

  return results;
}

/**
 * Determine if a query looks like a filter expression.
 * E.g., "tag:react" or "status:draft" — returns null if not a filter.
 */
export function parseFilterPrefix(
  query: string,
): { field: string; value: string } | null {
  const match = query.match(/^(tag|status|author|kind):(.+)$/i);
  if (!match) return null;
  return {
    field: (match[1] as string).toLowerCase(),
    value: (match[2] as string).trim().toLowerCase(),
  };
}
