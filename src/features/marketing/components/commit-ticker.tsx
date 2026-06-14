import { motion } from "framer-motion";
import { commitTicker } from "@/features/marketing/constants";

/**
 * A git-flavoured marquee: a continuous stream of commit pills, evoking the
 * idea that everything you do in Wryte lands as a real commit.
 */
export function CommitTicker() {
  const items = [...commitTicker, ...commitTicker];

  return (
    <section className="relative overflow-hidden py-10">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      <p className="mb-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35 dark:text-foreground/25">
        Everything you ship is a commit
      </p>

      <div className="relative">
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

        <motion.div
          className="flex w-max gap-3"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 32,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
          }}
        >
          {items.map((commit, i) => (
            <div
              key={`${commit.hash}-${i}`}
              className="flex shrink-0 items-center gap-2.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-3.5 py-2 dark:border-foreground/[0.05]"
            >
              <span className="size-1.5 rounded-full bg-emerald-400/70" />
              <span className="font-mono text-[11px] text-amber-400/70">
                {commit.hash}
              </span>
              <span className="font-mono text-[12px] text-foreground/55 dark:text-foreground/40">
                {commit.msg}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
