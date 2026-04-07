import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function ComingSoonCard({
  title,
  description,
  icon: Icon,
}: ComingSoonCardProps) {
  return (
    <Card className="group relative overflow-hidden border-dashed opacity-70 transition-opacity hover:opacity-90">
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent" />

      <CardHeader className="relative">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Lock className="size-2.5" />
            Soon
          </span>
        </div>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
