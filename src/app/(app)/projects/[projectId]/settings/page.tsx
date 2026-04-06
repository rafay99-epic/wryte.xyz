"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  GitFork,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

interface FrontmatterField {
  name: string;
  type: "string" | "text" | "boolean" | "date" | "tags" | "select";
  required: boolean;
  defaultValue: string;
  options: string;
}

const DEFAULT_FIELDS: FrontmatterField[] = [
  { name: "title", type: "string", required: true, defaultValue: "", options: "" },
  { name: "description", type: "text", required: false, defaultValue: "", options: "" },
  { name: "date", type: "date", required: true, defaultValue: "", options: "" },
  { name: "tags", type: "tags", required: false, defaultValue: "", options: "" },
  { name: "draft", type: "boolean", required: false, defaultValue: "true", options: "" },
];

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const project = useQuery(api.projects.get, { projectId });
  const user = useQuery(api.users.get);

  if (project === undefined || user === undefined) {
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your project, GitHub integration, and content structure.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <GeneralSettingsSection projectId={projectId} project={project} />
        <GitHubSection
          projectId={projectId}
          project={project}
          existingToken={user?.githubAccessToken ?? ""}
        />
        <ContentStructureSection projectId={projectId} project={project} />
        <FrontmatterSchemaSection projectId={projectId} project={project} />
        <DangerZoneSection projectId={projectId} />
      </div>
    </div>
  );
}

// --- General Settings ---

function GeneralSettingsSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: { name: string; slug: string };
}) {
  const updateProject = useMutation(api.projects.update);
  const [name, setName] = useState(project.name);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(project.name);
  }, [project.name]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Project name is required");
      return;
    }
    setIsSaving(true);
    try {
      await updateProject({ projectId, name: trimmed });
      toast.success("Project name updated");
    } catch {
      toast.error("Failed to update project name");
    } finally {
      setIsSaving(false);
    }
  }, [name, projectId, updateProject]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Basic project information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Project Name</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-slug">Slug</Label>
          <Input id="settings-slug" value={project.slug} disabled />
          <p className="text-xs text-muted-foreground">
            The slug cannot be changed after creation.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || name.trim() === project.name}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// --- GitHub Repository ---

type VerifyStatus = "idle" | "verifying" | "connected" | "error";

function GitHubSection({
  projectId,
  project,
  existingToken,
}: {
  projectId: Id<"projects">;
  project: { githubRepo?: string; githubBranch?: string };
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

  // Check OAuth connection on mount
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
    // Use OAuth token if available, otherwise fall back to PAT
    const verifyToken = oauthToken ?? token.trim();
    if (!verifyToken) {
      toast.error("Connect GitHub via OAuth or save a Personal Access Token first");
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitFork className="size-5" />
          GitHub Repository
        </CardTitle>
        <CardDescription>
          Connect your project to a GitHub repository for publishing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OAuth Status */}
        <div className="rounded-lg border p-3">
          {oauthConnected === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking GitHub connection...
            </div>
          ) : oauthConnected ? (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              GitHub connected via OAuth — publishing will use your OAuth token automatically.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="size-4" />
                GitHub not connected via OAuth
              </div>
              <p className="text-xs text-muted-foreground">
                Connect GitHub via Clerk to auto-import repos, or use a
                Personal Access Token below as a fallback.
              </p>
            </div>
          )}
        </div>

        {/* PAT Fallback — collapsible when OAuth is connected */}
        {oauthConnected ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowPatFallback(!showPatFallback)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {showPatFallback ? "Hide" : "Show"} Personal Access Token (fallback)
            </button>
            {showPatFallback && (
              <PatTokenInput
                token={token}
                showToken={showToken}
                isSaving={isSavingToken}
                onTokenChange={setToken}
                onToggleShow={() => setShowToken(!showToken)}
                onSave={handleSaveToken}
              />
            )}
          </div>
        ) : (
          <PatTokenInput
            token={token}
            showToken={showToken}
            isSaving={isSavingToken}
            onTokenChange={setToken}
            onToggleShow={() => setShowToken(!showToken)}
            onSave={handleSaveToken}
          />
        )}

        <Separator />

        {/* Repo + Branch */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="gh-repo">Repository</Label>
            <Input
              id="gh-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="username/my-blog"
            />
            <p className="text-xs text-muted-foreground">
              Format: owner/repo (e.g., &quot;username/my-blog&quot;)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-branch">Branch</Label>
            <Input
              id="gh-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleVerify}
              disabled={verifyStatus === "verifying"}
            >
              {verifyStatus === "verifying" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Verify Connection
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRepo}
              disabled={isSavingRepo}
            >
              {isSavingRepo && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </div>
          <ConnectionStatus status={verifyStatus} error={verifyError} />
        </div>
      </CardContent>
    </Card>
  );
}

function PatTokenInput({
  token,
  showToken,
  isSaving,
  onTokenChange,
  onToggleShow,
  onSave,
}: {
  token: string;
  showToken: boolean;
  isSaving: boolean;
  onTokenChange: (value: string) => void;
  onToggleShow: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="gh-token">Personal Access Token</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="gh-token"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="ghp_..."
            className="pr-10"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save Token
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Needs repo access. Stored securely and used for publishing only.
      </p>
    </div>
  );
}

