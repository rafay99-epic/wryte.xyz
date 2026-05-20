"use client";

import { Info } from "lucide-react";
import { useCallback, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;

const VARIABLES = [
  { token: "{{title}}", label: "Title" },
  { token: "{{url}}", label: "URL" },
] as const;

type SocialPostFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  showVariableButtons?: boolean;
};

export function SocialPostField({
  id,
  value,
  onChange,
  placeholder = "Write your social media announcement...",
  rows = 3,
  showVariableButtons = true,
}: SocialPostFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback(
    (token: string) => {
      const el = ref.current;
      if (!el) {
        onChange(value + token);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + token + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
        el.focus();
      });
    },
    [value, onChange],
  );

  const count = value.length;
  const nearLimit = count >= MAX_LENGTH * 0.9;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={MAX_LENGTH}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={placeholder}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="absolute right-2 top-2 rounded-sm p-0.5 text-muted-foreground/40 transition-colors hover:text-muted-foreground">
              <Info className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[240px]">
              <p>
                Use{" "}
                <code className="rounded bg-background/20 px-1 font-mono text-[10px]">
                  {"{{title}}"}
                </code>{" "}
                and{" "}
                <code className="rounded bg-background/20 px-1 font-mono text-[10px]">
                  {"{{url}}"}
                </code>{" "}
                as placeholders. They'll be replaced with the actual post title
                and URL when publishing.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center justify-between gap-2">
        {showVariableButtons ? (
          <div className="flex items-center gap-1">
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertVariable(v.token)}
                className="rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {v.token}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "text-[11px] tabular-nums",
            nearLimit ? "text-amber-500" : "text-muted-foreground/40",
          )}
        >
          {count}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
