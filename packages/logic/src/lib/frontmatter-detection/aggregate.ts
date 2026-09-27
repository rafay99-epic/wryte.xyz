import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import { inferFieldType } from "./infer";

export type AggregatedField = {
  type: FrontmatterFieldType;
  presenceRatio: number;
  firstSeenIndex: number;
};

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

export function aggregateSamples(
  samples: Array<Record<string, unknown>>,
): Map<string, AggregatedField> {
  const total = samples.length;
  const result = new Map<string, AggregatedField>();
  if (total === 0) return result;

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
