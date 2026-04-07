"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getColorClasses } from "@/lib/board-colors";
import type { BoardColumnDef } from "@/types/board";

interface DocumentStatusBadgeProps {
  status: string;
  columns?: BoardColumnDef[] | undefined;
}

export function DocumentStatusBadge({
  status,
  columns,
}: DocumentStatusBadgeProps) {
  // Try to find a matching column definition
  const column = columns?.find((c) => c.id === status);

  if (column) {
    const colors = getColorClasses(column.color);
    const icon =
      column.behavior === "schedule" ? (
        <Clock className="size-3" />
      ) : column.behavior === "publish" ? (
        <CheckCircle2 className="size-3" />
      ) : null;

    return (
      <Badge variant="secondary" className={colors.badge}>
        {icon}
        {column.label}
      </Badge>
    );
  }

  // Fallback for legacy or unknown statuses
  const fallbackConfig: Record<
    string,
    { label: string; className: string; icon: React.ReactNode | null }
  > = {
    draft: {
      label: "Draft",
      className: "bg-muted text-muted-foreground",
      icon: null,
    },
    scheduled: {
      label: "Scheduled",
      className:
        "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
      icon: <Clock className="size-3" />,
    },
    published: {
      label: "Published",
      className:
        "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
      icon: <CheckCircle2 className="size-3" />,
    },
  };

  const config = fallbackConfig[status];

  if (config) {
    return (
      <Badge variant="secondary" className={config.className}>
        {config.icon}
        {config.label}
      </Badge>
    );
  }

  // Unknown status — capitalize and show with gray styling
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
