import type { RefKind } from "@wryte/backend/cms/notes/_lib/model";
import { cn } from "@wryte/logic/lib/utils";
import {
  CircleDot,
  GitPullRequest,
  Link,
  type LucideIcon,
  MessageSquare,
} from "lucide-react";

const ICONS: Record<RefKind, LucideIcon> = {
  pr: GitPullRequest,
  issue: CircleDot,
  comment: MessageSquare,
  link: Link,
};

export function RefKindIcon({
  kind,
  className,
}: {
  kind: RefKind;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}
