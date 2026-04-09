"use client";

import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileCode,
  FolderTree,
  GitBranch,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { StepConfigurePaths } from "@/components/projects/wizard/step-configure-paths";
import { StepFrontmatterSchema } from "@/components/projects/wizard/step-frontmatter-schema";
import { StepSelectRepo } from "@/components/projects/wizard/step-select-repo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import type { FrontmatterField } from "@/types/frontmatter";
import { DEFAULT_FRONTMATTER_FIELDS } from "@/types/frontmatter";
import { api } from "../../../../../convex/_generated/api";

/**
 * Shape of the multi-step project creation wizard.
 *
 * All three steps share a single state object so values entered in earlier
 * steps are preserved when navigating back and forth.
 */
export interface WizardState {
  step: 1 | 2 | 3;
  // Step 1 — repo selection & project identity
  selectedRepo: {
    fullName: string;
    name: string;
    defaultBranch: string;
    description: string | null;
    isPrivate: boolean;
  } | null;
  projectName: string;
  projectSlug: string;
  /** When true the user skips the GitHub repo picker and enters details manually. */
  useManualSetup: boolean;
  // Step 2 — directory paths & media config
  contentPath: string;
  mediaPath: string;
  mediaStorageMode: "github" | "external";
  // Step 3 — frontmatter schema definition
  frontmatterFields: FrontmatterField[];
  /** If frontmatter fields were auto-detected from an existing file, its name is stored here. */
  detectedFromFile: string | null;
}

/** Sensible defaults so the wizard is usable without touching every field. */
const INITIAL_STATE: WizardState = {
  step: 1,
  selectedRepo: null,
  projectName: "",
  projectSlug: "",
  useManualSetup: false,
  contentPath: "content/blog",
  mediaPath: "public/images",
  mediaStorageMode: "github",
  frontmatterFields: DEFAULT_FRONTMATTER_FIELDS,
  detectedFromFile: null,
};

