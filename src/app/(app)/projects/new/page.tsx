"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { StepConfigurePaths } from "@/components/projects/wizard/step-configure-paths";
import { StepFrontmatterSchema } from "@/components/projects/wizard/step-frontmatter-schema";
import { StepSelectRepo } from "@/components/projects/wizard/step-select-repo";
import { WizardStepper } from "@/components/projects/wizard/wizard-stepper";
import { Button, buttonVariants } from "@/components/ui/button";
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

/**
 * Three-step wizard for creating a new project.
 *
 * Step 1: Select a GitHub repo (or opt for manual setup) and name the project.
 * Step 2: Configure content and media directory paths.
 * Step 3: Define the frontmatter schema for documents.
 *
 * On final submission, the wizard calls the `projects.create` Convex mutation
 * and redirects the user to the newly created project page.
 */
export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear active project so sidebar shows default view
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  // Merge partial updates into the wizard state — used by each step component.
  const handleChange = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Validates the fields for the given step number.
   * Returns `true` if valid; on failure, shows an error toast and returns `false`.
   */
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
          // Slug must be a valid URL segment: lowercase alphanumeric + hyphens.
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
          // Every frontmatter field must be named.
          const emptyName = state.frontmatterFields.some((f) => !f.name.trim());
          if (emptyName) {
            toast.error("All frontmatter fields must have a name");
            return false;
          }
          // Duplicate field names would cause YAML key collisions.
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

  // Advance to the next step after validating the current one.
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

  /**
   * Final submission handler.
   *
   * Validates step 3, serialises the frontmatter schema to JSON, builds
   * the mutation args (attaching GitHub repo details only if a repo was
   * selected), creates the project in Convex, and navigates to it.
   */
  const handleCreate = useCallback(async () => {
    if (!validateStep(3)) return;

    setIsSubmitting(true);
    try {
      // Serialize frontmatter fields for storage as a JSON string in Convex.
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

      // Only attach GitHub fields when the user picked a repo (not manual setup).
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/projects"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-4 text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            Back to Projects
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Plus className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Create New Project
              </h1>
              <p className="text-sm text-muted-foreground">
                Set up your content project in a few steps
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <WizardStepper currentStep={state.step} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border bg-card/50 shadow-sm">
          <div className="p-5 sm:p-6">
            {state.step === 1 && (
              <StepSelectRepo state={state} onChange={handleChange} />
            )}
            {state.step === 2 && (
              <StepConfigurePaths state={state} onChange={handleChange} />
            )}
            {state.step === 3 && (
              <StepFrontmatterSchema state={state} onChange={handleChange} />
            )}
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3 sm:px-6">
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
      </div>
    </div>
  );
}
