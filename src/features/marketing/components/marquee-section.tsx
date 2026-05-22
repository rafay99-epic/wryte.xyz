import { Marquee } from "@/features/marketing/components/marquee";
import { marqueeItems } from "@/features/marketing/constants";

export function MarqueeSection() {
  return (
    <div className="border-y border-foreground/[0.12] dark:border-foreground/[0.04] py-5">
      <Marquee items={marqueeItems} />
    </div>
  );
}
