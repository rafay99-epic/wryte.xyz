"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookText,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  FileCode,
  FolderTree,
  GitBranch,
  Globe,
  GripVertical,
  Info,
  Loader2,
  Plus,
  Rocket,
  Settings2,
  Trash2,
  User,
  Webhook,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FrontmatterField {
  name: string;
  type: import("@/types/frontmatter").FrontmatterFieldType;
  required: boolean;
  defaultValue: string;
  options: string;
  label?: string | undefined;
  description?: string | undefined;
  placeholder?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  group?: string | undefined;
  hidden?: boolean | undefined;
  step?: number | undefined;
}

interface ProjectData {
  name: string;
  slug: string;
  githubRepo?: string;
  githubBranch?: string;
  contentPath?: string;
  mediaPath?: string;
  mediaStorageMode?: "github" | "external";
  frontmatterSchema?: string;
  commitMessageTemplate?: string;
  filenamePattern?: string;
  defaultDraft?: boolean;
  siteUrl?: string;
  deployHookUrl?: string;
  frontmatterFormat?: "yaml" | "toml";
  defaultAuthor?: string;
}

const DEFAULT_FIELDS: FrontmatterField[] = [
  {
    name: "title",
    type: "string",
    required: true,
    defaultValue: "",
    options: "",
  },
  {
    name: "description",
    type: "text",
    required: false,
    defaultValue: "",
    options: "",
  },
  { name: "date", type: "date", required: true, defaultValue: "", options: "" },
  {
    name: "tags",
    type: "tags",
    required: false,
    defaultValue: "",
    options: "",
  },
  {
    name: "draft",
    type: "boolean",
    required: false,
    defaultValue: "true",
    options: "",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();
  const project = useQuery(api.projects.get, { projectId });
  const user = useQuery(api.users.get);
  const projectDeleted = project === null;

  // Set active project in sidebar on mount
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  useEffect(() => {
    if (projectDeleted) {
      router.push("/projects");
    }
  }, [projectDeleted, router]);

  if (project === undefined || user === undefined || projectDeleted) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="size-4" />
          Back to Project
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your project, integrations, and publishing workflow.
        </p>
      </div>

      <Tabs defaultValue="general" className="mx-auto max-w-3xl">
        <TabsList
          variant="line"
          className="mb-8 w-full justify-start border-b pb-px"
        >
          <TabsTrigger value="general" className="gap-1.5 px-3">
            <Settings2 className="size-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5 px-3">
            <GitBranch className="size-3.5" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5 px-3">
            <FolderTree className="size-3.5" />
            Content
          </TabsTrigger>
          <TabsTrigger value="publishing" className="gap-1.5 px-3">
            <Rocket className="size-3.5" />
            Publishing
          </TabsTrigger>
          <TabsTrigger value="frontmatter" className="gap-1.5 px-3">
            <Code2 className="size-3.5" />
            Frontmatter
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <div className="space-y-6">
            <GeneralSection projectId={projectId} project={project} />
            <DangerZoneSection projectId={projectId} />
          </div>
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github">
          <GitHubSection
            projectId={projectId}
            project={project}
            existingToken={user?.githubAccessToken ?? ""}
          />
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          <ContentSection projectId={projectId} project={project} />
        </TabsContent>

        {/* Publishing Tab */}
        <TabsContent value="publishing">
          <PublishingSection projectId={projectId} project={project} />
        </TabsContent>

        {/* Frontmatter Tab */}
        <TabsContent value="frontmatter">
          <FrontmatterSection projectId={projectId} project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable: Section wrapper                                          */
/* ------------------------------------------------------------------ */

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  footer,
  variant,
}: {
  icon?: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "destructive";
}) {
  return (
    <Card className={cn(variant === "destructive" && "border-destructive/30")}>
      <CardHeader>
        <CardTitle
          className={cn(
            "flex items-center gap-2 text-base",
            variant === "destructive" && "text-destructive",
          )}
        >
          {Icon && <Icon className="size-4" />}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
      {footer && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-3">
          {footer}
        </div>
      )}
    </Card>
  );
}

