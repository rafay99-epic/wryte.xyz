import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MagneticButton } from "@/features/marketing/components/magnetic-button";

export function CtaDiff({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="relative py-32 sm:py-40">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.05] blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mx-auto max-w-2xl px-6 text-center"
      >
        <div className="mx-auto mb-8 flex items-center justify-center gap-3">
          <BrandIcon width={56} height={56} />
          <span className="text-5xl font-bold leading-none tracking-tight text-foreground sm:text-6xl">
            wryte
          </span>
        </div>

        {/* Terminal-style commit line */}
        <div className="mx-auto mb-9 inline-flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-4 py-2.5 dark:border-foreground/[0.05]">
          <span className="font-mono text-[12px] text-emerald-400/60">$</span>
          <span className="truncate font-mono text-[12px] text-foreground/55 dark:text-foreground/40">
            git commit -m{" "}
            <span className="text-amber-400/80">
              &quot;stopped fighting my CMS&quot;
            </span>
          </span>
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY }}
            className="h-3.5 w-[2px] bg-amber-400"
          />
        </div>

        <h2 className="text-[clamp(1.8rem,4vw,2.6rem)] font-bold leading-tight tracking-tight">
          Keep your content in git.
          <br />
          <span className="text-foreground/55 dark:text-foreground/40">
            Let Wryte do the rest.
          </span>
        </h2>

        <div className="mt-9 flex items-center justify-center">
          <MagneticButton
            href={isSignedIn ? "/dashboard" : "/sign-up"}
            className="cta-shine group relative inline-flex h-14 items-center gap-3 rounded-xl bg-amber-500 px-10 text-[16px] font-semibold text-black transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/20"
          >
            {isSignedIn ? "Open Dashboard" : "Start Writing — Free"}
            <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
          </MagneticButton>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-foreground/45 dark:text-foreground/25">
          <span>No credit card</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>GitHub login</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>Open Source</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>Bring your own keys</span>
        </div>
      </motion.div>
    </section>
  );
}
