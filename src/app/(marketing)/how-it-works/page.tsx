"use client";

import { motion, useInView } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Command,
  FileText,
  GitBranch,
  GripVertical,
  ImageIcon,
  Layers,
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";
import { APP_RELEASE_LABEL } from "@/lib/release";

/* ------------------------------------------------------------------ */
/*  Step card                                                           */
/* ------------------------------------------------------------------ */

function StepCard({
  num,
  color,
  dotColor,
  glowColor,
  title,
  description,
  features,
  visual,
  delay = 0,
}: {
  num: string;
  color: string;
  dotColor: string;
  glowColor: string;
  title: string;
  description: string;
  features: { icon: React.ElementType; label: string; detail: string }[];
  visual: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Text side */}
        <div className="flex flex-col justify-center">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative">
              <div
                className={`absolute inset-0 scale-[3] rounded-full ${glowColor} blur-xl`}
              />
              <div
                className={`relative z-10 size-5 rounded-full ${dotColor}`}
              />
            </div>
            <span className={`font-mono text-sm font-bold ${color}`}>
              Step {num}
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="mb-8 max-w-md text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
            {description}
          </p>

          <div className="space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-foreground/[0.1] dark:border-foreground/[0.06] bg-foreground/[0.02]`}
                  >
                    <Icon className="size-4 text-foreground/50" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{f.label}</p>
                    <p className="text-[12px] leading-relaxed text-foreground/50 dark:text-foreground/25">
                      {f.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visual side */}
        <div className="flex items-center justify-center">{visual}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual: Editor mock                                                 */
/* ------------------------------------------------------------------ */

function EditorVisual() {
  const lines = [
    { num: 1, text: "---", dim: true },
    {
      num: 2,
      text: 'title: "Getting Started"',
      key: "title:",
      val: '"Getting Started"',
    },
    { num: 3, text: "date: 2026-05-16", key: "date:", val: " 2026-05-16" },
    {
      num: 4,
      text: "tags: [tutorial, guide]",
      key: "tags:",
      val: " [tutorial, guide]",
    },
    { num: 5, text: "draft: false", key: "draft:", val: " false" },
    { num: 6, text: "---", dim: true },
    { num: 7, text: "" },
    { num: 8, text: "# Welcome to Wryte", heading: true },
    { num: 9, text: "" },
    { num: 10, text: "Write content in **markdown**." },
    { num: 11, text: "Publish to GitHub with one click." },
  ];

  return (
    <div className="w-full max-w-sm rounded-xl border border-foreground/[0.12] dark:border-foreground/[0.06] bg-foreground/[0.02] overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-foreground/[0.08] px-4 py-2.5">
        <div className="size-2.5 rounded-full bg-foreground/10" />
        <div className="size-2.5 rounded-full bg-foreground/10" />
        <div className="size-2.5 rounded-full bg-foreground/10" />
        <span className="ml-3 text-[10px] text-foreground/30">
          getting-started.md
        </span>
      </div>
      <div className="p-4 font-mono text-[11px] leading-[1.8]">
        {lines.map((line) => (
          <div key={line.num} className="flex gap-3">
            <span className="w-5 shrink-0 text-right text-foreground/20 select-none">
              {line.num}
            </span>
            {line.dim ? (
              <span className="text-purple-400/40">{line.text}</span>
            ) : line.heading ? (
              <span className="font-semibold text-amber-400/80">
                {line.text}
              </span>
            ) : line.key ? (
              <span>
                <span className="text-emerald-400/60">{line.key}</span>
                <span className="text-foreground/50">{line.val}</span>
              </span>
            ) : (
              <span className="text-foreground/60">{line.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual: Board mock                                                  */
/* ------------------------------------------------------------------ */

function BoardVisual() {
  const columns = [
    {
      label: "Draft",
      color: "border-t-blue-400/60",
      cards: [
        { title: "API Reference", slug: "api-reference" },
        { title: "Migration Guide", slug: "migration-guide" },
      ],
    },
    {
      label: "Review",
      color: "border-t-purple-400/60",
      cards: [{ title: "Getting Started", slug: "getting-started" }],
    },
    {
      label: "Published",
      color: "border-t-emerald-400/60",
      cards: [{ title: "Changelog v2", slug: "changelog-v2" }],
    },
  ];

  return (
    <div className="flex w-full max-w-md gap-2">
      {columns.map((col) => (
        <div
          key={col.label}
          className={`flex-1 rounded-lg border border-foreground/[0.1] dark:border-foreground/[0.06] border-t-[3px] ${col.color} bg-foreground/[0.02] p-2`}
        >
          <p className="mb-2 px-1 text-[10px] font-semibold text-foreground/60">
            {col.label}
          </p>
          <div className="space-y-1.5">
            {col.cards.map((card) => (
              <div
                key={card.slug}
                className="rounded-md border border-foreground/[0.08] dark:border-foreground/[0.04] bg-card px-2.5 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <GripVertical className="size-3 text-foreground/20" />
                  <p className="text-[10px] font-medium text-foreground/70">
                    {card.title}
                  </p>
                </div>
                <p className="mt-0.5 pl-[18px] font-mono text-[8px] text-foreground/30">
                  /{card.slug}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual: Publish mock                                                */
/* ------------------------------------------------------------------ */

function PublishVisual() {
  const steps = [
    { label: "Frontmatter validated", done: true },
    { label: "Markdown compiled", done: true },
    { label: "Committed to GitHub", done: true },
    { label: "Deploy hook triggered", done: true },
  ];

  return (
    <div className="w-full max-w-sm rounded-xl border border-foreground/[0.12] dark:border-foreground/[0.06] bg-foreground/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="size-4 text-emerald-400" />
        <span className="text-xs font-medium text-foreground/60">
          Publishing to{" "}
          <span className="font-mono text-emerald-400/80">main</span>
        </span>
      </div>
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span className="text-[12px] text-foreground/60">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-center">
        <p className="text-[11px] font-medium text-emerald-500">
          Published successfully
        </p>
        <p className="mt-0.5 font-mono text-[9px] text-emerald-400/60">
          commit a3f8b2c
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */

export default function HowItWorksPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] hidden opacity-[0.025] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/[0.05] blur-[120px]" />
        <div className="absolute left-1/4 top-1/2 h-[300px] w-[400px] rounded-full bg-purple-600/[0.03] blur-[100px]" />
        <div className="absolute right-1/4 top-3/4 h-[300px] w-[300px] rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 right-0 left-0 z-50 border-b border-foreground/[0.06] bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <BrandIcon width={28} height={28} className="rounded-md" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground/80">
                wryte
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <MarketingThemeToggle />
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] text-foreground/65 dark:text-foreground/35 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
              >
                <ArrowLeft className="size-3.5" />
                Home
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section
          ref={heroRef}
          className="flex flex-col items-center px-6 pt-32 pb-20"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-foreground/[0.02]">
              <Layers className="size-6 text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              How Wryte works
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-foreground/55 dark:text-foreground/25">
              From blank page to published content in three steps. No deploy
              scripts, no CLI gymnastics, no context switching.
            </p>
          </motion.div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-[1000px] space-y-32 px-6 pb-32">
          {/* Step 1: Write */}
          <StepCard
            num="01"
            color="text-amber-400"
            dotColor="bg-amber-400"
            glowColor="bg-amber-400/20"
            title="Write in markdown"
            description="A distraction-free editor that gets out of your way. Write the way you think — in markdown — with instant preview and auto-save."
            features={[
              {
                icon: FileText,
                label: "Split preview",
                detail:
                  "Live side-by-side preview updates as you type. WYSIWYG without the WYSIWYG complexity.",
              },
              {
                icon: Sparkles,
                label: "AI polish",
                detail:
                  "Bring your own API key. Get AI-powered title suggestions, grammar fixes, and tone adjustments.",
              },
              {
                icon: Tag,
                label: "Schema-driven frontmatter",
                detail:
                  "Define your blog's frontmatter schema once. Every new post auto-generates the right fields.",
              },
              {
                icon: Command,
                label: "Keyboard-first",
                detail:
                  "Customizable shortcuts for everything. Cmd+S to save, Cmd+Shift+P to publish, Cmd+K for quick actions.",
              },
            ]}
            visual={<EditorVisual />}
          />

          {/* Step 2: Organize */}
          <StepCard
            num="02"
            color="text-purple-400"
            dotColor="bg-purple-400"
            glowColor="bg-purple-400/20"
            title="Organize on a board"
            description="See all your content at a glance. Drag articles through your workflow — from draft to review to published."
            delay={0.1}
            features={[
              {
                icon: GripVertical,
                label: "Drag and drop",
                detail:
                  "Move cards between columns to update status. Reorder within a column to set priority.",
              },
              {
                icon: Tag,
                label: "Inline tag editing",
                detail:
                  "Click a tag to add, remove, or create new tags. Autocomplete from your project's existing tags.",
              },
              {
                icon: Calendar,
                label: "Schedule publishing",
                detail:
                  "Set a date and time. Wryte publishes automatically when the clock hits — no manual step.",
              },
              {
                icon: ImageIcon,
                label: "Media management",
                detail:
                  "Upload images to GitHub, UploadThing, or Cloudinary. Automatic compression and optimization.",
              },
            ]}
            visual={<BoardVisual />}
          />

          {/* Step 3: Ship */}
          <StepCard
            num="03"
            color="text-emerald-400"
            dotColor="bg-emerald-400"
            glowColor="bg-emerald-400/20"
            title="Publish to GitHub"
            description="One click and your content is committed to your repository. Deploy hooks fire automatically."
            delay={0.2}
            features={[
              {
                icon: GitBranch,
                label: "Git-native",
                detail:
                  "Content is committed as real markdown files. Your repo stays the single source of truth.",
              },
              {
                icon: Upload,
                label: "Bulk publishing",
                detail:
                  "Select multiple articles and publish them all at once. Perfect for batch content drops.",
              },
              {
                icon: Clock,
                label: "Scheduled deploys",
                detail:
                  "Queue posts to go live at a specific time. Wryte commits on schedule, your CI does the rest.",
              },
              {
                icon: CheckCircle2,
                label: "Conflict detection",
                detail:
                  "If someone edits the same file on GitHub, Wryte detects the conflict and lets you resolve it.",
              },
            ]}
            visual={<PublishVisual />}
          />
        </section>

        {/* CTA */}
        <section className="relative py-24 sm:py-32">
          <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="relative z-10 mx-auto max-w-xl px-6 text-center"
          >
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to start?
            </h2>
            <p className="mt-4 text-[15px] text-foreground/55 dark:text-foreground/25">
              Sign up with GitHub and create your first project in under a
              minute.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-amber-500 px-7 text-[15px] font-semibold text-black transition-all hover:bg-amber-400"
              >
                Start Writing
                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-foreground/[0.2] dark:border-foreground/[0.08] px-7 text-[15px] font-medium text-foreground/75 dark:text-foreground/50 transition-all hover:border-foreground/20 hover:text-foreground/80"
              >
                Contact Us
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-foreground/[0.08] dark:border-foreground/[0.04] py-8">
          <div className="mx-auto max-w-[1100px] px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandIcon
                  width={18}
                  height={18}
                  className="rounded-[3px] opacity-40"
                />
                <span className="text-[12px] text-foreground/40 dark:text-foreground/20">
                  &copy; {new Date().getFullYear()} Wryte
                </span>
              </div>
              <div className="flex items-center gap-5 text-[12px] text-foreground/40 dark:text-foreground/20">
                <Link
                  href="/contact"
                  className="transition-colors hover:text-foreground/70"
                >
                  Contact
                </Link>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-foreground/70"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-foreground/70"
                >
                  Privacy
                </Link>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-foreground/[0.06] dark:border-foreground/[0.03] pt-5">
              <p className="text-[11px] text-foreground/30 dark:text-foreground/15">
                {APP_RELEASE_LABEL} · Built by{" "}
                <a
                  href="https://rafay99.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground/50"
                >
                  Abdul Rafay
                </a>
              </p>
              <a
                href="https://syntaxlabtechnology.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-foreground/30 dark:text-foreground/15 transition-colors hover:text-foreground/50"
              >
                Syntax Lab Technology
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
