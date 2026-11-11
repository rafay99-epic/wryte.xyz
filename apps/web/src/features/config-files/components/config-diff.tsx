"use client";

import type { ConfigFormat } from "@wryte/backend/_lib/configFiles";
import type { DiffHunk, DiffLine } from "@wryte/logic/lib/config/diff";
import { cn } from "@wryte/logic/lib/utils";
import { HighlightedCode } from "@/components/code/highlighted-code";

const SIGN: Record<DiffLine["kind"], string> = {
  add: "+",
  remove: "-",
  context: " ",
};

export function ConfigDiff({
  hunks,
  language,
}: {
  hunks: DiffHunk[];
  language: ConfigFormat;
}) {
  if (hunks.length === 0) {
    return (
      <p className="p-4 text-xs text-muted-foreground">
        No changes. This file matches GitHub.
      </p>
    );
  }
  return (
    <div className="hljs min-w-max bg-transparent pb-4 font-mono text-xs leading-relaxed">
      {hunks.map((hunk) => (
        <section
          key={`${String(hunk.newStart)}:${String(hunk.lines[0]?.oldLine)}`}
          className="border-b border-border pb-2"
        >
          <h3 className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground">
            Line {hunk.newStart}
          </h3>
          {hunk.lines.map((line) => (
            <div
              key={`${line.kind}:${String(line.oldLine)}:${String(line.newLine)}`}
              className={cn(
                "flex whitespace-pre",
                line.kind === "add" && "bg-emerald-500/10",
                line.kind === "remove" && "bg-destructive/10",
              )}
            >
              <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/50">
                {line.newLine ?? line.oldLine}
              </span>
              <span
                className={cn(
                  "w-4 shrink-0 select-none",
                  line.kind === "add" && "text-emerald-500",
                  line.kind === "remove" && "text-destructive",
                )}
              >
                {SIGN[line.kind]}
              </span>
              <span className="pr-3">
                <HighlightedCode
                  source={line.text.replace(/\r$/, "")}
                  language={language}
                />
              </span>
            </div>
          ))}
        </section>
      ))}
      <p className="px-3 pt-3 font-sans text-muted-foreground">
        Nothing else in this file changes.
      </p>
    </div>
  );
}
