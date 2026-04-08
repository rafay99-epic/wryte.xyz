"use client";

import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { StepConfigurePaths } from "@/components/projects/wizard/step-configure-paths";
import { StepFrontmatterSchema } from "@/components/projects/wizard/step-frontmatter-schema";
import { StepSelectRepo } from "@/components/projects/wizard/step-select-repo";
import { WizardStepper } from "@/components/projects/wizard/wizard-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
import { smoothTransition } from "@/lib/motion";
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

const STEP_TITLES: Record<1 | 2 | 3, { title: string; description: string }> = {
  1: {
    title: "Connect your repository",
    description: "Link a GitHub repo or set up manually to get started.",
  },
  2: {
    title: "Configure paths",
    description: "Tell us where your content and media files live.",
  },
  3: {
    title: "Define your schema",
    description: "Set up the frontmatter fields for your markdown files.",
  },
};

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

  const stepInfo = STEP_TITLES[state.step];

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      {/* Top bar: back + stepper */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/projects"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-1.5 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-3.5" />
          Projects
        </Link>
        <WizardStepper currentStep={state.step} />
      </div>

      {/* Step header */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={smoothTransition}
          className="mb-6"
        >
          <h1 className="text-xl font-semibold tracking-tight">
            {stepInfo.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {stepInfo.description}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ ...smoothTransition, delay: 0.03 }}
        >
          {state.step === 1 && (
            <StepSelectRepo state={state} onChange={handleChange} />
          )}
          {state.step === 2 && (
            <StepConfigurePaths state={state} onChange={handleChange} />
          )}
          {state.step === 3 && (
            <StepFrontmatterSchema state={state} onChange={handleChange} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={state.step === 1}
          className="gap-1.5"
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
  );
}
