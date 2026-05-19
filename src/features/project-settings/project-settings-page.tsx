"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import yaml from "js-yaml";
import {
  AlertTriangle,
  BookText,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  FileCode,
  FileText,
  FolderTree,
  GitBranch,
  Globe,
  GripVertical,
  ImageIcon,
  Loader2,
  Orbit,
  Plus,
  Rocket,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
  User,
  Webhook,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { CompressionSettingsForm } from "@/components/forms/compression-settings-form";
import { MediaPickerInput } from "@/components/forms/media-picker-input";
import { Button } from "@/components/ui/button";
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
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { useGithubBranches } from "@/hooks/use-github";
import type { ContentFormat } from "@/lib/content-format";
import { getFileExtension } from "@/lib/content-format";
import {
  type CompressionSettings,
  compressionSettingsEqual,
  DEFAULT_COMPRESSION_SETTINGS,
} from "@/lib/image-compression";
import {
  fadeSlideUp,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type { AiProvider } from "@/types/ai";
import {
  FIELD_TYPE_OPTIONS,
  type FrontmatterField,
  type FrontmatterFieldType,
} from "@/types/frontmatter";
import type { MediaStorageMode } from "@/types/media";

type ProjectData = {
  name: string;
  slug: string;
  githubRepo?: string;
  githubBranch?: string;
  contentPath?: string;
  mediaPath?: string;
  mediaStorageMode?: MediaStorageMode;
  frontmatterSchema?: string;
  commitMessageTemplate?: string;
  filenamePattern?: string;
  contentFormat?: "md" | "mdx";
  defaultDraft?: boolean;
  siteUrl?: string;
  deployHookUrl?: string;
  frontmatterFormat?: "yaml" | "toml";
  defaultAuthor?: string;
  defaultAuthorAvatar?: string;
  aiProvider?: AiProvider;
  aiModel?: string;
  timezone?: string;
  autoSaveEnabled?: boolean;
  compressionSettings?: CompressionSettings;
  trashRetentionDays?: number;
};

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
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

type SettingsTab =
  | "general"
  | "github"
  | "content"
  | "publishing"
  | "frontmatter"
  | "media"
  | "ai";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "content", label: "Content", icon: FolderTree },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "publishing", label: "Publishing", icon: Rocket },
  { id: "frontmatter", label: "Frontmatter", icon: Code2 },
  { id: "ai", label: "AI", icon: Sparkles },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();
  const project = useQuery(api.cms.projects.get, { projectId });
  const user = useQuery(api.account.users.get);
  const projectDeleted = project === null;
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

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
    <motion.div
      variants={fadeSlideUp}
      initial="initial"
      animate="animate"
      transition={smoothTransition}
      className="flex h-full"
    >
      {/* Sidebar tabs */}
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <h1 className="mb-1 px-3 text-lg font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mb-5 px-3 text-[11px] text-muted-foreground/60">
          Project configuration
        </p>

        <nav className="space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="projectSettingsTabIndicator"
                    className="absolute inset-0 rounded-lg bg-background shadow-sm -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto slim-scrollbar">
        <div className="mx-auto max-w-xl px-8 py-8">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "general" && (
              <motion.div
                key="general"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <GeneralSection projectId={projectId} project={project} />
                <Divider />
                <DangerZoneSection projectId={projectId} />
              </motion.div>
            )}
            {activeTab === "github" && (
              <motion.div
                key="github"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <GitHubSection
                  projectId={projectId}
                  project={project}
                  existingToken={user?.githubAccessToken ?? ""}
                />
              </motion.div>
            )}
            {activeTab === "content" && (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <ContentSection projectId={projectId} project={project} />
              </motion.div>
            )}
            {activeTab === "media" && (
              <motion.div
                key="media"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <MediaSection projectId={projectId} project={project} />
              </motion.div>
            )}
            {activeTab === "publishing" && (
              <motion.div
                key="publishing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <PublishingSection projectId={projectId} project={project} />
              </motion.div>
            )}
            {activeTab === "frontmatter" && (
              <motion.div
                key="frontmatter"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <FrontmatterSection projectId={projectId} project={project} />
              </motion.div>
            )}
            {activeTab === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <AiSection projectId={projectId} project={project} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable helpers                                                   */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-border/40" />;
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
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
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
  const updateProject = useMutation(api.cms.projects.update);
  const [name, setName] = useState(project.name);
  const [siteUrl, setSiteUrl] = useState(project.siteUrl ?? "");
  const [defaultAuthor, setDefaultAuthor] = useState(
    project.defaultAuthor ?? "",
  );
  const [defaultAuthorAvatar, setDefaultAuthorAvatar] = useState(
    project.defaultAuthorAvatar ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setName(project.name);
    setSiteUrl(project.siteUrl ?? "");
    setDefaultAuthor(project.defaultAuthor ?? "");
    setDefaultAuthorAvatar(project.defaultAuthorAvatar ?? "");
  }, [
    project.name,
    project.siteUrl,
    project.defaultAuthor,
    project.defaultAuthorAvatar,
  ]);

  const hasChanges =
    name.trim() !== project.name ||
    siteUrl.trim() !== (project.siteUrl ?? "") ||
    defaultAuthor.trim() !== (project.defaultAuthor ?? "") ||
    defaultAuthorAvatar.trim() !== (project.defaultAuthorAvatar ?? "");

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
      if (defaultAuthorAvatar.trim())
        args.defaultAuthorAvatar = defaultAuthorAvatar.trim();
      await updateProject(args);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    siteUrl,
    defaultAuthor,
    defaultAuthorAvatar,
    projectId,
    updateProject,
  ]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Settings2}
        title="General"
        description="Basic project information and identity"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup label="Project Name" htmlFor="s-name">
          <Input
            id="s-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Blog"
          />
        </FieldGroup>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <FieldGroup
          label="Default Author Avatar"
          htmlFor="s-author-avatar"
          hint="Pre-fills the authorAvatar frontmatter field for new posts. Pick from your media library or paste a URL."
        >
          <MediaPickerInput
            id="s-author-avatar"
            value={defaultAuthorAvatar}
            onChange={setDefaultAuthorAvatar}
            projectId={projectId}
            placeholder="/author.webp"
          />
        </FieldGroup>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted-foreground/50">
            The slug{" "}
            <span className="font-mono text-foreground/70">{project.slug}</span>{" "}
            cannot be changed after creation.
          </p>
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>
    </motion.div>
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
  const updateProject = useMutation(api.cms.projects.update);
  const updateGithubToken = useAction(api.account.users.updateGithubToken);
  const verifyRepoAccess = useAction(api.integrations.github.verifyRepoAccess);

  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [oauthToken, setOauthToken] = useState<string | null>(null);

  const [token, setToken] = useState(existingToken);
  const [showToken, setShowToken] = useState(false);
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

  const [repo, setRepo] = useState(project.githubRepo ?? "");
  const [branch, setBranch] = useState(project.githubBranch ?? "main");
  const [isSavingRepo, setIsSavingRepo] = useState(false);

  // Branch dropdown sourced from /api/github/branches. We only query when
  // the repo string looks valid ("owner/name"), so a half-typed repo doesn't
  // spam the API. The hook returns the repo's actual `defaultBranch` so we
  // can auto-pick it when the user picks a new repo and the previously-set
  // branch doesn't exist on the new one.
  const repoLooksValid = /^[^/]+\/[^/]+$/.test(repo.trim());
  const {
    data: branchesData,
    isLoading: isLoadingBranches,
    error: branchesError,
  } = useGithubBranches(repoLooksValid ? repo.trim() : null);
  const availableBranches = branchesData?.branches ?? [];
  const defaultBranch = branchesData?.defaultBranch;

  // If the configured branch isn't in the live list (e.g. it was renamed
  // on GitHub, or the user switched repos), fall back to the real default.
  useEffect(() => {
    if (!defaultBranch) return;
    if (availableBranches.length === 0) return;
    if (!availableBranches.includes(branch)) {
      setBranch(defaultBranch);
    }
  }, [defaultBranch, availableBranches, branch]);

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
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={GitBranch}
        title="GitHub"
        description="Connect your account and configure your repository"
      />

      {/* Connection status */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div
          className={cn(
            "rounded-xl border p-4 transition-colors",
            oauthConnected === true
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-border/40 bg-card",
          )}
        >
          {oauthConnected === null ? (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                Checking connection...
              </span>
            </div>
          ) : oauthConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Connected via OAuth
                </p>
                <p className="text-xs text-muted-foreground">
                  Publishing will use your OAuth token automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <XCircle className="size-4 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium">Not connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect via Clerk, or add a Personal Access Token below.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* PAT Fallback */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        {oauthConnected === true && (
          <button
            type="button"
            onClick={() => setShowPatFallback(!showPatFallback)}
            className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {showPatFallback ? "Hide" : "Show"} Personal Access Token (fallback)
          </button>
        )}
        {(oauthConnected === false || showPatFallback) && (
          <div className="mt-4 space-y-3 rounded-xl border border-border/40 bg-card p-4">
            <FieldGroup label="Personal Access Token" htmlFor="gh-token">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gh-token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-foreground"
                  >
                    {showToken ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                <SaveButton
                  isSaving={isSavingToken}
                  onClick={handleSaveToken}
                  label="Save"
                />
              </div>
            </FieldGroup>
            <p className="text-[11px] leading-relaxed text-muted-foreground/60">
              Requires{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                repo
              </code>{" "}
              scope. Stored securely and used as a fallback only.
            </p>
          </div>
        )}
      </motion.div>

      <Divider />

      {/* Repository */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 flex items-center gap-2">
          <FileCode className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Repository</span>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              hint={
                branchesError
                  ? "Couldn't load branches — check the repo above is correct."
                  : isLoadingBranches
                    ? "Loading branches from GitHub…"
                    : availableBranches.length > 0
                      ? `${availableBranches.length} branch${availableBranches.length === 1 ? "" : "es"} available${
                          defaultBranch ? ` · default: ${defaultBranch}` : ""
                        }`
                      : "The branch to commit content to."
              }
            >
              {availableBranches.length > 0 ? (
                <Select
                  value={branch}
                  onValueChange={(v) => {
                    if (v) setBranch(v);
                  }}
                >
                  <SelectTrigger
                    id="gh-branch"
                    className="w-full font-mono text-sm"
                  >
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    alignItemWithTrigger={false}
                    className="max-h-60 w-(--anchor-width) min-w-[280px]"
                  >
                    {availableBranches.map((b) => (
                      <SelectItem
                        key={b}
                        value={b}
                        className="font-mono text-sm"
                      >
                        <span className="truncate">{b}</span>
                        {b === defaultBranch ? (
                          <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-muted-foreground">
                            default
                          </span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                /* Fallback: free-text input when the API hasn't returned
                   branches yet, the repo is invalid, or the API errored.
                   Lets the user save a branch by typing even without a list. */
                <Input
                  id="gh-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="font-mono text-sm"
                />
              )}
            </FieldGroup>
          </div>

          <div className="flex items-center justify-between">
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
          </div>
        </div>
      </motion.div>
    </motion.div>
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
  const updateProject = useMutation(api.cms.projects.update);

  const [contentPath, setContentPath] = useState(
    project.contentPath ?? "content/blog",
  );
  const [contentFormat, setContentFormat] = useState<ContentFormat>(
    (project.contentFormat as ContentFormat) ?? "md",
  );

  const defaultPattern = `{{slug}}${getFileExtension(contentFormat)}`;
  const [filenamePattern, setFilenamePattern] = useState(
    project.filenamePattern ?? defaultPattern,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContentPath(project.contentPath ?? "content/blog");
    const fmt = (project.contentFormat as ContentFormat) ?? "md";
    setContentFormat(fmt);
    setFilenamePattern(
      project.filenamePattern ?? `{{slug}}${getFileExtension(fmt)}`,
    );
  }, [project.contentPath, project.filenamePattern, project.contentFormat]);

  const hasChanges =
    contentPath.trim() !== (project.contentPath ?? "content/blog") ||
    filenamePattern.trim() !==
      (project.filenamePattern ??
        `{{slug}}${getFileExtension(project.contentFormat)}`) ||
    contentFormat !== ((project.contentFormat as ContentFormat) ?? "md");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        contentPath: contentPath.trim(),
        filenamePattern: filenamePattern.trim(),
        contentFormat,
      });
      toast.success("Content structure saved");
    } catch {
      toast.error("Failed to save content structure");
    } finally {
      setIsSaving(false);
    }
  }, [contentPath, filenamePattern, contentFormat, projectId, updateProject]);

  const handleFormatChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const fmt = value as ContentFormat;
      setContentFormat(fmt);
      const ext = getFileExtension(fmt);
      const currentExt = getFileExtension(fmt === "md" ? "mdx" : "md");
      if (filenamePattern.endsWith(currentExt)) {
        setFilenamePattern(filenamePattern.slice(0, -currentExt.length) + ext);
      }
    },
    [filenamePattern],
  );

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={FolderTree}
        title="Content Structure"
        description="Where your content files live and how they're named"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Content Directory"
          htmlFor="s-content-path"
          hint="Where content files are published."
        >
          <Input
            id="s-content-path"
            value={contentPath}
            onChange={(e) => setContentPath(e.target.value)}
            placeholder="content/blog"
            className="font-mono text-sm"
          />
        </FieldGroup>

        <FieldGroup
          label="Content Format"
          htmlFor="s-content-format"
          hint="Changing format only affects future publishes."
        >
          <Select value={contentFormat} onValueChange={handleFormatChange}>
            <SelectTrigger id="s-content-format" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="md">Markdown (.md)</SelectItem>
              <SelectItem value="mdx">MDX (.mdx)</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup
          label="Filename Pattern"
          htmlFor="s-filename"
          hint="Variables: {{slug}}, {{date}}, {{year}}, {{month}}, {{day}}"
        >
          <Input
            id="s-filename"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
            placeholder={defaultPattern}
            className="max-w-sm font-mono text-sm"
          />
        </FieldGroup>

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media Tab                                                          */
/* ------------------------------------------------------------------ */

/**
 * Dedicated section for media storage configuration. Holds the
 * per-project media path, the provider picker, and the credential
 * subform (UploadThing / Cloudinary). Top-level Save persists
 * `mediaPath` + `mediaStorageMode`; the credential subform manages
 * its own vault-backed save/test/rotate/delete.
 */
function MediaSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);

  const [mediaPath, setMediaPath] = useState(
    project.mediaPath ?? "public/images",
  );
  const [mediaStorageMode, setMediaStorageMode] = useState<MediaStorageMode>(
    project.mediaStorageMode ?? "github",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMediaPath(project.mediaPath ?? "public/images");
    setMediaStorageMode(project.mediaStorageMode ?? "github");
  }, [project.mediaPath, project.mediaStorageMode]);

  const hasChanges =
    mediaPath.trim() !== (project.mediaPath ?? "public/images") ||
    mediaStorageMode !== (project.mediaStorageMode ?? "github");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        mediaPath: mediaPath.trim(),
        mediaStorageMode,
      });
      toast.success("Media settings saved");
    } catch {
      toast.error("Failed to save media settings");
    } finally {
      setIsSaving(false);
    }
  }, [mediaPath, mediaStorageMode, projectId, updateProject]);

  // Hint text for the path field shifts with provider — same field, broader meaning.
  const pathHint =
    mediaStorageMode === "github"
      ? "Repo directory for images, e.g. public/images (Astro/Next.js) or static/images (Hugo/SvelteKit)."
      : mediaStorageMode === "cloudinary"
        ? "Folder prefix every upload lands under in your Cloudinary account."
        : "Informational for UploadThing — files live in a flat namespace.";

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={ImageIcon}
        title="Media Storage"
        description="Where images uploaded in the editor are stored"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Media Directory"
          htmlFor="s-media-path"
          hint={pathHint}
        >
          <Input
            id="s-media-path"
            value={mediaPath}
            onChange={(e) => setMediaPath(e.target.value)}
            placeholder="public/images"
            className="font-mono text-sm"
          />
        </FieldGroup>

        <FieldGroup
          label="Storage Backend"
          hint="Each project can use a different backend. Switching does not move existing media."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MediaModeOption
              active={
                mediaStorageMode === "github" || mediaStorageMode === "external"
              }
              onClick={() => setMediaStorageMode("github")}
              title="GitHub Repository"
              description="Commit images directly into the project's repo."
            />
            <MediaModeOption
              active={mediaStorageMode === "uploadthing"}
              onClick={() => setMediaStorageMode("uploadthing")}
              title="UploadThing"
              description="Use your own UploadThing account."
            />
            <MediaModeOption
              active={mediaStorageMode === "cloudinary"}
              onClick={() => setMediaStorageMode("cloudinary")}
              title="Cloudinary"
              description="Use your own Cloudinary account."
            />
          </div>
        </FieldGroup>

        {(mediaStorageMode === "uploadthing" ||
          mediaStorageMode === "cloudinary") && (
          <MediaCredentialsForm
            projectId={projectId}
            provider={mediaStorageMode}
          />
        )}

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>

      <Divider />

      <ProjectCompressionSection projectId={projectId} project={project} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project Compression Settings                                       */
