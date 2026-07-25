import { relativeTime } from "@wryte/logic/lib/relative-time";
import { Calendar } from "lucide-react";
import Link from "next/link";

type ScheduledDoc = {
  _id: string;
  title: string;
  scheduledAt: number;
  projectId: string;
  projectName: string;
};

export function UpcomingSchedule({ items }: { items: ScheduledDoc[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Calendar className="size-3 text-purple-500/60" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Upcoming
        </h3>
      </div>
      <div className="space-y-1">
        {items.map((doc) => (
          <Link
            key={doc._id}
            href={`/editor/${doc._id}`}
            className="group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-purple-500" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-foreground/80">
                {doc.title || "Untitled"}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
                <span>{doc.projectName}</span>
                <span className="text-border">·</span>
                <span>{relativeTime(doc.scheduledAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
