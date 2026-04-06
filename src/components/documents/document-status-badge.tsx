"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type DocumentStatus = "draft" | "scheduled" | "published";

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
}

const statusConfig: Record<
  DocumentStatus,
  {
    label: string;
    className: string;
    icon: React.ReactNode | null;
  }
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

export function DocumentStatusBadge({ status }: DocumentStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
