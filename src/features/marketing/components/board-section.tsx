import { motion } from "framer-motion";
import { GalleryVerticalEnd, Keyboard, MousePointerClick } from "lucide-react";
import { BoardCardMock } from "@/features/marketing/components/board-card-mock";

export function BoardSection() {
  return (
    <section id="board" className="relative py-24 sm:py-32">
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

      <div className="mx-auto max-w-[1100px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-[13px] font-medium tracking-[0.15em] text-purple-400/60 uppercase">
            The Board
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your content pipeline, visualized
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
            Drag articles between columns. See word counts, age indicators, and
            tags at a glance. Navigate with vim keys. Bulk-move with
            multi-select.
          </p>
        </motion.div>

        {/* Board mockup */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="animated-border relative"
        >
          <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.2] dark:border-foreground/[0.08] bg-card shadow-2xl shadow-black/60">
            {/* Board title bar */}
            <div className="flex items-center justify-between border-b border-foreground/[0.15] dark:border-foreground/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                  <div className="size-[10px] rounded-full bg-[#febc2e]" />
                  <div className="size-[10px] rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-3 flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2.5 py-1">
                  <GalleryVerticalEnd className="size-3 text-foreground/75 dark:text-foreground/20" />
                  <span className="text-[11px] text-foreground/70 dark:text-foreground/40">
                    Content Board
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {["Board", "Table"].map((view, i) => (
                  <div
                    key={view}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      i === 0
                        ? "bg-purple-500/15 text-purple-400"
                        : "text-foreground/75 dark:text-foreground/20"
                    }`}
                  >
                    {view}
                  </div>
                ))}
              </div>
            </div>

            {/* Board columns */}
            <div className="flex gap-3 overflow-x-auto p-4">
              {/* Draft column */}
              <div className="min-w-[220px] flex-1 rounded-xl border border-amber-500/10 border-t-amber-500/30 border-t-[3px] bg-foreground/[0.01]">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                    Draft
                  </span>
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0 text-[10px] font-semibold text-amber-400">
                    3
                  </span>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  <BoardCardMock
                    title="Getting Started Guide"
                    slug="getting-started"
                    words="1.2k"
                    age="2h"
                    ageColor="text-emerald-400"
                    tags={["docs"]}
                  />
                  <BoardCardMock
                    title="API Reference v2"
                    slug="api-reference-v2"
                    words="3.4k"
                    age="1d"
                    ageColor="text-amber-400"
                    tags={["api", "docs"]}
                    isDragging
                  />
                  <BoardCardMock
                    title="Migration Guide"
                    slug="migration-guide"
                    words="890"
                    age="3d"
                    ageColor="text-red-400"
                    tags={["guide"]}
                  />
                </div>
              </div>

              {/* Review column */}
              <div className="min-w-[220px] flex-1 rounded-xl border border-purple-500/10 border-t-purple-500/30 border-t-[3px] bg-foreground/[0.01]">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                    Review
                  </span>
                  <span className="rounded-full bg-purple-500/10 px-1.5 py-0 text-[10px] font-semibold text-purple-400">
                    2
                  </span>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  <BoardCardMock
                    title="Shipping Faster with Wryte"
                    slug="shipping-faster"
                    words="2.1k"
                    age="4h"
                    ageColor="text-emerald-400"
                    tags={["blog", "devtools"]}
                  />
                  <BoardCardMock
                    title="Content Strategy 2026"
                    slug="content-strategy"
                    words="1.8k"
                    age="12h"
                    ageColor="text-amber-400"
                    tags={["strategy"]}
                  />
                </div>
              </div>

              {/* Published column */}
              <div className="min-w-[220px] flex-1 rounded-xl border border-emerald-500/10 border-t-emerald-500/30 border-t-[3px] bg-foreground/[0.01]">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="text-[12px] font-semibold text-foreground/80 dark:text-foreground/60">
                    Published
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold text-emerald-400">
                    4
                  </span>
                </div>
                <div className="space-y-2 px-2 pb-2">
                  <BoardCardMock
                    title="Why We Built Wryte"
                    slug="why-we-built-wryte"
                    words="1.5k"
                    age="2d"
                    ageColor="text-amber-400"
                    tags={["blog"]}
                  />
                  <BoardCardMock
                    title="Markdown Best Practices"
                    slug="markdown-best-practices"
                    words="2.8k"
                    age="5d"
                    ageColor="text-red-400"
                    tags={["guide", "markdown"]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Floating annotations */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="absolute -right-3 top-1/4 hidden xl:block"
          >
            <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MousePointerClick className="size-3.5 text-amber-400" />
                <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                  Drag & Drop
                </span>
              </div>
              <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                Grab any card and move
                <br />
                it to another column
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="absolute -left-3 bottom-1/4 hidden xl:block"
          >
            <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Keyboard className="size-3.5 text-purple-400" />
                <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                  Vim Navigation
                </span>
              </div>
              <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                j/k to move, m+1-9
                <br />
                to move cards between columns
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
