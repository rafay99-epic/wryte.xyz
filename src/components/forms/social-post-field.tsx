"use client";

import { Info } from "lucide-react";
import { useCallback, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  renderSocialText,
  type SocialTemplateVars,
} from "@/lib/social-template";
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
  /**
   * When provided, renders a live preview of the message with the
   * placeholders resolved — exactly what will be posted.
   */
  previewValues?: SocialTemplateVars | undefined;
};

export function SocialPostField({
  id,
  value,
  onChange,
  placeholder = "Write your social media announcement...",
  rows = 3,
  showVariableButtons = true,
  previewValues,
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

  const preview = previewValues
    ? renderSocialText(value, previewValues).trim()
    : "";

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={MAX_LENGTH}
          className="flex w-full resize-y rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                as placeholders. They're filled in with the real title and link
                when the post goes out.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center justify-between gap-2">
        {showVariableButtons ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Insert
            </span>
            {VARIABLES.map((variable) => (
              <button
                key={variable.token}
                type="button"
                onClick={() => insertVariable(variable.token)}
                title={`Insert ${variable.label}`}
                className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
              >
                {variable.token}
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

      {previewValues && (
        <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            Preview
          </p>
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/75">
            {preview || "Nothing to preview yet."}
          </p>
        </div>
      )}
    </div>
  );
}