/* ------------------------------------------------------------------ */

/**
 * Per-project override for the user-level default compression preferences.
 * Stored on `projects.compressionSettings`. Pass `null` to the update
 * mutation to clear the override and inherit the account default again.
 */
function ProjectCompressionSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const user = useQuery(api.account.users.get);

  const accountDefault: CompressionSettings = useMemo(
    () => ({
      ...DEFAULT_COMPRESSION_SETTINGS,
      ...(user?.defaultCompressionSettings ?? {}),
    }),
    [user?.defaultCompressionSettings],
  );

  // `true` when the project record actually has an override saved.
  const hasOverride = project.compressionSettings !== undefined;

  const [overrideEnabled, setOverrideEnabled] = useState(hasOverride);
  const [draft, setDraft] = useState<CompressionSettings>(
    project.compressionSettings ?? accountDefault,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Re-sync when the underlying records change (e.g. another tab saves).
  useEffect(() => {
    setOverrideEnabled(hasOverride);
    setDraft(project.compressionSettings ?? accountDefault);
  }, [hasOverride, project.compressionSettings, accountDefault]);

  const isDirty = overrideEnabled
    ? !project.compressionSettings ||
      !compressionSettingsEqual(draft, project.compressionSettings)
    : hasOverride;

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        compressionSettings: overrideEnabled ? draft : null,
      });
      toast.success(
        overrideEnabled
          ? "Compression override saved"
          : "Reverted to account default",
      );
    } catch {
      toast.error("Failed to save compression settings");
    } finally {
      setIsSaving(false);
    }
  }, [draft, overrideEnabled, projectId, updateProject]);

  const handleResetDraft = useCallback(() => {
    setDraft(accountDefault);
  }, [accountDefault]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Sparkles}
        title="Image Compression"
        description="Reduce upload size and convert formats before files leave the browser"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">Override account default</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {overrideEnabled
                ? "This project uses the settings below."
                : "This project inherits your account-wide default."}
            </p>
          </div>
          <Switch
            checked={overrideEnabled}
            onCheckedChange={setOverrideEnabled}
          />
        </div>

        {overrideEnabled && (
          <CompressionSettingsForm
            value={draft}
            onChange={setDraft}
            inheritanceBanner={
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                <span>
                  Starting from your account default. Reset to drop this
                  override and follow account changes again.
                </span>
                <button
                  type="button"
                  onClick={handleResetDraft}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground transition-colors hover:bg-muted"
                >
                  <RotateCcw className="size-3" />
                  Reset
                </button>
              </div>
            }
          />
        )}

        <div className="mt-2 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!isDirty}
            onClick={handleSave}
            label={overrideEnabled ? "Save compression" : "Use account default"}
          />
        </div>
      </motion.div>
    </motion.div>
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
/*  Media Credentials Form                                              */
/* ------------------------------------------------------------------ */

