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

/**
 * Maps the registry's icon keys to components.
 *
 * Kept out of `registry.ts` so that module stays a plain data file readable from
 * anywhere (including the `node:fs` doc loader) without dragging React imports
 * along with it.
 */
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