function FieldGroup({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SaveButton({
  isSaving,
  disabled,
  onClick,
  label = "Save changes",
}: {
  isSaving: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled || isSaving}>
      {isSaving && <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/*  General Tab                                                        */
/* ------------------------------------------------------------------ */

function GeneralSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.projects.update);
  const [name, setName] = useState(project.name);
  const [siteUrl, setSiteUrl] = useState(project.siteUrl ?? "");
  const [defaultAuthor, setDefaultAuthor] = useState(
    project.defaultAuthor ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(project.name);
    setSiteUrl(project.siteUrl ?? "");
    setDefaultAuthor(project.defaultAuthor ?? "");
  }, [project.name, project.siteUrl, project.defaultAuthor]);

  const hasChanges =
    name.trim() !== project.name ||
    siteUrl.trim() !== (project.siteUrl ?? "") ||
    defaultAuthor.trim() !== (project.defaultAuthor ?? "");

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Project name is required");
      return;
    }
    setIsSaving(true);
    try {
      const args: Parameters<typeof updateProject>[0] = {
        projectId,
        name: trimmed,
      };
      if (siteUrl.trim()) args.siteUrl = siteUrl.trim();
      if (defaultAuthor.trim()) args.defaultAuthor = defaultAuthor.trim();
      await updateProject(args);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [name, siteUrl, defaultAuthor, projectId, updateProject]);

  return (
    <SettingsCard
      icon={Settings2}
      title="General"
      description="Basic project information and identity."
      footer={
        <>
          <p className="text-xs text-muted-foreground">
            The slug{" "}
            <span className="font-mono text-foreground/70">{project.slug}</span>{" "}
            cannot be changed after creation.
          </p>
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </>
      }
    >
      <FieldGroup label="Project Name" htmlFor="s-name">
        <Input
          id="s-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Blog"
        />
      </FieldGroup>

      <div className="grid gap-5 sm:grid-cols-2">
        <FieldGroup
          label="Site URL"
          htmlFor="s-site-url"
          hint="Used for preview links and canonical URLs."
        >
          <div className="flex items-center gap-0">
            <div className="flex h-9 items-center rounded-l-md border border-r-0 bg-muted/50 px-3 text-xs text-muted-foreground">
              <Globe className="mr-1.5 size-3.5" />
              https://
            </div>
            <Input
              id="s-site-url"
              value={siteUrl.replace(/^https?:\/\//, "")}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="example.com"
              className="rounded-l-none"
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Default Author"
          htmlFor="s-author"
          hint="Injected into frontmatter for new posts."
        >
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="s-author"
              value={defaultAuthor}
              onChange={(e) => setDefaultAuthor(e.target.value)}
              placeholder="John Doe"
              className="pl-9"
            />
          </div>
        </FieldGroup>
      </div>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/*  GitHub Tab                                                         */
/* ------------------------------------------------------------------ */

type VerifyStatus = "idle" | "verifying" | "connected" | "error";

function GitHubSection({
  projectId,
  project,
  existingToken,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
  existingToken: string;
}) {
  const updateProject = useMutation(api.projects.update);
  const updateGithubToken = useMutation(api.users.updateGithubToken);
  const verifyRepoAccess = useAction(api["github"]["verifyRepoAccess"]);

  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [oauthToken, setOauthToken] = useState<string | null>(null);

  const [token, setToken] = useState(existingToken);
  const [showToken, setShowToken] = useState(false);
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

  const [repo, setRepo] = useState(project.githubRepo ?? "");
  const [branch, setBranch] = useState(project.githubBranch ?? "main");
  const [isSavingRepo, setIsSavingRepo] = useState(false);

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    project.githubRepo ? "connected" : "idle",
  );
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    async function checkOAuth() {
      try {
        const res = await fetch("/api/github/token");
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data.token) {
            setOauthConnected(true);
            setOauthToken(data.token);
            return;
          }
        }
        setOauthConnected(false);
      } catch {
        setOauthConnected(false);
      }
    }
    void checkOAuth();
  }, []);

  useEffect(() => {
    setToken(existingToken);
  }, [existingToken]);
  useEffect(() => {
    setRepo(project.githubRepo ?? "");
    setBranch(project.githubBranch ?? "main");
  }, [project.githubRepo, project.githubBranch]);

  const handleSaveToken = useCallback(async () => {
    if (!token.trim()) {
      toast.error("Token is required");
      return;
    }
    setIsSavingToken(true);
    try {
      await updateGithubToken({ token: token.trim() });
      toast.success("GitHub token saved");
    } catch {
      toast.error("Failed to save token");
    } finally {
      setIsSavingToken(false);
    }
  }, [token, updateGithubToken]);

  const repoHasChanges =
    repo.trim() !== (project.githubRepo ?? "") ||
    branch.trim() !== (project.githubBranch ?? "main");

  const handleSaveRepo = useCallback(async () => {
    const trimmedRepo = repo.trim();
    if (!trimmedRepo) {
      toast.error("Repository is required");
      return;
    }
    if (!/^[^/]+\/[^/]+$/.test(trimmedRepo)) {
      toast.error('Repository must be in "owner/repo" format');
      return;
    }
    setIsSavingRepo(true);
    try {
      await updateProject({
        projectId,
        githubRepo: trimmedRepo,
        githubBranch: branch.trim() || "main",
      });
      toast.success("Repository settings saved");
    } catch {
      toast.error("Failed to save repository settings");
    } finally {
      setIsSavingRepo(false);
    }
  }, [repo, branch, projectId, updateProject]);

  const handleVerify = useCallback(async () => {
    const trimmedRepo = repo.trim();
    const verifyToken = oauthToken ?? token.trim();
    if (!verifyToken) {
      toast.error(
        "Connect GitHub via OAuth or save a Personal Access Token first",
      );
      return;
    }
    if (!trimmedRepo) {
      toast.error("Enter a repository to verify");
      return;
    }
    setVerifyStatus("verifying");
    setVerifyError("");
    try {
      const result = await verifyRepoAccess({
        token: verifyToken,
        repo: trimmedRepo,
      });
      if (result.valid) {
        setVerifyStatus("connected");
        toast.success("Repository access verified");
      } else {
        setVerifyStatus("error");
        setVerifyError(result.error ?? "Verification failed");
        toast.error(result.error ?? "Verification failed");
      }
    } catch {
      setVerifyStatus("error");
      setVerifyError("Failed to verify repository access");
      toast.error("Failed to verify repository access");
    }
  }, [repo, token, oauthToken, verifyRepoAccess]);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <SettingsCard
        icon={GitBranch}
        title="Connection"
        description="Link your GitHub account to enable publishing."
      >
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            oauthConnected === true &&
              "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20",
            oauthConnected === false &&
              "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
          )}
        >
          {oauthConnected === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking GitHub connection…
            </div>
          ) : oauthConnected ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <div>
                <p className="font-medium">GitHub connected via OAuth</p>
                <p className="mt-0.5 text-xs text-green-600/80 dark:text-green-400/60">
                  Publishing will use your OAuth token automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Info className="size-4 shrink-0" />
              <div>
                <p className="font-medium">GitHub not connected via OAuth</p>
                <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/60">
                  Connect GitHub via Clerk, or add a Personal Access Token
                  below.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* PAT Fallback */}
        {oauthConnected === true && (
          <button
            type="button"
            onClick={() => setShowPatFallback(!showPatFallback)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showPatFallback ? "Hide" : "Show"} Personal Access Token (fallback)
          </button>
        )}
        {(oauthConnected === false || showPatFallback) && (
          <div className="space-y-2">
            <Label htmlFor="gh-token" className="text-sm font-medium">
              Personal Access Token
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gh-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_..."
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <SaveButton
                isSaving={isSavingToken}
                onClick={handleSaveToken}
                label="Save Token"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Needs{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                repo
              </code>{" "}
              scope. Stored securely and used as a fallback only.
            </p>
          </div>
        )}
      </SettingsCard>

      {/* Repository */}
      <SettingsCard
        icon={FileCode}
        title="Repository"
        description="The GitHub repository where content will be published."
        footer={
          <>
            <ConnectionStatusBadge status={verifyStatus} error={verifyError} />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleVerify}
                disabled={verifyStatus === "verifying"}
              >
                {verifyStatus === "verifying" && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                Verify
              </Button>
              <SaveButton
                isSaving={isSavingRepo}
                disabled={!repoHasChanges}
                onClick={handleSaveRepo}
              />
            </div>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldGroup
            label="Repository"
            htmlFor="gh-repo"
            hint='Format: owner/repo (e.g. "username/my-blog")'
          >
            <Input
              id="gh-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="username/my-blog"
              className="font-mono text-sm"
            />
          </FieldGroup>

          <FieldGroup
            label="Branch"
            htmlFor="gh-branch"
            hint="The branch to commit content to."
          >
            <Input
              id="gh-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="font-mono text-sm"
            />
          </FieldGroup>
        </div>
      </SettingsCard>
    </div>
  );
}