/**
 * Per-provider credential input + status. Stores secrets in the WorkOS Vault
 * via `api.media.credentials.setCredentials`; the secret itself never round-trips
 * back to the client. Once configured, the row's `status` (active/verifying/
 * invalid/rotating) is reactive — the UI re-renders as the server pings.
 */
function MediaCredentialsForm({
  projectId,
  provider,
}: {
  projectId: Id<"projects">;
  provider: "uploadthing" | "cloudinary";
}) {
  const config = useQuery(api.media.credentialsDb.getPublicConfig, {
    projectId,
    provider,
  });

  const setCredentials = useAction(api.media.credentials.setCredentials);
  const testCredentials = useAction(api.media.credentials.testCredentials);
  const rotate = useAction(api.media.credentials.rotate);
  const deleteCredentials = useAction(api.media.credentials.deleteCredentials);

  const [token, setToken] = useState("");
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [folder, setFolder] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const hasExisting = config !== null && config !== undefined;
  const isRotating = config?.status === "rotating";

  // Cloudinary stores cloud_name+folder in publicConfig so we can show
  // them after the secret has been wiped from the form.
  const publicCloudName = useMemo(() => {
    if (provider !== "cloudinary" || !config?.publicConfig) return null;
    try {
      const parsed = JSON.parse(config.publicConfig) as {
        cloudName?: string;
        folder?: string;
      };
      return parsed.cloudName ?? null;
    } catch {
      return null;
    }
  }, [config?.publicConfig, provider]);

  const publicFolder = useMemo(() => {
    if (provider !== "cloudinary" || !config?.publicConfig) return null;
    try {
      const parsed = JSON.parse(config.publicConfig) as { folder?: string };
      return parsed.folder ?? null;
    } catch {
      return null;
    }
  }, [config?.publicConfig, provider]);

  // Reset the form whenever the provider changes (so switching tabs doesn't
  // leak typed values across providers).
  useEffect(() => {
    setToken("");
    setCloudName("");
    setApiKey("");
    setApiSecret("");
    setFolder("");
  }, []);

  const buildSecret = useCallback((): string | null => {
    if (provider === "uploadthing") {
      const trimmed = token.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (
      cloudName.trim() === "" ||
      apiKey.trim() === "" ||
      apiSecret.trim() === ""
    ) {
      return null;
    }
    return JSON.stringify({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
    });
  }, [apiKey, apiSecret, cloudName, provider, token]);

  const buildPublicConfig = useCallback((): string | undefined => {
    if (provider !== "cloudinary") return undefined;
    const out: Record<string, string> = {};
    if (cloudName.trim() !== "") out["cloudName"] = cloudName.trim();
    if (folder.trim() !== "") out["folder"] = folder.trim();
    return Object.keys(out).length === 0 ? undefined : JSON.stringify(out);
  }, [cloudName, folder, provider]);

  const handleSave = useCallback(async () => {
    const secret = buildSecret();
    if (!secret) {
      toast.error(
        provider === "uploadthing"
          ? "Paste your UPLOADTHING_TOKEN before saving."
          : "Cloud name, API key, and API secret are all required.",
      );
      return;
    }

    setBusy("save");
    try {
      const publicConfig = buildPublicConfig();
      const args: {
        projectId: Id<"projects">;
        provider: "uploadthing" | "cloudinary";
        secret: string;
        publicConfig?: string;
      } = { projectId, provider, secret };
      if (publicConfig !== undefined) args.publicConfig = publicConfig;

      if (hasExisting) {
        await rotate(args);
        toast.success("Rotation in progress — verifying new key…");
      } else {
        const result = await setCredentials(args);
        if (result.ok) {
          toast.success(
            `${provider === "uploadthing" ? "UploadThing" : "Cloudinary"} connected.`,
          );
        } else {
          toast.error(result.message ?? "Credentials failed verification.");
        }
      }
      // Clear typed values — UI now reads from the persisted row.
      setToken("");
      setApiSecret("");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save credentials."),
      );
    } finally {
      setBusy(null);
    }
  }, [
    buildPublicConfig,
    buildSecret,
    hasExisting,
    projectId,
    provider,
    rotate,
    setCredentials,
  ]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId, provider });
      if (result.ok) {
        toast.success("Connection looks good.");
      } else {
        toast.error(result.message ?? "Connection failed.");
      }
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Test failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, provider, testCredentials]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Remove these credentials? Existing media URLs keep working, but new uploads will fail until you reconfigure.",
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await deleteCredentials({ projectId, provider });
      toast.success("Credentials removed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId, provider]);

  return (
    <div className="mt-4 space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            {provider === "uploadthing"
              ? "UploadThing credentials"
              : "Cloudinary credentials"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored encrypted in WorkOS Vault. We never log or display the
            secret.
          </p>
        </div>
        {hasExisting && <StatusBadge status={config.status} />}
      </div>

      {hasExisting && config.lastVerifyError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <span className="font-medium">Last error:</span>{" "}
          {config.lastVerifyError}
        </div>
      )}

      {provider === "uploadthing" && (
        <FieldGroup
          label={hasExisting ? "Replace token" : "UPLOADTHING_TOKEN"}
          htmlFor="ut-token"
          hint="The single base64-encoded token from your UploadThing dashboard."
        >
          <div className="relative">
            <Input
              id="ut-token"
              type={showSecret ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                hasExisting ? "Paste a new token to rotate…" : "ut_…"
              }
              autoComplete="off"
              spellCheck={false}
              className="pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? "Hide" : "Show"}
            >
              {showSecret ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </FieldGroup>
      )}

      {provider === "cloudinary" && (
        <div className="space-y-3">
          {hasExisting && publicCloudName && (
            <div className="text-xs text-muted-foreground">
              Connected to{" "}
              <span className="font-mono text-foreground">
                {publicCloudName}
              </span>
              {publicFolder ? (
                <>
                  {" · folder "}
                  <span className="font-mono text-foreground">
                    {publicFolder}
                  </span>
                </>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup
              label="Cloud name"
              htmlFor="cld-name"
              hint="Visible in your Cloudinary URLs."
            >
              <Input
                id="cld-name"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="my-cloud"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup
              label="Folder (optional)"
              htmlFor="cld-folder"
              hint="Prefix every upload, e.g. blog/wryte."
            >
              <Input
                id="cld-folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="wryte/blog"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup label="API key" htmlFor="cld-key">
              <Input
                id="cld-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="123456789012345"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-xs"
              />
            </FieldGroup>
            <FieldGroup
              label={hasExisting ? "Replace API secret" : "API secret"}
              htmlFor="cld-secret"
            >
              <div className="relative">
                <Input
                  id="cld-secret"
                  type={showSecret ? "text" : "password"}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder={
                    hasExisting ? "Type to rotate…" : "your_api_secret"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-9 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSecret ? "Hide" : "Show"}
                >
                  {showSecret ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </FieldGroup>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy !== null || isRotating}
        >
          {busy === "save" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : hasExisting ? (
            "Replace key"
          ) : (
            "Save"
          )}
        </Button>
        {hasExisting && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || isRotating}
          >
            {busy === "test" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Testing…
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        )}
        {hasExisting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy !== null || isRotating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === "delete" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Remove
          </Button>
        )}
        {hasExisting && config.lastVerifiedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last verified{" "}
            {new Date(config.lastVerifiedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "verifying" | "invalid" | "rotating";
}) {
  const styles: Record<typeof status, string> = {
    active:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    verifying:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/30",
    rotating:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };
  const label: Record<typeof status, string> = {
    active: "Active",
    verifying: "Verifying",
    invalid: "Invalid",
    rotating: "Rotating",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
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
  const updateProject = useMutation(api.cms.projects.update);

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
  const [timezone, setTimezone] = useState(project.timezone ?? "");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(
    project.autoSaveEnabled ?? true,
  );
  const [trashRetentionDays, setTrashRetentionDays] = useState<number>(
    project.trashRetentionDays ?? 30,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCommitTemplate(
      project.commitMessageTemplate ?? "docs: publish {{filename}}",
    );
    setDefaultDraft(project.defaultDraft ?? true);
    setDeployHookUrl(project.deployHookUrl ?? "");
    setFrontmatterFormat(project.frontmatterFormat ?? "yaml");
    setTimezone(project.timezone ?? "");
    setAutoSaveEnabled(project.autoSaveEnabled ?? true);
    setTrashRetentionDays(project.trashRetentionDays ?? 30);
  }, [
    project.commitMessageTemplate,
    project.defaultDraft,
    project.deployHookUrl,
    project.frontmatterFormat,
    project.timezone,
    project.autoSaveEnabled,
    project.trashRetentionDays,
  ]);

  const hasChanges =
    commitTemplate.trim() !==
      (project.commitMessageTemplate ?? "docs: publish {{filename}}") ||
    defaultDraft !== (project.defaultDraft ?? true) ||
    deployHookUrl.trim() !== (project.deployHookUrl ?? "") ||
    frontmatterFormat !== (project.frontmatterFormat ?? "yaml") ||
    timezone !== (project.timezone ?? "") ||
    autoSaveEnabled !== (project.autoSaveEnabled ?? true) ||
    trashRetentionDays !== (project.trashRetentionDays ?? 30);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const args: Parameters<typeof updateProject>[0] = {
        projectId,
        commitMessageTemplate: commitTemplate.trim(),
        defaultDraft,
        frontmatterFormat,
        timezone,
        autoSaveEnabled,
        trashRetentionDays,
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
    timezone,
    autoSaveEnabled,
    trashRetentionDays,
    projectId,
    updateProject,
  ]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={Rocket}
        title="Publishing"
        description="Control how content is committed and deployed"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
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
            className="font-mono text-sm"
          />
        </FieldGroup>

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Default to draft</p>
            <p className="text-xs text-muted-foreground">
              New documents will have{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
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

        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Auto-save</p>
            <p className="text-xs text-muted-foreground">
              When on, edits persist a few seconds after you stop typing. When
              off, use{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                ⌘S
              </code>{" "}
              /{" "}
              <code className="rounded bg-muted px-1 py-px text-[10px]">
                Ctrl+S
              </code>{" "}
              to save manually.
            </p>
          </div>
          <Switch
            checked={autoSaveEnabled}
            onCheckedChange={(checked) => setAutoSaveEnabled(checked)}
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

        <FieldGroup
          label="Publishing Timezone"
          htmlFor="s-timezone"
          hint="Drives how scheduled publish times are interpreted and how the publish-date frontmatter field is rendered. Leave on browser default to use whatever timezone you happen to be in."
        >
          <TimezoneSelect
            id="s-timezone"
            value={timezone}
            onChange={setTimezone}
          />
        </FieldGroup>

        <FieldGroup
          label="Trash retention"
          hint="How long deleted documents stay in this project's trash before being permanently removed. Restorable any time before then."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MediaModeOption
              active={trashRetentionDays === 7}
              onClick={() => setTrashRetentionDays(7)}
              title="7 days"
              description="Quick cleanup"
            />
            <MediaModeOption
              active={trashRetentionDays === 30}
              onClick={() => setTrashRetentionDays(30)}
              title="30 days"
              description="Recommended"
            />
            <MediaModeOption
              active={trashRetentionDays === 90}
              onClick={() => setTrashRetentionDays(90)}
              title="90 days"
              description="Long memory"
            />
            <MediaModeOption
              active={trashRetentionDays >= 36500}
              onClick={() => setTrashRetentionDays(36500)}
              title="Forever"
              description="Manual only"
            />
          </div>
        </FieldGroup>
      </motion.div>

      <Divider />

      {/* Deploy Hook */}
      <motion.div variants={staggerItem} transition={smoothTransition}>
        <div className="mb-3 flex items-center gap-2">
          <Webhook className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Deploy Hook</span>
        </div>

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

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges}
            onClick={handleSave}
          />
        </div>
      </motion.div>
    </motion.div>
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
  const updateProject = useMutation(api.cms.projects.update);

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
  const [editorMode, setEditorMode] = useState<"visual" | "code" | "yaml">(
    "visual",
  );
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [yamlValue, setYamlValue] = useState("");
  const [yamlError, setYamlError] = useState<string | null>(null);

  useEffect(() => {
    setFields(initialFields);
  }, [initialFields]);

  // Sync code editor when switching to code mode
  useEffect(() => {
    if (editorMode === "code") {
      setCodeValue(JSON.stringify(fields, null, 2));
      setCodeError(null);
    }
  }, [editorMode, fields]); // intentionally only on mode switch

  // Sync YAML editor when switching to yaml mode. The YAML view is a
  // condensed `name: type` representation that mirrors how a field would
  // look in actual markdown frontmatter — lossy (drops required/default/
  // options/etc.) but the round trip preserves those props for any field
  // whose name still exists after the YAML edit.
  useEffect(() => {
    if (editorMode === "yaml") {
      const lines = fields
        .filter((f) => f.name.trim())
        .map((f) => `${f.name}: ${f.type}`)
        .join("\n");
      setYamlValue(`---\n${lines}\n---`);
      setYamlError(null);
    }
  }, [editorMode, fields]);

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
      setCodeError(err instanceof SyntaxError ? err.message : "Invalid JSON");
    }
  }, []);

  // Parse YAML editor changes. Each YAML entry is `name: type`; we merge
  // the result with the existing fields so a user who only retypes the
  // YAML view doesn't lose props (required/defaultValue/options/etc.)
  // they configured in Visual mode for fields whose names are unchanged.
  const handleYamlChange = useCallback(
    (value: string) => {
      setYamlValue(value);
      const body = value
        .split("\n")
        .filter((line) => line.trim() !== "---")
        .join("\n");
      let parsed: unknown;
      try {
        parsed = yaml.load(body);
      } catch (err) {
        setYamlError(
          err instanceof yaml.YAMLException ? err.message : "Invalid YAML",
        );
        return;
      }
      if (
        parsed == null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        setYamlError("Schema must be a mapping of `name: type` pairs");
        return;
      }
      const entries = Object.entries(parsed as Record<string, unknown>);
      const invalidType = entries.find(
        ([, v]) =>
          typeof v !== "string" ||
          !FIELD_TYPE_OPTIONS.some((opt) => opt.value === v),
      );
      if (invalidType) {
        setYamlError(
          `Unknown type for "${invalidType[0]}". Valid types: ${FIELD_TYPE_OPTIONS.map((o) => o.value).join(", ")}`,
        );
        return;
      }
      const existingByName = new Map(fields.map((f) => [f.name, f]));
      const nextFields: FrontmatterField[] = entries.map(([name, type]) => {
        const existing = existingByName.get(name);
        const fieldType = type as FrontmatterFieldType;
        if (existing) return { ...existing, type: fieldType };
        return {
          name,
          type: fieldType,
          required: false,
          defaultValue: "",
          options: "",
        };
      });
      setYamlError(null);
      setFields(nextFields);
    },
    [fields],
  );

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

  const clearAllDefaults = useCallback(() => {
    setFields((prev) => prev.map((field) => ({ ...field, defaultValue: "" })));
    toast.info("Cleared all default values — click Save Schema to apply");
  }, []);

  const hasAnyDefaults = useMemo(
    () => fields.some((f) => f.defaultValue !== ""),
    [fields],
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
    if (editorMode === "yaml" && yamlError) {
      toast.error("Fix YAML errors before saving");
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
  }, [fields, projectId, updateProject, editorMode, codeError, yamlError]);

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
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={BookText}
        title="Frontmatter Schema"
        description="Define the metadata fields for your markdown files"
      />

      {/* Visual / Code toggle */}
      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="mb-5"
      >
        <div className="flex items-center gap-2">
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
              onClick={() => setEditorMode("yaml")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                editorMode === "yaml"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileText className="mr-1.5 inline-block size-3" />
              YAML
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
              JSON
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground/60">
            {editorMode === "code"
              ? "Edit schema as JSON — supports all field properties"
              : editorMode === "yaml"
                ? "Edit schema as YAML — `name: type` pairs, like real frontmatter"
                : `${fields.length} field${fields.length !== 1 ? "s" : ""} defined`}
          </span>
          {hasAnyDefaults && editorMode === "visual" ? (
            <button
              type="button"
              onClick={clearAllDefaults}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
              title="Wipe every field's default value — useful for cleaning up values that auto-detect copied from an existing post"
            >
              <RotateCcw className="size-3" />
              Clear default values
            </button>
          ) : null}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} transition={smoothTransition}>
        {editorMode === "visual" ? (
          // --- Visual editor ---
          fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-8">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={addField}
                className="w-full border border-dashed border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add Field
              </Button>
            </div>
          )
        ) : editorMode === "yaml" ? (
          // --- YAML editor ---
          <div className="space-y-2">
            <textarea
              value={yamlValue}
              onChange={(e) => handleYamlChange(e.target.value)}
              spellCheck={false}
              className={cn(
                "w-full rounded-xl border bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-amber-200 outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                "placeholder:text-amber-900",
                "min-h-[300px] resize-y",
                yamlError &&
                  "border-destructive focus-visible:ring-destructive/30",
              )}
              placeholder={`---\ntitle: string\ndescription: text\ndate: date\ntags: tags\ndraft: boolean\n---`}
            />
            {yamlError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{yamlError}</span>
              </div>
            )}
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              <p className="font-medium">YAML schema format:</p>
              <p className="mt-1">
                One <code className="rounded bg-muted/60 px-1">name: type</code>{" "}
                pair per line, optionally wrapped in{" "}
                <code className="rounded bg-muted/60 px-1">---</code> fences so
                it looks just like real markdown frontmatter. Field order is
                preserved.
              </p>
              <p className="mt-2 font-medium">Valid types:</p>
              <p className="mt-1 font-mono">
                string · text · url · image · slug · number · date · datetime ·
                boolean · tags · list · select · multiselect · color · json
              </p>
              <p className="mt-2 text-muted-foreground/70">
                YAML mode only edits name + type. Required, default values,
                options, and other per-field settings stay where you left them
                in Visual mode; switch back there to edit those.
              </p>
            </div>
          </div>
        ) : (
          // --- Code editor (JSON) ---
          <div className="space-y-2">
            <textarea
              value={codeValue}
              onChange={(e) => handleCodeChange(e.target.value)}
              spellCheck={false}
              className={cn(
                "w-full rounded-xl border bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-green-300 outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                "placeholder:text-green-800",
                "min-h-[300px] resize-y",
                codeError &&
                  "border-destructive focus-visible:ring-destructive/30",
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

        <div className="mt-4 flex justify-end">
          <SaveButton
            isSaving={isSaving}
            onClick={handleSave}
            label="Save Schema"
          />
        </div>
      </motion.div>

      {/* YAML Preview */}
      {fields.length > 0 && (
        <>
          <Divider />
          <motion.div variants={staggerItem} transition={smoothTransition}>
            <div className="mb-3 flex items-center gap-2">
              <Code2 className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Preview</span>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border/40 bg-muted/30 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {yamlPreview}
            </pre>
          </motion.div>
        </>
      )}
    </motion.div>
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
    field.label ||
    field.description ||
    field.placeholder ||
    field.group ||
    field.min !== undefined ||
    field.max !== undefined ||
    field.step !== undefined ||
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
                        min: e.target.value
                          ? Number(e.target.value)
                          : undefined,
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
                        max: e.target.value
                          ? Number(e.target.value)
                          : undefined,
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
                        step: e.target.value
                          ? Number(e.target.value)
                          : undefined,
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
                        max: e.target.value
                          ? Number(e.target.value)
                          : undefined,
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
/*  AI Tab                                                             */
/* ------------------------------------------------------------------ */

function AnthropicMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 257"
      preserveAspectRatio="xMidYMid meet"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <title>Anthropic</title>
      <path
        fill="#D97757"
        d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z"
      />
    </svg>
  );
}

function OpenAIMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 260"
      preserveAspectRatio="xMidYMid meet"
      className={cn("shrink-0 fill-foreground", className)}
      aria-hidden
    >
      <title>OpenAI</title>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
  );
}

function OpenRouterMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40",
        className,
      )}
      aria-hidden
    >
      <Orbit className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
    </div>
  );
}

