import {
  getAgeLevel,
  relativeTimeCompact,
} from "@wryte/logic/lib/relative-time";
import type { BoardColumnDef } from "@wryte/logic/types/board";
import type { ContentItem } from "./content-table-row";
import { TagBadges } from "./tag-badges";

const AGE_COLORS: Record<ReturnType<typeof getAgeLevel>, string> = {
  fresh: "text-emerald-500",
  aging: "text-amber-500",
  stale: "text-red-400",
};

export function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export function CardInner({
  item,
  tags,
  columns,
  columnId,
  onMoveToColumn,
}: {
  item: ContentItem;
  tags: string[];
  columns?: BoardColumnDef[];
  columnId?: string;
  onMoveToColumn?: (targetColumnId: string) => void;
}) {
  return (
    <>
      <div className="pr-6">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/60">
          {item.kind === "remote" ? item.path : `/${item.slug}`}
        </p>
      </div>

      {item.kind === "local" && (
        <div className="mt-2.5 flex items-center gap-2 text-[10px] text-muted-foreground/70">
          {item.wordCount != null && (
            <span title={`${String(item.wordCount)} words`}>
              {formatWordCount(item.wordCount)} words
            </span>
          )}
          {item.updatedAt != null && (
            <>
              <span className="text-border">·</span>
              <span
                className={AGE_COLORS[getAgeLevel(item.updatedAt)]}
                title={new Date(item.updatedAt).toLocaleString()}
              >
                {relativeTimeCompact(item.updatedAt)}
              </span>
            </>
          )}

          {columns && columns.length > 1 && onMoveToColumn && (
            <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
              <select
                className="cursor-pointer rounded bg-transparent px-0.5 py-0 text-[10px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={columnId ?? ""}
                onChange={(e) => {
                  e.stopPropagation();
                  onMoveToColumn(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <div className="mt-2.5">
          <TagBadges tags={tags} max={2} />
        </div>
      )}
    </>
  );
}
