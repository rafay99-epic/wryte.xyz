import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, GitBranch } from "lucide-react";
import { useRef } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MagneticButton } from "@/features/marketing/components/magnetic-button";
import {
  type DiffLine,
  heroDiffLines,
} from "@/features/marketing/v2/constants";

/* ------------------------------------------------------------------ */
/*  Diff card                                                          */
/* ------------------------------------------------------------------ */

const GUTTER: Record<DiffLine["kind"], string> = {
  add: "+",
  remove: "-",
  context: " ",
  meta: " ",
};

function DiffRow({ line, index }: { line: DiffLine; index: number }) {
  if (line.kind === "meta") {
    return (
      <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-4 py-2 text-[11px] text-foreground/45 dark:text-foreground/30">
        <span className="size-1.5 rounded-full bg-emerald-400/70" />
        <span className="font-mono">{line.text}</span>
      </div>
    );
  }

  const tone =
    line.kind === "add"
      ? "bg-emerald-500/[0.07] text-emerald-300/90 dark:text-emerald-300/80"
      : line.kind === "remove"
        ? "bg-rose-500/[0.07] text-rose-300/80 dark:text-rose-300/70"
        : "text-foreground/55 dark:text-foreground/40";

  const gutterTone =
    line.kind === "add"
      ? "text-emerald-400/70"
      : line.kind === "remove"
        ? "text-rose-400/60"
        : "text-foreground/20";

  return (
    <motion.div
      initial={{ opacity: 0, x: line.kind === "remove" ? -8 : 8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.4 + index * 0.06 }}
      className={`flex items-stretch font-mono text-[12px] leading-[1.7] ${tone}`}
    >
      <span className="w-7 shrink-0 select-none text-right text-[10px] text-foreground/15">
        {index}
      </span>
      <span className={`w-5 shrink-0 select-none text-center ${gutterTone}`}>
        {GUTTER[line.kind]}
      </span>
      <span className="min-w-0 flex-1 truncate pr-4">{line.text}</span>
    </motion.div>
  );
}

function HeroDiffCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="animated-border relative w-full max-w-[520px]"
    >
      <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.12] bg-background/80 shadow-2xl shadow-black/20 backdrop-blur-xl dark:border-foreground/[0.07] dark:bg-foreground/[0.02]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
          </div>
          <span className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2 py-0.5 font-mono text-[10px] text-foreground/45 dark:text-foreground/35">
            <GitBranch className="size-3" />
            main
          </span>
          <span className="ml-auto font-mono text-[10px] text-foreground/30">
            diff --staged
          </span>
        </div>

        {/* Diff body */}
        <div className="py-2">
          {heroDiffLines.map((line, i) => (
            <DiffRow key={`${line.kind}-${i}`} line={line} index={i} />
          ))}
        </div>

        {/* Commit footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          className="flex items-center gap-2.5 border-t border-foreground/[0.07] bg-emerald-500/[0.04] px-4 py-3"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="size-3 text-emerald-400" />
          </span>
          <span className="font-mono text-[11px] text-foreground/55 dark:text-foreground/45">
            Published to <span className="text-emerald-400/80">main</span> ·{" "}
            <span className="text-foreground/40">commit a3f8b2c</span>
          </span>
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            className="ml-auto size-1.5 rounded-full bg-emerald-400"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

export function HeroDiff({
  isSignedIn,
  onScrollTo,
}: {
  isSignedIn: boolean;
  onScrollTo?: (id: string) => void;
}) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.8], [0, 60]);

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen items-center overflow-hidden px-6 pt-28 pb-20"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.08] blur-[120px]" />
        <div className="absolute right-1/4 top-2/3 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.05] blur-[120px]" />
        <div className="absolute left-2/3 top-1/4 h-[300px] w-[300px] rounded-full bg-purple-600/[0.04] blur-[100px]" />
      </div>

      <motion.div
        style={{ opacity, y }}
        className="relative mx-auto grid w-full max-w-[1180px] items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10"
      >
        {/* Copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-7 inline-flex items-center gap-2.5"
          >
            <BrandIcon width={28} height={28} className="rounded-[6px]" />
            <span className="inline-flex items-center gap-2 rounded-full border border-foreground/[0.1] bg-foreground/[0.03] px-3 py-1 text-[12px] text-foreground/55 dark:border-foreground/[0.07] dark:text-foreground/40">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Git-native content workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(2.4rem,5.4vw,4.4rem)] font-bold leading-[1.05] tracking-[-0.03em]"
          >
            <span className="block bg-gradient-to-b from-foreground to-foreground/65 bg-clip-text text-transparent">
              Your CMS shouldn&apos;t
            </span>
            <span className="block">
              fight your <span className="text-amber-400">repo</span>.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mx-auto mt-7 max-w-xl text-[16px] leading-relaxed text-foreground/60 dark:text-foreground/35 lg:mx-0"
          >
            Write in a real markdown editor, organize on a board, and publish
            straight to GitHub as clean commits. No database to sync, no
            webhooks to babysit, no lock-in — your repo stays the source of
            truth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start"
          >
            <MagneticButton
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="cta-shine group relative inline-flex h-12 items-center gap-2 rounded-xl bg-amber-500 px-7 text-[15px] font-semibold text-black transition-all hover:bg-amber-400"
            >
              {isSignedIn ? "Go to Dashboard" : "Start Writing"}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </MagneticButton>

            <button
              type="button"
              onClick={() => onScrollTo?.("comparison")}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-foreground/[0.15] bg-foreground/[0.03] px-7 text-[15px] font-medium text-foreground/75 transition-all hover:border-foreground/25 hover:bg-foreground/[0.06] dark:border-foreground/[0.1] dark:text-foreground/55 dark:hover:border-foreground/15"
            >
              See how it compares
              <ArrowUpRight className="size-4 opacity-60" />
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-6 font-mono text-[12px] text-foreground/35 dark:text-foreground/20"
          >
            Open Source · MIT · BYO keys · No credit card
          </motion.p>
        </div>

        {/* Diff card */}
        <div className="flex justify-center lg:justify-end">
          <HeroDiffCard />
        </div>
      </motion.div>
    </section>
  );
}
