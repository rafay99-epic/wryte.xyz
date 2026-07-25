"use client";

import { motion } from "framer-motion";
import { Apple, Download, ExternalLink, Monitor, Terminal } from "lucide-react";
import { SectionHeading } from "@/features/marketing/components/section-heading";

function HighlightChip({
  icon: Icon,
  label,
  tint,
  className,
}: {
  icon: React.ElementType;
  label: string;
  tint: string;
  className: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.6 }}
      style={{ transform: "translateZ(60px)" }}
      className={`absolute z-20 hidden items-center gap-2 rounded-xl border border-foreground/[0.1] bg-background/90 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur-md md:flex dark:border-foreground/[0.08] dark:bg-foreground/[0.04] ${className}`}
    >
      <Icon className={`size-3.5 ${tint}`} />
      <span className="text-[12px] font-medium text-foreground/70 dark:text-foreground/55">
        {label}
      </span>
    </motion.div>
  );
}

export function DesktopApp() {
  return (
    <section id="desktop" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-[400px] w-[500px] -translate-y-1/2 rounded-full bg-amber-500/[0.05] blur-[120px]" />
      <div className="pointer-events-none absolute left-1/3 bottom-1/4 h-[300px] w-[400px] rounded-full bg-amber-500/[0.03] blur-[120px]" />

      <div className="mx-auto max-w-[1100px] px-6">
        <SectionHeading
          eyebrow="Desktop App"
          eyebrowClassName="text-amber-400/70"
          title="Same Wryte. Native feel."
          description="The full Wryte experience as a cross-platform desktop app. Built with Electron — same editor, same board, same git-native workflow. No browser tab required."
          className="mb-14 max-w-2xl"
          align="center"
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="relative z-10 mx-auto max-w-3xl"
        >
          <div className="relative">
            <HighlightChip
              className="-left-4 top-16 lg:-left-10"
              icon={Monitor}
              label="macOS · Windows · Linux"
              tint="text-amber-400"
            />
            <HighlightChip
              className="-right-3 bottom-20 lg:-right-8"
              icon={Apple}
              label="Native menus & shortcuts"
              tint="text-purple-400"
            />

            <div className="overflow-hidden rounded-2xl border border-foreground/[0.12] bg-background/70 shadow-2xl shadow-black/25 backdrop-blur-xl dark:border-foreground/[0.07] dark:bg-foreground/[0.02]">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                  <span className="size-2.5 rounded-full bg-foreground/15" />
                </div>
                <span className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-foreground/40">
                  <Terminal className="size-3" />
                  wryte.desktop
                </span>
                <span className="ml-auto rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-400/80">
                  ● native
                </span>
              </div>

              <div className="p-6 sm:p-10">
                <div className="mx-auto mb-6 flex items-center justify-center gap-3 sm:mb-8">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 sm:size-14">
                    <Download className="size-5 text-amber-400 sm:size-6" />
                  </div>
                </div>

                <h3 className="mb-2 text-center text-lg font-bold tracking-tight sm:text-xl">
                  Install with Homebrew
                </h3>
                <p className="mb-5 text-center text-[13px] text-foreground/55 sm:mb-6 sm:text-[14px] dark:text-foreground/40">
                  One command, always up to date.
                </p>

                {/* Brew install command */}
                <div className="mx-auto max-w-xl">
                  <div className="inline-flex w-full items-center gap-2 overflow-hidden rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 sm:px-4 sm:py-3 dark:border-foreground/[0.05] dark:bg-foreground/[0.02]">
                    <span className="font-mono text-[12px] text-emerald-400/60 sm:text-[13px]">
                      $
                    </span>
                    <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-foreground/70 sm:text-[13px] dark:text-foreground/50">
                      brew install rafay99-epic/apps/wryte
                    </code>
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{
                        duration: 1.1,
                        repeat: Number.POSITIVE_INFINITY,
                      }}
                      className="hidden h-4 w-[2px] shrink-0 bg-amber-400 sm:block"
                    />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
                  {[
                    {
                      label: "Native shortcuts",
                      desc: "Full keyboard-driven workflow. System menus.",
                    },
                    {
                      label: "Auto-updates",
                      desc: "Seamless background updates. Latest features.",
                    },
                  ].map((feature) => (
                    <div
                      key={feature.label}
                      className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-3.5 text-center sm:p-4 dark:bg-transparent"
                    >
                      <p className="text-[12px] font-semibold text-foreground/80 sm:text-[13px]">
                        {feature.label}
                      </p>
                      <p className="mt-1 text-[11px] text-foreground/45 sm:text-[12px] dark:text-foreground/35">
                        {feature.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer bar */}
              <div className="flex items-center gap-4 border-t border-foreground/[0.07] px-4 py-2 font-mono text-[10px] text-foreground/35">
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="size-2.5" />
                  github.com/rafay99-epic/wryte
                </span>
                <span className="ml-auto">electron · cross-platform · oss</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
