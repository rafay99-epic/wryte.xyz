"use client";

import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Switch } from "@wryte/ui/switch";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useReadability } from "../hooks/use-readability";
import { useStyleLint } from "../hooks/use-style-lint";
import { useStyleLintChecks } from "../hooks/use-style-lint-checks";
import type {
  FlagType,
  HardSentence,
  ReadabilityStats,
} from "../lib/readability/types";
import { lintStructure } from "../lib/seo-lint";
import {
  groupFindingsByCheck,
  STYLE_LINT_CHECKS,
  type StyleLintCheckId,
} from "../lib/style-lint";
import { useEditorContext } from "./editor-context";

type ReadabilityPanelProps = {
  open: boolean;
  onClose: () => void;
};

/** Reading-ease band label + accent color from the Flesch score. */
function easeBand(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Easy", className: "text-emerald-500" };
  if (score >= 60) return { label: "Plain", className: "text-green-500" };
  if (score >= 50) return { label: "Fairly hard", className: "text-amber-500" };
  if (score >= 30) return { label: "Hard", className: "text-orange-500" };
  return { label: "Very hard", className: "text-red-500" };
}

const FLAG_LABELS: Record<FlagType, string> = {
  "long-sentence": "Long sentences",
  "very-long-sentence": "Very long",
  passive: "Passive voice",
  adverb: "Adverbs",
  complex: "Complex words",
};

