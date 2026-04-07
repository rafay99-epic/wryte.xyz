"use client";

import { Check, FileCode, FolderTree, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { number: 1 as const, label: "Repository", icon: GitBranch },
  { number: 2 as const, label: "Structure", icon: FolderTree },
  { number: 3 as const, label: "Schema", icon: FileCode },
];

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full transition-all duration-300",
                  isCompleted &&
                    "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                  isCurrent &&
                    "bg-primary/15 text-primary ring-2 ring-primary/50",
                  !isCompleted &&
                    !isCurrent &&
                    "bg-muted text-muted-foreground/40",
                )}
              >
                {isCompleted ? (
                  <Check className="size-5" strokeWidth={2.5} />
                ) : (
                  <Icon className="size-[18px]" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  isCurrent && "text-foreground",
                  isCompleted && "text-foreground",
                  !isCompleted && !isCurrent && "text-muted-foreground/40",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-4 mb-5 h-[2px] w-12 rounded-full transition-colors duration-300 sm:w-20",
                  currentStep > step.number
                    ? "bg-primary"
                    : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
