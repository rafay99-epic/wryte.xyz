export function BoardCardMock({
  title,
  slug,
  words,
  age,
  ageColor,
  tags,
  isDragging,
  className,
}: {
  title: string;
  slug: string;
  words: string;
  age: string;
  ageColor: string;
  tags: string[];
  isDragging?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-foreground/[0.12] dark:border-foreground/[0.06] bg-card px-3 py-2.5 transition-all ${isDragging ? "rotate-2 scale-105 shadow-xl shadow-amber-500/10 border-amber-400/30" : ""} ${className ?? ""}`}
    >
      <p className="text-[12px] font-medium text-foreground/85 dark:text-foreground/70">
        {title}
      </p>
      <p className="mt-0.5 truncate font-mono text-[10px] text-foreground/50 dark:text-foreground/20">
        /{slug}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[9px] text-foreground/50 dark:text-foreground/30">
        <span>{words} words</span>
        <span className="text-foreground/20">·</span>
        <span className={ageColor}>{age}</span>
      </div>
      {tags.length > 0 && (
        <div className="mt-1.5 flex gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-foreground/[0.04] dark:bg-foreground/[0.06] px-1.5 py-0.5 text-[8px] font-medium text-foreground/50 dark:text-foreground/30"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
