import { motion } from "framer-motion";
import { Check, FileText, Sparkles } from "lucide-react";
import { CanvasSurface } from "@/features/marketing/components/canvas-surface";
import { SectionHeading } from "@/features/marketing/components/section-heading";

const frontmatter = [
  { key: "title", value: '"Shipping Faster"', type: "string" },
  { key: "date", value: "2026-04-07", type: "date" },
  { key: "tags", value: "[devtools]", type: "tags" },
  { key: "draft", value: "false", type: "boolean" },
];

const bodyLines: { text: string; kind?: "h1" | "bold" | "dim" }[] = [
  { text: "# The Developer Content Problem", kind: "h1" },
  { text: "" },
  { text: "Most developers write in markdown — but" },
  { text: "publishing still means committing, pushing," },
  { text: "and waiting on a deploy to finish." },
  { text: "" },
  { text: "**Wryte changes that.**", kind: "bold" },
  { text: "One click from editor to your repo.", kind: "dim" },
];

function FloatingChip({
  className,
  icon: Icon,
  label,
  tint,
}: {
  className: string;
  icon: React.ElementType;
  label: string;
  tint: string;
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

export function CanvasEditor() {
  return (
    <section id="editor" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute left-1/4 top-1/2 h-[400px] w-[500px] -translate-y-1/2 rounded-full bg-amber-500/[0.05] blur-[120px]" />

      <div className="mx-auto max-w-[1100px] px-6">
        <SectionHeading
          eyebrow="Write"
          eyebrowClassName="text-amber-400/70"
          title="A real editor — not a form with a rich-text box"
          description="Markdown with live preview, schema-driven frontmatter, and AI polish on your own keys. The kind of editor you'd actually choose to write in."
          className="mb-14 max-w-2xl"
        />

        <CanvasSurface className="mx-auto max-w-[920px]">
          <FloatingChip
            className="-left-4 top-16 lg:-left-10"
            icon={Sparkles}
            label="AI polish · BYO key"
            tint="text-pink-400"
          />
          <FloatingChip
            className="-right-3 bottom-20 lg:-right-8"
            icon={Check}
            label="Auto-saved · 0ms ago"
            tint="text-emerald-400"
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
                <FileText className="size-3" />
                shipping-faster.md
              </span>
              <span className="ml-auto rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400/80">
                ● live preview
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[170px_1fr_1fr]">
              {/* Frontmatter sidebar */}
              <div className="hidden border-r border-foreground/[0.06] p-4 md:block">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-foreground/30">
                  Frontmatter
                </p>
                <div className="space-y-3">
                  {frontmatter.map((f) => (
                    <div key={f.key}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-purple-400">
                          {f.key}
                        </span>
                        <span className="rounded bg-foreground/[0.05] px-1 font-mono text-[8px] text-foreground/30">
                          {f.type}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-foreground/55 dark:text-foreground/40">
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Markdown source */}
              <div className="border-r border-foreground/[0.06] p-5 font-mono text-[12px] leading-[1.8]">
                {bodyLines.map((line, i) => (
                  <div
                    key={`${line.text}-${i}`}
                    className={
                      line.kind === "h1"
                        ? "font-semibold text-amber-400/80"
                        : line.kind === "bold"
                          ? "font-semibold text-foreground/80"
                          : line.kind === "dim"
                            ? "text-foreground/45"
                            : "text-foreground/60 dark:text-foreground/45"
                    }
                  >
                    {line.text || " "}
                  </div>
                ))}
                <span className="inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-amber-400" />
              </div>

              {/* Rendered preview */}
              <div className="hidden p-5 md:block">
                <h3 className="text-[15px] font-bold tracking-tight text-foreground/85">
                  The Developer Content Problem
                </h3>
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/55 dark:text-foreground/40">
                  Most developers write in markdown — but publishing still means
                  committing, pushing, and waiting on a deploy to finish.
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-foreground/55 dark:text-foreground/40">
                  <span className="font-semibold text-foreground/75">
                    Wryte changes that.
                  </span>{" "}
                  One click from editor to your repo.
                </p>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center gap-4 border-t border-foreground/[0.07] px-4 py-2 font-mono text-[10px] text-foreground/35">
              <span>markdown</span>
              <span>UTF-8</span>
              <span>312 words</span>
              <span className="ml-auto text-emerald-400/70">⌘S to publish</span>
            </div>
          </div>
        </CanvasSurface>
      </div>
    </section>
  );
}