function ConnectionStatus({
  status,
  error,
}: {
  status: VerifyStatus;
  error: string;
}) {
  if (status === "idle") return null;

  if (status === "verifying") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Verifying connection...
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-4" />
        Connected
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-destructive">
      <XCircle className="size-4" />
      {error || "Connection failed"}
    </div>
  );
}

// --- Content Structure ---

function ContentStructureSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: {
    contentPath?: string;
    mediaPath?: string;
    mediaStorageMode?: "github" | "external";
  };
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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContentPath(project.contentPath ?? "content/blog");
    setMediaPath(project.mediaPath ?? "public/images");
    setMediaStorageMode(project.mediaStorageMode ?? "github");
  }, [project.contentPath, project.mediaPath, project.mediaStorageMode]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        contentPath: contentPath.trim(),
        mediaPath: mediaPath.trim(),
        mediaStorageMode,
      });
      toast.success("Content structure saved");
    } catch {
      toast.error("Failed to save content structure");
    } finally {
      setIsSaving(false);
    }
  }, [contentPath, mediaPath, mediaStorageMode, projectId, updateProject]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Structure</CardTitle>
        <CardDescription>
          Configure where your content and media files live in the repository.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="content-path">Content Directory</Label>
          <Input
            id="content-path"
            value={contentPath}
            onChange={(e) => setContentPath(e.target.value)}
            placeholder="content/blog"
          />
          <p className="text-xs text-muted-foreground">
            The directory in your repository where markdown files will be
            published.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="media-path">Media Directory</Label>
          <Input
            id="media-path"
            value={mediaPath}
            onChange={(e) => setMediaPath(e.target.value)}
            placeholder="public/images"
          />
        </div>
        <div className="space-y-2">
          <Label>Media Storage Mode</Label>
          <Select
            value={mediaStorageMode}
            onValueChange={(val) =>
              setMediaStorageMode(val as "github" | "external")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="github">GitHub Repository</SelectItem>
              <SelectItem value="external">External URL</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {mediaStorageMode === "github"
              ? "Images will be uploaded directly to your GitHub repository."
              : "Images will reference external URLs. You manage hosting separately."}
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// --- Frontmatter Schema ---

function FrontmatterSchemaSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: { frontmatterSchema?: string };
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

  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

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
        prev.map((field, i) => (i === index ? { ...field, ...updates } : field)),
      );
    },
    [],
  );

  const moveField = useCallback(
    (index: number, direction: "up" | "down") => {
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
    },
    [],
  );

  const handleSave = useCallback(async () => {
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
  }, [fields, projectId, updateProject]);

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
    <Card>
      <CardHeader>
        <CardTitle>Frontmatter Schema</CardTitle>
        <CardDescription>
          Define the frontmatter fields for your documents. These fields will be
          included at the top of each published markdown file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
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
        <Button variant="outline" size="sm" onClick={addField}>
          <Plus className="size-4" />
          Add Field
        </Button>

        <Separator />

        <div className="space-y-2">
          <Label>Preview</Label>
          <pre className="rounded-lg bg-muted p-3 font-mono text-xs">
            {yamlPreview}
          </pre>
        </div>

        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save Schema
        </Button>
      </CardContent>
    </Card>
  );
}

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
  return (
    <div className="flex items-start gap-2 rounded-lg border p-3">
      <div className="flex flex-col gap-1 pt-1">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={index === 0}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={index === totalFields - 1}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Field name"
            value={field.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1"
          />
          <Select
            value={field.type}
            onValueChange={(val) =>
              onUpdate({ type: val as FrontmatterField["type"] })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="tags">Tags</SelectItem>
              <SelectItem value="select">Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
            className="flex-1"
          />
        </div>
        {field.type === "select" && (
          <div className="space-y-1">
            <Input
              placeholder="Options (comma-separated)"
              value={field.options}
              onChange={(e) => onUpdate({ options: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              e.g., &quot;tech, lifestyle, travel&quot;
            </p>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        className="mt-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function getPlaceholderForType(type: FrontmatterField["type"]): string {
  switch (type) {
    case "string":
      return '"example"';
    case "text":
      return '"A longer text..."';
    case "boolean":
      return "true";
    case "date":
      return new Date().toISOString().split("T")[0] ?? "";
    case "tags":
      return '["tag1", "tag2"]';
    case "select":
      return '"option1"';
    default:
      return '""';
  }
}

// --- Danger Zone ---

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
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible and destructive actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-3">
          <div>
            <p className="text-sm font-medium">Delete this project</p>
            <p className="text-xs text-muted-foreground">
              This will permanently delete this project and all its documents.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Project
          </Button>
        </div>
      </CardContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you absolutely sure? This will permanently delete this project
              and all of its documents. This action cannot be undone.
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
              {isDeleting && <Loader2 className="size-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="mb-6 h-7 w-24" />
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="mx-auto max-w-2xl space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
