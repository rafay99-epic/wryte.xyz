import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useRef } from "react";

/**
 * A large product surface that tilts gently toward the cursor in 3D, used for
 * the editor and board "canvas" sections. Bigger and softer than BentoCard:
 * a slow lean rather than a snappy hover, so the mockups feel like physical
 * panels floating in the page.
 *
 * Children that should pop out (floating chips) can use `translateZ` via the
 * `style` prop combined with `transform-style: preserve-3d` on the surface.
 */
export function CanvasSurface({
  children,
  className = "",
  maxTilt = 5,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 120, damping: 18 });
  const springRotateY = useSpring(rotateY, { stiffness: 120, damping: 18 });

  const handleMouse = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      rotateX.set(y * -maxTilt);
      rotateY.set(x * maxTilt);
    },
    [rotateX, rotateY, maxTilt],
  );

  const handleLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        perspective: 1200,
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative ${className}`}
    >
      {children}
    </motion.div>
  );
}
