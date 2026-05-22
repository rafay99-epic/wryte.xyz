import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MagneticButton } from "@/features/marketing/components/magnetic-button";
import { OrbitalRing } from "@/features/marketing/components/orbital-ring";

export function HeroSection({ isSignedIn }: { isSignedIn: boolean }) {
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0]);
  const heroBlur = useTransform(heroProgress, [0, 0.8], [0, 10]);
  const logoScale = useTransform(heroProgress, [0, 0.5], [1, 1.2]);

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.07] blur-[100px]" />
        <div className="absolute right-1/4 top-2/3 h-[400px] w-[400px] rounded-full bg-purple-600/[0.04] blur-[100px]" />
      </div>

      <motion.div
        style={{
          opacity: heroOpacity,
          filter: useTransform(heroBlur, (v) => `blur(${v}px)`),
        }}
        className="relative flex flex-col items-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-10"
        >
          <motion.div style={{ scale: logoScale }}>
            <div className="relative">
              <OrbitalRing size={200} duration={20} opacity={0.06} />
              <OrbitalRing size={280} duration={35} opacity={0.03} delay={2} />
              <OrbitalRing size={360} duration={50} opacity={0.02} delay={5} />
              <BrandIcon
                width={100}
                height={100}
                className="relative z-10"
                priority
              />
              <div className="absolute inset-0 z-0 scale-[2] rounded-full bg-amber-500/20 blur-3xl" />
            </div>
          </motion.div>
        </motion.div>

        <div className="relative text-center">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold leading-[1.08] tracking-[-0.03em]"
          >
            <span className="block bg-gradient-to-b from-foreground/95 to-foreground/60 bg-clip-text text-transparent">
              Write.
            </span>
            <span className="block bg-gradient-to-b from-foreground/90 to-foreground/55 bg-clip-text text-transparent">
              Manage.
            </span>
            <span className="relative block">
              <span className="text-amber-400">Publish.</span>
              <motion.span
                className="absolute -bottom-2 left-0 h-[3px] rounded-full bg-gradient-to-r from-amber-400 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{
                  duration: 0.8,
                  delay: 1.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mx-auto mt-8 max-w-lg text-[17px] leading-relaxed text-foreground/65 dark:text-foreground/30"
          >
            A complete content workspace for developers.
            <br />
            Write in markdown. Manage on a kanban board.
            <br />
            Publish to GitHub with one click.
          </motion.p>

          <motion.a
            href="https://github.com/rafay99-epic/wryte.xyz"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.05 }}
            className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/[0.12] dark:border-foreground/[0.06] bg-foreground/[0.03] px-4 py-1.5 text-[13px] text-foreground/60 dark:text-foreground/30 transition-colors hover:border-foreground/20 hover:text-foreground/80 dark:hover:border-foreground/10 dark:hover:text-foreground/50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
            </svg>
            <span>Open Source</span>
            <span className="text-foreground/20">·</span>
            <span>MIT Licensed</span>
            <ArrowUpRight className="size-3 opacity-50" />
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
            className="mt-6 flex items-center justify-center gap-4"
          >
            <MagneticButton
              href={isSignedIn ? "/dashboard" : "/sign-up"}
              className="cta-shine group relative inline-flex h-12 items-center gap-2 rounded-xl bg-amber-500 px-7 text-[15px] font-semibold text-black transition-all hover:bg-amber-400"
            >
              {isSignedIn ? "Go to Dashboard" : "Start Writing"}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </MagneticButton>

            <MagneticButton
              href="#editor"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-foreground/[0.15] bg-foreground/[0.03] dark:border-foreground/[0.1] dark:bg-foreground/[0.04] px-7 text-[15px] font-medium text-foreground/80 dark:text-foreground/50 transition-all hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground/90 dark:hover:border-foreground/15 dark:hover:bg-foreground/[0.07]"
            >
              See it in action
            </MagneticButton>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
