import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useRef } from "react";

export function BentoCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouse = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      rotateX.set(y * -8);
      rotateY.set(x * 8);
    },
    [rotateX, rotateY],
  );

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={
        isInView
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 30, scale: 0.97 }
      }
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        perspective: 800,
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={`group relative overflow-hidden rounded-2xl border border-foreground/[0.15] bg-foreground/[0.02] transition-colors duration-500 hover:border-foreground/[0.25] hover:bg-foreground/[0.04] dark:border-foreground/[0.06] dark:bg-foreground/[0.02] dark:hover:border-foreground/[0.12] dark:hover:bg-foreground/[0.04] ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
