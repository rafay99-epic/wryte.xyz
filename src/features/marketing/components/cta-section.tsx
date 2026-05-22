import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MagneticButton } from "@/features/marketing/components/magnetic-button";

export function CtaSection({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="relative py-32 sm:py-40">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.04] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mx-auto max-w-2xl px-6 text-center"
      >
        <div className="mx-auto mb-10 flex items-center justify-center gap-3">
          <BrandIcon width={64} height={64} />
          <span className="text-6xl font-bold leading-none tracking-tight text-foreground">
            wryte
          </span>
        </div>

        <p className="mb-10 text-lg text-foreground/65 dark:text-foreground/30">
          Stop juggling markdown files and deploy scripts.
          <br />
          Start shipping content that matters.
        </p>

        <MagneticButton
          href={isSignedIn ? "/dashboard" : "/sign-up"}
          className="cta-shine group relative inline-flex h-14 items-center gap-3 rounded-xl bg-amber-500 px-10 text-[16px] font-semibold text-black transition-all hover:bg-amber-400 hover:shadow-xl hover:shadow-amber-500/20"
        >
          {isSignedIn ? "Open Dashboard" : "Start Writing — Free"}
          <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
        </MagneticButton>

        <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-foreground/75 dark:text-foreground/20">
          <span>No credit card</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>GitHub login</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>Open Source</span>
          <span className="size-0.5 rounded-full bg-foreground/20" />
          <span>Ships in seconds</span>
        </div>
      </motion.div>
    </section>
  );
}
