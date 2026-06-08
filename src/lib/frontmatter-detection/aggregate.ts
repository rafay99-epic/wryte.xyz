import type { FrontmatterFieldType } from "@/types/frontmatter";
import { inferFieldType } from "./infer";

/**
 * Per-field result of scanning many posts: the winning type, how often the
 * field appeared, and the order in which it was first seen (so the synthesized
 * schema keeps a stable, source-like field order).
 */
export type AggregatedField = {
  type: FrontmatterFieldType;
  /** Fraction of sampled posts that contained this field (0–1). */
  presenceRatio: number;
  firstSeenIndex: number;
};

/**
 * Specificity ranking used to break ties when a field shows up as different
 * types across posts. More specific types win over "string" so one outlier
 * post can't dilute a confidently-typed field.
 */
const TYPE_SPECIFICITY: Record<FrontmatterFieldType, number> = {
  tags: 10,
  multiselect: 9,
  list: 9,
  json: 8,
  datetime: 7,
  date: 7,
  boolean: 6,
  number: 6,
  color: 5,
  image: 5,
  url: 5,
  select: 4,
  slug: 3,
  text: 2,
  string: 1,
};

/**
 * Aggregates frontmatter across many posts into one field map. For each field
 * we tally the inferred type per post, then pick the winner by (frequency,
 * then specificity). `presenceRatio` lets the caller decide required-ness
 * (present in ≥80% of posts ⇒ required).
 *
 * This is the framework-agnostic layer: it works for any repo with YAML/TOML
 * frontmatter and is what makes detection robust to a single unrepresentative
 * post — the bug the old "sample exactly one file" approach caused.
 */
export function aggregateSamples(
  samples: Array<Record<string, unknown>>,
): Map<string, AggregatedField> {
  const total = samples.length;
  const result = new Map<string, AggregatedField>();
  if (total === 0) return result;

  // field -> (type -> count)
  const typeCounts = new Map<string, Map<FrontmatterFieldType, number>>();
  const presence = new Map<string, number>();
  const firstSeen = new Map<string, number>();

  samples.forEach((sample, index) => {
    for (const [key, value] of Object.entries(sample)) {
      const type = inferFieldType(value, key);

      let counts = typeCounts.get(key);
      if (!counts) {
        counts = new Map();
        typeCounts.set(key, counts);
      }
      counts.set(type, (counts.get(type) ?? 0) + 1);

      presence.set(key, (presence.get(key) ?? 0) + 1);
      if (!firstSeen.has(key)) firstSeen.set(key, index);
    }
  });

  for (const [key, counts] of typeCounts) {
    let bestType: FrontmatterFieldType = "string";
    let bestCount = -1;
    for (const [type, count] of counts) {
      const better =
        count > bestCount ||
        (count === bestCount &&
          TYPE_SPECIFICITY[type] > TYPE_SPECIFICITY[bestType]);
      if (better) {
        bestType = type;
        bestCount = count;
      }
    }

    result.set(key, {
      type: bestType,
      presenceRatio: (presence.get(key) ?? 0) / total,
      firstSeenIndex: firstSeen.get(key) ?? 0,
    });
  }

  return result;
}
