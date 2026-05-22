import { motion } from "framer-motion";

export function Marquee({
  items,
  reverse = false,
}: {
  items: string[];
  reverse?: boolean;
}) {
  return (
    <div className="relative flex overflow-hidden select-none">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-linear-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-linear-to-l from-background to-transparent" />
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="flex shrink-0 items-center gap-8 px-4"
          animate={{ x: reverse ? ["0%", "-100%"] : ["-100%", "0%"] }}
          transition={{
            x: {
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              duration: 30,
              ease: "linear",
            },
          }}
        >
          {items.map((item) => (
            <span
              key={`${i}-${item}`}
              className="whitespace-nowrap text-sm font-medium tracking-[0.2em] text-foreground/65 dark:text-foreground/10 uppercase"
            >
              {item}
            </span>
          ))}
        </motion.div>
      ))}
    </div>
  );
}