type AiProviderId = NonNullable<Doc<"projects">["aiProvider"]>;
type AiSettingsPatch = Pick<Doc<"projects">, "aiProvider" | "aiModel">;

const AI_PROVIDERS: {
  id: AiProviderId;
  title: string;
  Mark: ComponentType<{ className?: string }>;
}[] = [
  { id: "anthropic", title: "Anthropic", Mark: AnthropicMark },
  { id: "openai", title: "OpenAI", Mark: OpenAIMark },
  { id: "openrouter", title: "OpenRouter", Mark: OpenRouterMark },
];

const AI_MODEL_OPTIONS: Record<
  string,
  { value: string; label: string; description: string }[]
> = {
  anthropic: [
    {
      value: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      description: "Best balance of intelligence and speed",
    },
    {
      value: "claude-haiku-4-20250414",
      label: "Claude Haiku 4",
      description: "Fastest, most cost-effective",
    },
  ],
  openai: [
    {
      value: "gpt-4.1",
      label: "GPT-4.1",
      description: "Most capable GPT model",
    },
    {
      value: "gpt-4.1-mini",
      label: "GPT-4.1 Mini",
      description: "Fast and affordable",
    },
    {
      value: "gpt-4.1-nano",
      label: "GPT-4.1 Nano",
      description: "Fastest, lowest cost",
    },
  ],
  openrouter: [
    {
      value: "google/gemma-4-26b-a4b-it:free",
      label: "Gemma 4 26B",
      description: "Google's efficient open model (free)",
    },
    {
      value: "google/gemma-4-31b-it:free",
      label: "Gemma 4 31B",
      description: "Google's larger open model (free)",
    },
    {
      value: "minimax/minimax-m2.5:free",
      label: "MiniMax M2.5",
      description: "MiniMax multimodal model (free)",
    },
    {
      value: "openai/gpt-oss-120b:free",
      label: "GPT-OSS 120B",
      description: "OpenAI open-source 120B (free)",
    },
  ],
};

function AiSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const updateProject = useMutation(api.cms.projects.update);
  const [provider, setProvider] = useState(project.aiProvider ?? "");
  const [model, setModel] = useState(project.aiModel ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setProvider(project.aiProvider ?? "");
    setModel(project.aiModel ?? "");
  }, [project.aiProvider, project.aiModel]);

  const models = provider ? (AI_MODEL_OPTIONS[provider] ?? []) : [];

  const handleProviderChange = useCallback((id: AiProviderId) => {
    setProvider(id);
    const providerModels = AI_MODEL_OPTIONS[id] ?? [];
    setModel(providerModels[0]?.value ?? "");
  }, []);

  const hasChanges =
    provider !== (project.aiProvider ?? "") ||
    model !== (project.aiModel ?? "");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const patch: AiSettingsPatch = {
        aiProvider: provider as AiProviderId,
        aiModel: model,
      };
      await updateProject({ projectId, ...patch });
      toast.success("AI settings saved");
    } catch {
      toast.error("Failed to save AI settings");
    } finally {
      setIsSaving(false);
    }
  }, [updateProject, projectId, provider, model]);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Sparkles}
          title="AI Enhancement"
          description="Configure the AI provider and model for content enhancement."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-5">
        <FieldGroup
          label="Provider"
          hint="Service used when you run enhancements in the editor."
        >
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="AI provider"
          >
            {AI_PROVIDERS.map((p) => {
              const selected = provider === p.id;
              const Mark = p.Mark;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleProviderChange(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Mark
                    className={cn(
                      p.id === "anthropic" && "size-6",
                      p.id === "openai" && "size-6",
                    )}
                  />
                  {p.title}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup
          label="Model"
          hint={
            provider
              ? "Model used for rewrites and enhancements."
              : "Select a provider first to see available models."
          }
        >
          {provider ? (
            <div
              className="space-y-1.5"
              role="radiogroup"
              aria-label="AI model"
            >
              {models.map((m) => {
                const selected = model === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setModel(m.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border/40 bg-transparent hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        selected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {selected && (
                        <div className="size-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          selected
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {m.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {m.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground/50">
                Select a provider above to see available models
              </p>
            </div>
          )}
        </FieldGroup>

        <Divider />

        {provider ? (
          <AiCredentialsForm
            projectId={projectId}
            provider={provider as AiProviderId}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground/50">
              Select a provider above to add your API key
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <SaveButton
            isSaving={isSaving}
            disabled={!hasChanges || !provider || !model}
            onClick={() => void handleSave()}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Credentials Form                                                 */
/* ------------------------------------------------------------------ */

/**
 * Per-provider API key input + status. Stores the secret in the WorkOS
 * Vault via `api.ai.credentials.setCredentials`; the secret itself never
 * round-trips back to the client. Mirrors `MediaCredentialsForm`.
 */
function AiCredentialsForm({
  projectId,
  provider,
}: {
  projectId: Id<"projects">;
  provider: AiProviderId;
}) {
  const config = useQuery(api.ai.credentialsDb.getPublicConfig, {
    projectId,
    provider,
  });

  const setCredentials = useAction(api.ai.credentials.setCredentials);
  const testCredentials = useAction(api.ai.credentials.testCredentials);
  const rotate = useAction(api.ai.credentials.rotate);
  const deleteCredentials = useAction(api.ai.credentials.deleteCredentials);

  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const hasExisting = config !== null && config !== undefined;
  const isRotating = config?.status === "rotating";

  // Clear typed value when provider switches.
  useEffect(() => {
    setSecret("");
  }, []);

  const placeholder =
    provider === "anthropic"
      ? "sk-ant-…"
      : provider === "openai"
        ? "sk-…"
        : "sk-or-…";

  const dashboardLink =
    provider === "anthropic"
      ? "https://console.anthropic.com/settings/keys"
      : provider === "openai"
        ? "https://platform.openai.com/api-keys"
        : "https://openrouter.ai/keys";

  const handleSave = useCallback(async () => {
    const trimmed = secret.trim();
    if (!trimmed) {
      toast.error("Paste your API key before saving.");
      return;
    }
    setBusy("save");
    try {
      const result = hasExisting
        ? await rotate({ projectId, provider, secret: trimmed })
        : await setCredentials({ projectId, provider, secret: trimmed });
      if (result.ok) {
        toast.success(
          hasExisting ? "API key rotated." : `${provider} key saved.`,
        );
        setSecret("");
      } else {
        toast.error(result.message ?? "Key failed verification.");
      }
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to save API key."),
      );
    } finally {
      setBusy(null);
    }
  }, [hasExisting, projectId, provider, rotate, secret, setCredentials]);

  const handleTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await testCredentials({ projectId, provider });
      if (result.ok) toast.success("Connection looks good.");
      else toast.error(result.message ?? "Connection failed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ?? (err instanceof Error ? err.message : "Test failed."),
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, provider, testCredentials]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Remove this API key? AI enhancements will stop working until you reconfigure.",
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await deleteCredentials({ projectId, provider });
      toast.success("API key removed.");
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data;
      toast.error(
        data?.message ??
          (err instanceof Error ? err.message : "Failed to remove."),
      );
    } finally {
      setBusy(null);
    }
  }, [deleteCredentials, projectId, provider]);

  const providerLabel =
    provider === "anthropic"
      ? "Anthropic"
      : provider === "openai"
        ? "OpenAI"
        : "OpenRouter";

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{providerLabel} API key</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stored encrypted in the secret vault. Verification doesn't consume
            any tokens.{" "}
            <a
              href={dashboardLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-2 hover:underline"
            >
              Get your key →
            </a>
          </p>
        </div>
        {hasExisting && <AiStatusBadge status={config.status} />}
      </div>

      {hasExisting && config.lastVerifyError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <span className="font-medium">Last error:</span>{" "}
          {config.lastVerifyError}
        </div>
      )}

      <FieldGroup
        label={hasExisting ? "Replace API key" : "API key"}
        htmlFor="ai-secret"
      >
        <div className="relative">
          <Input
            id="ai-secret"
            type={showSecret ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              hasExisting ? "Paste a new key to rotate…" : placeholder
            }
            autoComplete="off"
            spellCheck={false}
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showSecret ? "Hide" : "Show"}
          >
            {showSecret ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={busy !== null || isRotating}
        >
          {busy === "save" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : hasExisting ? (
            "Replace key"
          ) : (
            "Save"
          )}
        </Button>
        {hasExisting && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={busy !== null || isRotating}
          >
            {busy === "test" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Testing…
              </>
            ) : (
              "Test connection"
            )}
          </Button>
        )}
        {hasExisting && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy !== null || isRotating}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === "delete" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Remove
          </Button>
        )}
        {hasExisting && config.lastVerifiedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Last verified{" "}
            {new Date(config.lastVerifiedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function AiStatusBadge({
  status,
}: {
  status: "active" | "verifying" | "invalid" | "rotating";
}) {
  const styles: Record<typeof status, string> = {
    active:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    verifying:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    invalid: "bg-destructive/10 text-destructive border-destructive/30",
    rotating:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  };
  const label: Record<typeof status, string> = {
    active: "Active",
    verifying: "Verifying",
    invalid: "Invalid",
    rotating: "Rotating",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        styles[status],
      )}
    >
      {label[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Danger Zone                                                        */
/* ------------------------------------------------------------------ */

function DangerZoneSection({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const removeProject = useMutation(api.cms.projects.remove);
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
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle className="size-4 text-destructive" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-destructive">
            Danger Zone
          </h2>
          <p className="text-xs text-muted-foreground">
            Irreversible and destructive actions
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4">
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SettingsSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-border/40 bg-muted/20 p-4 pt-6">
        <Skeleton className="mb-1 ml-3 h-6 w-20" />
        <Skeleton className="mb-5 ml-3 h-3 w-28" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-xl space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
