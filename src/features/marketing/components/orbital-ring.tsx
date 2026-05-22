import { motion } from "framer-motion";

export function OrbitalRing({
  size,
  duration,
  opacity,
  delay = 0,
}: {
  size: number;
  duration: number;
  opacity: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full border border-amber-400"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        opacity,
      }}
      animate={{ rotate: 360 }}
      transition={{
        duration,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
        delay,
      }}
    >
      <div
        className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-amber-400"
        style={{ opacity: opacity * 3 }}
      />
    </motion.div>
  );
}
