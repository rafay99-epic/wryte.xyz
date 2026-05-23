import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

function streakColor(days: number): string {
  if (days === 0) return "text-zinc-400 dark:text-zinc-600";
  if (days < 7) return "text-amber-500";
  if (days < 30) return "text-orange-500";
  return "text-red-500";
}

function streakMilestone(days: number): string | null {
  if (days === 7) return "1 week strong";
  if (days === 14) return "2 weeks going";
  if (days === 30) return "30-day milestone";
  if (days === 60) return "60 days unstoppable";
  if (days === 100) return "100 days!";
  if (days === 365) return "1 year of writing";
  return null;
}

export function WritingStreak({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  const milestone = streakMilestone(currentStreak);

  return (
    <div className="flex items-center gap-3">
      <Flame
        className={cn(
          "size-5 shrink-0 transition-colors",
          streakColor(currentStreak),
          currentStreak >= 7 && "animate-pulse",
        )}
      />
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tabular-nums leading-none tracking-tight">
            {currentStreak}
          </span>
          <span className="text-[11px] text-muted-foreground/50">
            day{currentStreak !== 1 ? "s" : ""}
          </span>
        </div>
        {milestone ? (
          <span className="block text-[10px] font-medium text-orange-500/80">
            {milestone}
          </span>
        ) : (
          <span className="block text-[10px] text-muted-foreground/40">
            Best: {longestStreak}
          </span>
        )}
      </div>
    </div>
  );
}
