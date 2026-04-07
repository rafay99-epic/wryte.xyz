"use client";

import { Badge } from "@/components/ui/badge";

/**
 * Deterministic 8-color palette for tag badges.
 * Each tag gets a consistent color based on its string hash.
 */
const TAG_COLORS = [
  "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800",
  "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800",
  "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800",
  "bg-pink-500/10 text-pink-700 border-pink-200 dark:text-pink-300 dark:border-pink-800",
  "bg-cyan-500/10 text-cyan-700 border-cyan-200 dark:text-cyan-300 dark:border-cyan-800",
  "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800",
  "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:text-indigo-300 dark:border-indigo-800",
];

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface TagBadgesProps {
  tags: string[];
  /** Maximum number of tags to show before showing "+N" overflow. Default: 3 */
  max?: number;
}

export function TagBadges({ tags, max = 3 }: TagBadgesProps) {
  if (!tags.length) return null;

  const visible = tags.slice(0, max);
  const overflow = tags.length - max;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={`px-1.5 py-0 text-[10px] font-medium ${TAG_COLORS[hashTag(tag) % TAG_COLORS.length]}`}
        >
          {tag}
        </Badge>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
