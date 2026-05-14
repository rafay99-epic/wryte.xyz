"use client";

import { motion } from "framer-motion";
import { Check, FileCode, FolderTree, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStepperProps = {
  currentStep: 1 | 2 | 3;
};

const steps = [
  { number: 1 as const, label: "Repository", icon: GitBranch },
  { number: 2 as const, label: "Structure", icon: FolderTree },
  { number: 3 as const, label: "Schema", icon: FileCode },
];

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex items-center gap-1">
            <div
              className={cn(
                "relative flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
                isCompleted && "bg-primary/10 text-primary",
                isCurrent && "bg-foreground text-background",
                !isCompleted && !isCurrent && "text-muted-foreground/40",
              )}
            >
              {isCompleted ? (
                <Check className="size-3" strokeWidth={2.5} />
              ) : (
                <Icon className="size-3" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{step.number}</span>
              {isCurrent && (
                <motion.div
                  layoutId="wizard-step-bg"
                  className="absolute inset-0 rounded-full bg-foreground"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 transition-colors duration-300",
                  currentStep > step.number ? "bg-primary/40" : "bg-border/50",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
