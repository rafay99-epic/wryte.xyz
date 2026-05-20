import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function Divider() {
  return <div className="my-6 h-px bg-border/40" />;
}

export function InventoryStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/60 p-2.5",
        emphasize && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          emphasize && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <Skeleton className="mb-1 ml-3 h-6 w-20" />
        <Skeleton className="mb-5 ml-3 h-3 w-28" />
        <div className="space-y-1">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
