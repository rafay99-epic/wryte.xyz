import { motion, useScroll, useTransform } from "framer-motion";
import type { RefObject } from "react";

export function PageBackground({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { scrollYProgress: pageProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const sectionHue = useTransform(
    pageProgress,
    [0, 0.3, 0.6, 1],
    [45, 45, 280, 160],
  );
  const sectionOpacity = useTransform(
    pageProgress,
    [0, 0.15, 0.35, 0.55, 0.75, 1],
    [0.07, 0.05, 0.04, 0.04, 0.03, 0.04],
  );

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        className="pointer-events-none fixed inset-0 z-[2]"
        style={{
          background: useTransform(
            [sectionHue, sectionOpacity] as const,
            ([h, o]: number[]) =>
              `radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.7 0.1 ${h} / ${o}), transparent 70%)`,
          ),
        }}
      />
    </>
  );
}
