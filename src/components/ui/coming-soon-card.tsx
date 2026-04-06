import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <Card className="relative opacity-60">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Lock className="size-3" />
            Coming Soon
          </Badge>
        </div>
        <CardTitle className="text-muted-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
