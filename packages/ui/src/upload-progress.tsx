import { cn } from "@wryte/logic/lib/utils";
import { Check, Loader2 } from "lucide-react";

export type UploadStep = {
  id: string;
  label: string;
};

export function UploadProgress({
  steps,
  currentStep,
  className,
}: {
  steps: UploadStep[];
  currentStep: string | null;
  className?: string;
}) {
  const currentIdx = currentStep
    ? steps.findIndex((s) => s.id === currentStep)
    : -1;

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border bg-muted/30 px-3 py-3",
        className,
      )}
    >
      {steps.map((step, i) => {
        const isPast = currentIdx > i;
        const isCurrent = steps[i]?.id === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-2.5">
            {isPast ? (
              <div className="flex size-4 shrink-0 items-center justify-center">
                <Check className="size-3.5 text-emerald-500" />
              </div>
            ) : isCurrent ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/25" />
            )}
            <span
              className={cn(
                "text-sm",
                isPast && "text-emerald-600 dark:text-emerald-400",
                isCurrent && "font-medium text-foreground",
                !isPast && !isCurrent && "text-muted-foreground/50",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
