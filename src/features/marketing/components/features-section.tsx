import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Command,
  GalleryVerticalEnd,
  GitBranch,
  Keyboard,
  Save,
  Sparkles,
} from "lucide-react";
import { BentoCard } from "@/features/marketing/components/bento-card";

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1100px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-[13px] font-medium tracking-[0.15em] text-purple-400/60 uppercase">
            Capabilities
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Designed for how developers actually work
          </h2>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[260px_260px_260px]">
          {/* Card 1: GitHub Publishing (large, spans 2 rows) */}
          <BentoCard className="lg:row-span-2" delay={0}>
            <div className="flex h-full flex-col p-6">
              <GitBranch className="mb-4 size-5 text-amber-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                GitHub Native
              </h3>
              <p className="mb-6 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Connect any repo, configure content paths, and publish. Wryte
                generates clean commits and tracks file SHAs for smart
                create-or-update logic. Diff-before-sync ensures no wasted
                operations.
              </p>

              <div className="mt-auto space-y-2.5">
                {[
                  {
                    msg: "feat: add getting-started guide",
                    time: "2m ago",
                    color: "bg-emerald-400",
                  },
                  {
                    msg: "content: update api-reference",
                    time: "1h ago",
                    color: "bg-amber-400",
                  },
                  {
                    msg: "feat: new blog post — shipping",
                    time: "3h ago",
                    color: "bg-purple-400",
                  },
                  {
                    msg: "fix: frontmatter date format",
                    time: "1d ago",
                    color: "bg-blue-400",
                  },
                ].map((commit) => (
                  <div
                    key={commit.msg}
                    className="flex items-start gap-3 rounded-lg bg-foreground/[0.02] px-3 py-2 transition-colors group-hover:bg-foreground/[0.04]"
                  >
                    <div
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${commit.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[11px] text-foreground/70 dark:text-foreground/40">
                        {commit.msg}
                      </div>
                      <div className="text-[10px] text-foreground/70 dark:text-foreground/15">
                        {commit.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 2: Kanban Board */}
          <BentoCard delay={0.08}>
            <div className="flex h-full flex-col p-6">
              <GalleryVerticalEnd className="mb-4 size-5 text-purple-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Kanban Board
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Drag cards between columns. Rename inline, edit tags, preview on
                hover. Collapsible columns keep things tidy.
              </p>

              <div className="mt-auto flex gap-2">
                {["Draft", "Review", "Live"].map((col, i) => (
                  <div
                    key={col}
                    className="flex-1 rounded-md bg-foreground/[0.03] px-2 py-1.5 text-center"
                  >
                    <div className="text-[9px] font-semibold text-foreground/50 dark:text-foreground/25">
                      {col}
                    </div>
                    <div className="mt-1 text-[16px] font-bold text-foreground/70 dark:text-foreground/40">
                      {[3, 2, 4][i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 3: Schedule & Forget */}
          <BentoCard delay={0.16}>
            <div className="flex h-full flex-col p-6">
              <Clock className="mb-4 size-5 text-emerald-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Schedule & Forget
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Pick a date and time. Wryte&apos;s cron engine handles the rest
                — your content goes live while you sleep.
              </p>

              <div className="mt-auto grid grid-cols-7 gap-1">
                {Array.from({ length: 14 }, (_, i) => {
                  const isScheduled = i === 5 || i === 11;
                  const isPublished = i < 3;
                  return (
                    <div
                      key={i}
                      className={`flex aspect-square items-center justify-center rounded text-[9px] ${
                        isScheduled
                          ? "bg-amber-500/20 text-amber-400 font-medium"
                          : isPublished
                            ? "bg-emerald-500/10 text-emerald-400/50"
                            : "bg-foreground/[0.02] text-foreground/70 dark:text-foreground/15"
                      }`}
                    >
                      {i + 7}
                    </div>
                  );
                })}
              </div>
            </div>
          </BentoCard>

          {/* Card 4: Keyboard First (large, spans 2 cols) */}
          <BentoCard className="sm:col-span-2" delay={0.12}>
            <div className="flex h-full flex-col p-6">
              <Keyboard className="mb-4 size-5 text-amber-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Keyboard First
              </h3>
              <p className="mb-4 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Every action has a shortcut. Navigate the board with vim keys,
                format text with familiar combos, move cards without touching
                the mouse.
              </p>

              <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {[
                  { keys: "j / k", action: "Navigate cards" },
                  { keys: "h / l", action: "Switch columns" },
                  { keys: "m + 1-9", action: "Move to column" },
                  { keys: "Ctrl+B", action: "Bold text" },
                  { keys: "Ctrl+K", action: "Insert link" },
                  { keys: "Ctrl+S", action: "Force save" },
                ].map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center gap-2">
                    <kbd className="rounded bg-foreground/[0.05] dark:bg-foreground/[0.08] px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/60 dark:text-foreground/40">
                      {shortcut.keys}
                    </kbd>
                    <span className="text-[11px] text-foreground/50 dark:text-foreground/25">
                      {shortcut.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 5: Auto-Save */}
          <BentoCard delay={0.2}>
            <div className="flex h-full flex-col p-6">
              <Save className="mb-4 size-5 text-emerald-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Never Lose Work
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Real-time auto-save syncs every keystroke to the cloud. Pick up
                exactly where you left off, on any device.
              </p>

              <div className="mt-auto flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <motion.div
                    className="absolute size-8 rounded-full bg-emerald-400/20"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  />
                  <div className="size-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="font-mono text-[11px] text-emerald-400/60">
                  Synced — 0ms ago
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Card 6: Smart Frontmatter */}
          <BentoCard delay={0.24}>
            <div className="flex h-full flex-col p-6">
              <Command className="mb-4 size-5 text-blue-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Smart Frontmatter
              </h3>
              <p className="mb-4 text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Auto-detects schema from your repo. Define custom fields and
                Wryte builds the form.
              </p>

              <div className="mt-auto space-y-1.5">
                {[
                  { key: "title", type: "string", required: true },
                  { key: "date", type: "date", required: true },
                  { key: "tags", type: "tags", required: false },
                  { key: "draft", type: "boolean", required: false },
                ].map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-2 font-mono text-[10px]"
                  >
                    <span className="text-purple-400">{field.key}</span>
                    <span className="text-foreground/65 dark:text-foreground/10">
                      :
                    </span>
                    <span className="text-amber-300/40">{field.type}</span>
                    {field.required && (
                      <span className="rounded bg-red-500/10 px-1 text-[8px] text-red-400/50">
                        req
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 7: Multi-Select & Bulk Actions */}
          <BentoCard delay={0.28}>
            <div className="flex h-full flex-col p-6">
              <CheckCircle2 className="mb-4 size-5 text-purple-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                Bulk Actions
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Select multiple articles with checkboxes. Move, publish, or
                delete in batch — across both board and table views.
              </p>

              <div className="mt-auto space-y-1.5">
                {[
                  "Move 3 articles to Review",
                  "Publish 5 to GitHub",
                  "Delete 2 drafts",
                ].map((action) => (
                  <div
                    key={action}
                    className="flex items-center gap-2 rounded bg-foreground/[0.03] px-2 py-1.5 text-[10px] text-foreground/50 dark:text-foreground/30"
                  >
                    <CheckCircle2 className="size-3 text-purple-400/50" />
                    {action}
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* Card 8: AI Enhancement (coming soon) */}
          <BentoCard delay={0.32}>
            <div className="relative flex h-full flex-col p-6">
              <Sparkles className="mb-4 size-5 text-pink-400" />
              <h3 className="mb-2 text-lg font-semibold text-foreground/90">
                AI-Powered Polish
              </h3>
              <p className="text-[13px] leading-relaxed text-foreground/65 dark:text-foreground/30">
                Tone shifts, SEO suggestions, frontmatter generation, and
                content improvements. Your voice, amplified by AI.
              </p>

              <div className="mt-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/15 bg-pink-500/5 px-2.5 py-1 text-[10px] font-medium text-pink-400/60">
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                    className="size-1 rounded-full bg-pink-400"
                  />
                  Coming Soon
                </span>
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
