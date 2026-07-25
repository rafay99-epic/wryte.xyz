import { motion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { SectionHeading } from "@/features/marketing/components/section-heading";
import {
  type Cell,
  comparisonColumns,
  comparisonRows,
  oldWaySteps,
  wryteWaySteps,
} from "@/features/marketing/constants";

/* ------------------------------------------------------------------ */
/*  Verdict icon                                                        */
/* ------------------------------------------------------------------ */

function Verdict({ cell }: { cell: Cell }) {
  const config = {
    yes: {
      Icon: Check,
      tint: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/15",
      ring: "ring-emerald-500/30",
    },
    no: {
      Icon: X,
      tint: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/12",
      ring: "ring-rose-500/25",
    },
    partial: {
      Icon: Minus,
      tint: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/15",
      ring: "ring-amber-500/30",
    },
  }[cell.verdict];

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span
        className={`flex size-7 items-center justify-center rounded-full ring-1 ring-inset ${config.bg} ${config.ring}`}
      >
        <config.Icon className={`size-4 ${config.tint}`} strokeWidth={2.75} />
      </span>
      <span className="text-[11px] font-medium leading-tight text-foreground/70 dark:text-foreground/50">
        {cell.note}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The "git dance" diff narrative                                      */
/* ------------------------------------------------------------------ */

function DiffNarrative() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Old way (red) */}
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="overflow-hidden rounded-2xl border border-rose-500/15 bg-rose-500/[0.03]"
      >
        <div className="flex items-center gap-2 border-b border-rose-500/10 px-4 py-3">
          <span className="font-mono text-[12px] text-rose-400/70">
            - the usual CMS → git dance
          </span>
        </div>
        <div className="space-y-1 p-4 font-mono text-[12.5px] leading-relaxed">
          {oldWaySteps.map((step) => (
            <div
              key={step}
              className="flex items-start gap-2.5 text-rose-300/70 dark:text-rose-300/55"
            >
              <span className="select-none text-rose-400/50">-</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Wryte way (green) */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04]"
      >
        <div className="flex items-center gap-2 border-b border-emerald-500/15 px-4 py-3">
          <BrandIcon width={16} height={16} className="rounded-[3px]" />
          <span className="font-mono text-[12px] text-emerald-400/80">
            + with Wryte
          </span>
        </div>
        <div className="space-y-1 p-4 font-mono text-[12.5px] leading-relaxed">
          {wryteWaySteps.map((step) => (
            <div
              key={step}
              className="flex items-start gap-2.5 text-emerald-300/85 dark:text-emerald-300/70"
            >
              <span className="select-none text-emerald-400/60">+</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature matrix                                                      */
/* ------------------------------------------------------------------ */

function FeatureMatrix() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7 }}
      className="overflow-hidden rounded-2xl border border-foreground/[0.12] bg-card shadow-lg shadow-black/5 dark:border-foreground/[0.08] dark:shadow-black/20"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-foreground/[0.12] bg-muted">
              <th className="sticky left-0 z-10 bg-muted px-4 py-3.5 text-left text-[12px] font-semibold uppercase tracking-wider text-foreground/60 dark:text-foreground/50">
                Capability
              </th>
              {comparisonColumns.map((col) => {
                const isWryte = col.key === "wryte";
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-3.5 text-center text-[13px] ${
                      isWryte
                        ? "border-x border-amber-500/30 bg-amber-500/[0.14] font-bold text-amber-600 dark:bg-amber-500/[0.12] dark:text-amber-400"
                        : "font-semibold text-foreground/70 dark:text-foreground/55"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {isWryte ? (
                        <BrandIcon
                          width={16}
                          height={16}
                          className="rounded-[3px]"
                        />
                      ) : null}
                      {col.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, rowIndex) => {
              const odd = rowIndex % 2 === 1;
              const rowBg = odd ? "bg-muted" : "";
              const stickyBg = odd ? "bg-muted" : "bg-card";
              return (
                <tr
                  key={row.capability}
                  className={`border-b border-foreground/[0.08] last:border-0 ${rowBg}`}
                >
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 px-4 py-4 text-left text-[13px] font-semibold text-foreground/85 dark:text-foreground/70 ${stickyBg}`}
                  >
                    {row.capability}
                  </th>
                  {comparisonColumns.map((col) => {
                    const isWryte = col.key === "wryte";
                    const cell = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-4 align-top ${
                          isWryte
                            ? "border-x border-amber-500/25 bg-amber-500/[0.09] dark:bg-amber-500/[0.1]"
                            : ""
                        }`}
                      >
                        <Verdict cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                             */
/* ------------------------------------------------------------------ */

export function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-amber-500/[0.04] blur-[130px]" />

      <div className="mx-auto max-w-[1100px] px-6">
        <SectionHeading
          eyebrow="Where Wryte stands"
          eyebrowClassName="text-amber-400/70"
          title="Every CMS bolts git on. Wryte starts there."
          description="Payload, Sanity, and Contentful keep your content in their own database and treat git as an export problem — so you wire up webhooks and pray they fire. TinaCMS gets closer, but you have to wrap your whole site in its config. Wryte points at any GitHub repo and writes plain markdown commits. Nothing to install in your codebase."
          align="center"
          className="mb-14"
        />

        <DiffNarrative />

        <div className="mt-8">
          <FeatureMatrix />
        </div>

        {/* Payload-specific callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mt-8 max-w-3xl rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] px-6 py-5 dark:border-foreground/[0.05]"
        >
          <p className="text-[14px] leading-relaxed text-foreground/60 dark:text-foreground/40">
            <span className="font-semibold text-foreground/80">
              Take Payload.
            </span>{" "}
            It&apos;s a great code-first CMS — but you stand up a database,
            model collections in code, host the app, and your content lives in
            Postgres or Mongo. Getting it into a git-backed static site means an
            export step and a build hook. Wryte skips all of it: the markdown
            files <span className="text-amber-400/90">are</span> the content,
            and the commit <span className="text-amber-400/90">is</span> the
            publish.
          </p>
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-foreground/30 dark:text-foreground/20">
          Comparison reflects typical out-of-the-box setups. Every tool here is
          capable — Wryte just optimizes for one workflow: markdown in a repo.
        </p>
      </div>
    </section>
  );
}
