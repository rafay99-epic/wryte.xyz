import {
  Gauge,
  Layers,
  LifeBuoy,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import type { DocPage } from "../registry";

const ICONS: Record<DocPage["icon"], React.ElementType> = {
  rocket: Rocket,
  shield: ShieldCheck,
  toggles: SlidersHorizontal,
  wrench: Wrench,
  layers: Layers,
  gauge: Gauge,
  life: LifeBuoy,
};

export function DocsIcon({
  icon,
  className,
}: {
  icon: DocPage["icon"];
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} />;
}