export function ReadabilityPanel({ open, onClose }: ReadabilityPanelProps) {
  // The shell subscribes to nothing high-frequency. The body — which holds the
  // content subscription and runs analysis — mounts only inside `open`, so a
  // closed (but enabled) panel does zero work per keystroke.
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="h-full shrink-0 overflow-hidden border-l border-border/40"
        >
          <div className="flex h-full w-[320px] flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-xs font-medium text-foreground">
                Readability
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto slim-scrollbar">
              <ReadabilityPanelBody />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ReadabilityPanelBody() {
  const content = useEditorStore((s) => s.content);
  const { selectRange } = useEditorContext();
  const { result, analyzing } = useReadability();

  if (!result || result.stats.words === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-muted-foreground/60">
        Start writing to see readability insights.
      </p>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <ScoreBlock stats={result.stats} analyzing={analyzing} />
      <StatGrid stats={result.stats} />
      <FlagChips counts={result.stats.counts} />
      <HardSentenceList
        sentences={result.hardSentences}
        content={content}
        onJump={selectRange}
      />
      <StructureLintSection content={content} onJump={selectRange} />
      <StyleLintSection onJump={selectRange} />
    </div>
  );
}

function StyleLintSection({
  onJump,
}: {
  onJump: (start: number, end: number) => void;
}) {
  const { findings, analyzing } = useStyleLint();
  const { enabled, toggle } = useStyleLintChecks();
  const [expanded, setExpanded] = useState<StyleLintCheckId | null>(null);
  const grouped = useMemo(() => groupFindingsByCheck(findings), [findings]);

  return (
    <div className="space-y-1.5" data-testid="style-lint-section">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">Style</p>
        {analyzing && (
          <span className="text-[10px] text-muted-foreground/50">…</span>
        )}
      </div>
      <div className="divide-y divide-border/40 rounded-lg border border-border/40">
        {STYLE_LINT_CHECKS.map((check) => {
          const checkFindings = grouped[check.id];
          const isEnabled = enabled[check.id] ?? true;
          const visibleFindings = isEnabled ? checkFindings : [];
          const isExpanded = expanded === check.id;
          const canExpand = visibleFindings.length > 0;

          return (
            <div key={check.id} data-testid={`style-lint-check-${check.id}`}>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button
                  type="button"
                  disabled={!canExpand}
                  onClick={() => setExpanded(isExpanded ? null : check.id)}
                  data-testid={`style-lint-expand-${check.id}`}
                  className={cn(
                    "flex flex-1 items-center gap-1.5 text-left text-[11px] transition-colors",
                    isEnabled
                      ? "text-foreground/80"
                      : "text-muted-foreground/40",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "size-3 shrink-0 text-muted-foreground/50 transition-transform",
                      isExpanded && "rotate-90",
                    )}
                  />
                  <span className="flex-1">{check.label}</span>
                  <span
                    className="font-medium tabular-nums"
                    data-testid={`style-lint-count-${check.id}`}
                  >
                    {visibleFindings.length}
                  </span>
                </button>
                <Switch
                  size="sm"
                  checked={isEnabled}
                  onCheckedChange={() => toggle(check.id)}
                  aria-label={`Toggle ${check.label}`}
                  data-testid={`style-lint-toggle-${check.id}`}
                />
              </div>
              {isExpanded && canExpand && (
                <div className="space-y-1 px-2.5 pb-2">
                  {visibleFindings.slice(0, 30).map((finding, idx) => (
                    <button
                      key={`${finding.start}-${finding.end}-${idx}`}
                      type="button"
                      onClick={() => onJump(finding.start, finding.end)}
                      data-testid={`style-lint-excerpt-${check.id}-${idx}`}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-foreground/80 transition-colors hover:bg-muted/30"
                    >
                      {finding.excerpt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StructureLintSection({
  content,
  onJump,
}: {
  content: string;
  onJump: (start: number, end: number) => void;
}) {
  const issues = useMemo(() => lintStructure(content), [content]);

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Structure & SEO
      </p>
      {issues.length === 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-border/50 px-3 py-3 text-[11px] text-muted-foreground/50">
          <CheckCircle2 className="size-3.5 text-emerald-500/70" />
          No structure issues found.
        </p>
      ) : (
        issues.map((issue) => {
          const jumpable = issue.start !== undefined && issue.end !== undefined;
          return (
            <button
              key={issue.id}
              type="button"
              disabled={!jumpable}
              onClick={() => {
                if (jumpable)
                  onJump(issue.start as number, issue.end as number);
              }}
              className={cn(
                "flex w-full items-start gap-1.5 rounded-lg border border-border/40 px-2.5 py-2 text-left transition-colors",
                jumpable
                  ? "hover:border-border hover:bg-muted/30"
                  : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "mt-1 size-1.5 shrink-0 rounded-full",
                  issue.severity === "warn" ? "bg-amber-500" : "bg-sky-500",
                )}
              />
              <span className="text-[11px] leading-snug text-foreground/80">
                {issue.message}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function ScoreBlock({
  stats,
  analyzing,
}: {
  stats: ReadabilityStats;
  analyzing: boolean;
}) {
  const band = easeBand(stats.fleschReadingEase);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-3xl font-semibold", band.className)}>
            {Math.round(stats.fleschReadingEase)}
          </span>
          <span className={cn("text-sm font-medium", band.className)}>
            {band.label}
          </span>
        </div>
        {analyzing && (
          <span className="text-[10px] text-muted-foreground/50">…</span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground/60">
        Reading ease · grade level {stats.gradeLevel.toFixed(1)}
      </p>
    </div>
  );
}

function StatGrid({ stats }: { stats: ReadabilityStats }) {
  const items: { label: string; value: string }[] = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    {
      label: "Avg / sentence",
      value: stats.avgWordsPerSentence.toFixed(1),
    },
    { label: "Read time", value: `${stats.readingMinutes} min` },
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground/60">
            {item.label}
          </span>
          <span className="text-xs font-medium tabular-nums text-foreground">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function FlagChips({ counts }: { counts: Record<FlagType, number> }) {
  const order: FlagType[] = [
    "very-long-sentence",
    "long-sentence",
    "passive",
    "adverb",
    "complex",
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.map((type) => (
        <span
          key={type}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
            counts[type] > 0
              ? "border-border/60 text-foreground"
              : "border-border/30 text-muted-foreground/40",
          )}
        >
          <span className="font-medium tabular-nums">{counts[type]}</span>
          <span>{FLAG_LABELS[type]}</span>
        </span>
      ))}
    </div>
  );
}

function HardSentenceList({
  sentences,
  content,
  onJump,
}: {
  sentences: HardSentence[];
  content: string;
  onJump: (start: number, end: number) => void;
}) {
  if (sentences.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/50 px-3 py-4 text-center text-[11px] text-muted-foreground/50">
        No overly long sentences. Nice and tight.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">
        Sentences to tighten
      </p>
      {sentences.slice(0, 40).map((s) => {
        const preview = content
          .slice(s.start, s.end)
          .replace(/\s+/g, " ")
          .trim();
        return (
          <button
            key={`${s.start}-${s.end}`}
            type="button"
            onClick={() => onJump(s.start, s.end)}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border/40 px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/30"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  s.type === "very-long-sentence"
                    ? "bg-red-500"
                    : "bg-amber-500",
                )}
              />
              <span className="text-[10px] font-medium text-muted-foreground">
                {s.words} words
              </span>
            </span>
            <span className="line-clamp-2 text-[11px] text-foreground/80">
              {preview}
            </span>
          </button>
        );
      })}
    </div>
  );
}