function ConnectionStatusBadge({
  status,
  error,
}: {
  status: VerifyStatus;
  error: string;
}) {
  if (status === "idle") return <span />;
  if (status === "verifying") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Verifying…
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3" /> Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive">
      <XCircle className="size-3" /> {error || "Failed"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Content Tab                                                        */
/* ------------------------------------------------------------------ */

function ContentSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.projects.update);

  const [contentPath, setContentPath] = useState(
    project.contentPath ?? "content/blog",
  );
  const [mediaPath, setMediaPath] = useState(
    project.mediaPath ?? "public/images",
  );
  const [mediaStorageMode, setMediaStorageMode] = useState<
    "github" | "external"
  >(project.mediaStorageMode ?? "github");
  const [filenamePattern, setFilenamePattern] = useState(
    project.filenamePattern ?? "{{slug}}.md",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContentPath(project.contentPath ?? "content/blog");
    setMediaPath(project.mediaPath ?? "public/images");
    setMediaStorageMode(project.mediaStorageMode ?? "github");
    setFilenamePattern(project.filenamePattern ?? "{{slug}}.md");
  }, [
    project.contentPath,
    project.mediaPath,
    project.mediaStorageMode,
    project.filenamePattern,
  ]);

  const hasChanges =
    contentPath.trim() !== (project.contentPath ?? "content/blog") ||
    mediaPath.trim() !== (project.mediaPath ?? "public/images") ||
    mediaStorageMode !== (project.mediaStorageMode ?? "github") ||
    filenamePattern.trim() !== (project.filenamePattern ?? "{{slug}}.md");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        contentPath: contentPath.trim(),
        mediaPath: mediaPath.trim(),
        mediaStorageMode,
        filenamePattern: filenamePattern.trim(),
      });
      toast.success("Content structure saved");
    } catch {
      toast.error("Failed to save content structure");
    } finally {
      setIsSaving(false);
    }
  }, [
    contentPath,
    mediaPath,
    mediaStorageMode,
    filenamePattern,
    projectId,
    updateProject,
  ]);

  return (
    <div className="space-y-6">
      {/* Directory Structure */}
      <SettingsCard
        icon={FolderTree}
        title="Directory Structure"
        description="Where your content and media files live in the repository."
        footer={
          <>
            <span />
            <SaveButton
              isSaving={isSaving}
              disabled={!hasChanges}
              onClick={handleSave}
            />
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldGroup
            label="Content Directory"
            htmlFor="s-content-path"
            hint="Where markdown files are published."
          >
            <div className="relative">
              <FolderTree className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="s-content-path"
                value={contentPath}
                onChange={(e) => setContentPath(e.target.value)}
                placeholder="content/blog"
                className="pl-9 font-mono text-sm"
              />
            </div>
          </FieldGroup>

          <FieldGroup
            label="Media Directory"
            htmlFor="s-media-path"
            hint="Where images and assets are stored."
          >
            <div className="relative">
              <FolderTree className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="s-media-path"
                value={mediaPath}
                onChange={(e) => setMediaPath(e.target.value)}
                placeholder="public/images"
                className="pl-9 font-mono text-sm"
              />
            </div>
          </FieldGroup>
        </div>

        <FieldGroup
          label="Filename Pattern"
          htmlFor="s-filename"
          hint="Variables: {{slug}}, {{date}}, {{year}}, {{month}}, {{day}}"
        >
          <Input
            id="s-filename"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
            placeholder="{{slug}}.md"
            className="max-w-sm font-mono text-sm"
          />
        </FieldGroup>

        <FieldGroup label="Media Storage" hint="">
          <div className="grid gap-3 sm:grid-cols-2">
            <MediaModeOption
              active={mediaStorageMode === "github"}
              onClick={() => setMediaStorageMode("github")}
              title="GitHub Repository"
              description="Upload images directly to your repo."
            />
            <MediaModeOption
              active={mediaStorageMode === "external"}
              onClick={() => setMediaStorageMode("external")}
              title="External URLs"
              description="Reference images hosted elsewhere."
            />
          </div>
        </FieldGroup>
      </SettingsCard>
    </div>
  );
}

function MediaModeOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-input hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "text-sm font-medium",
          active ? "text-primary" : "text-foreground",
        )}
      >
        {title}
      </span>
      <span className="mt-0.5 text-xs text-muted-foreground">
        {description}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Publishing Tab                                                     */
/* ------------------------------------------------------------------ */

function PublishingSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.projects.update);

  const [commitTemplate, setCommitTemplate] = useState(
    project.commitMessageTemplate ?? "docs: publish {{filename}}",
  );
  const [defaultDraft, setDefaultDraft] = useState(
    project.defaultDraft ?? true,
  );
  const [deployHookUrl, setDeployHookUrl] = useState(
    project.deployHookUrl ?? "",
  );
  const [frontmatterFormat, setFrontmatterFormat] = useState<"yaml" | "toml">(
    project.frontmatterFormat ?? "yaml",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCommitTemplate(
      project.commitMessageTemplate ?? "docs: publish {{filename}}",
    );
    setDefaultDraft(project.defaultDraft ?? true);
    setDeployHookUrl(project.deployHookUrl ?? "");
    setFrontmatterFormat(project.frontmatterFormat ?? "yaml");
  }, [
    project.commitMessageTemplate,
    project.defaultDraft,
    project.deployHookUrl,
    project.frontmatterFormat,
  ]);

  const hasChanges =
    commitTemplate.trim() !==
      (project.commitMessageTemplate ?? "docs: publish {{filename}}") ||
    defaultDraft !== (project.defaultDraft ?? true) ||
    deployHookUrl.trim() !== (project.deployHookUrl ?? "") ||
    frontmatterFormat !== (project.frontmatterFormat ?? "yaml");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const args: Parameters<typeof updateProject>[0] = {
        projectId,
        commitMessageTemplate: commitTemplate.trim(),
        defaultDraft,
        frontmatterFormat,
      };
      if (deployHookUrl.trim()) args.deployHookUrl = deployHookUrl.trim();
      await updateProject(args);
      toast.success("Publishing settings saved");
    } catch {
      toast.error("Failed to save publishing settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    commitTemplate,
    defaultDraft,
    deployHookUrl,
    frontmatterFormat,
    projectId,
    updateProject,
  ]);

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={Rocket}
        title="Workflow"
        description="Control how content is committed and deployed."
        footer={
          <>
            <span />
            <SaveButton
              isSaving={isSaving}
              disabled={!hasChanges}
              onClick={handleSave}
            />
          </>
        }
      >
        <FieldGroup
          label="Commit Message Template"
          htmlFor="s-commit"
          hint="Variables: {{filename}}, {{title}}, {{slug}}, {{date}}"
        >
          <Input
            id="s-commit"
            value={commitTemplate}
            onChange={(e) => setCommitTemplate(e.target.value)}
            placeholder="docs: publish {{filename}}"
            className="max-w-lg font-mono text-sm"
          />
        </FieldGroup>

        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Default to draft</p>
            <p className="text-xs text-muted-foreground">
              New documents will have{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                draft: true
              </code>{" "}
              in frontmatter.
            </p>
          </div>
          <Switch
            checked={defaultDraft}
            onCheckedChange={(checked) => setDefaultDraft(checked)}
          />
        </div>

        <FieldGroup label="Frontmatter Format">
          <div className="grid gap-3 sm:grid-cols-2">
            <MediaModeOption
              active={frontmatterFormat === "yaml"}
              onClick={() => setFrontmatterFormat("yaml")}
              title="YAML"
              description="Delimited with --- (most common)"
            />
            <MediaModeOption
              active={frontmatterFormat === "toml"}
              onClick={() => setFrontmatterFormat("toml")}
              title="TOML"
              description="Delimited with +++ (Hugo default)"
            />
          </div>
        </FieldGroup>
      </SettingsCard>

      <SettingsCard
        icon={Webhook}
        title="Deploy Hook"
        description="Trigger a deployment after publishing content."
      >
        <FieldGroup
          label="Webhook URL"
          htmlFor="s-deploy-hook"
          hint="Paste a Vercel, Netlify, or Cloudflare Pages deploy hook URL. A POST request is sent after each publish."
        >
          <Input
            id="s-deploy-hook"
            value={deployHookUrl}
            onChange={(e) => setDeployHookUrl(e.target.value)}
            placeholder="https://api.vercel.com/v1/integrations/deploy/..."
            className="font-mono text-xs"
          />
        </FieldGroup>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Frontmatter Tab                                                    */
/* ------------------------------------------------------------------ */

function FrontmatterSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.projects.update);

  const initialFields = useMemo(() => {
    if (project.frontmatterSchema) {
      try {
        return JSON.parse(project.frontmatterSchema) as FrontmatterField[];
      } catch {
        return DEFAULT_FIELDS;
      }
    }
    return DEFAULT_FIELDS;
  }, [project.frontmatterSchema]);

  const [fields, setFields] = useState<FrontmatterField[]>(initialFields);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  // Sync code editor when switching to code mode
  useEffect(() => {
    if (editorMode === "code") {
      setCodeValue(JSON.stringify(fields, null, 2));
      setCodeError(null);
    }
  }, [editorMode]); // intentionally only on mode switch

  // Parse code editor changes
  const handleCodeChange = useCallback((value: string) => {
    setCodeValue(value);
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setCodeError("Schema must be an array of field definitions");
        return;
      }
      for (const field of parsed) {
        if (!field.name || !field.type) {
          setCodeError("Each field must have a 'name' and 'type' property");
          return;
        }
      }
      setCodeError(null);
      setFields(parsed as FrontmatterField[]);
    } catch (err) {
      setCodeError(
        err instanceof SyntaxError ? err.message : "Invalid JSON",
      );
    }
  }, []);

  const addField = useCallback(() => {
    setFields((prev) => [
      ...prev,
      {
        name: "",
        type: "string",
        required: false,
        defaultValue: "",
        options: "",
      },
    ]);
  }, []);

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateField = useCallback(
    (index: number, updates: Partial<FrontmatterField>) => {
      setFields((prev) =>
        prev.map((field, i) =>
          i === index ? { ...field, ...updates } : field,
        ),
      );
    },
    [],
  );

  const moveField = useCallback((index: number, direction: "up" | "down") => {
    setFields((prev) => {
      const newFields = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newFields.length) return prev;
      const a = newFields[index];
      const b = newFields[targetIndex];
      if (!a || !b) return prev;
      newFields[targetIndex] = a;
      newFields[index] = b;
      return newFields;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (editorMode === "code" && codeError) {
      toast.error("Fix JSON errors before saving");
      return;
    }
    const invalidField = fields.find((f) => !f.name.trim());
    if (invalidField) {
      toast.error("All fields must have a name");
      return;
    }
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        frontmatterSchema: JSON.stringify(fields),
      });
      toast.success("Frontmatter schema saved");
    } catch {
      toast.error("Failed to save frontmatter schema");
    } finally {
      setIsSaving(false);
    }
  }, [fields, projectId, updateProject, editorMode, codeError]);

  const yamlPreview = useMemo(() => {
    const lines = fields
      .filter((f) => f.name.trim())
      .map((f) => {
        const val = f.defaultValue || getPlaceholderForType(f.type);
        return `${f.name}: ${val}`;
      });
    return `---\n${lines.join("\n")}\n---`;
  }, [fields]);

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={BookText}
        title="Schema"
        description="Define the metadata fields included at the top of each markdown file."
        footer={
          <>
            {editorMode === "visual" && (
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus className="size-3.5" />
                Add Field
              </Button>
            )}
            <SaveButton
              isSaving={isSaving}
              onClick={handleSave}
              label="Save Schema"
            />
          </>
        }
      >
        {/* Visual / Code toggle */}
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setEditorMode("visual")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "visual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Settings2 className="mr-1.5 inline-block size-3" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("code")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Code2 className="mr-1.5 inline-block size-3" />
              Code
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {editorMode === "code"
              ? "Edit schema as JSON — supports all field properties"
              : `${fields.length} field${fields.length !== 1 ? "s" : ""} defined`}
          </span>
        </div>

        {editorMode === "visual" ? (
          // --- Visual editor ---
          fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
              <Code2 className="mb-2 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No fields defined yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={addField}
              >
                <Plus className="size-3.5" />
                Add your first field
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field, index) => (
                <FrontmatterFieldRow
                  key={index}
                  field={field}
                  index={index}
                  totalFields={fields.length}
                  onUpdate={(updates) => updateField(index, updates)}
                  onRemove={() => removeField(index)}
                  onMove={(dir) => moveField(index, dir)}
                />
              ))}
            </div>
          )
        ) : (
          // --- Code editor ---
          <div className="space-y-2">
            <textarea
              value={codeValue}
              onChange={(e) => handleCodeChange(e.target.value)}
              spellCheck={false}
              className={cn(
                "w-full rounded-lg border bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-green-300 outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                "placeholder:text-green-800",
                "min-h-[300px] resize-y",
                codeError && "border-destructive focus-visible:ring-destructive/30",
              )}
              placeholder={`[\n  {\n    "name": "title",\n    "type": "string",\n    "required": true\n  }\n]`}
            />
            {codeError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{codeError}</span>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-medium">Available field types:</p>
              <p className="mt-1 font-mono">
                string · text · url · image · slug · number · date · datetime ·
                boolean · tags · list · select · multiselect · color · json
              </p>
              <p className="mt-2 font-medium">Optional properties:</p>
              <p className="mt-1 font-mono">
                label · description · placeholder · group · hidden · min · max ·
                step · options · defaultValue · required
              </p>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* YAML Preview */}
      {fields.length > 0 && (
        <SettingsCard
          icon={Code2}
          title="Preview"
          description="How your frontmatter will look in the published markdown file."
        >
          <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
            {yamlPreview}
          </pre>
        </SettingsCard>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Frontmatter Field Row                                              */
/* ------------------------------------------------------------------ */

function FrontmatterFieldRow({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMove,
}: {
  field: FrontmatterField;
  index: number;
  totalFields: number;
  onUpdate: (updates: Partial<FrontmatterField>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvancedSettings =
    field.label || field.description || field.placeholder || field.group ||
    field.min !== undefined || field.max !== undefined || field.step !== undefined ||
    field.hidden;

  return (
    <div className="group flex items-start gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/20">
      {/* Reorder handle */}
      <div className="flex flex-col gap-0.5 pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
          aria-label="Move up"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === totalFields - 1}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
          aria-label="Move down"
        >
          <GripVertical className="size-3.5" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 space-y-2">
        {/* Row 1: Name + Type */}
        <div className="flex gap-2">
          <Input
            placeholder="Field name (YAML key)"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
          <Select
            value={field.type}
            onValueChange={(val) =>
              onUpdate({ type: val as FrontmatterField["type"] })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="url">URL</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="slug">Slug</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="datetime">DateTime</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="tags">Tags</SelectItem>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="multiselect">Multi-Select</SelectItem>
              <SelectItem value="color">Color</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Required + Default */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              size="sm"
              checked={field.required}
              onCheckedChange={(checked) => onUpdate({ required: checked })}
            />
            <span className="text-xs text-muted-foreground">Required</span>
          </div>
          <Input
            placeholder="Default value"
            value={field.defaultValue}
            onChange={(e) => onUpdate({ defaultValue: e.target.value })}
            className="flex-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium transition-colors",
              showAdvanced || hasAdvancedSettings
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {showAdvanced ? "Less" : "More"}
          </button>
        </div>

        {/* Options for select/multiselect */}
        {(field.type === "select" || field.type === "multiselect") && (
          <Input
            placeholder="Options (comma-separated, e.g. tech, lifestyle, travel)"
            value={field.options}
            onChange={(e) => onUpdate({ options: e.target.value })}
            className="text-sm"
          />
        )}

        {/* Advanced settings (collapsible) */}
        {showAdvanced && (
          <div className="space-y-2 rounded-lg border border-dashed bg-muted/10 p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Display Label
                </Label>
                <Input
                  placeholder="Human-readable name"
                  value={field.label ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      label: e.target.value || undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Group
                </Label>
                <Input
                  placeholder="e.g. SEO, Author, Meta"
                  value={field.group ?? ""}
                  onChange={(e) =>
                    onUpdate({
                      group: e.target.value || undefined,
                    })
                  }
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Placeholder
              </Label>
              <Input
                placeholder="Placeholder text in editor"
                value={field.placeholder ?? ""}
                onChange={(e) =>
                  onUpdate({
                    placeholder: e.target.value || undefined,
                  })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Description
              </Label>
              <Input
                placeholder="Help text shown below field"
                value={field.description ?? ""}
                onChange={(e) =>
                  onUpdate({
                    description: e.target.value || undefined,
                  })
                }
                className="text-sm"
              />
            </div>

            {/* Number-specific: min, max, step */}
            {field.type === "number" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Min
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.min ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        min: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Max
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.max ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        max: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Step
                  </Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={field.step ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        step: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* String/text: max length */}
            {(field.type === "string" || field.type === "text") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Max Length
                  </Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={field.max ?? ""}
                    onChange={(e) =>
                      onUpdate({
                        max: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Hidden toggle */}
            <div className="flex items-center gap-2">
              <Switch
                size="sm"
                checked={field.hidden ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({ hidden: checked || undefined })
                }
              />
              <span className="text-xs text-muted-foreground">
                Hidden from editor
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onRemove}
        className="mt-1.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove field"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function getPlaceholderForType(type: FrontmatterField["type"]): string {
  switch (type) {
    case "string":
      return '"example"';
    case "text":
      return '"A longer text..."';
    case "url":
      return '"https://example.com"';
    case "image":
      return '"/images/hero.jpg"';
    case "slug":
      return '"my-post-slug"';
    case "number":
      return "0";
    case "boolean":
      return "true";
    case "date":
      return new Date().toISOString().split("T")[0] ?? "";
    case "datetime":
      return new Date().toISOString();
    case "tags":
      return '["tag1", "tag2"]';
    case "list":
      return '["item1", "item2"]';
    case "select":
      return '"option1"';
    case "multiselect":
      return '["opt1", "opt2"]';
    case "color":
      return '"#3b82f6"';
    case "json":
      return '{"key": "value"}';
    default:
      return '""';
  }
}

/* ------------------------------------------------------------------ */
/*  Danger Zone                                                        */
/* ------------------------------------------------------------------ */

function DangerZoneSection({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const removeProject = useMutation(api.projects.remove);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await removeProject({ projectId });
      toast.success("Project deleted");
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  }, [projectId, removeProject, router]);

  return (
    <SettingsCard
      icon={AlertTriangle}
      title="Danger Zone"
      description="Irreversible and destructive actions."
      variant="destructive"
    >
      <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-medium">Delete this project</p>
          <p className="text-xs text-muted-foreground">
            Permanently removes this project and all its documents.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you absolutely sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              All documents, scheduled publishes, and project settings will be
              permanently removed.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="mb-6 h-7 w-24" />
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-72" />
      <div className="mx-auto max-w-3xl">
        <Skeleton className="mb-8 h-9 w-full max-w-md" />
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
