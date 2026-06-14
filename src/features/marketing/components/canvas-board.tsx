import { motion } from "framer-motion";
import { CalendarClock, GripVertical } from "lucide-react";
import { CanvasSurface } from "@/features/marketing/components/canvas-surface";
import { SectionHeading } from "@/features/marketing/components/section-heading";

type Card = { title: string; slug: string; words: string; tag?: string };

const columns: {
  label: string;
  accent: string;
  count: number;
  cards: Card[];
}[] = [
  {
    label: "Draft",
    accent: "bg-amber-400",
    count: 3,
    cards: [
      {
        title: "API Reference",
        slug: "api-reference",
        words: "1.2k",
        tag: "docs",
      },
      { title: "Migration Guide", slug: "migration-guide", words: "840" },
    ],
  },
  {
    label: "Review",
    accent: "bg-purple-400",
    count: 2,
    cards: [
      {
        title: "Getting Started",
        slug: "getting-started",
        words: "2.1k",
        tag: "guide",
      },
    ],
  },
  {
    label: "Scheduled",
    accent: "bg-blue-400",
    count: 1,
    cards: [
      { title: "Shipping Faster", slug: "shipping-faster", words: "1.6k" },
    ],
  },
  {
    label: "Published",
    accent: "bg-emerald-400",
    count: 4,
    cards: [{ title: "Changelog v0.19", slug: "changelog-v019", words: "420" }],
  },
];

export function CanvasBoard() {
  return (
    <section id="board" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-[400px] w-[500px] -translate-y-1/2 rounded-full bg-purple-600/[0.05] blur-[120px]" />

      <div className="mx-auto max-w-[1100px] px-6">
        <SectionHeading
          eyebrow="Organize"
          eyebrowClassName="text-purple-400/70"
          title="Your whole pipeline on one board"
          description="Every article is a card. Drag it from Draft to Published, schedule it for later, edit tags inline — and move through it all with vim-style keys."
          className="mb-14 max-w-2xl"
        />

        <CanvasSurface className="mx-auto max-w-[960px]" maxTilt={4}>
          {/* Floating schedule chip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            style={{ transform: "translateZ(60px)" }}
            className="absolute -right-3 top-24 z-20 hidden items-center gap-2 rounded-xl border border-blue-500/20 bg-background/90 px-3 py-2 shadow-xl shadow-black/20 backdrop-blur-md md:flex lg:-right-8 dark:bg-foreground/[0.04]"
          >
            <CalendarClock className="size-3.5 text-blue-400" />
            <span className="text-[12px] font-medium text-foreground/70 dark:text-foreground/55">
              Auto-publishes Apr 12, 9:00am
            </span>
          </motion.div>

          <div className="overflow-hidden rounded-2xl border border-foreground/[0.12] bg-background/70 p-4 shadow-2xl shadow-black/25 backdrop-blur-xl sm:p-5 dark:border-foreground/[0.07] dark:bg-foreground/[0.02]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {columns.map((col) => (
                <div key={col.label} className="min-w-0">
                  <div className="mb-2.5 flex items-center gap-2 px-1">
                    <span className={`size-2 rounded-full ${col.accent}`} />
                    <span className="text-[12px] font-semibold text-foreground/65 dark:text-foreground/50">
                      {col.label}
                    </span>
                    <span className="ml-auto rounded-full bg-foreground/[0.05] px-1.5 text-[10px] text-foreground/40">
                      {col.count}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {col.cards.map((card) => (
                      <div
                        key={card.slug}
                        className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] p-2.5 transition-colors hover:border-foreground/[0.15] dark:border-foreground/[0.05]"
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="mt-0.5 size-3 shrink-0 text-foreground/20" />
                          <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-foreground/75 dark:text-foreground/60">
                            {card.title}
                          </p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 pl-[18px]">
                          <span className="font-mono text-[9px] text-foreground/30">
                            /{card.slug}
                          </span>
                          {card.tag ? (
                            <span className="rounded bg-purple-500/10 px-1.5 text-[9px] text-purple-400/70">
                              {card.tag}
                            </span>
                          ) : null}
                          <span className="ml-auto font-mono text-[9px] text-foreground/25">
                            {card.words}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Ghost slot */}
                    <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-foreground/[0.08] text-[10px] text-foreground/20 dark:border-foreground/[0.05]">
                      drop here
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Keyboard hint bar */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-foreground/[0.06] px-1 pt-3 font-mono text-[10px] text-foreground/35">
              <span>
                <span className="text-foreground/55">j / k</span> navigate
              </span>
              <span>
                <span className="text-foreground/55">h / l</span> switch columns
              </span>
              <span>
                <span className="text-foreground/55">m + 1–9</span> move card
              </span>
              <span className="ml-auto text-emerald-400/60">
                ⇧ + click to multi-select
              </span>
            </div>
          </div>
        </CanvasSurface>
      </div>
    </section>
  );
}
