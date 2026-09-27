"use client";

import { motion, useInView } from "framer-motion";
import type { ReactNode } from "react";
import { useRef } from "react";

type AnimatedSectionProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export function AnimatedSection({
  children,
  delay = 0,
  className,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
