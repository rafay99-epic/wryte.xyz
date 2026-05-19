"use client";

import { Badge } from "@/components/ui/badge";
import { getTagColor } from "@/lib/tag-colors";

type TagBadgesProps = {
  tags: string[];
  /** Maximum number of tags to show before showing "+N" overflow. Default: 3 */
  max?: number;
};

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
          className={`px-1.5 py-0 text-[10px] font-medium ${getTagColor(tag).badge}`}
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