const STEPS = [
  {
    number: 1 as const,
    label: "Repository",
    description: "Link a GitHub repo",
    icon: GitBranch,
  },
  {
    number: 2 as const,
    label: "Structure",
    description: "Configure paths",
    icon: FolderTree,
  },
  {
    number: 3 as const,
    label: "Schema",
    description: "Frontmatter fields",
    icon: FileCode,
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear active project so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  const handleChange = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const validateStep = useCallback(
    (step: 1 | 2 | 3): boolean => {
      switch (step) {
        case 1: {
          if (!state.projectName.trim()) {
            toast.error("Project name is required");
            return false;
          }
          if (!state.projectSlug.trim()) {
            toast.error("Slug is required");
            return false;
          }
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.projectSlug.trim())) {
            toast.error(
              "Slug must contain only lowercase letters, numbers, and hyphens",
            );
            return false;
          }
          return true;
        }
        case 2: {
          if (!state.contentPath.trim()) {
            toast.error("Content directory is required");
            return false;
          }
          return true;
        }
        case 3: {
          const emptyName = state.frontmatterFields.some((f) => !f.name.trim());
          if (emptyName) {
            toast.error("All frontmatter fields must have a name");
            return false;
          }
          const names = state.frontmatterFields.map((f) => f.name.trim());
          const hasDuplicates = new Set(names).size !== names.length;
          if (hasDuplicates) {
            toast.error("Frontmatter field names must be unique");
            return false;
          }
          return true;
        }
      }
    },
    [state],
  );

  const goToStep = useCallback(
    (target: 1 | 2 | 3) => {
      // Can always go back. Going forward requires validation.
      if (target < state.step) {
        setState((prev) => ({ ...prev, step: target }));
        return;
      }
      // Validate all steps up to target
      for (let s = state.step; s < target; s++) {
        if (!validateStep(s as 1 | 2 | 3)) return;
      }
      setState((prev) => ({ ...prev, step: target }));
    },
    [state.step, validateStep],
  );

  const handleNext = useCallback(() => {
    if (!validateStep(state.step)) return;
    if (state.step < 3) {
      const nextStep = (state.step + 1) as 2 | 3;
      setState((prev) => ({ ...prev, step: nextStep }));
    }
  }, [state.step, validateStep]);

  const handleBack = useCallback(() => {
    if (state.step > 1) {
      const prevStep = (state.step - 1) as 1 | 2;
      setState((prev) => ({ ...prev, step: prevStep }));
    }
  }, [state.step]);

  const handleCreate = useCallback(async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    try {
      const schemaFields = state.frontmatterFields.map((f) => ({
        name: f.name.trim(),
        type: f.type,
        required: f.required,
        defaultValue: f.defaultValue,
        options: f.options,
      }));

      const args: {
        name: string;
        slug: string;
        githubRepo?: string;
        githubBranch?: string;
        contentPath?: string;
        mediaPath?: string;
        mediaStorageMode?: "github" | "external";
        frontmatterSchema?: string;
      } = {
        name: state.projectName.trim(),
        slug: state.projectSlug.trim(),
        contentPath: state.contentPath.trim(),
        mediaPath: state.mediaPath.trim(),
        mediaStorageMode: state.mediaStorageMode,
        frontmatterSchema: JSON.stringify(schemaFields),
      };

      if (state.selectedRepo) {
        args.githubRepo = state.selectedRepo.fullName;
        args.githubBranch = state.selectedRepo.defaultBranch;
      }

      const projectId = await createProject(args);

      toast.success("Project created successfully");
      router.push(`/projects/${projectId}`);
    } catch {
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [state, createProject, router, validateStep]);

  return (
    <div className="flex h-full">
      {/* ── Left rail: step navigation + summary ─────────────────── */}
      <div className="hidden w-56 shrink-0 border-r border-border/50 lg:block">
        <div className="flex h-full flex-col px-4 py-5">
          {/* Back to projects */}
          <Link
            href="/projects"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to projects
          </Link>

          {/* Page title */}
          <h1 className="mb-1 text-sm font-semibold">New Project</h1>
          <p className="mb-6 text-[11px] text-muted-foreground/60">
            Set up your content project
          </p>

          {/* Step list */}
          <nav className="flex-1 space-y-1">
            {STEPS.map((step) => {
              const isCompleted = state.step > step.number;
              const isCurrent = state.step === step.number;
              const Icon = step.icon;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => goToStep(step.number)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                    isCurrent && "bg-accent text-foreground",
                    isCompleted &&
                      !isCurrent &&
                      "text-foreground hover:bg-accent/50",
                    !isCurrent &&
                      !isCompleted &&
                      "text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                      isCurrent && "bg-foreground text-background",
                      isCompleted && !isCurrent && "bg-primary/10 text-primary",
                      !isCurrent &&
                        !isCompleted &&
                        "bg-muted text-muted-foreground/40",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-3.5" strokeWidth={2.5} />
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{step.label}</div>
                    <div className="text-[10px] text-muted-foreground/50">
                      {step.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Summary — shows what's been configured */}
          {(state.selectedRepo || state.projectName) && (
            <div className="mt-auto border-t border-border/40 pt-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Summary
              </p>
              <div className="space-y-1.5 text-[11px]">
                {state.projectName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground/60">Name</span>
                    <span className="max-w-[100px] truncate font-medium text-foreground/80">
                      {state.projectName}
                    </span>
                  </div>
                )}
                {state.selectedRepo && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground/60">Repo</span>
                    <span className="max-w-[100px] truncate font-mono text-[10px] text-foreground/60">
                      {state.selectedRepo.name}
                    </span>
                  </div>
                )}
                {state.step > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground/60">Content</span>
                    <span className="max-w-[100px] truncate font-mono text-[10px] text-foreground/60">
                      {state.contentPath}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile back link + step indicator (visible on smaller screens) */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 lg:hidden">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <ArrowLeft className="size-3" />
            Projects
          </Link>
          <div className="flex items-center gap-1">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  state.step === step.number
                    ? "bg-foreground"
                    : state.step > step.number
                      ? "bg-primary/50"
                      : "bg-border",
                )}
              />
            ))}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto slim-scrollbar">
          <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
            {/* Step title */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state.step}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="mb-6"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                    {(() => {
                      const s = STEPS[state.step - 1];
                      if (!s) return null;
                      const Icon = s.icon;
                      return <Icon className="size-4" />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">
                      {STEPS[state.step - 1]?.label}
                    </h2>
                    <p className="text-xs text-muted-foreground/60">
                      Step {state.step} of 3
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={state.step}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{
                  duration: 0.25,
                  ease: [0.25, 0.1, 0.25, 1],
                  delay: 0.05,
                }}
              >
                {state.step === 1 && (
                  <StepSelectRepo state={state} onChange={handleChange} />
                )}
                {state.step === 2 && (
                  <StepConfigurePaths state={state} onChange={handleChange} />
                )}
                {state.step === 3 && (
                  <StepFrontmatterSchema
                    state={state}
                    onChange={handleChange}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom bar — navigation */}
        <div className="shrink-0 border-t border-border/40 bg-background px-5 py-3 sm:px-8">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              disabled={state.step === 1}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>

            {state.step < 3 ? (
              <Button size="sm" onClick={handleNext} className="gap-1.5">
                Continue
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => void handleCreate()}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                Create Project
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
