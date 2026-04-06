"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateSlug } from "@/lib/markdown";
import { api } from "../../../../../convex/_generated/api";

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setName(newName);
      if (!slugManuallyEdited) {
        setSlug(generateSlug(newName));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSlugManuallyEdited(true);
      setSlug(generateSlug(e.target.value));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = name.trim();
      const trimmedSlug = slug.trim();

      if (!trimmedName) {
        toast.error("Project name is required");
        return;
      }

      if (!trimmedSlug) {
        toast.error("Slug is required");
        return;
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
        toast.error(
          "Slug must contain only lowercase letters, numbers, and hyphens",
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const projectId = await createProject({
          name: trimmedName,
          slug: trimmedSlug,
        });
        toast.success("Project created");
        router.push(`/projects/${projectId}/settings`);
      } catch {
        toast.error("Failed to create project");
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, slug, createProject, router],
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/projects" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="size-4" />
          Back to Projects
        </Link>
      </div>

      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create New Project</CardTitle>
            <CardDescription>
              Set up a new project to organize your content. You can configure
              GitHub integration in the next step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My Blog"
                  value={name}
                  onChange={handleNameChange}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-slug">Slug</Label>
                <Input
                  id="project-slug"
                  placeholder="my-blog"
                  value={slug}
                  onChange={handleSlugChange}
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier. Auto-generated from the name.
                </p>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Create Project
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
